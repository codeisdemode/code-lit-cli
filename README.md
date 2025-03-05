# Code-lit

A local dev ops agent inspired by Claude Code from Anthropic. This CLI tool helps you manage your development workflow more efficiently through a variety of commands for searching, analyzing, executing, and managing git operations in your codebase.

## Features

- **Search**: Find patterns in your codebase with detailed results
- **Analyze**: Scan your code for issues related to dependencies, complexity, security, and performance
- **Execute**: Run shell commands with detailed output and control
- **Git Operations**: Perform git commands with enhanced feedback and interactive features
- **Database Setup**: Configure and manage database connections for your projects
- **Backend Framework**: Set up and run Node.js backend applications

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

Search for patterns in your codebase:

```bash
code-lit search <pattern> [options]

Options:
  -f, --file-pattern <pattern>  File glob pattern to search in (default: "**/*.*")
  -i, --ignore <dirs>           Comma-separated list of directories to ignore (default: "node_modules,dist,.git")
  -c, --case-sensitive          Enable case-sensitive search
```

### Analyze Command

Analyze your codebase for issues:

```bash
code-lit analyze [options]

Options:
  -t, --type <type>             Type of analysis (dependency, complexity, security, performance, all) (default: "all")
  -f, --file-pattern <pattern>  File glob pattern to analyze (default: "**/*.{js,ts,jsx,tsx}")
  -i, --ignore <dirs>           Comma-separated list of directories to ignore (default: "node_modules,dist,.git")
```

### Execute Command

Execute shell commands with additional controls:

```bash
code-lit exec <command> [options]

Options:
  -d, --cwd <directory>         Working directory to run the command in
  -t, --timeout <ms>            Timeout in milliseconds (default: "300000")
  -s, --silent                  Run in silent mode (no output)
  -e, --env <keyValue>          Environment variables in format KEY=VALUE
  -i, --interactive             Run in interactive mode (use for commands requiring input)
```

### Git Commands

Enhanced git operations:

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

## License

MIT

## Acknowledgements

Inspired by Claude Code from Anthropic.
