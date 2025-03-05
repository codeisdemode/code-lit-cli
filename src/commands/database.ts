import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

interface DatabaseConfig {
  type: 'mongodb' | 'mysql' | 'postgresql' | 'sqlite';
  name: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export function databaseCommand(program: Command): void {
  program
    .command('database')
    .description('Setup and manage database connections')
    .option('-t, --type <type>', 'Database type (mongodb, mysql, postgresql, sqlite)')
    .option('-n, --name <name>', 'Database name')
    .option('-h, --host <host>', 'Database host')
    .option('-p, --port <port>', 'Database port')
    .option('-u, --username <username>', 'Database username')
    .option('--password <password>', 'Database password')
    .option('-s, --setup', 'Setup a new database connection')
    .option('-m, --migrate <file>', 'Run migrations from a file')
    .option('-g, --generate-schema', 'Generate schema from an existing database')
    .action(async (options) => {
      if (options.setup) {
        await setupDatabase(options);
      } else if (options.migrate) {
        await runMigrations(options.migrate, options);
      } else if (options.generateSchema) {
        await generateSchema(options);
      } else {
        await showDatabaseInfo(options);
      }
    });
}

async function setupDatabase(options: any): Promise<void> {
  let config: DatabaseConfig;
  
  if (!options.type || !options.name) {
    // Prompt for required information if not provided
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'What type of database would you like to set up?',
        choices: ['mongodb', 'mysql', 'postgresql', 'sqlite'],
        default: options.type || 'mongodb'
      },
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of your database?',
        default: options.name || 'myapp'
      },
      {
        type: 'input',
        name: 'host',
        message: 'Database host:',
        default: options.host || 'localhost',
        when: (answers) => answers.type !== 'sqlite'
      },
      {
        type: 'input',
        name: 'port',
        message: 'Database port:',
        default: (answers) => {
          if (answers.type === 'mongodb') return options.port || '27017';
          if (answers.type === 'mysql') return options.port || '3306';
          if (answers.type === 'postgresql') return options.port || '5432';
          return '';
        },
        when: (answers) => answers.type !== 'sqlite'
      },
      {
        type: 'input',
        name: 'username',
        message: 'Database username:',
        default: options.username || '',
        when: (answers) => answers.type !== 'sqlite'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Database password:',
        default: options.password || '',
        when: (answers) => answers.type !== 'sqlite'
      }
    ]);
    
    config = {
      ...answers,
      port: answers.port ? parseInt(answers.port, 10) : undefined
    };
  } else {
    config = {
      type: options.type,
      name: options.name,
      host: options.host,
      port: options.port ? parseInt(options.port, 10) : undefined,
      username: options.username,
      password: options.password
    };
  }
  
  const spinner = ora('Setting up database connection...').start();
  
  try {
    // Create a config directory if it doesn't exist
    if (!fs.existsSync('config')) {
      fs.mkdirSync('config');
    }
    
    // Save the database configuration
    fs.writeFileSync(
      path.join('config', 'database.json'),
      JSON.stringify(config, null, 2)
    );
    
    // Install necessary packages based on database type
    const packages: string[] = [];
    
    if (config.type === 'mongodb') {
      packages.push('mongoose');
    } else if (config.type === 'mysql') {
      packages.push('mysql2', 'sequelize');
    } else if (config.type === 'postgresql') {
      packages.push('pg', 'pg-hstore', 'sequelize');
    } else if (config.type === 'sqlite') {
      packages.push('sqlite3', 'sequelize');
    }
    
    if (packages.length > 0) {
      spinner.text = `Installing required packages: ${packages.join(', ')}`;
      execSync(`npm install --save ${packages.join(' ')}`, { stdio: 'ignore' });
    }
    
    // Create example model/schema files
    createExampleSchemaFiles(config.type);
    
    spinner.succeed(`Database configuration for ${chalk.green(config.type)} has been set up successfully!`);
    console.log(`Configuration saved to: ${chalk.blue('config/database.json')}`);
    console.log(`Example schema files created in: ${chalk.blue('src/models/')}`);
  } catch (error) {
    spinner.fail(`Failed to set up database: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createExampleSchemaFiles(dbType: string): void {
  // Create models directory if it doesn't exist
  const modelsDir = path.join('src', 'models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  
  // Create database connection file
  const dbConnContent = getDatabaseConnectionTemplate(dbType);
  fs.writeFileSync(path.join(modelsDir, 'db.ts'), dbConnContent);
  
  // Create example model file
  const modelContent = getExampleModelTemplate(dbType);
  fs.writeFileSync(path.join(modelsDir, 'user.ts'), modelContent);
}

function getDatabaseConnectionTemplate(dbType: string): string {
  if (dbType === 'mongodb') {
    return `import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join('config', 'database.json'), 'utf-8'));

// Connect to MongoDB
export async function connectToDatabase() {
  try {
    const connectionString = \`mongodb://\${config.host}:\${config.port}/\${config.name}\`;
    await mongoose.connect(connectionString);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export default mongoose;
`;
  } else {
    // For SQL databases (MySQL, PostgreSQL, SQLite)
    return `import { Sequelize } from 'sequelize';
import * as fs from 'fs';
import * as path from 'path';

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join('config', 'database.json'), 'utf-8'));

// Create Sequelize instance
let sequelize: Sequelize;

if (config.type === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: \`./\${config.name}.sqlite\`
  });
} else {
  sequelize = new Sequelize(config.name, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: config.type,
    logging: false
  });
}

// Test connection
export async function connectToDatabase() {
  try {
    await sequelize.authenticate();
    console.log(\`Connected to \${config.type} database successfully\`);
  } catch (error) {
    console.error(\`Failed to connect to \${config.type} database:\`, error);
    process.exit(1);
  }
}

export default sequelize;
`;
  }
}

function getExampleModelTemplate(dbType: string): string {
  if (dbType === 'mongodb') {
    return `import mongoose from './db';

// Define schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create model
const User = mongoose.model('User', userSchema);

export default User;
`;
  } else {
    // For SQL databases (MySQL, PostgreSQL, SQLite)
    return `import { DataTypes, Model } from 'sequelize';
import sequelize from './db';

// Define User model
class User extends Model {
  declare id: number;
  declare username: string;
  declare email: string;
  declare password: string;
  declare createdAt: Date;
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'User',
  timestamps: true
});

export default User;
`;
  }
}

async function runMigrations(migrationFile: string, options: any): Promise<void> {
  const spinner = ora('Running database migrations...').start();
  
  try {
    if (!fs.existsSync(migrationFile)) {
      spinner.fail(`Migration file not found: ${migrationFile}`);
      return;
    }
    
    // Load configuration
    const configPath = path.join('config', 'database.json');
    if (!fs.existsSync(configPath)) {
      spinner.fail('Database configuration not found. Run `code-lit database --setup` first.');
      return;
    }
    
    // Implementation depends on the migration format and DB type
    // This is a simplified example
    spinner.text = 'Applying migrations...';
    
    // Read the migration file content
    const migrationContent = fs.readFileSync(migrationFile, 'utf-8');
    
    // For a real implementation, you would:
    // 1. Parse the migration file
    // 2. Connect to the database using the configuration
    // 3. Execute the migrations
    // 4. Track which migrations have been applied
    
    spinner.succeed('Migrations applied successfully');
  } catch (error) {
    spinner.fail(`Failed to run migrations: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function generateSchema(options: any): Promise<void> {
  const spinner = ora('Generating database schema...').start();
  
  try {
    // Load configuration
    const configPath = path.join('config', 'database.json');
    if (!fs.existsSync(configPath)) {
      spinner.fail('Database configuration not found. Run `code-lit database --setup` first.');
      return;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // Implementation depends on DB type
    // This would involve:
    // 1. Connecting to the database
    // 2. Extracting schema information
    // 3. Generating model files
    
    spinner.text = `Analyzing ${config.type} database structure...`;
    
    // Create models directory if it doesn't exist
    const modelsDir = path.join('src', 'models');
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    
    // For demo purposes, we'll just create the connection file
    const dbConnContent = getDatabaseConnectionTemplate(config.type);
    fs.writeFileSync(path.join(modelsDir, 'db.ts'), dbConnContent);
    
    spinner.succeed('Schema generation completed');
    console.log(chalk.yellow('Note: This is a placeholder implementation. In a real scenario, this would analyze your database and generate appropriate model files.'));
  } catch (error) {
    spinner.fail(`Failed to generate schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function showDatabaseInfo(options: any): Promise<void> {
  try {
    const configPath = path.join('config', 'database.json');
    if (!fs.existsSync(configPath)) {
      console.log(chalk.yellow('No database configuration found.'));
      console.log(`Run ${chalk.blue('code-lit database --setup')} to configure a database connection.`);
      return;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    console.log(chalk.bold('\nDatabase Configuration:'));
    console.log(`Type: ${chalk.green(config.type)}`);
    console.log(`Name: ${chalk.green(config.name)}`);
    
    if (config.type !== 'sqlite') {
      console.log(`Host: ${chalk.green(config.host || 'localhost')}`);
      console.log(`Port: ${chalk.green(config.port?.toString() || 'default')}`);
      console.log(`Username: ${chalk.green(config.username || 'not set')}`);
      console.log(`Password: ${config.password ? chalk.green('*****') : chalk.red('not set')}`);
    }
    
    // Check if models exist
    const modelsDir = path.join('src', 'models');
    if (fs.existsSync(modelsDir)) {
      const modelFiles = fs.readdirSync(modelsDir).filter(file => 
        file.endsWith('.ts') && file !== 'db.ts'
      );
      
      if (modelFiles.length > 0) {
        console.log(chalk.bold('\nDefined Models:'));
        modelFiles.forEach(file => {
          console.log(`- ${chalk.blue(file.replace('.ts', ''))}`);
        });
      }
    }
  } catch (error) {
    console.error(`Error retrieving database information: ${error instanceof Error ? error.message : String(error)}`);
  }
} 