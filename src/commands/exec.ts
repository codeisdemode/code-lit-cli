import { Command } from 'commander';
import chalk from 'chalk';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import ora from 'ora';
import { ExecCommandOptions } from '../utils/types';

// Promisify exec
const execAsync = promisify(exec);

/**
 * Register the exec command to the CLI program
 */
export function execCommand(program: Command): void {
  program
    .command('exec <command>')
    .description('Execute a command in the terminal')
    .option('-d, --cwd <directory>', 'Working directory to run the command in')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '300000')
    .option('-s, --silent', 'Run in silent mode (no output)', false)
    .option('-e, --env <keyValue>', 'Environment variables in format KEY=VALUE', collectEnvVars, {})
    .option('-i, --interactive', 'Run in interactive mode (use for commands requiring input)', false)
    .action(async (command, options) => {
      await executeCommand(command, options);
    });
}

/**
 * Helper to collect environment variables
 */
function collectEnvVars(value: string, previous: Record<string, string> = {}): Record<string, string> {
  const [key, val] = value.split('=');
  if (key && val) {
    return { ...previous, [key]: val };
  }
  return previous;
}

/**
 * Execute a command
 */
async function executeCommand(
  command: string, 
  options: ExecCommandOptions & { 
    interactive?: boolean; 
    env?: Record<string, string>;
    timeout?: string;
  }
): Promise<void> {
  // Parse timeout
  const timeout = parseInt(options.timeout || '300000', 10);
  
  // Check for potentially dangerous commands
  const dangerousCommands = ['rm -rf /', 'dd if=/dev/zero', ':(){:|:&};:'];
  if (dangerousCommands.some(cmd => command.includes(cmd))) {
    console.error(chalk.red('Error: Potentially dangerous command detected.'));
    console.error(chalk.yellow('For safety reasons, this command will not be executed.'));
    return;
  }
  
  if (options.interactive) {
    // Use spawn for interactive commands
    console.log(chalk.blue(`\nExecuting command: ${command}`));
    console.log(chalk.gray('Interactive mode: Press Ctrl+C to terminate.\n'));
    
    const [cmd, ...args] = command.split(' ');
    
    // Create environment variables
    const env = { ...process.env, ...(options.env || {}) };
    
    // Spawn the process
    const childProcess = spawn(cmd, args, {
      cwd: options.cwd || process.cwd(),
      env,
      stdio: 'inherit',
      shell: true,
    });
    
    return new Promise((resolve, reject) => {
      childProcess.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('\nCommand completed successfully.'));
          resolve();
        } else {
          console.error(chalk.red(`\nCommand failed with exit code ${code}.`));
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });
      
      childProcess.on('error', (error) => {
        console.error(chalk.red(`\nCommand failed: ${error.message}`));
        reject(error);
      });
    });
  } else {
    // Use exec for non-interactive commands
    const spinner = ora(`Executing command: ${command}`).start();
    
    try {
      // Create environment variables
      const env = { ...process.env, ...(options.env || {}) };
      
      // Execute the command
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.cwd || process.cwd(),
        env,
        timeout,
      });
      
      // Handle command output
      if (stderr && stderr.trim() !== '') {
        spinner.warn(`Command completed with warnings.`);
        if (!options.silent) {
          console.error(chalk.yellow('\nStderr:'));
          console.error(stderr);
        }
      } else {
        spinner.succeed('Command completed successfully.');
      }
      
      // Show stdout
      if (stdout && stdout.trim() !== '' && !options.silent) {
        console.log(chalk.cyan('\nOutput:'));
        console.log(stdout);
      }
    } catch (error) {
      spinner.fail(`Command failed: ${error}`);
      
      if (!options.silent && error instanceof Error) {
        if ('stdout' in error && error.stdout) {
          console.log(chalk.cyan('\nOutput:'));
          console.log(error.stdout);
        }
        
        if ('stderr' in error && error.stderr) {
          console.error(chalk.yellow('\nStderr:'));
          console.error(error.stderr);
        }
      }
    }
  }
} 