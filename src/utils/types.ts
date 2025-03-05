// Common types used throughout the application

export interface CodeFile {
  path: string;
  content: string;
  language?: string;
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  matchIndex: number;
}

export interface AnalysisResult {
  type: 'dependency' | 'complexity' | 'security' | 'performance';
  file?: string;
  line?: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
}

export interface GitCommandOptions {
  branch?: string;
  message?: string;
  interactive?: boolean;
  verbose?: boolean;
}

export interface ExecCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  silent?: boolean;
} 