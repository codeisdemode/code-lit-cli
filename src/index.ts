#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { searchCommand } from './commands/search';
import { analyzeCommand } from './commands/analyze';
import { execCommand } from './commands/exec';
import { gitCommand } from './commands/git-commands';
import { databaseCommand } from './commands/database';
import { backendCommand } from './commands/backend';

// Define the CLI program
const program = new Command();

// Set up CLI information
program
  .name('code-lit')
  .description('A local dev ops agent inspired by Claude Code')
  .version('1.0.0');

// Display a welcome message
console.log(chalk.blue('🧠 Code-lit - Your local dev ops agent\n'));

// Register commands
searchCommand(program);
analyzeCommand(program);
execCommand(program);
gitCommand(program);
databaseCommand(program);
backendCommand(program);

// Handle unknown commands
program.on('command:*', (operands) => {
  console.error(chalk.red(`Error: unknown command '${operands[0]}'`));
  const availableCommands = program.commands.map(cmd => cmd.name());
  console.error(chalk.yellow(`Available commands: ${availableCommands.join(', ')}`));
  process.exit(1);
});

// Parse arguments or show help if no args provided
if (process.argv.length === 2) {
  program.help();
} else {
  program.parse(process.argv);
} 