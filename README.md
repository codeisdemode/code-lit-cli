# Code-lit

A powerful local dev ops agent inspired by Claude Code from Anthropic. This CLI tool helps you manage your development workflow more efficiently through a variety of commands for searching, analyzing, executing, and managing git operations in your codebase.

## Features

- **Advanced Search**: Find patterns in your codebase with detailed results and syntax highlighting
- **Code Analysis**: Comprehensive analysis of your code for:
  - Dependencies (unused imports, circular dependencies)
  - Complexity (function length, nesting levels)
  - Security (common vulnerabilities, unsafe practices)
  - Performance (bottlenecks, optimization opportunities)
- **Smart Execution**: Run shell commands with detailed output, timeout control, and environment variable management
- **Enhanced Git Operations**: Perform git commands with interactive features and detailed feedback
- **Database Management**: Configure and manage database connections for various database types
- **Backend Framework**: Set up and run Node.js backend applications with multiple framework options

## Installation

```bash
# Install globally
npm install -g code-lit

# Or run directly with npx
npx code-lit
```

## Usage

### Basic Commands

```bash
# Show help
code-lit --help

# Search for a pattern in your codebase
code-lit search "TODO" --file-pattern "**/*.js" --ignore "node_modules,dist"

# Analyze your code for issues
code-lit analyze --type security --file-pattern "**/*.ts"

# Execute a shell command
code-lit exec "npm test" --silent

# Git operations
code-lit git status
code-lit git commit -m "Your commit message"
code-lit git push
```

### Search Command

Search for patterns in your codebase with syntax highlighting and detailed results:

```bash
code-lit search <pattern> [options]

Options:
  -f, --file-pattern <pattern>  File glob pattern to search in (default: "**/*.*")
  -i, --ignore <dirs>           Comma-separated list of directories to ignore (default: "node_modules,dist,.git")
  -c, --case-sensitive          Enable case-sensitive search
```

Features:
- Syntax highlighting for matched content
- Line numbers and file paths
- Context-aware pattern matching
- Progress indicator during search
- Detailed result summary

### Analyze Command

Comprehensive code analysis with multiple analysis types:

```bash
code-lit analyze [options]

Options:
  -t, --type <type>             Type of analysis (dependency, complexity, security, performance, all) (default: "all")
  -f, --file-pattern <pattern>  File glob pattern to analyze (default: "**/*.{js,ts,jsx,tsx}")
  -i, --ignore <dirs>           Comma-separated list of directories to ignore (default: "node_modules,dist,.git")
```

Analysis Types:
1. **Dependency Analysis**
   - Detects unused imports
   - Identifies circular dependencies
   - Suggests dependency optimizations

2. **Complexity Analysis**
   - Function length checks
   - Nesting level analysis
   - Code structure recommendations

3. **Security Analysis**
   - Common vulnerability patterns
   - Unsafe coding practices
   - Security best practices suggestions

4. **Performance Analysis**
   - Bottleneck detection
   - Optimization opportunities
   - Resource usage patterns

### Execute Command

Execute shell commands with enhanced control and feedback:

```bash
code-lit exec <command> [options]

Options:
  -d, --cwd <directory>         Working directory to run the command in
  -t, --timeout <ms>            Timeout in milliseconds (default: "300000")
  -s, --silent                  Run in silent mode (no output)
  -e, --env <keyValue>          Environment variables in format KEY=VALUE
  -i, --interactive             Run in interactive mode (use for commands requiring input)
```

Features:
- Command timeout control
- Environment variable management
- Interactive mode for user input
- Silent mode for background operations
- Detailed execution feedback

### Git Commands

Enhanced git operations with interactive features:

```bash
code-lit git status
code-lit git commit [options]
code-lit git push [options]
code-lit git pull [options]

Git Commit Options:
  -m, --message <message>       Commit message
  -a, --all                     Automatically stage modified and deleted files
  -i, --interactive             Use interactive mode to choose files

Git Push Options:
  -b, --branch <branch>         The branch to push to
  -f, --force                   Force push

Git Pull Options:
  -b, --branch <branch>         The branch to pull from
  -r, --rebase                  Rebase instead of merge
```

Features:
- Interactive file staging
- Detailed status information
- Branch management
- Conflict resolution assistance
- Commit message validation

### Database Commands

Set up and manage database connections:

```bash
code-lit database [options]

Options:
  -t, --type <type>             Database type (mongodb, mysql, postgresql, sqlite)
  -n, --name <name>             Database name
  -h, --host <host>             Database host
  -p, --port <port>             Database port
  -u, --username <username>     Database username
  --password <password>         Database password
  -s, --setup                   Setup a new database connection
  -m, --migrate <file>          Run migrations from a file
  -g, --generate-schema         Generate schema from an existing database
```

Features:
- Multiple database type support
- Connection testing
- Migration management
- Schema generation
- Secure credential handling

### Backend Commands

Set up and run Node.js backend applications:

```bash
code-lit backend [options]

Options:
  -s, --setup <type>            Setup a new backend (express, koa, fastify, nestjs)
  -p, --port <number>           Port to run the server on (default: 3000)
  -d, --dev                     Run in development mode with hot-reloading
  -b, --build                   Build the backend for production
  -r, --run                     Run the backend server
  -t, --test                    Run backend tests
```

Features:
- Multiple framework support
- Development mode with hot-reloading
- Production build optimization
- Test runner integration
- Environment configuration

## Development

To contribute or modify this tool:

```bash
# Clone the repository
git clone https://github.com/yourusername/code-lit.git
cd code-lit

# Install dependencies
npm install

# Build the TypeScript files
npm run build

# Link for local development
npm link

# Run in development mode (watch for changes)
npm run dev
```

## Project Structure

```
code-lit/
├── src/
│   ├── commands/          # Command implementations
│   ├── utils/            # Utility functions
│   ├── tools/            # External tool integrations
│   └── index.ts          # Main CLI entry point
├── tests/                # Test files
├── package.json          # Project configuration
└── tsconfig.json         # TypeScript configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Acknowledgements

Inspired by Claude Code from Anthropic.
