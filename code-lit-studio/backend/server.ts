/***************************************************
 * server.ts
 ***************************************************/
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from 'openai';
import { errorHandler } from './middleware/errorHandler';
import { body, validationResult } from 'express-validator';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

// For executing shell commands
import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec for better async/await handling
const execAsync = promisify(exec);

// For SQLite administration
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// Define message types
type MessageType = 'command' | 'query' | 'status' | 'other';

// Define MetaAction interface
interface MetaAction {
  action: string; // e.g., 'refresh_page', 'update_component', 'restart_website'
  target: string; // e.g., 'main', 'sidebar', 'website'
  data: Record<string, any>; // Additional data needed for the action
}

// Define GPTFunctionCall interface
interface GPTFunctionCall {
  name: string;
  arguments: Record<string, any>;
}

// Define GPTResponse interface
interface GPTResponse {
  explanation: string; // Explanation text from GPT
  function_calls: GPTFunctionCall[]; // Array of function calls GPT wants to execute
  meta_actions: MetaAction[]; // Array of meta-actions for the front-end
}

// Initialize SQLite Database instance
let db: Database | null = null;

// ------------------ GPT Setup ------------------
const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

// ------------------ Constants ------------------
const PROJECTS_DIR = path.join(__dirname, 'projects');
const ALLOWED_EXTENSIONS = ['.html', '.css', '.js'];

// Ensure PROJECTS_DIR exists
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR);
}

// ------------------ Utilities / Helper Functions ------------------

/**
 * Validate that a given file path is within the project’s directory
 * and has an allowed extension. This is a security measure.
 */
function validateFilePath(projectId: string, filename: string): boolean {
  const projectDir = path.join(PROJECTS_DIR, projectId);
  const resolved = path.resolve(projectDir, filename);
  if (!resolved.startsWith(projectDir)) {
    return false;
  }
  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return false;
  }
  return true;
}

/**
 * Ensure the project directory exists.
 */
function ensureProjectDir(projectId: string) {
  const projectDir = path.join(PROJECTS_DIR, projectId);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
}

/**
 * Create a backup copy of the file before writing changes.
 * The backups go in a .backups folder within the project folder,
 * labeled by timestamp.
 */
function createBackup(projectId: string, filename: string) {
  ensureProjectDir(projectId);
  const projectDir = path.join(PROJECTS_DIR, projectId);
  const backupsDir = path.join(projectDir, '.backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
  }

  const originalFile = path.join(projectDir, filename);
  if (fs.existsSync(originalFile)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupsDir, `${filename}.${timestamp}.bak`);
    fs.copyFileSync(originalFile, backupFile);
    console.log(`Backup created: ${backupFile}`);
  }
}

/**
 * Recursively build a tree of the directory structure.
 * This can be sent to GPT so it knows what files/folders exist.
 */
function getProjectTree(dirPath: string): any {
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    // It's a file
    return path.basename(dirPath);
  }
  // It's a directory
  const children = fs.readdirSync(dirPath).map((name) =>
    getProjectTree(path.join(dirPath, name))
  );

  return {
    name: path.basename(dirPath),
    type: 'directory',
    children
  };
}

/**
 * Determine the type of a given message based on its content.
 * @param message - The user message to categorize.
 * @returns The determined message type.
 */
function determineMessageType(message: string): MessageType {
  const commandKeywords = ['create', 'delete', 'update', 'install', 'run', 'stop', 'restart'];
  const queryKeywords = ['what', 'how', 'list', 'show', 'describe'];
  const statusKeywords = ['status', 'running', 'error', 'issue'];

  const lowerCaseMsg = message.toLowerCase();

  if (commandKeywords.some(word => lowerCaseMsg.includes(word))) {
    return 'command';
  } else if (queryKeywords.some(word => lowerCaseMsg.startsWith(word))) {
    return 'query';
  } else if (statusKeywords.some(word => lowerCaseMsg.includes(word))) {
    return 'status';
  } else {
    return 'other';
  }
}

// ------------------ In-Memory Conversation History ------------------
const conversationHistory: Record<string, ChatCompletionRequestMessage[]> = {};

// ------------------ Express App Setup ------------------
const app = express();
const PORT = 3001;

// Create HTTP server to integrate with Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:3000", // React dev server
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ------------------ Function Handlers ------------------
const FUNCTION_HANDLERS: Record<string, Function> = {
  readFile: async (args: any, projectId: string) => {
    const { filename } = args;
    console.log(`Executing readFile for ${filename}`);
    if (!validateFilePath(projectId, filename)) {
      throw new Error('Invalid file path');
    }
    const filePath = path.join(PROJECTS_DIR, projectId, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`readFile succeeded: ${content}`);
    return content;
  },

  writeFile: async (args: any, projectId: string) => {
    const { filename, content } = args;
    console.log(`Executing writeFile for ${filename}`);
    if (!validateFilePath(projectId, filename)) {
      throw new Error('Invalid file path');
    }
    createBackup(projectId, filename);
    const filePath = path.join(PROJECTS_DIR, projectId, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`writeFile succeeded: ${filename} updated.`);

    // Emit a meta-action to refresh the file viewer
    io.emit('metaAction', {
      action: 'refresh_component',
      target: 'fileViewer',
      data: { projectId, filename }
    });

    return `File ${filename} written successfully.`;
  },

  createFile: async (args: any, projectId: string) => {
    const { filename, content } = args;
    console.log(`Executing createFile for ${filename}`);
    if (!validateFilePath(projectId, filename)) {
      throw new Error('Invalid file path');
    }
    const filePath = path.join(PROJECTS_DIR, projectId, filename);
    if (fs.existsSync(filePath)) {
      throw new Error('File already exists');
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`createFile succeeded: ${filename} created.`);

    // Emit a meta-action to render the project files table
    io.emit('metaAction', {
      action: 'render_table',
      target: 'projectFilesTable',
      data: { projectId }
    });

    return `File ${filename} created successfully.`;
  },

  deleteFile: async (args: any, projectId: string) => {
    const { filename } = args;
    console.log(`Executing deleteFile for ${filename}`);
    if (!validateFilePath(projectId, filename)) {
      throw new Error('Invalid file path');
    }
    const filePath = path.join(PROJECTS_DIR, projectId, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
    createBackup(projectId, filename);
    fs.unlinkSync(filePath);
    console.log(`deleteFile succeeded: ${filename} deleted.`);

    // Emit a meta-action to refresh the file list
    io.emit('metaAction', {
      action: 'refresh_component',
      target: 'fileList',
      data: { projectId }
    });

    return `File ${filename} deleted successfully.`;
  },

  // Meta-Actions: Refresh UI
  refreshUI: async (args: any, projectId: string) => {
    console.log(`Executing refreshUI for projectId: ${projectId}`);
    io.emit('metaAction', {
      action: 'refresh_page',
      target: 'main',
      data: { projectId }
    });
    return `UI refresh triggered for project ${projectId}`;
  },

  // Server Control: Stop Website
  stopWebsite: async () => {
    console.log('Executing stopWebsite - stopping website process...');
    try {
      await execAsync('pm2 stop website');
      console.log('Website stopped successfully.');

      // Emit success notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'success',
          message: 'Website stopped successfully.'
        }
      });

      return 'Website stop initiated successfully.';
    } catch (error: any) {
      console.error(`Error stopping website: ${error.message}`);

      // Emit error notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'error',
          message: `Failed to stop website: ${error.message}`
        }
      });

      throw new Error(`Failed to stop website: ${error.message}`);
    }
  },

  // Server Control: Restart Website
  restartWebsite: async () => {
    console.log('Executing restartWebsite - restarting website process...');
    try {
      await execAsync('pm2 restart website');
      console.log('Website restarted successfully.');

      // Emit success notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'success',
          message: 'Website restarted successfully.'
        }
      });

      return 'Website restart initiated successfully.';
    } catch (error: any) {
      console.error(`Error restarting website: ${error.message}`);

      // Emit error notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'error',
          message: `Failed to restart website: ${error.message}`
        }
      });

      throw new Error(`Failed to restart website: ${error.message}`);
    }
  },

  // Server Control: Stop Backend Server
  stopBackendServer: async () => {
    console.log('Executing stopBackendServer - shutting down backend server...');
    // CAUTION: This will terminate the Node.js process.
    // Ensure you have a process manager like PM2 to restart the server if needed.
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    return 'Backend server stop initiated.';
  },

  // Server Control: Restart Backend Server using PM2
  restartBackendServer: async () => {
    console.log('Executing restartBackendServer - restarting backend server via PM2...');
    try {
      await execAsync('pm2 restart backend-server');
      console.log('Backend server restarted successfully.');

      // Emit success notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'success',
          message: 'Backend server restarted successfully.'
        }
      });

      return 'Backend server restart initiated successfully.';
    } catch (error: any) {
      console.error(`Error restarting backend server: ${error.message}`);

      // Emit error notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'error',
          message: `Failed to restart backend server: ${error.message}`
        }
      });

      throw new Error(`Failed to restart backend server: ${error.message}`);
    }
  },

  // SQLite Administration: Install SQLite
  installSqlite: async () => {
    console.log('Executing installSqlite...');
    // This command is for Debian-based systems. Adjust as needed.
    try {
      const { stdout, stderr } = await execAsync('sudo apt-get update && sudo apt-get install -y sqlite3');
      console.log(`sqlite3 installation output: ${stdout}`);

      // Emit success notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'success',
          message: 'SQLite3 installed successfully.'
        }
      });

      return 'SQLite3 installed successfully.';
    } catch (error: any) {
      console.error(`Failed to install sqlite3: ${error.message}`);

      // Emit error notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'error',
          message: `Failed to install SQLite3: ${error.message}`
        }
      });

      throw new Error(`Failed to install sqlite3: ${error.message}`);
    }
  },

  // SQLite Administration: Initialize or Connect to SQLite Database
  initSqliteDB: async () => {
    console.log('Initializing/Connecting to SQLite DB...');
    try {
      const dbPath = path.join(__dirname, 'db.sqlite');
      db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      console.log(`Connected to SQLite DB at: ${dbPath}`);

      // Emit success notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'success',
          message: `Connected to SQLite database at ${dbPath}`
        }
      });

      return `Connected to SQLite database at ${dbPath}`;
    } catch (error: any) {
      console.error(`Failed to connect to SQLite DB: ${error.message}`);

      // Emit error notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'error',
          message: `Failed to connect to SQLite database: ${error.message}`
        }
      });

      throw new Error(`Failed to connect to SQLite DB: ${error.message}`);
    }
  },

  // SQLite Administration: Run SQL Query
  runSqlQuery: async (args: any) => {
    const { query } = args;
    if (!db) {
      throw new Error('Database not initialized. Call initSqliteDB first.');
    }
    console.log(`Executing SQL query: ${query}`);
    try {
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        const rows = await db.all(query);
        console.log(`SQL Query Result: ${JSON.stringify(rows)}`);

        // Optionally emit a meta-action to display query results
        io.emit('metaAction', {
          action: 'render_table',
          target: 'sqlQueryResultsTable',
          data: { rows }
        });

        return rows;
      } else {
        await db.run(query);
        console.log('SQL Query executed successfully.');

        // Emit success notification
        io.emit('metaAction', {
          action: 'display_notification',
          target: 'notificationCenter',
          data: {
            type: 'success',
            message: 'SQL query executed successfully.'
          }
        });

        return 'Query executed successfully.';
      }
    } catch (error: any) {
      console.error(`Error executing SQL query: ${error.message}`);

      // Emit error notification
      io.emit('metaAction', {
        action: 'display_notification',
        target: 'notificationCenter',
        data: {
          type: 'error',
          message: `Error executing SQL query: ${error.message}`
        }
      });

      throw new Error(`Error executing SQL query: ${error.message}`);
    }
  },

  // Meta-Actions Handlers
  createChart: async (args: any, projectId: string) => {
    const { config, type } = args; // config includes chart configuration
    console.log(`Executing createChart for projectId: ${projectId}`);
    // Emit a meta-action to create a chart on the frontend
    io.emit('metaAction', {
      action: 'create_chart',
      target: 'dashboard',
      data: {
        config,
        type
      }
    });
    return `Chart ${config.title || 'unnamed'} created successfully.`;
  },

  renderTable: async (args: any, projectId: string) => {
    const { config } = args; // config includes table configuration
    console.log(`Executing renderTable for projectId: ${projectId}`);
    // Emit a meta-action to render a table on the frontend
    io.emit('metaAction', {
      action: 'render_table',
      target: 'dashboard',
      data: config
    });
    return `Table rendered successfully.`;
  },

  displayLogs: async (args: any, projectId: string) => {
    const { logs } = args; // logs is an array of log strings
    console.log(`Executing displayLogs for projectId: ${projectId}`);
    // Emit a meta-action to display logs on the frontend
    io.emit('metaAction', {
      action: 'display_logs',
      target: 'logViewer',
      data: { logs }
    });
    return `Logs displayed successfully.`;
  },

  // Add more handlers as needed
};

// ------------------ JSON Extraction Helper ------------------
function extractJSONFromResponse(responseText: string): GPTResponse | null {
  // Simple approach: find the first { ... } block
  const jsonRegex = /(\{[\s\S]*\})/;
  const match = responseText.match(jsonRegex);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    return parsed;
  } catch (err) {
    console.error('Failed to parse JSON:', err);
    return null;
  }
}

// ------------------ Task Orchestration ------------------
async function orchestrateTasks(
  initialMessages: ChatCompletionRequestMessage[],
  projectId: string
): Promise<any> {
  const MAX_ITERATIONS = 20; // Increased for more complex tasks
  let messages = [...initialMessages];
  let iteration = 0;

  // Track repeated calls to detect loops
  let lastFunctionCalls: string[] = [];
  // Track consecutive failures
  let consecutiveFailures = 0;

  while (iteration < MAX_ITERATIONS) {
    console.log(`Orchestration Iteration: ${iteration + 1}`);

    try {
      // Send messages to GPT
      const response = await openai.createChatCompletion({
        model: 'gpt-4o', // Corrected model name
        messages,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const gptReply = response.data.choices[0].message?.content?.trim();
      if (!gptReply) {
        console.warn('GPT returned an empty response.');
        break;
      }

      console.log(`GPT Reply: ${gptReply}`);

      // Attempt to parse valid JSON
      const parsedResponse = extractJSONFromResponse(gptReply);
      if (!parsedResponse) {
        console.warn('GPT response is not valid JSON. Ending orchestration.');
        messages.push({ role: 'assistant', content: gptReply });
        break;
      }

      // Append GPT’s explanation as an assistant message
      messages.push({ role: 'assistant', content: parsedResponse.explanation });

      // Check for function calls
      if (!parsedResponse.function_calls || parsedResponse.function_calls.length === 0) {
        console.log('No function calls detected. Checking for meta-actions.');

        // Check for meta-actions
        if (parsedResponse.meta_actions && parsedResponse.meta_actions.length > 0) {
          parsedResponse.meta_actions.forEach((metaAction: MetaAction) => {
            io.emit('metaAction', metaAction);
            console.log(`Emitted meta-action: ${metaAction.action} on ${metaAction.target}`);
          });
        }

        break;
      }

      // Execute each function call
      let allSucceeded = true;
      const functionCallNames: string[] = [];
      const functionResults = [];

      for (const funcCall of parsedResponse.function_calls) {
        functionCallNames.push(funcCall.name);

        const handler = FUNCTION_HANDLERS[funcCall.name];
        if (handler) {
          try {
            const result = await handler(funcCall.arguments, projectId);
            functionResults.push({
              function: funcCall.name,
              status: 'success',
              result,
            });
          } catch (funcError: any) {
            functionResults.push({
              function: funcCall.name,
              status: 'error',
              error: funcError.message,
            });
            allSucceeded = false;
          }
        } else {
          functionResults.push({
            function: funcCall.name,
            status: 'error',
            error: 'Unknown function',
          });
          allSucceeded = false;
        }
      }

      // Append function results to messages
      functionResults.forEach((res) => {
        if (res.status === 'success') {
          messages.push({
            role: 'system',
            content: `✅ ${res.function} succeeded: ${res.result}`
          });
        } else {
          messages.push({
            role: 'system',
            content: `❌ ${res.function} failed: ${res.error}`
          });
        }
      });

      // Handle success/failure
      if (!allSucceeded) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          // If we have 3 consecutive failures, let's bail out or let GPT know
          messages.push({
            role: 'system',
            content: 'Multiple consecutive failures. Ending orchestration.'
          });
          break;
        } else {
          // Give GPT a chance to correct itself
          messages.push({
            role: 'system',
            content: 'Some tasks failed. Please adjust your instructions or try a different approach.'
          });
        }
      } else {
        consecutiveFailures = 0;
      }

      // Detect repeated calls to avoid infinite loops
      const newCallsStr = functionCallNames.join(',');
      const oldCallsStr = lastFunctionCalls.join(',');
      if (newCallsStr === oldCallsStr) {
        messages.push({
          role: 'system',
          content: 'You are repeating the same function calls as before. Please propose a different approach or end.'
        });
      }
      lastFunctionCalls = functionCallNames;

      // Handle meta-actions if any
      if (parsedResponse.meta_actions && parsedResponse.meta_actions.length > 0) {
        parsedResponse.meta_actions.forEach((metaAction: MetaAction) => {
          io.emit('metaAction', metaAction);
          console.log(`Emitted meta-action: ${metaAction.action} on ${metaAction.target}`);
        });
      }

      iteration++;
    } catch (error: any) {
      console.error(`Orchestration Iteration ${iteration + 1} failed: ${error.message}`);
      messages.push({
        role: 'system',
        content: `Error during orchestration: ${error.message}`
      });
      break; // Exit orchestration on unexpected errors
    }
  }

  if (iteration === MAX_ITERATIONS) {
    console.warn('Reached maximum iterations. Possible infinite loop or complex tasks not resolved.');
    messages.push({
      role: 'system',
      content: 'Max iterations reached. Orchestration ended.'
    });
  }

  // Return the final messages as the response
  return { messages };
}

// ------------------ API Routes ------------------

/**
 * 1) List all files in a project directory (only .html, .css, .js).
 */
app.get('/api/:projectId/files', async (req: Request, res: Response, next: NextFunction) => {
  const { projectId } = req.params;
  const projectDir = path.join(PROJECTS_DIR, projectId);

  try {
    if (!fs.existsSync(projectDir)) {
      const error: any = new Error('Project not found');
      error.status = 404;
      throw error;
    }

    const files = fs
      .readdirSync(projectDir)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return ALLOWED_EXTENSIONS.includes(ext);
      });

    res.json(files);
  } catch (err) {
    next(err);
  }
});

/**
 * 2) Read a file’s content
 */
app.get('/api/:projectId/file', async (req: Request, res: Response, next: NextFunction) => {
  const { projectId } = req.params;
  const { filename } = req.query;

  if (!filename || typeof filename !== 'string') {
    const error: any = new Error('Missing filename query param');
    error.status = 400;
    return next(error);
  }

  try {
    if (!validateFilePath(projectId, filename)) {
      const error: any = new Error('File not allowed or invalid path');
      error.status = 403;
      throw error;
    }

    const filePath = path.join(PROJECTS_DIR, projectId, filename);
    if (!fs.existsSync(filePath)) {
      const error: any = new Error('File does not exist');
      error.status = 404;
      throw error;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content });
  } catch (err) {
    next(err);
  }
});

/**
 * 3) Write/update a file (with backup).
 */
app.post(
  '/api/:projectId/file',
  [
    body('filename')
      .isString()
      .withMessage('Filename must be a string')
      .notEmpty()
      .withMessage('Filename is required'),
    body('content')
      .isString()
      .withMessage('Content must be a string'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error: any = new Error('Validation Error');
      error.status = 400;
      error.message = errors.array().map(err => err.msg).join(', ');
      return next(error);
    }

    const { projectId } = req.params;
    const { filename, content } = req.body;

    try {
      if (!validateFilePath(projectId, filename)) {
        const error: any = new Error('File not allowed or invalid path');
        error.status = 403;
        throw error;
      }

      // Create a backup first
      createBackup(projectId, filename);

      // Then write
      const filePath = path.join(PROJECTS_DIR, projectId, filename);
      fs.writeFileSync(filePath, content, 'utf-8');

      res.json({ message: 'File updated successfully' });

      // Emit real-time update to clients via meta-action
      io.emit('metaAction', {
        action: 'update_component',
        target: 'fileViewer',
        data: { projectId, filename }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 4) List Backups for a File
 */
app.get('/api/:projectId/file/backups', async (req: Request, res: Response, next: NextFunction) => {
  const { projectId } = req.params;
  const { filename } = req.query;

  if (!filename || typeof filename !== 'string') {
    const error: any = new Error('Missing filename query param');
    error.status = 400;
    return next(error);
  }

  try {
    const projectDir = path.join(PROJECTS_DIR, projectId);
    const backupsDir = path.join(projectDir, '.backups');

    if (!fs.existsSync(backupsDir)) {
      return res.json({ backups: [] });
    }

    const backups = fs
      .readdirSync(backupsDir)
      .filter(file => file.startsWith(`${filename}.`) && file.endsWith('.bak'));

    res.json({ backups });
  } catch (err) {
    next(err);
  }
});

/**
 * 5) Restore a Backup
 */
app.post(
  '/api/:projectId/file/restore',
  [
    body('filename')
      .isString()
      .withMessage('Filename must be a string')
      .notEmpty()
      .withMessage('Filename is required'),
    body('backupName')
      .isString()
      .withMessage('Backup name must be a string')
      .notEmpty()
      .withMessage('Backup name is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error: any = new Error('Validation Error');
      error.status = 400;
      error.message = errors.array().map(err => err.msg).join(', ');
      return next(error);
    }

    const { projectId } = req.params;
    const { filename, backupName } = req.body;

    try {
      if (!validateFilePath(projectId, filename)) {
        const error: any = new Error('File not allowed or invalid path');
        error.status = 403;
        throw error;
      }

      const projectDir = path.join(PROJECTS_DIR, projectId);
      const backupsDir = path.join(projectDir, '.backups');
      const backupFilePath = path.join(backupsDir, backupName);

      if (!fs.existsSync(backupFilePath)) {
        const error: any = new Error('Backup file does not exist');
        error.status = 404;
        throw error;
      }

      // Create a backup of the current file before restoring
      createBackup(projectId, filename);

      // Restore the backup
      fs.copyFileSync(backupFilePath, path.join(projectDir, filename));

      res.json({ message: `File ${filename} restored from backup ${backupName}` });

      // Emit real-time update to clients via meta-action
      io.emit('metaAction', {
        action: 'update_component',
        target: 'fileViewer',
        data: { projectId, filename }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 6) Delete a Backup
 */
app.delete(
  '/api/:projectId/file/backups',
  [
    body('filename')
      .isString()
      .withMessage('Filename must be a string')
      .notEmpty()
      .withMessage('Filename is required'),
    body('backupName')
      .isString()
      .withMessage('Backup name must be a string')
      .notEmpty()
      .withMessage('Backup name is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error: any = new Error('Validation Error');
      error.status = 400;
      error.message = errors.array().map(err => err.msg).join(', ');
      return next(error);
    }

    const { projectId } = req.params;
    const { filename, backupName } = req.body;

    try {
      if (!validateFilePath(projectId, filename)) {
        const error: any = new Error('File not allowed or invalid path');
        error.status = 403;
        throw error;
      }

      const projectDir = path.join(PROJECTS_DIR, projectId);
      const backupsDir = path.join(projectDir, '.backups');
      const backupFilePath = path.join(backupsDir, backupName);

      if (!fs.existsSync(backupFilePath)) {
        const error: any = new Error('Backup file does not exist');
        error.status = 404;
        throw error;
      }

      fs.unlinkSync(backupFilePath);
      res.json({ message: `Backup ${backupName} deleted successfully` });

      // Emit real-time update to clients via meta-action
      io.emit('metaAction', {
        action: 'update_component',
        target: 'backupList',
        data: { projectId, filename }
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 7) GPT Chat Instructions Endpoint
 *    - Orchestrate tasks: GPT proposes tasks, server executes them, handles results.
 */
app.post('/api/chat', async (req: Request, res: Response, next: NextFunction) => {
  const { userMessages, projectId } = req.body;

  if (!Array.isArray(userMessages)) {
    return res.status(400).json({ error: 'userMessages must be an array of strings' });
  }
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid projectId' });
  }

  try {
    // Determine the type of each user message
    const categorizedMessages = userMessages.map((msg: string) => ({
      message: msg,
      type: determineMessageType(msg)
    }));

    // Build dynamic system messages based on message types
    const dynamicSystemMessages: ChatCompletionRequestMessage[] = categorizedMessages.map(({ message, type }) => {
      switch (type) {
        case 'command':
          return { role: 'system', content: `Handle the following command: "${message}"` };
        case 'query':
          return { role: 'system', content: `Respond to the following query: "${message}"` };
        case 'status':
          return { role: 'system', content: `Provide status information for: "${message}"` };
        default:
          return { role: 'system', content: `Process the following message: "${message}"` };
      }
    });

    // Enhanced system message with instructions and references to OpenAI docs about JSON mode
    const baseSystemMessage: ChatCompletionRequestMessage = {
      role: 'system',
      content: `
You are a sophisticated coding assistant capable of managing complex, multi-step tasks to help build and modify a website.
Below is relevant guidance from OpenAI about JSON mode output:

"When JSON mode is turned on, the model's output is ensured to be valid JSON, except in some edge cases. 
If you are using function calling, JSON mode is always turned on.
To turn on JSON mode with Chat Completions or Assistants API, set response_format = { "type": "json_object" }.

Your application must detect and handle edge cases where the model's output may not be complete JSON. 
Always instruct the model to produce JSON, or it may run until the token limit is reached.

JSON mode does not guarantee the output matches your schema. 
You should use a validation library or structured outputs to ensure the result is correct."

## What you can do:
- **Read File** -> \`readFile({"filename": "..."})\`
- **Write/Update File** -> \`writeFile({"filename": "...", "content": "..."})\`
- **Create File** -> \`createFile({"filename": "...", "content": "..."})\`
- **Delete File** -> \`deleteFile({"filename": "..."})\`
- **Refresh UI** -> \`refreshUI({"projectId": "..."})\`
- **Stop Website** -> \`stopWebsite()\`
- **Restart Website** -> \`restartWebsite()\`
- **Stop Backend Server** -> \`stopBackendServer()\`
- **Restart Backend Server** -> \`restartBackendServer()\`
- **Install SQLite** -> \`installSqlite()\`
- **Initialize SQLite DB** -> \`initSqliteDB()\`
- **Run SQL Query** -> \`runSqlQuery({"query": "..."})\`
- **Create Chart** -> \`createChart({"config": {...}, "type": "..."})\`
- **Render Table** -> \`renderTable({"config": {...}})\`
- **Display Logs** -> \`displayLogs({"logs": ["log1", "log2", ...]})\`

## Please follow these rules:
1. Always return valid JSON.
2. Provide a short, clear \`explanation\` of your plan or actions.
3. If you need no actions, set \`function_calls\` and \`meta_actions\` to empty arrays.
4. You may propose multiple function calls and meta-actions at once if necessary (multi-step).
5. If a function fails, you can propose a new plan or ask the user for more info.

**Response Format** (JSON):
{
  "explanation": "...",
  "function_calls": [
    {
      "name": "someFunction",
      "arguments": {}
    }
  ],
  "meta_actions": [
    {
      "action": "refresh_page",
      "target": "main",
      "data": {}
    }
  ]
}
`
    };

    // Build a system message that includes the current project directory structure
    const projectDir = path.join(PROJECTS_DIR, projectId);
    let dirTree: any = { error: 'Project directory does not exist' };
    if (fs.existsSync(projectDir)) {
      dirTree = getProjectTree(projectDir);
    }
    const projectStructureMessage: ChatCompletionRequestMessage = {
      role: 'system',
      content: `Here is the current project structure:\n${JSON.stringify(dirTree, null, 2)}`
    };

    // Retrieve the last few messages from conversation history for this projectId
    if (!conversationHistory[projectId]) {
      conversationHistory[projectId] = [];
    }
    const historyTail = conversationHistory[projectId].slice(-5); // last 5 messages

    // Convert new user messages to ChatCompletionRequestMessage[] objects with dynamic system messages
    const userMessagesArray: ChatCompletionRequestMessage[] = categorizedMessages.map(
      ({ message, type }) => ({
        role: 'user',
        content: message
      })
    );

    // Combine all messages
    const messages: ChatCompletionRequestMessage[] = [
      baseSystemMessage,
      projectStructureMessage,
      ...historyTail,
      ...dynamicSystemMessages,
      ...userMessagesArray
    ];

    // Orchestrate tasks (with advanced iteration logic)
    const finalResponse = await orchestrateTasks(messages, projectId);

    // Extract the latest messages from orchestration
    const latestMessages = finalResponse.messages;

    // Append them to conversation history so subsequent calls see updated context
    conversationHistory[projectId].push(...latestMessages);

    // Determine the final textual reply
    const lastAssistantMessage = latestMessages.slice().reverse().find(msg => msg.role === 'assistant');
    const finalReply = lastAssistantMessage ? lastAssistantMessage.content : '';

    res.json({ reply: finalReply });
  } catch (error) {
    next(error);
  }
});

/**
 * 8) Serve the Actual Website Files for Live Preview
 */
app.use('/projects/:projectId', (req: Request, res: Response, next: NextFunction) => {
  const projectDir = path.join(PROJECTS_DIR, req.params.projectId);
  if (!fs.existsSync(projectDir)) {
    return res.status(404).send('Project not found');
  }
  express.static(projectDir)(req, res, next);
});

// ------------------ Socket.IO Event Handling ------------------
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // Additional event listeners can be added here as needed
});

// ------------------ Error Handling Middleware ------------------
app.use(errorHandler);

// ------------------ Start Server ------------------
server.listen(PORT, async () => {
  console.log(`Server listening at http://localhost:${PORT}`);

  // OPTIONAL: Initialize SQLite on startup, if desired
  // try {
  //   const dbPath = path.join(__dirname, 'db.sqlite');
  //   db = await open({ filename: dbPath, driver: sqlite3.Database });
  //   console.log(`Connected to SQLite database at ${dbPath}`);
  // } catch (error) {
  //   console.error('Failed to initialize SQLite DB on startup:', error);
  // }
});
