import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GitCommandOptions } from '../utils/types';

// Promisify exec
const execAsync = promisify(exec);

/**
 * Register the git command to the CLI program
 */
export function gitCommand(program: Command): void {
  const git = program
    .command('git')
    .description('Perform git operations')
    .action(() => {
      console.log(chalk.yellow('Please specify a git subcommand. Use --help for details.'));
    });
  
  // Add git subcommands
  git
    .command('status')
    .description('Show the working tree status')
    .action(async () => {
      await gitStatus();
    });
  
  git
    .command('commit')
    .description('Record changes to the repository')
    .option('-m, --message <message>', 'Commit message')
    .option('-a, --all', 'Automatically stage modified and deleted files', false)
    .option('-i, --interactive', 'Use interactive mode to choose files', false)
    .action(async (options) => {
      await gitCommit(options);
    });
  
  git
    .command('push')
    .description('Update remote refs along with associated objects')
    .option('-b, --branch <branch>', 'The branch to push to')
    .option('-f, --force', 'Force push', false)
    .action(async (options) => {
      await gitPush(options);
    });
    
  git
    .command('pull')
    .description('Fetch from and integrate with another repository or a local branch')
    .option('-b, --branch <branch>', 'The branch to pull from')
    .option('-r, --rebase', 'Rebase instead of merge', false)
    .action(async (options) => {
      await gitPull(options);
    });
}

/**
 * Execute a git command
 */
async function executeGitCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(`git ${command}`);
  } catch (error) {
    if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
      return {
        stdout: String(error.stdout || ''),
        stderr: String(error.stderr || ''),
      };
    }
    throw error;
  }
}

/**
 * Show git status
 */
async function gitStatus(): Promise<void> {
  const spinner = ora('Checking git status...').start();
  
  try {
    const { stdout, stderr } = await executeGitCommand('status');
    
    if (stderr) {
      spinner.fail(`Git status failed: ${stderr}`);
      return;
    }
    
    spinner.succeed('Git status retrieved successfully.');
    
    // Display formatted status
    const lines = stdout.split('\n');
    
    // Branch info is usually in the first line
    const branchLine = lines.find(line => line.includes('On branch'));
    if (branchLine) {
      console.log(chalk.cyan(`\n${branchLine}`));
    }
    
    // Check for tracking info
    const trackingLine = lines.find(line => line.includes('Your branch is'));
    if (trackingLine) {
      console.log(chalk.gray(trackingLine));
    }
    
    // Check for changes
    if (stdout.includes('nothing to commit, working tree clean')) {
      console.log(chalk.green('\nWorking tree clean. No changes to commit.'));
      return;
    }
    
    // Display changes
    console.log('\nChanges:');
    
    let section = '';
    for (const line of lines) {
      if (line.includes('Changes to be committed:')) {
        section = 'staged';
        console.log(chalk.green('\nChanges to be committed:'));
      } else if (line.includes('Changes not staged for commit:')) {
        section = 'unstaged';
        console.log(chalk.red('\nChanges not staged for commit:'));
      } else if (line.includes('Untracked files:')) {
        section = 'untracked';
        console.log(chalk.red('\nUntracked files:'));
      } else if (line.trim().startsWith('modified:') || 
                line.trim().startsWith('new file:') || 
                line.trim().startsWith('deleted:')) {
        const prefix = section === 'staged' ? chalk.green('✓') : chalk.red('!');
        console.log(`  ${prefix} ${line.trim()}`);
      } else if (section === 'untracked' && line.trim() && !line.includes(':')) {
        console.log(`  ${chalk.red('?')} ${line.trim()}`);
      }
    }
  } catch (error) {
    spinner.fail(`Failed to get git status: ${error}`);
  }
}

/**
 * Commit changes
 */
async function gitCommit(options: { message?: string; all?: boolean; interactive?: boolean }): Promise<void> {
  let message = options.message;
  let filesToAdd: string[] = [];
  
  try {
    // Get current status
    const { stdout: statusOutput } = await executeGitCommand('status --porcelain');
    const hasChanges = statusOutput.trim() !== '';
    
    if (!hasChanges) {
      console.log(chalk.yellow('No changes to commit. Working tree clean.'));
      return;
    }
    
    // Interactive mode to select files
    if (options.interactive) {
      const files = statusOutput
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          const status = line.substring(0, 2);
          const file = line.substring(3);
          return { status, file };
        });
      
      const { selectedFiles } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedFiles',
          message: 'Select files to stage:',
          choices: files.map(({ status, file }) => ({
            name: `[${status}] ${file}`,
            value: file,
            checked: status.trim() !== '??', // Check all but untracked
          })),
        },
      ]);
      
      filesToAdd = selectedFiles;
      
      if (filesToAdd.length === 0) {
        console.log(chalk.yellow('No files selected for commit.'));
        return;
      }
    }
    
    // Get commit message if not provided
    if (!message) {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'commitMessage',
          message: 'Enter commit message:',
          validate: (input) => input.trim() !== '' ? true : 'Commit message cannot be empty.',
        },
      ]);
      
      message = response.commitMessage;
    }
    
    // Start spinner
    const spinner = ora('Committing changes...').start();
    
    // Add files based on options
    if (options.interactive && filesToAdd.length > 0) {
      for (const file of filesToAdd) {
        await executeGitCommand(`add "${file}"`);
      }
    } else if (options.all) {
      await executeGitCommand('add -A');
    }
    
    // Commit changes
    const { stdout, stderr } = await executeGitCommand(`commit -m "${message}"`);
    
    if (stderr && !stderr.includes('create mode')) {
      spinner.fail(`Commit failed: ${stderr}`);
      return;
    }
    
    if (stdout.includes('nothing to commit')) {
      spinner.warn('Commit created, but no files changed.');
    } else {
      spinner.succeed(`Committed changes with message: "${message}"`);
    }
  } catch (error) {
    console.error(chalk.red(`Failed to commit: ${error}`));
  }
}

/**
 * Push changes
 */
async function gitPush(options: { branch?: string; force?: boolean }): Promise<void> {
  const spinner = ora('Pushing changes...').start();
  
  try {
    // Get current branch if not specified
    let branch = options.branch;
    if (!branch) {
      const { stdout } = await executeGitCommand('rev-parse --abbrev-ref HEAD');
      branch = stdout.trim();
    }
    
    // Build push command
    let pushCommand = `push origin ${branch}`;
    if (options.force) {
      pushCommand += ' --force';
      spinner.text = `Force pushing to origin/${branch}...`;
    } else {
      spinner.text = `Pushing to origin/${branch}...`;
    }
    
    // Execute push
    const { stdout, stderr } = await executeGitCommand(pushCommand);
    
    if (stderr && stderr.includes('error:')) {
      spinner.fail(`Push failed: ${stderr}`);
      return;
    }
    
    spinner.succeed(`Successfully pushed to origin/${branch}.`);
  } catch (error) {
    spinner.fail(`Failed to push changes: ${error}`);
    
    if (error instanceof Error && error.message.includes('rejected')) {
      console.log(chalk.yellow('\nHint: Use --force to force push, but be careful as this can overwrite remote changes.'));
    }
  }
}

/**
 * Pull changes
 */
async function gitPull(options: { branch?: string; rebase?: boolean }): Promise<void> {
  const spinner = ora('Pulling changes...').start();
  
  try {
    // Get current branch if not specified
    let branch = options.branch;
    if (!branch) {
      const { stdout } = await executeGitCommand('rev-parse --abbrev-ref HEAD');
      branch = stdout.trim();
    }
    
    // Build pull command
    let pullCommand = `pull origin ${branch}`;
    if (options.rebase) {
      pullCommand += ' --rebase';
      spinner.text = `Pulling with rebase from origin/${branch}...`;
    } else {
      spinner.text = `Pulling from origin/${branch}...`;
    }
    
    // Execute pull
    const { stdout, stderr } = await executeGitCommand(pullCommand);
    
    if (stderr && stderr.includes('error:')) {
      spinner.fail(`Pull failed: ${stderr}`);
      return;
    }
    
    spinner.succeed(`Successfully pulled from origin/${branch}.`);
  } catch (error) {
    spinner.fail(`Failed to pull changes: ${error}`);
    
    if (error instanceof Error) {
      if (error.message.includes('conflict')) {
        console.log(chalk.yellow('\nThere are conflicts that need to be resolved manually.'));
      } else if (error.message.includes('local changes')) {
        console.log(chalk.yellow('\nYou have local changes that would be overwritten by pull. Commit or stash them first.'));
      }
    }
  }
} 