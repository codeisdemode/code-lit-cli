"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitCommand = gitCommand;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const inquirer_1 = __importDefault(require("inquirer"));
const child_process_1 = require("child_process");
const util_1 = require("util");
// Promisify exec
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Register the git command to the CLI program
 */
function gitCommand(program) {
    const git = program
        .command('git')
        .description('Perform git operations')
        .action(() => {
        console.log(chalk_1.default.yellow('Please specify a git subcommand. Use --help for details.'));
    });
    // Add git subcommands
    git
        .command('status')
        .description('Show the working tree status')
        .action(() => __awaiter(this, void 0, void 0, function* () {
        yield gitStatus();
    }));
    git
        .command('commit')
        .description('Record changes to the repository')
        .option('-m, --message <message>', 'Commit message')
        .option('-a, --all', 'Automatically stage modified and deleted files', false)
        .option('-i, --interactive', 'Use interactive mode to choose files', false)
        .action((options) => __awaiter(this, void 0, void 0, function* () {
        yield gitCommit(options);
    }));
    git
        .command('push')
        .description('Update remote refs along with associated objects')
        .option('-b, --branch <branch>', 'The branch to push to')
        .option('-f, --force', 'Force push', false)
        .action((options) => __awaiter(this, void 0, void 0, function* () {
        yield gitPush(options);
    }));
    git
        .command('pull')
        .description('Fetch from and integrate with another repository or a local branch')
        .option('-b, --branch <branch>', 'The branch to pull from')
        .option('-r, --rebase', 'Rebase instead of merge', false)
        .action((options) => __awaiter(this, void 0, void 0, function* () {
        yield gitPull(options);
    }));
}
/**
 * Execute a git command
 */
function executeGitCommand(command) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield execAsync(`git ${command}`);
        }
        catch (error) {
            if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
                return {
                    stdout: String(error.stdout || ''),
                    stderr: String(error.stderr || ''),
                };
            }
            throw error;
        }
    });
}
/**
 * Show git status
 */
function gitStatus() {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = (0, ora_1.default)('Checking git status...').start();
        try {
            const { stdout, stderr } = yield executeGitCommand('status');
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
                console.log(chalk_1.default.cyan(`\n${branchLine}`));
            }
            // Check for tracking info
            const trackingLine = lines.find(line => line.includes('Your branch is'));
            if (trackingLine) {
                console.log(chalk_1.default.gray(trackingLine));
            }
            // Check for changes
            if (stdout.includes('nothing to commit, working tree clean')) {
                console.log(chalk_1.default.green('\nWorking tree clean. No changes to commit.'));
                return;
            }
            // Display changes
            console.log('\nChanges:');
            let section = '';
            for (const line of lines) {
                if (line.includes('Changes to be committed:')) {
                    section = 'staged';
                    console.log(chalk_1.default.green('\nChanges to be committed:'));
                }
                else if (line.includes('Changes not staged for commit:')) {
                    section = 'unstaged';
                    console.log(chalk_1.default.red('\nChanges not staged for commit:'));
                }
                else if (line.includes('Untracked files:')) {
                    section = 'untracked';
                    console.log(chalk_1.default.red('\nUntracked files:'));
                }
                else if (line.trim().startsWith('modified:') ||
                    line.trim().startsWith('new file:') ||
                    line.trim().startsWith('deleted:')) {
                    const prefix = section === 'staged' ? chalk_1.default.green('✓') : chalk_1.default.red('!');
                    console.log(`  ${prefix} ${line.trim()}`);
                }
                else if (section === 'untracked' && line.trim() && !line.includes(':')) {
                    console.log(`  ${chalk_1.default.red('?')} ${line.trim()}`);
                }
            }
        }
        catch (error) {
            spinner.fail(`Failed to get git status: ${error}`);
        }
    });
}
/**
 * Commit changes
 */
function gitCommit(options) {
    return __awaiter(this, void 0, void 0, function* () {
        let message = options.message;
        let filesToAdd = [];
        try {
            // Get current status
            const { stdout: statusOutput } = yield executeGitCommand('status --porcelain');
            const hasChanges = statusOutput.trim() !== '';
            if (!hasChanges) {
                console.log(chalk_1.default.yellow('No changes to commit. Working tree clean.'));
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
                const { selectedFiles } = yield inquirer_1.default.prompt([
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
                    console.log(chalk_1.default.yellow('No files selected for commit.'));
                    return;
                }
            }
            // Get commit message if not provided
            if (!message) {
                const response = yield inquirer_1.default.prompt([
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
            const spinner = (0, ora_1.default)('Committing changes...').start();
            // Add files based on options
            if (options.interactive && filesToAdd.length > 0) {
                for (const file of filesToAdd) {
                    yield executeGitCommand(`add "${file}"`);
                }
            }
            else if (options.all) {
                yield executeGitCommand('add -A');
            }
            // Commit changes
            const { stdout, stderr } = yield executeGitCommand(`commit -m "${message}"`);
            if (stderr && !stderr.includes('create mode')) {
                spinner.fail(`Commit failed: ${stderr}`);
                return;
            }
            if (stdout.includes('nothing to commit')) {
                spinner.warn('Commit created, but no files changed.');
            }
            else {
                spinner.succeed(`Committed changes with message: "${message}"`);
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`Failed to commit: ${error}`));
        }
    });
}
/**
 * Push changes
 */
function gitPush(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = (0, ora_1.default)('Pushing changes...').start();
        try {
            // Get current branch if not specified
            let branch = options.branch;
            if (!branch) {
                const { stdout } = yield executeGitCommand('rev-parse --abbrev-ref HEAD');
                branch = stdout.trim();
            }
            // Build push command
            let pushCommand = `push origin ${branch}`;
            if (options.force) {
                pushCommand += ' --force';
                spinner.text = `Force pushing to origin/${branch}...`;
            }
            else {
                spinner.text = `Pushing to origin/${branch}...`;
            }
            // Execute push
            const { stdout, stderr } = yield executeGitCommand(pushCommand);
            if (stderr && stderr.includes('error:')) {
                spinner.fail(`Push failed: ${stderr}`);
                return;
            }
            spinner.succeed(`Successfully pushed to origin/${branch}.`);
        }
        catch (error) {
            spinner.fail(`Failed to push changes: ${error}`);
            if (error instanceof Error && error.message.includes('rejected')) {
                console.log(chalk_1.default.yellow('\nHint: Use --force to force push, but be careful as this can overwrite remote changes.'));
            }
        }
    });
}
/**
 * Pull changes
 */
function gitPull(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = (0, ora_1.default)('Pulling changes...').start();
        try {
            // Get current branch if not specified
            let branch = options.branch;
            if (!branch) {
                const { stdout } = yield executeGitCommand('rev-parse --abbrev-ref HEAD');
                branch = stdout.trim();
            }
            // Build pull command
            let pullCommand = `pull origin ${branch}`;
            if (options.rebase) {
                pullCommand += ' --rebase';
                spinner.text = `Pulling with rebase from origin/${branch}...`;
            }
            else {
                spinner.text = `Pulling from origin/${branch}...`;
            }
            // Execute pull
            const { stdout, stderr } = yield executeGitCommand(pullCommand);
            if (stderr && stderr.includes('error:')) {
                spinner.fail(`Pull failed: ${stderr}`);
                return;
            }
            spinner.succeed(`Successfully pulled from origin/${branch}.`);
        }
        catch (error) {
            spinner.fail(`Failed to pull changes: ${error}`);
            if (error instanceof Error) {
                if (error.message.includes('conflict')) {
                    console.log(chalk_1.default.yellow('\nThere are conflicts that need to be resolved manually.'));
                }
                else if (error.message.includes('local changes')) {
                    console.log(chalk_1.default.yellow('\nYou have local changes that would be overwritten by pull. Commit or stash them first.'));
                }
            }
        }
    });
}
//# sourceMappingURL=git-commands.js.map