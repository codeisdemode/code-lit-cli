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
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.findFiles = findFiles;
exports.getLanguageFromExtension = getLanguageFromExtension;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
const util_1 = require("util");
// Promisify file operations
const readFileAsync = (0, util_1.promisify)(fs_1.default.readFile);
const writeFileAsync = (0, util_1.promisify)(fs_1.default.writeFile);
/**
 * Read a file from the filesystem
 */
function readFile(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const content = yield readFileAsync(filePath, 'utf-8');
            return {
                path: filePath,
                content,
                language: getLanguageFromExtension(filePath),
            };
        }
        catch (error) {
            throw new Error(`Failed to read file ${filePath}: ${error}`);
        }
    });
}
/**
 * Write content to a file
 */
function writeFile(filePath, content) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Ensure the directory exists
            const dir = path_1.default.dirname(filePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            yield writeFileAsync(filePath, content, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to write to file ${filePath}: ${error}`);
        }
    });
}
/**
 * Find files matching a pattern
 */
function findFiles(pattern_1) {
    return __awaiter(this, arguments, void 0, function* (pattern, ignoreDirs = ['node_modules', 'dist', '.git']) {
        try {
            const ignore = ignoreDirs.map(dir => `**/${dir}/**`);
            return yield (0, glob_1.glob)(pattern, { ignore });
        }
        catch (error) {
            throw new Error(`Failed to find files matching pattern ${pattern}: ${error}`);
        }
    });
}
/**
 * Get programming language based on file extension
 */
function getLanguageFromExtension(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    const extensionMap = {
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
//# sourceMappingURL=file-utils.js.map