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
exports.searchCommand = searchCommand;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const path_1 = __importDefault(require("path"));
const file_utils_1 = require("../utils/file-utils");
/**
 * Register the search command to the CLI program
 */
function searchCommand(program) {
    program
        .command('search')
        .description('Search for patterns in your codebase')
        .argument('<pattern>', 'Pattern to search for')
        .option('-f, --file-pattern <pattern>', 'File glob pattern to search in', '**/*.*')
        .option('-i, --ignore <dirs>', 'Comma-separated list of directories to ignore', 'node_modules,dist,.git')
        .option('-c, --case-sensitive', 'Enable case-sensitive search', false)
        .action((pattern, options) => __awaiter(this, void 0, void 0, function* () {
        yield executeSearch(pattern, options);
    }));
}
/**
 * Execute the search operation
 */
function executeSearch(pattern, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const spinner = (0, ora_1.default)('Searching files...').start();
        try {
            // Parse ignore directories
            const ignoreDirs = options.ignore.split(',').map(dir => dir.trim());
            // Find files matching the pattern
            const files = yield (0, file_utils_1.findFiles)(options.filePattern, ignoreDirs);
            if (files.length === 0) {
                spinner.fail('No files found matching the pattern');
                return;
            }
            spinner.text = `Found ${files.length} files. Searching for matches...`;
            // Search for pattern in each file
            const results = [];
            for (const filePath of files) {
                try {
                    const fileData = yield (0, file_utils_1.readFile)(filePath);
                    const fileResults = searchInContent(fileData.content, pattern, filePath, options.caseSensitive);
                    results.push(...fileResults);
                }
                catch (error) {
                    // Skip files that can't be read (binary, etc.)
                    continue;
                }
            }
            // Display results
            if (results.length === 0) {
                spinner.succeed('Search complete. No matches found.');
            }
            else {
                spinner.succeed(`Search complete. Found ${results.length} matches.`);
                displaySearchResults(results);
            }
        }
        catch (error) {
            spinner.fail(`Search failed: ${error}`);
        }
    });
}
/**
 * Search for a pattern in file content
 */
function searchInContent(content, pattern, filePath, caseSensitive) {
    const results = [];
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
function displaySearchResults(results) {
    console.log('\nSearch results:');
    for (const result of results) {
        const relativePath = path_1.default.relative(process.cwd(), result.file);
        // Print file path and line number
        console.log(`\n${chalk_1.default.cyan(relativePath)}:${chalk_1.default.yellow(result.line)}`);
        // Print the matched content with highlighted match
        const { content, matchIndex } = result;
        const match = content.substring(matchIndex, matchIndex + content.substring(matchIndex).split(/\s|$|[.,;:?!]/, 1)[0].length);
        const before = content.substring(0, matchIndex);
        const after = content.substring(matchIndex + match.length);
        console.log(`${before}${chalk_1.default.bgYellow.black(match)}${after}`);
    }
}
//# sourceMappingURL=search.js.map