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
const simple_git_1 = __importDefault(require("simple-git"));
const ora_1 = __importDefault(require("ora"));
const inquirer_1 = __importDefault(require("inquirer"));
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
 * Get Git client
 */
function getGit() {
    return (0, simple_git_1.default)();
}
/**
 * Show git status
 */
function gitStatus() {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = (0, ora_1.default)('Checking git status...').start();
        try {
            const git = getGit();
            const status = yield git.status();
            spinner.succeed('Git status retrieved successfully.');
            // Display branch information
            console.log(chalk_1.default.cyan(`\nOn branch: ${status.current}`));
            // Display tracking information
            if (status.tracking) {
                console.log(chalk_1.default.gray(`Tracking: ${status.tracking}`));
                if (status.ahead > 0) {
                    console.log(chalk_1.default.yellow(`Your branch is ahead of '${status.tracking}' by ${status.ahead} commit(s).`));
                }
                if (status.behind > 0) {
                    console.log(chalk_1.default.yellow(`Your branch is behind '${status.tracking}' by ${status.behind} commit(s).`));
                }
            }
            // Display file status
            const { not_added, created, deleted, modified, renamed, staged, conflicted } = status;
            if ([...not_added, ...modified, ...deleted, ...created, ...renamed, ...staged, ...conflicted].length === 0) {
                console.log(chalk_1.default.green('\nWorking tree clean. No changes to commit.'));
                return;
            }
            console.log('\nChanges:');
            if (staged.length > 0) {
                console.log(chalk_1.default.green('\nChanges to be committed:'));
                staged.forEach(file => console.log(`  ${chalk_1.default.green('✔')} ${file}`));
            }
            if (modified.length > 0) {
                console.log(chalk_1.default.red('\nChanges not staged for commit:'));
                modified.forEach(file => console.log(`  ${chalk_1.default.red('M')} ${file}`));
            }
            if (not_added.length > 0) {
                console.log(chalk_1.default.red('\nUntracked files:'));
                not_added.forEach(file => console.log(`  ${chalk_1.default.red('?')} ${file}`));
            }
            if (deleted.length > 0) {
                console.log(chalk_1.default.red('\nDeleted files:'));
                deleted.forEach(file => console.log(`  ${chalk_1.default.red('-')} ${file}`));
            }
            if (conflicted.length > 0) {
                console.log(chalk_1.default.yellow('\nConflicted files:'));
                conflicted.forEach(file => console.log(`  ${chalk_1.default.yellow('!')} ${file}`));
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
        const git = getGit();
        let message = options.message;
        let filesToAdd = [];
        try {
            // Get current status
            const status = yield git.status();
            const { not_added, modified, deleted } = status;
            const hasChanges = [...not_added, ...modified, ...deleted].length > 0;
            if (!hasChanges) {
                console.log(chalk_1.default.yellow('No changes to commit. Working tree clean.'));
                return;
            }
            // Interactive mode to select files
            if (options.interactive) {
                const allFiles = [...not_added, ...modified, ...deleted];
                const { selectedFiles } = yield inquirer_1.default.prompt([
                    {
                        type: 'checkbox',
                        name: 'selectedFiles',
                        message: 'Select files to stage:',
                        choices: allFiles.map(file => ({
                            name: `${not_added.includes(file) ? '[untracked] ' : modified.includes(file) ? '[modified] ' : '[deleted] '}${file}`,
                            value: file,
                            checked: modified.includes(file) || deleted.includes(file),
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
                yield git.add(filesToAdd);
            }
            else if (options.all) {
                yield git.add(['-A']);
            }
            // Commit changes
            const commitResult = yield git.commit(message);
            if (commitResult.summary.changes === 0 && commitResult.summary.insertions === 0 && commitResult.summary.deletions === 0) {
                spinner.warn('Commit created, but no files changed.');
            }
            else {
                spinner.succeed(`Committed ${commitResult.summary.changes} files with message: "${message}"`);
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
            const git = getGit();
            const status = yield git.status();
            // Determine remote and branch
            const remote = 'origin';
            const branch = options.branch || status.current;
            // Check if branch exists on remote
            const remotes = yield git.getRemotes(true);
            if (!remotes.find(r => r.name === remote)) {
                spinner.fail(`Remote '${remote}' not found.`);
                return;
            }
            // Push with options
            const pushOptions = ['--set-upstream', remote, branch];
            if (options.force) {
                pushOptions.unshift('--force');
                spinner.text = `Force pushing to ${remote}/${branch}...`;
            }
            else {
                spinner.text = `Pushing to ${remote}/${branch}...`;
            }
            yield git.push(pushOptions);
            spinner.succeed(`Successfully pushed to ${remote}/${branch}.`);
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
            const git = getGit();
            const status = yield git.status();
            // Determine remote and branch
            const remote = 'origin';
            const branch = options.branch || status.current;
            // Check if branch exists on remote
            const remotes = yield git.getRemotes(true);
            if (!remotes.find(r => r.name === remote)) {
                spinner.fail(`Remote '${remote}' not found.`);
                return;
            }
            // Pull with options
            if (options.rebase) {
                spinner.text = `Pulling with rebase from ${remote}/${branch}...`;
                yield git.pull([remote, branch, '--rebase']);
            }
            else {
                spinner.text = `Pulling from ${remote}/${branch}...`;
                yield git.pull([remote, branch]);
            }
            spinner.succeed(`Successfully pulled from ${remote}/${branch}.`);
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
//# sourceMappingURL=git.js.map