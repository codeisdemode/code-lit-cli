#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const search_1 = require("./commands/search");
const analyze_1 = require("./commands/analyze");
const exec_1 = require("./commands/exec");
const git_commands_1 = require("./commands/git-commands");
const database_1 = require("./commands/database");
const backend_1 = require("./commands/backend");
// Define the CLI program
const program = new commander_1.Command();
// Set up CLI information
program
    .name('code-lit')
    .description('A local dev ops agent inspired by Claude Code')
    .version('1.0.0');
// Display a welcome message
console.log(chalk_1.default.blue('🧠 Code-lit - Your local dev ops agent\n'));
// Register commands
(0, search_1.searchCommand)(program);
(0, analyze_1.analyzeCommand)(program);
(0, exec_1.execCommand)(program);
(0, git_commands_1.gitCommand)(program);
(0, database_1.databaseCommand)(program);
(0, backend_1.backendCommand)(program);
// Handle unknown commands
program.on('command:*', (operands) => {
    console.error(chalk_1.default.red(`Error: unknown command '${operands[0]}'`));
    const availableCommands = program.commands.map(cmd => cmd.name());
    console.error(chalk_1.default.yellow(`Available commands: ${availableCommands.join(', ')}`));
    process.exit(1);
});
// Parse arguments or show help if no args provided
if (process.argv.length === 2) {
    program.help();
}
else {
    program.parse(process.argv);
}
//# sourceMappingURL=index.js.map