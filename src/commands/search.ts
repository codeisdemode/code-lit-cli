import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { findFiles, readFile } from '../utils/file-utils';
import { SearchResult } from '../utils/types';

/**
 * Register the search command to the CLI program
 */
export function searchCommand(program: Command): void {
  program
    .command('search')
    .description('Search for patterns in your codebase')
    .argument('<pattern>', 'Pattern to search for')
    .option('-f, --file-pattern <pattern>', 'File glob pattern to search in', '**/*.*')
    .option('-i, --ignore <dirs>', 'Comma-separated list of directories to ignore', 'node_modules,dist,.git')
    .option('-c, --case-sensitive', 'Enable case-sensitive search', false)
    .action(async (pattern, options) => {
      await executeSearch(pattern, options);
    });
}

/**
 * Execute the search operation
 */
async function executeSearch(
  pattern: string, 
  options: { 
    filePattern: string; 
    ignore: string; 
    caseSensitive: boolean;
  }
): Promise<void> {
  const spinner = ora('Searching files...').start();
  
  try {
    // Parse ignore directories
    const ignoreDirs = options.ignore.split(',').map(dir => dir.trim());
    
    // Find files matching the pattern
    const files = await findFiles(options.filePattern, ignoreDirs);
    
    if (files.length === 0) {
      spinner.fail('No files found matching the pattern');
      return;
    }
    
    spinner.text = `Found ${files.length} files. Searching for matches...`;
    
    // Search for pattern in each file
    const results: SearchResult[] = [];
    
    for (const filePath of files) {
      try {
        const fileData = await readFile(filePath);
        const fileResults = searchInContent(
          fileData.content, 
          pattern, 
          filePath, 
          options.caseSensitive
        );
        
        results.push(...fileResults);
      } catch (error) {
        // Skip files that can't be read (binary, etc.)
        continue;
      }
    }
    
    // Display results
    if (results.length === 0) {
      spinner.succeed('Search complete. No matches found.');
    } else {
      spinner.succeed(`Search complete. Found ${results.length} matches.`);
      displaySearchResults(results);
    }
  } catch (error) {
    spinner.fail(`Search failed: ${error}`);
  }
}

/**
 * Search for a pattern in file content
 */
function searchInContent(
  content: string, 
  pattern: string, 
  filePath: string, 
  caseSensitive: boolean
): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = content.split('\n');
  const searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    
    while ((match = searchRegex.exec(line)) !== null) {
      results.push({
        file: filePath,
        line: i + 1,
        content: line.trim(),
        matchIndex: match.index,
      });
    }
    
    // Reset regex for next line
    searchRegex.lastIndex = 0;
  }
  
  return results;
}

/**
 * Display search results in a readable format
 */
function displaySearchResults(results: SearchResult[]): void {
  console.log('\nSearch results:');
  
  for (const result of results) {
    const relativePath = path.relative(process.cwd(), result.file);
    
    // Print file path and line number
    console.log(`\n${chalk.cyan(relativePath)}:${chalk.yellow(result.line)}`);
    
    // Print the matched content with highlighted match
    const { content, matchIndex } = result;
    const match = content.substring(
      matchIndex, 
      matchIndex + content.substring(matchIndex).split(/\s|$|[.,;:?!]/, 1)[0].length
    );
    
    const before = content.substring(0, matchIndex);
    const after = content.substring(matchIndex + match.length);
    
    console.log(`${before}${chalk.bgYellow.black(match)}${after}`);
  }
} 