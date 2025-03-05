"use strict";
// backend/server.ts
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
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openai_1 = require("openai");
const errorHandler_1 = require("./middleware/errorHandler");
const express_validator_1 = require("express-validator");
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
// ------------------ GPT Setup ------------------
const openai = new openai_1.OpenAIApi(new openai_1.Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));
// ------------------ Constants ------------------
/**
 * The directory where we store multiple projects.
 * e.g., /projects/<projectId>/index.html
 */
const PROJECTS_DIR = path_1.default.join(__dirname, 'projects');
/** Allowed file extensions for editing */
const ALLOWED_EXTENSIONS = ['.html', '.css', '.js'];
// Ensure PROJECTS_DIR exists
if (!fs_1.default.existsSync(PROJECTS_DIR)) {
    fs_1.default.mkdirSync(PROJECTS_DIR);
}
/**
 * Validate that a given file path is within the project’s directory
 * and has an allowed extension. This is a security measure.
 */
function validateFilePath(projectId, filename) {
    const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
    const resolved = path_1.default.resolve(projectDir, filename);
    if (!resolved.startsWith(projectDir)) {
        return false;
    }
    const ext = path_1.default.extname(resolved).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return false;
    }
    return true;
}
/**
 * Ensure the project directory exists.
 */
function ensureProjectDir(projectId) {
    const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
    if (!fs_1.default.existsSync(projectDir)) {
        fs_1.default.mkdirSync(projectDir, { recursive: true });
    }
}
/**
 * Create a backup copy of the file before writing changes.
 * The backups go in a .backups folder within the project folder,
 * labeled by timestamp.
 */
function createBackup(projectId, filename) {
    ensureProjectDir(projectId);
    const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
    const backupsDir = path_1.default.join(projectDir, '.backups');
    if (!fs_1.default.existsSync(backupsDir)) {
        fs_1.default.mkdirSync(backupsDir);
    }
    const originalFile = path_1.default.join(projectDir, filename);
    if (fs_1.default.existsSync(originalFile)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path_1.default.join(backupsDir, `${filename}.${timestamp}.bak`);
        fs_1.default.copyFileSync(originalFile, backupFile); // Removed 'utf-8'
    }
}
// ------------------ Express App Setup ------------------
const app = (0, express_1.default)();
const PORT = 3001;
// Create HTTP server to integrate with Socket.IO
const server = http_1.default.createServer(app);
// Initialize Socket.IO server
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://localhost:3000", // React dev server
        methods: ["GET", "POST"]
    }
});
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// ------------------ Function Handlers ------------------
const FUNCTION_HANDLERS = {
    readFile: (args, projectId) => __awaiter(void 0, void 0, void 0, function* () {
        const { filename } = args;
        if (!validateFilePath(projectId, filename)) {
            throw new Error('Invalid file path');
        }
        const filePath = path_1.default.join(PROJECTS_DIR, projectId, filename);
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error('File does not exist');
        }
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        return content;
    }),
    writeFile: (args, projectId) => __awaiter(void 0, void 0, void 0, function* () {
        const { filename, content } = args;
        if (!validateFilePath(projectId, filename)) {
            throw new Error('Invalid file path');
        }
        createBackup(projectId, filename);
        const filePath = path_1.default.join(PROJECTS_DIR, projectId, filename);
        fs_1.default.writeFileSync(filePath, content, 'utf-8');
        return `File ${filename} written successfully.`;
    }),
    createFile: (args, projectId) => __awaiter(void 0, void 0, void 0, function* () {
        const { filename, content } = args;
        if (!validateFilePath(projectId, filename)) {
            throw new Error('Invalid file path');
        }
        const filePath = path_1.default.join(PROJECTS_DIR, projectId, filename);
        if (fs_1.default.existsSync(filePath)) {
            throw new Error('File already exists');
        }
        fs_1.default.writeFileSync(filePath, content, 'utf-8');
        return `File ${filename} created successfully.`;
    }),
    deleteFile: (args, projectId) => __awaiter(void 0, void 0, void 0, function* () {
        const { filename } = args;
        if (!validateFilePath(projectId, filename)) {
            throw new Error('Invalid file path');
        }
        const filePath = path_1.default.join(PROJECTS_DIR, projectId, filename);
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error('File does not exist');
        }
        // Create a backup before deletion
        createBackup(projectId, filename);
        fs_1.default.unlinkSync(filePath);
        return `File ${filename} deleted successfully.`;
    }),
    // Add more handlers as needed
};
// ------------------ API Routes ------------------
/**
 * 1) List all files in a project directory (only .html, .css, .js).
 */
app.get('/api/:projectId/files', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
    try {
        if (!fs_1.default.existsSync(projectDir)) {
            const error = new Error('Project not found');
            error.status = 404;
            throw error;
        }
        const files = fs_1.default
            .readdirSync(projectDir)
            .filter((file) => {
            const ext = path_1.default.extname(file).toLowerCase();
            return ALLOWED_EXTENSIONS.includes(ext);
        });
        res.json(files);
    }
    catch (err) {
        next(err);
    }
}));
/**
 * 2) Read a file’s content
 */
app.get('/api/:projectId/file', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const { filename } = req.query;
    if (!filename || typeof filename !== 'string') {
        const error = new Error('Missing filename query param');
        error.status = 400;
        return next(error);
    }
    try {
        if (!validateFilePath(projectId, filename)) {
            const error = new Error('File not allowed or invalid path');
            error.status = 403;
            throw error;
        }
        const filePath = path_1.default.join(PROJECTS_DIR, projectId, filename);
        if (!fs_1.default.existsSync(filePath)) {
            const error = new Error('File does not exist');
            error.status = 404;
            throw error;
        }
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        res.json({ content });
    }
    catch (err) {
        next(err);
    }
}));
// Apply similar try-catch structures to other endpoints
/**
 * 3) Write/update a file (with backup).
 */
app.post('/api/:projectId/file', [
    (0, express_validator_1.body)('filename')
        .isString()
        .withMessage('Filename must be a string')
        .notEmpty()
        .withMessage('Filename is required'),
    (0, express_validator_1.body)('content')
        .isString()
        .withMessage('Content must be a string'),
], (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation Error');
        error.status = 400;
        error.message = errors.array().map(err => err.msg).join(', ');
        return next(error);
    }
    const { projectId } = req.params;
    const { filename, content } = req.body;
    try {
        if (!validateFilePath(projectId, filename)) {
            const error = new Error('File not allowed or invalid path');
            error.status = 403;
            throw error;
        }
        // Create a backup first
        createBackup(projectId, filename);
        // Then write
        const filePath = path_1.default.join(PROJECTS_DIR, projectId, filename);
        fs_1.default.writeFileSync(filePath, content, 'utf-8');
        res.json({ message: 'File updated successfully' });
        // Emit real-time update to clients
        io.emit('fileUpdated', { projectId, filename });
    }
    catch (err) {
        next(err);
    }
}));
/**
 * 4) List Backups for a File
 */
app.get('/api/:projectId/file/backups', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectId } = req.params;
    const { filename } = req.query;
    if (!filename || typeof filename !== 'string') {
        const error = new Error('Missing filename query param');
        error.status = 400;
        return next(error);
    }
    try {
        const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
        const backupsDir = path_1.default.join(projectDir, '.backups');
        if (!fs_1.default.existsSync(backupsDir)) {
            return res.json({ backups: [] });
        }
        const backups = fs_1.default.readdirSync(backupsDir).filter(file => file.startsWith(`${filename}.`) && file.endsWith('.bak'));
        res.json({ backups });
    }
    catch (err) {
        next(err);
    }
}));
/**
 * 5) Restore a Backup
 */
app.post('/api/:projectId/file/restore', [
    (0, express_validator_1.body)('filename')
        .isString()
        .withMessage('Filename must be a string')
        .notEmpty()
        .withMessage('Filename is required'),
    (0, express_validator_1.body)('backupName')
        .isString()
        .withMessage('Backup name must be a string')
        .notEmpty()
        .withMessage('Backup name is required'),
], (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation Error');
        error.status = 400;
        error.message = errors.array().map(err => err.msg).join(', ');
        return next(error);
    }
    const { projectId } = req.params;
    const { filename, backupName } = req.body;
    try {
        if (!validateFilePath(projectId, filename)) {
            const error = new Error('File not allowed or invalid path');
            error.status = 403;
            throw error;
        }
        const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
        const backupsDir = path_1.default.join(projectDir, '.backups');
        const backupFilePath = path_1.default.join(backupsDir, backupName);
        if (!fs_1.default.existsSync(backupFilePath)) {
            const error = new Error('Backup file does not exist');
            error.status = 404;
            throw error;
        }
        // Create a backup of the current file before restoring
        createBackup(projectId, filename);
        // Restore the backup
        fs_1.default.copyFileSync(backupFilePath, path_1.default.join(projectDir, filename));
        res.json({ message: `File ${filename} restored from backup ${backupName}` });
        // Emit real-time update to clients
        io.emit('fileRestored', { projectId, filename, backupName });
    }
    catch (err) {
        next(err);
    }
}));
/**
 * 6) Delete a Backup
 */
app.delete('/api/:projectId/file/backups', [
    (0, express_validator_1.body)('filename')
        .isString()
        .withMessage('Filename must be a string')
        .notEmpty()
        .withMessage('Filename is required'),
    (0, express_validator_1.body)('backupName')
        .isString()
        .withMessage('Backup name must be a string')
        .notEmpty()
        .withMessage('Backup name is required'),
], (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation Error');
        error.status = 400;
        error.message = errors.array().map(err => err.msg).join(', ');
        return next(error);
    }
    const { projectId } = req.params;
    const { filename, backupName } = req.body;
    try {
        if (!validateFilePath(projectId, filename)) {
            const error = new Error('File not allowed or invalid path');
            error.status = 403;
            throw error;
        }
        const projectDir = path_1.default.join(PROJECTS_DIR, projectId);
        const backupsDir = path_1.default.join(projectDir, '.backups');
        const backupFilePath = path_1.default.join(backupsDir, backupName);
        if (!fs_1.default.existsSync(backupFilePath)) {
            const error = new Error('Backup file does not exist');
            error.status = 404;
            throw error;
        }
        fs_1.default.unlinkSync(backupFilePath);
        res.json({ message: `Backup ${backupName} deleted successfully` });
        // Emit real-time update to clients
        io.emit('backupDeleted', { projectId, filename, backupName });
    }
    catch (err) {
        next(err);
    }
}));
/**
 * 7) GPT Chat Instructions Endpoint
 *    - Parses user instructions, plans changes, and executes them.
 */
app.post('/api/chat', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { userMessages, projectId } = req.body;
    if (!Array.isArray(userMessages)) {
        return res.status(400).json({ error: 'userMessages must be an array of strings' });
    }
    if (!projectId || typeof projectId !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid projectId' });
    }
    try {
        // Initialize conversation with user messages
        const messages = userMessages.map((msg) => ({
            role: 'user', // Explicitly set as 'user'
            content: msg
        }));
        const response = yield openai.createChatCompletion({
            model: 'gpt-4',
            messages,
        });
        const gptReply = (_b = (_a = response.data.choices[0].message) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.trim();
        if (!gptReply) {
            throw new Error('GPT returned empty response');
        }
        // Attempt to parse GPT's response as JSON for function calls
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(gptReply);
        }
        catch (parseError) {
            // If parsing fails, return GPT's reply as is
            return res.json({ reply: gptReply });
        }
        if (parsedResponse.function_calls && parsedResponse.function_calls.length > 0) {
            const results = [];
            for (const funcCall of parsedResponse.function_calls) {
                const handler = FUNCTION_HANDLERS[funcCall.name];
                if (handler) {
                    try {
                        const result = yield handler(funcCall.arguments, projectId);
                        results.push({ function: funcCall.name, status: 'success', result });
                    }
                    catch (funcError) {
                        results.push({ function: funcCall.name, status: 'error', error: funcError.message });
                    }
                }
                else {
                    results.push({ function: funcCall.name, status: 'error', error: 'Unknown function' });
                }
            }
            // Optionally, you can feed the results back to GPT for iterative improvements
            return res.json({ reply: parsedResponse.explanation, functionResults: results });
        }
        else {
            // No function calls, return GPT's reply
            res.json({ reply: gptReply });
        }
    }
    catch (error) {
        next(error);
    }
}));
/**
 * 8) Serve the Actual Website Files for Live Preview
 *    For example: GET /projects/:projectId/index.html
 *    We'll rely on Express static for that:
 */
app.use('/projects/:projectId', (req, res, next) => {
    const projectDir = path_1.default.join(PROJECTS_DIR, req.params.projectId);
    if (!fs_1.default.existsSync(projectDir)) {
        return res.status(404).send('Project not found');
    }
    express_1.default.static(projectDir)(req, res, next);
});
// ------------------ Socket.IO Event Handling ------------------
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
    // Additional event listeners can be added here as needed
});
// Apply the error handler middleware after all routes
app.use(errorHandler_1.errorHandler);
// Start server
server.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});
