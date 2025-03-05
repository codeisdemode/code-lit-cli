import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { promisify } from 'util';
import { CodeFile } from './types';

// Promisify file operations
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

/**
 * Read a file from the filesystem
 */
export async function readFile(filePath: string): Promise<CodeFile> {
  try {
    const content = await readFileAsync(filePath, 'utf-8');
    return {
      path: filePath,
      content,
      language: getLanguageFromExtension(filePath),
    };
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Write content to a file
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await writeFileAsync(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write to file ${filePath}: ${error}`);
  }
}

/**
 * Find files matching a pattern
 */
export async function findFiles(pattern: string, ignoreDirs: string[] = ['node_modules', 'dist', '.git']): Promise<string[]> {
  try {
    const ignore = ignoreDirs.map(dir => `**/${dir}/**`);
    return await glob(pattern, { ignore });
  } catch (error) {
    throw new Error(`Failed to find files matching pattern ${pattern}: ${error}`);
  }
}

/**
 * Get programming language based on file extension
 */
export function getLanguageFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  
  const extensionMap: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'jsx',
    '.tsx': 'tsx',
    '.py': 'python',
    '.java': 'java',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.json': 'json',
    '.md': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bat': 'batch',
    '.ps1': 'powershell',
  };
  
  return extensionMap[ext] || 'plaintext';
} 