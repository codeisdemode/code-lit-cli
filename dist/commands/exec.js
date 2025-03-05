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
exports.execCommand = execCommand;
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const ora_1 = __importDefault(require("ora"));
// Promisify exec
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Register the exec command to the CLI program
 */
function execCommand(program) {
    program
        .command('exec <command>')
        .description('Execute a command in the terminal')
        .option('-d, --cwd <directory>', 'Working directory to run the command in')
        .option('-t, --timeout <ms>', 'Timeout in milliseconds', '300000')
        .option('-s, --silent', 'Run in silent mode (no output)', false)
        .option('-e, --env <keyValue>', 'Environment variables in format KEY=VALUE', collectEnvVars, {})
        .option('-i, --interactive', 'Run in interactive mode (use for commands requiring input)', false)
        .action((command, options) => __awaiter(this, void 0, void 0, function* () {
        yield executeCommand(command, options);
    }));
}
/**
 * Helper to collect environment variables
 */
function collectEnvVars(value, previous = {}) {
    const [key, val] = value.split('=');
    if (key && val) {
        return Object.assign(Object.assign({}, previous), { [key]: val });
    }
    return previous;
}
/**
 * Execute a command
 */
function executeCommand(command, options) {
    return __awaiter(this, void 0, void 0, function* () {
        // Parse timeout
        const timeout = parseInt(options.timeout || '300000', 10);
        // Check for potentially dangerous commands
        const dangerousCommands = ['rm -rf /', 'dd if=/dev/zero', ':(){:|:&};:'];
        if (dangerousCommands.some(cmd => command.includes(cmd))) {
            console.error(chalk_1.default.red('Error: Potentially dangerous command detected.'));
            console.error(chalk_1.default.yellow('For safety reasons, this command will not be executed.'));
            return;
        }
        if (options.interactive) {
            // Use spawn for interactive commands
            console.log(chalk_1.default.blue(`\nExecuting command: ${command}`));
            console.log(chalk_1.default.gray('Interactive mode: Press Ctrl+C to terminate.\n'));
            const [cmd, ...args] = command.split(' ');
            // Create environment variables
            const env = Object.assign(Object.assign({}, process.env), (options.env || {}));
            // Spawn the process
            const childProcess = (0, child_process_1.spawn)(cmd, args, {
                cwd: options.cwd || process.cwd(),
                env,
                stdio: 'inherit',
                shell: true,
            });
            return new Promise((resolve, reject) => {
                childProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log(chalk_1.default.green('\nCommand completed successfully.'));
                        resolve();
                    }
                    else {
                        console.error(chalk_1.default.red(`\nCommand failed with exit code ${code}.`));
                        reject(new Error(`Command failed with exit code ${code}`));
                    }
                });
                childProcess.on('error', (error) => {
                    console.error(chalk_1.default.red(`\nCommand failed: ${error.message}`));
                    reject(error);
                });
            });
        }
        else {
            // Use exec for non-interactive commands
            const spinner = (0, ora_1.default)(`Executing command: ${command}`).start();
            try {
                // Create environment variables
                const env = Object.assign(Object.assign({}, process.env), (options.env || {}));
                // Execute the command
                const { stdout, stderr } = yield execAsync(command, {
                    cwd: options.cwd || process.cwd(),
                    env,
                    timeout,
                });
                // Handle command output
                if (stderr && stderr.trim() !== '') {
                    spinner.warn(`Command completed with warnings.`);
                    if (!options.silent) {
                        console.error(chalk_1.default.yellow('\nStderr:'));
                        console.error(stderr);
                    }
                }
                else {
                    spinner.succeed('Command completed successfully.');
                }
                // Show stdout
                if (stdout && stdout.trim() !== '' && !options.silent) {
                    console.log(chalk_1.default.cyan('\nOutput:'));
                    console.log(stdout);
                }
            }
            catch (error) {
                spinner.fail(`Command failed: ${error}`);
                if (!options.silent && error instanceof Error) {
                    if ('stdout' in error && error.stdout) {
                        console.log(chalk_1.default.cyan('\nOutput:'));
                        console.log(error.stdout);
                    }
                    if ('stderr' in error && error.stderr) {
                        console.error(chalk_1.default.yellow('\nStderr:'));
                        console.error(error.stderr);
                    }
                }
            }
        }
    });
}
//# sourceMappingURL=exec.js.map