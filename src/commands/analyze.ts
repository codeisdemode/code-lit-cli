import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { findFiles, readFile } from '../utils/file-utils';
import { AnalysisResult } from '../utils/types';

/**
 * Register the analyze command to the CLI program
 */
export function analyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze your codebase for issues, complexity, and performance')
    .option('-t, --type <type>', 'Type of analysis (dependency, complexity, security, performance)', 'all')
    .option('-f, --file-pattern <pattern>', 'File glob pattern to analyze', '**/*.{js,ts,jsx,tsx}')
    .option('-i, --ignore <dirs>', 'Comma-separated list of directories to ignore', 'node_modules,dist,.git')
    .action(async (options) => {
      await executeAnalysis(options);
    });
}

/**
 * Execute the analysis operation
 */
async function executeAnalysis(
  options: { 
    type: string; 
    filePattern: string; 
    ignore: string;
  }
): Promise<void> {
  const spinner = ora('Analyzing codebase...').start();
  
  try {
    // Parse ignore directories
    const ignoreDirs = options.ignore.split(',').map(dir => dir.trim());
    
    // Find files matching the pattern
    const files = await findFiles(options.filePattern, ignoreDirs);
    
    if (files.length === 0) {
      spinner.fail('No files found matching the pattern');
      return;
    }
    
    spinner.text = `Found ${files.length} files. Analyzing...`;
    
    // Analyze each file
    const results: AnalysisResult[] = [];
    
    for (const filePath of files) {
      try {
        const fileData = await readFile(filePath);
        
        // Run appropriate analysis based on type
        let analysisResults: AnalysisResult[] = [];
        
        if (options.type === 'all' || options.type === 'dependency') {
          analysisResults = analysisResults.concat(analyzeDependencies(fileData.content, filePath));
        }
        
        if (options.type === 'all' || options.type === 'complexity') {
          analysisResults = analysisResults.concat(analyzeComplexity(fileData.content, filePath));
        }
        
        if (options.type === 'all' || options.type === 'security') {
          analysisResults = analysisResults.concat(analyzeSecurity(fileData.content, filePath));
        }
        
        if (options.type === 'all' || options.type === 'performance') {
          analysisResults = analysisResults.concat(analyzePerformance(fileData.content, filePath));
        }
        
        results.push(...analysisResults);
      } catch (error) {
        // Skip files that can't be analyzed
        continue;
      }
    }
    
    // Display results
    if (results.length === 0) {
      spinner.succeed('Analysis complete. No issues found.');
    } else {
      spinner.succeed(`Analysis complete. Found ${results.length} issues.`);
      displayAnalysisResults(results);
    }
  } catch (error) {
    spinner.fail(`Analysis failed: ${error}`);
  }
}

/**
 * Analyze dependencies in the code
 */
function analyzeDependencies(content: string, filePath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const lines = content.split('\n');
  
  // Check for unused imports (very basic implementation)
  const importRegex = /import\s+[{]?\s*(\w+)(?:,\s*{[^}]*})?\s*[}]?\s*from\s+['"]([^'"]+)['"]/g;
  const imports: { name: string; source: string; line: number }[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    
    while ((match = importRegex.exec(line)) !== null) {
      imports.push({
        name: match[1],
        source: match[2],
        line: i + 1,
      });
    }
    
    // Reset regex for next line
    importRegex.lastIndex = 0;
  }
  
  // Very simple check for unused imports (just checks if name appears elsewhere)
  for (const imp of imports) {
    const nameRegex = new RegExp(`\\b${imp.name}\\b`, 'g');
    let usageCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (i === imp.line - 1) continue; // Skip the import line itself
      
      const line = lines[i];
      let match;
      
      while ((match = nameRegex.exec(line)) !== null) {
        usageCount++;
      }
      
      nameRegex.lastIndex = 0;
    }
    
    if (usageCount === 0) {
      results.push({
        type: 'dependency',
        file: filePath,
        line: imp.line,
        severity: 'low',
        message: `Unused import: ${imp.name} from ${imp.source}`,
        suggestion: `Consider removing this import if it's not needed.`,
      });
    }
  }
  
  return results;
}

/**
 * Analyze code complexity
 */
function analyzeComplexity(content: string, filePath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const lines = content.split('\n');
  
  // Find functions and check their length
  const funcRegex = /(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?function|\(.*\)\s*=>\s*{)/g;
  let funcStartLine = -1;
  let bracketCount = 0;
  let inFunction = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!inFunction) {
      // Check if this line contains a function declaration
      if (funcRegex.test(line)) {
        funcStartLine = i + 1;
        inFunction = true;
        bracketCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
        
        // Reset regex for next use
        funcRegex.lastIndex = 0;
        
        // If function is complete on this line
        if (bracketCount === 0 && line.includes('}')) {
          inFunction = false;
        }
      }
    } else {
      // Count brackets to determine function end
      bracketCount += (line.match(/{/g) || []).length;
      bracketCount -= (line.match(/}/g) || []).length;
      
      // Function has ended
      if (bracketCount === 0 && line.includes('}')) {
        const funcLength = i - funcStartLine + 1;
        
        if (funcLength > 30) {
          results.push({
            type: 'complexity',
            file: filePath,
            line: funcStartLine,
            severity: 'medium',
            message: `Function is too long (${funcLength} lines)`,
            suggestion: 'Consider refactoring this function into smaller, more focused functions.',
          });
        }
        
        inFunction = false;
      }
    }
  }
  
  return results;
}

/**
 * Analyze security issues
 */
function analyzeSecurity(content: string, filePath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const lines = content.split('\n');
  
  // Check for potential security issues
  const securityPatterns = [
    {
      pattern: /eval\s*\(/g,
      message: 'Use of eval() can lead to code injection vulnerabilities',
      severity: 'high' as const,
      suggestion: 'Avoid using eval() as it executes arbitrary code.',
    },
    {
      pattern: /document\.write\s*\(/g,
      message: 'Use of document.write can lead to XSS vulnerabilities',
      severity: 'medium' as const,
      suggestion: 'Use safer DOM manipulation methods instead.',
    },
    {
      pattern: /innerHTML\s*=/g,
      message: 'Assignment to innerHTML can lead to XSS vulnerabilities',
      severity: 'medium' as const,
      suggestion: 'Consider using textContent or safer DOM manipulation methods.',
    },
    {
      pattern: /localStorage\.setItem\s*\(/g,
      message: 'Storing sensitive data in localStorage',
      severity: 'low' as const,
      suggestion: 'Avoid storing sensitive information in localStorage as it is accessible to JavaScript.',
    },
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const { pattern, message, severity, suggestion } of securityPatterns) {
      if (pattern.test(line)) {
        results.push({
          type: 'security',
          file: filePath,
          line: i + 1,
          severity,
          message,
          suggestion,
        });
      }
      
      // Reset regex for next use
      pattern.lastIndex = 0;
    }
  }
  
  return results;
}

/**
 * Analyze performance issues
 */
function analyzePerformance(content: string, filePath: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const lines = content.split('\n');
  
  // Check for potential performance issues
  const performancePatterns = [
    {
      pattern: /for\s*\(.*\)\s*{[\s\S]*\bfor\s*\(/g,
      message: 'Nested loops can lead to O(n²) or worse time complexity',
      severity: 'medium' as const,
      suggestion: 'Consider refactoring to avoid nested loops or use more efficient algorithms.',
    },
    {
      pattern: /\.(forEach|map|filter|reduce|some|every)\s*\(\s*.*\.(forEach|map|filter|reduce|some|every)\s*\(/g,
      message: 'Nested array methods can lead to performance issues',
      severity: 'medium' as const,
      suggestion: 'Consider refactoring to avoid nested array operations.',
    },
    {
      pattern: /\bnew\s+Array\((\d+)\)/g,
      message: 'Creating large arrays without immediate initialization',
      severity: 'low' as const,
      suggestion: 'Consider using more efficient data structures or initializing arrays with values.',
    },
  ];
  
  // Full content checks for multi-line patterns
  for (const { pattern, message, severity, suggestion } of performancePatterns) {
    if (pattern.test(content)) {
      // Find the line number (approximate)
      let lineNum = 1;
      const match = pattern.exec(content);
      
      if (match) {
        const upToMatch = content.substring(0, match.index);
        lineNum = (upToMatch.match(/\n/g) || []).length + 1;
      }
      
      results.push({
        type: 'performance',
        file: filePath,
        line: lineNum,
        severity,
        message,
        suggestion,
      });
    }
    
    // Reset regex for next use
    pattern.lastIndex = 0;
  }
  
  return results;
}

/**
 * Display analysis results in a readable format
 */
function displayAnalysisResults(results: AnalysisResult[]): void {
  console.log('\nAnalysis results:');
  
  // Group results by file
  const resultsByFile: Record<string, AnalysisResult[]> = {};
  
  for (const result of results) {
    if (!result.file) continue;
    
    const relativePath = path.relative(process.cwd(), result.file);
    
    if (!resultsByFile[relativePath]) {
      resultsByFile[relativePath] = [];
    }
    
    resultsByFile[relativePath].push(result);
  }
  
  // Display results grouped by file
  for (const [filePath, fileResults] of Object.entries(resultsByFile)) {
    console.log(`\n${chalk.cyan(filePath)}`);
    
    for (const result of fileResults) {
      // Set color based on severity
      let severityColor;
      switch (result.severity) {
        case 'high':
          severityColor = chalk.red;
          break;
        case 'medium':
          severityColor = chalk.yellow;
          break;
        case 'low':
          severityColor = chalk.blue;
          break;
        default:
          severityColor = chalk.white;
      }
      
      // Display the result
      console.log(`  ${severityColor(`[${result.severity.toUpperCase()}]`)} Line ${chalk.yellow(result.line)}: ${result.message}`);
      
      if (result.suggestion) {
        console.log(`    ${chalk.gray(`Suggestion: ${result.suggestion}`)}`);
      }
    }
  }
} 