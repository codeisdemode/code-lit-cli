import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

export function backendCommand(program: Command): void {
  program
    .command('backend')
    .description('Setup and run a Node.js backend')
    .option('-s, --setup <type>', 'Setup a new backend (express, koa, fastify, nestjs)')
    .option('-p, --port <number>', 'Port to run the server on (default: 3000)')
    .option('-d, --dev', 'Run in development mode with hot-reloading')
    .option('-b, --build', 'Build the backend for production')
    .option('-r, --run', 'Run the backend server')
    .option('-t, --test', 'Run backend tests')
    .action(async (options) => {
      if (options.setup) {
        await setupBackend(options.setup, options);
      } else if (options.build) {
        await buildBackend(options);
      } else if (options.run) {
        await runBackend(options);
      } else if (options.test) {
        await testBackend(options);
      } else if (options.dev) {
        await devBackend(options);
      } else {
        // Show help if no option is provided
        console.log(`
${chalk.bold('Code-lit Backend Commands')}

Setup a new backend:
  ${chalk.blue('code-lit backend --setup express')}
  ${chalk.blue('code-lit backend --setup nestjs')}

Run in development mode:
  ${chalk.blue('code-lit backend --dev')}

Build for production:
  ${chalk.blue('code-lit backend --build')}

Run the backend:
  ${chalk.blue('code-lit backend --run')}

Run tests:
  ${chalk.blue('code-lit backend --test')}
        `);
      }
    });
}

async function setupBackend(type: string, options: any): Promise<void> {
  const supportedTypes = ['express', 'koa', 'fastify', 'nestjs'];
  
  if (!supportedTypes.includes(type)) {
    console.error(`Unsupported backend type: ${type}`);
    console.log(`Supported types: ${supportedTypes.join(', ')}`);
    return;
  }
  
  // Prompt for configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'backend-app'
    },
    {
      type: 'input',
      name: 'port',
      message: 'Port number:',
      default: options.port || '3000',
      validate: (input) => {
        const port = parseInt(input, 10);
        return (port > 0 && port < 65536) ? true : 'Please enter a valid port number';
      }
    },
    {
      type: 'confirm',
      name: 'typescript',
      message: 'Use TypeScript?',
      default: true
    },
    {
      type: 'confirm',
      name: 'database',
      message: 'Setup a database connection?',
      default: false
    },
    {
      type: 'list',
      name: 'dbType',
      message: 'Database type:',
      choices: ['mongodb', 'mysql', 'postgresql', 'sqlite'],
      when: (answers) => answers.database
    }
  ]);
  
  const spinner = ora(`Setting up ${type} backend...`).start();
  
  try {
    // Create project directory if it doesn't exist
    if (!fs.existsSync(answers.name)) {
      fs.mkdirSync(answers.name, { recursive: true });
    }
    
    // Save configuration
    const config = {
      name: answers.name,
      port: parseInt(answers.port, 10),
      type,
      typescript: answers.typescript,
      database: answers.database ? answers.dbType : null
    };
    
    // Change to the project directory
    process.chdir(answers.name);
    
    // Initialize package.json
    execSync('npm init -y', { stdio: 'ignore' });
    
    // Install dependencies based on backend type
    spinner.text = 'Installing dependencies...';
    let dependencies: string[] = [];
    let devDependencies: string[] = [];
    
    if (type === 'express') {
      dependencies = ['express', 'cors', 'helmet', 'morgan'];
      if (answers.typescript) {
        devDependencies = ['typescript', '@types/express', '@types/cors', '@types/morgan', 'ts-node', 'nodemon'];
      } else {
        devDependencies = ['nodemon'];
      }
    } else if (type === 'koa') {
      dependencies = ['koa', '@koa/router', '@koa/cors', 'koa-helmet', 'koa-logger', 'koa-bodyparser'];
      if (answers.typescript) {
        devDependencies = ['typescript', '@types/koa', '@types/koa__router', '@types/koa-bodyparser', 'ts-node', 'nodemon'];
      } else {
        devDependencies = ['nodemon'];
      }
    } else if (type === 'fastify') {
      dependencies = ['fastify', '@fastify/cors', '@fastify/helmet'];
      if (answers.typescript) {
        devDependencies = ['typescript', '@types/node', 'ts-node', 'nodemon'];
      } else {
        devDependencies = ['nodemon'];
      }
    } else if (type === 'nestjs') {
      // Use NestJS CLI to bootstrap the project
      execSync('npm i -g @nestjs/cli', { stdio: 'ignore' });
      execSync(`nest new . --package-manager npm --skip-git --skip-install`, { stdio: 'ignore' });
      
      // NestJS already sets up TypeScript and basic dependencies
      dependencies = [];
      devDependencies = [];
    }
    
    // Install dependencies
    if (dependencies.length > 0) {
      execSync(`npm install ${dependencies.join(' ')}`, { stdio: 'ignore' });
    }
    
    if (devDependencies.length > 0) {
      execSync(`npm install --save-dev ${devDependencies.join(' ')}`, { stdio: 'ignore' });
    }
    
    // Setup database if selected
    if (answers.database) {
      spinner.text = 'Setting up database connection...';
      
      // Install database dependencies
      const dbDependencies: string[] = [];
      
      if (answers.dbType === 'mongodb') {
        dbDependencies.push('mongoose');
      } else if (answers.dbType === 'mysql') {
        dbDependencies.push('mysql2', 'sequelize');
      } else if (answers.dbType === 'postgresql') {
        dbDependencies.push('pg', 'pg-hstore', 'sequelize');
      } else if (answers.dbType === 'sqlite') {
        dbDependencies.push('sqlite3', 'sequelize');
      }
      
      if (dbDependencies.length > 0) {
        execSync(`npm install ${dbDependencies.join(' ')}`, { stdio: 'ignore' });
      }
      
      // Create database connection files
      createDatabaseFiles(answers.dbType, answers.typescript);
    }
    
    // Create project structure and files
    spinner.text = 'Creating project structure...';
    createProjectStructure(type, answers.typescript, config);
    
    // Update package.json with scripts
    updatePackageJson(answers.typescript, type);
    
    // Setup TypeScript if selected
    if (answers.typescript && type !== 'nestjs') {
      setupTypeScript();
    }
    
    spinner.succeed(`${chalk.green(type)} backend setup complete!`);
    
    console.log(`\nProject created in ${chalk.blue(answers.name)} directory`);
    console.log(`\nTo start the development server:`);
    console.log(`  ${chalk.green('cd')} ${answers.name}`);
    console.log(`  ${chalk.green('code-lit backend --dev')}`);
  } catch (error) {
    spinner.fail(`Failed to set up backend: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createDatabaseFiles(dbType: string, useTypeScript: boolean): void {
  const ext = useTypeScript ? 'ts' : 'js';
  const srcDir = 'src';
  const modelsDir = path.join(srcDir, 'models');
  
  // Create directories
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }
  
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  
  // Create database connection file
  let dbContent = '';
  
  if (dbType === 'mongodb') {
    if (useTypeScript) {
      dbContent = `import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myapp');
    console.log(\`MongoDB Connected: \${conn.connection.host}\`);
  } catch (error) {
    console.error(\`Error: \${error.message}\`);
    process.exit(1);
  }
};

export default connectDB;
`;
    } else {
      dbContent = `const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myapp');
    console.log(\`MongoDB Connected: \${conn.connection.host}\`);
  } catch (error) {
    console.error(\`Error: \${error.message}\`);
    process.exit(1);
  }
};

module.exports = connectDB;
`;
    }
  } else {
    // SQL databases (MySQL, PostgreSQL, SQLite)
    if (useTypeScript) {
      dbContent = `import { Sequelize } from 'sequelize';

const dbName = process.env.DB_NAME || 'myapp';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  dialect: '${dbType === 'sqlite' ? 'sqlite' : dbType === 'mysql' ? 'mysql' : 'postgres'}',
  ${dbType === 'sqlite' ? "storage: './database.sqlite'," : ""}
  logging: false,
});

const connectDB = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

export { sequelize, connectDB };
`;
    } else {
      dbContent = `const { Sequelize } = require('sequelize');

const dbName = process.env.DB_NAME || 'myapp';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbHost = process.env.DB_HOST || 'localhost';

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  dialect: '${dbType === 'sqlite' ? 'sqlite' : dbType === 'mysql' ? 'mysql' : 'postgres'}',
  ${dbType === 'sqlite' ? "storage: './database.sqlite'," : ""}
  logging: false,
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
`;
    }
  }
  
  fs.writeFileSync(path.join(srcDir, `db.${ext}`), dbContent);
  
  // Create example model
  let modelContent = '';
  
  if (dbType === 'mongodb') {
    if (useTypeScript) {
      modelContent = `import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: {
    type: String,
    required: true
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

export default mongoose.model<IUser>('User', UserSchema);
`;
    } else {
      modelContent = `const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
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

module.exports = mongoose.model('User', UserSchema);
`;
    }
  } else {
    // SQL databases (MySQL, PostgreSQL, SQLite)
    if (useTypeScript) {
      modelContent = `import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../db';

interface UserAttributes {
  id?: number;
  name: string;
  email: string;
  password: string;
}

class User extends Model<UserAttributes> implements UserAttributes {
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
  }
);

export default User;
`;
    } else {
      modelContent = `const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../db');

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'users',
  }
);

module.exports = User;
`;
    }
  }
  
  fs.writeFileSync(path.join(modelsDir, `User.${ext}`), modelContent);
}

function createProjectStructure(type: string, useTypeScript: boolean, config: any): void {
  const ext = useTypeScript ? 'ts' : 'js';
  const srcDir = 'src';
  
  // Create basic directory structure
  const directories = [
    srcDir,
    path.join(srcDir, 'routes'),
    path.join(srcDir, 'controllers'),
    path.join(srcDir, 'middleware'),
    path.join(srcDir, 'utils')
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Create main server file
  let serverContent = '';
  
  if (type === 'express') {
    if (useTypeScript) {
      serverContent = `import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
${config.database ? "import connectDB from './db';" : ""}

const app: Application = express();
const PORT = process.env.PORT || ${config.port};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

${config.database ? "// Connect to database\nconnectDB();" : ""}

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the API' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

export default app;
`;
    } else {
      serverContent = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
${config.database ? "const connectDB = require('./db');" : ""}

const app = express();
const PORT = process.env.PORT || ${config.port};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

${config.database ? "// Connect to database\nconnectDB();" : ""}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

module.exports = app;
`;
    }
  } else if (type === 'koa') {
    if (useTypeScript) {
      serverContent = `import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import helmet from 'koa-helmet';
import logger from 'koa-logger';
import bodyParser from 'koa-bodyparser';
${config.database ? "import { connectDB } from './db';" : ""}

const app = new Koa();
const router = new Router();
const PORT = process.env.PORT || ${config.port};

// Middleware
app.use(bodyParser());
app.use(cors());
app.use(helmet());
app.use(logger());

${config.database ? "// Connect to database\nconnectDB();" : ""}

// Routes
router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to the API' };
});

// Register router
app.use(router.routes()).use(router.allowedMethods());

// Error handling
app.on('error', (err, ctx) => {
  console.error('Server error:', err);
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

export default app;
`;
    } else {
      serverContent = `const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const helmet = require('koa-helmet');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
${config.database ? "const { connectDB } = require('./db');" : ""}

const app = new Koa();
const router = new Router();
const PORT = process.env.PORT || ${config.port};

// Middleware
app.use(bodyParser());
app.use(cors());
app.use(helmet());
app.use(logger());

${config.database ? "// Connect to database\nconnectDB();" : ""}

// Routes
router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to the API' };
});

// Register router
app.use(router.routes()).use(router.allowedMethods());

// Error handling
app.on('error', (err, ctx) => {
  console.error('Server error:', err);
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

module.exports = app;
`;
    }
  } else if (type === 'fastify') {
    if (useTypeScript) {
      serverContent = `import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
${config.database ? "import { connectDB } from './db';" : ""}

const fastify = Fastify({
  logger: true
});
const PORT = process.env.PORT || ${config.port};

// Register plugins
fastify.register(cors);
fastify.register(helmet);

${config.database ? "// Connect to database\nconnectDB();" : ""}

// Routes
fastify.get('/', async (request, reply) => {
  return { message: 'Welcome to the API' };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({ message: 'Something went wrong!' });
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT as number, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
`;
    } else {
      serverContent = `const fastify = require('fastify')({
  logger: true
});
const cors = require('@fastify/cors');
const helmet = require('@fastify/helmet');
${config.database ? "const { connectDB } = require('./db');" : ""}

const PORT = process.env.PORT || ${config.port};

// Register plugins
fastify.register(cors);
fastify.register(helmet);

${config.database ? "// Connect to database\nconnectDB();" : ""}

// Routes
fastify.get('/', async (request, reply) => {
  return { message: 'Welcome to the API' };
});

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({ message: 'Something went wrong!' });
});

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

module.exports = fastify;
`;
    }
  }
  
  if (type !== 'nestjs') {
    fs.writeFileSync(path.join(srcDir, `index.${ext}`), serverContent);
  }
  
  // Create example route
  if (type !== 'nestjs' && type !== 'fastify') {
    let routeContent = '';
    
    if (type === 'express') {
      if (useTypeScript) {
        routeContent = `import express, { Router, Request, Response } from 'express';

const router: Router = express.Router();

// @route   GET api/users
// @desc    Get all users
// @access  Public
router.get('/', async (req: Request, res: Response) => {
  try {
    res.json({ message: 'Users route' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

export default router;
`;
      } else {
        routeContent = `const express = require('express');
const router = express.Router();

// @route   GET api/users
// @desc    Get all users
// @access  Public
router.get('/', async (req, res) => {
  try {
    res.json({ message: 'Users route' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
`;
      }
    } else if (type === 'koa') {
      if (useTypeScript) {
        routeContent = `import Router from '@koa/router';

const router = new Router({
  prefix: '/api/users'
});

// @route   GET api/users
// @desc    Get all users
// @access  Public
router.get('/', async (ctx) => {
  try {
    ctx.body = { message: 'Users route' };
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { message: 'Server Error' };
  }
});

export default router;
`;
      } else {
        routeContent = `const Router = require('@koa/router');

const router = new Router({
  prefix: '/api/users'
});

// @route   GET api/users
// @desc    Get all users
// @access  Public
router.get('/', async (ctx) => {
  try {
    ctx.body = { message: 'Users route' };
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { message: 'Server Error' };
  }
});

module.exports = router;
`;
      }
    }
    
    fs.writeFileSync(path.join(srcDir, 'routes', `users.${ext}`), routeContent);
  }
  
  // Create .env file with sample environment variables
  const envContent = `NODE_ENV=development
PORT=${config.port}
${config.database ? getDatabaseEnvVars(config.database) : ''}
`;
  
  fs.writeFileSync('.env', envContent);
  
  // Create .gitignore file
  const gitignoreContent = `node_modules/
.env
dist/
build/
coverage/
.DS_Store
npm-debug.log
yarn-debug.log
yarn-error.log
*.log
`;
  
  fs.writeFileSync('.gitignore', gitignoreContent);
  
  // Create README.md
  const readmeContent = `# ${config.name}

A ${type} backend application.

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Production

\`\`\`bash
npm run build
npm start
\`\`\`

## API Endpoints

- GET / - Welcome message
${type !== 'nestjs' && type !== 'fastify' ? '- GET /api/users - Users endpoint' : ''}
`;
  
  fs.writeFileSync('README.md', readmeContent);
}

function getDatabaseEnvVars(dbType: string): string {
  if (dbType === 'mongodb') {
    return 'MONGO_URI=mongodb://localhost:27017/myapp';
  } else {
    return `DB_NAME=myapp
DB_USER=root
DB_PASSWORD=
DB_HOST=localhost`;
  }
}

function updatePackageJson(useTypeScript: boolean, type: string): void {
  const packageJsonPath = 'package.json';
  
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  if (type === 'nestjs') {
    // NestJS already sets up the scripts
    return;
  }
  
  // Update scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    start: useTypeScript ? 'node dist/index.js' : 'node src/index.js',
    dev: useTypeScript 
      ? 'nodemon --exec ts-node src/index.ts' 
      : 'nodemon src/index.js',
    build: useTypeScript ? 'tsc' : 'echo "No build step required"',
    test: 'echo "No tests specified" && exit 0'
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function setupTypeScript(): void {
  // Create tsconfig.json
  const tsconfigContent = {
    compilerOptions: {
      target: 'es2018',
      module: 'commonjs',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  };
  
  fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfigContent, null, 2));
}

async function buildBackend(options: any): Promise<void> {
  const spinner = ora('Building backend for production...').start();
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    spinner.succeed('Backend built successfully');
  } catch (error) {
    spinner.fail(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runBackend(options: any): Promise<void> {
  console.log(chalk.blue('Starting backend server...'));
  
  try {
    const port = options.port || 3000;
    process.env.PORT = port.toString();
    
    const child = spawn('npm', ['start'], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('error', (error) => {
      console.error(`Error starting server: ${error.message}`);
    });
    
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nGracefully shutting down server...'));
      child.kill('SIGINT');
      process.exit(0);
    });
  } catch (error) {
    console.error(`Failed to run backend: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function devBackend(options: any): Promise<void> {
  console.log(chalk.blue('Starting backend in development mode...'));
  
  try {
    const port = options.port || 3000;
    process.env.PORT = port.toString();
    
    const child = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('error', (error) => {
      console.error(`Error starting development server: ${error.message}`);
    });
    
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nGracefully shutting down server...'));
      child.kill('SIGINT');
      process.exit(0);
    });
  } catch (error) {
    console.error(`Failed to run backend in development mode: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function testBackend(options: any): Promise<void> {
  const spinner = ora('Running tests...').start();
  
  try {
    execSync('npm test', { stdio: 'inherit' });
    spinner.succeed('Tests completed');
  } catch (error) {
    spinner.fail(`Tests failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 