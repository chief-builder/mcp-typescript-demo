# MCP Development Tools Server

A Model Context Protocol server that provides development tools including code formatting, linting, testing, and bundle analysis.

## Features

### Resources
- **Configuration Files**: Access to Prettier, ESLint, and TypeScript configurations
- **Project Files**: Dynamic listing of source files in the project

### Tools
- **format_code**: Format code using Prettier with language-specific support
- **lint_code**: Lint code files with ESLint, with optional auto-fix
- **run_tests**: Execute test suites with coverage reporting
- **analyze_bundle**: Analyze JavaScript bundle size and dependencies

### Prompts
- **code_review**: Comprehensive code review with actionable feedback
- **refactor_suggestion**: Suggest refactoring improvements
- **generate_tests**: Generate unit tests for code
- **document_code**: Generate documentation for code

## Usage

### As a stdio server:
```bash
npm run build
npm start
```

### In an MCP client:
```json
{
  "mcpServers": {
    "dev-tools": {
      "command": "node",
      "args": ["/path/to/mcp-dev-tools"],
      "transport": "stdio"
    }
  }
}
```

## Examples

### Format code:
```typescript
// Tool: format_code
{
  "code": "const x={a:1,b:2}",
  "language": "typescript"
}
// Returns: "const x = { a: 1, b: 2 };"
```

### Run tests:
```typescript
// Tool: run_tests
{
  "pattern": "*.test.ts",
  "coverage": true
}
// Returns test results with coverage percentage
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```