# Development Assistant Bot

A comprehensive CLI tool that assists developers with code review, formatting, project analysis, and deployment planning using multiple MCP servers.

## Features

- **Code Analysis**: Analyze project structure and code quality
- **Code Formatting**: Format code using Prettier across multiple languages
- **Code Review**: AI-powered code review with suggestions
- **Documentation Generation**: Generate documentation for code
- **Project Scanning**: Scan projects for issues and metrics
- **Deployment Planning**: Create deployment strategies
- **Knowledge Management**: Search and create documentation

## Prerequisites

- Node.js 18+
- MCP TypeScript Demo project built
- All MCP servers available

## Installation

```bash
cd docs/examples/use-cases/dev-assistant
npm install
npm run build
```

## Usage

### Quick Start

```bash
# Analyze current project
npm run assistant analyze

# Format all TypeScript files
npm run assistant format **/*.ts

# Review a specific file
npm run assistant review src/index.ts

# Create deployment plan
npm run assistant deploy --service api-gateway --env staging
```

### Available Commands

#### Project Analysis
```bash
# Analyze project structure
assistant analyze [directory]

# Scan for code issues
assistant scan [--pattern="**/*.ts"] [--max-files=100]

# Get project metrics
assistant metrics [--detailed]
```

#### Code Operations
```bash
# Format code files
assistant format <pattern> [--language=typescript]

# Review code
assistant review <file> [--type=security|performance|style]

# Generate documentation
assistant docs <file> [--style=jsdoc|markdown]
```

#### Knowledge Management
```bash
# Search documentation
assistant search <query> [--category=development]

# Create new documentation
assistant create-doc --title="Title" --content="Content"

# List categories
assistant categories
```

#### Infrastructure Operations
```bash
# Check service health
assistant health [--service=name] [--env=prod]

# Plan deployment
assistant deploy --service=name --version=1.0.0 --env=staging

# Get system metrics
assistant system-metrics [--timerange=1h]
```

### Interactive Mode

```bash
# Start interactive assistant
assistant interactive

> Welcome to the Development Assistant!
> Type 'help' for available commands or 'exit' to quit.

assistant> analyze
🔍 Analyzing current project...
📊 Found 45 TypeScript files
📋 Analysis complete! Summary:
  - Total files: 45
  - Average complexity: 7.2
  - Test coverage: 85%
  - Issues found: 3

assistant> review src/server.ts
🔍 Reviewing src/server.ts...
📝 Code Review Results:
  ✅ Code structure looks good
  ⚠️  Consider adding error handling for async operations
  💡 Suggestion: Add JSDoc comments for public methods

assistant> exit
👋 Goodbye!
```

## Project Structure

```
dev-assistant/
├── src/
│   ├── index.ts              # Main CLI entry point
│   ├── commands/             # Command implementations
│   │   ├── analyze.ts
│   │   ├── format.ts
│   │   ├── review.ts
│   │   └── deploy.ts
│   ├── services/             # MCP service clients
│   │   ├── dev-tools.ts
│   │   ├── knowledge.ts
│   │   ├── analytics.ts
│   │   └── cloud-ops.ts
│   ├── utils/                # Utility functions
│   │   ├── config.ts
│   │   ├── formatter.ts
│   │   └── logger.ts
│   └── types/                # Type definitions
│       └── index.ts
├── config/
│   └── servers.json          # MCP server configurations
├── templates/                # Templates for generated content
└── examples/                 # Usage examples
```

## Implementation

### Main CLI Interface

```typescript
// src/index.ts
import { Command } from 'commander';
import { DevAssistant } from './assistant';

const program = new Command();

program
  .name('assistant')
  .description('AI-powered development assistant')
  .version('1.0.0');

program
  .command('analyze [directory]')
  .description('Analyze project structure and code quality')
  .option('-d, --detailed', 'Show detailed analysis')
  .action(async (directory, options) => {
    const assistant = new DevAssistant();
    await assistant.analyze(directory || '.', options);
  });

program
  .command('format <pattern>')
  .description('Format code files')
  .option('-l, --language <lang>', 'Programming language')
  .action(async (pattern, options) => {
    const assistant = new DevAssistant();
    await assistant.format(pattern, options);
  });

program
  .command('review <file>')
  .description('Perform code review')
  .option('-t, --type <type>', 'Review type', 'general')
  .action(async (file, options) => {
    const assistant = new DevAssistant();
    await assistant.review(file, options);
  });

program
  .command('interactive')
  .description('Start interactive mode')
  .action(async () => {
    const assistant = new DevAssistant();
    await assistant.interactive();
  });

program.parse();
```

### Core Assistant Class

```typescript
// src/assistant.ts
import { DevToolsService } from './services/dev-tools';
import { KnowledgeService } from './services/knowledge';
import { CloudOpsService } from './services/cloud-ops';
import { AnalyticsService } from './services/analytics';
import { Logger } from './utils/logger';

export class DevAssistant {
  private devTools: DevToolsService;
  private knowledge: KnowledgeService;
  private cloudOps: CloudOpsService;
  private analytics: AnalyticsService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('dev-assistant');
    this.devTools = new DevToolsService();
    this.knowledge = new KnowledgeService();
    this.cloudOps = new CloudOpsService();
    this.analytics = new AnalyticsService();
  }

  async analyze(directory: string, options: any) {
    this.logger.info('🔍 Analyzing project...', { directory });

    try {
      // Connect to services
      await this.devTools.connect();
      await this.analytics.connect();

      // Scan project files
      const scanResult = await this.devTools.scanProject({
        directory,
        pattern: '**/*.{ts,tsx,js,jsx}',
        scanType: options.detailed ? 'detailed' : 'quick'
      });

      // Generate analytics
      const metrics = await this.analytics.calculateStatistics({
        data: scanResult.metrics.complexity
      });

      // Display results
      this.displayAnalysisResults(scanResult, metrics);

    } catch (error) {
      this.logger.error('Analysis failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async format(pattern: string, options: any) {
    this.logger.info('🎨 Formatting code files...', { pattern });

    try {
      await this.devTools.connect();

      // List matching files
      const files = await this.devTools.listProjectFiles({
        pattern,
        maxDepth: 5
      });

      this.logger.info(`Found ${files.files.length} files to format`);

      // Format each file
      for (const file of files.files) {
        const content = await this.devTools.readFile({
          filePath: file.path
        });

        const formatted = await this.devTools.formatCode({
          code: content.content,
          language: options.language || this.detectLanguage(file.path)
        });

        // Write back formatted content (in real implementation)
        this.logger.info(`✅ Formatted ${file.path}`);
      }

    } catch (error) {
      this.logger.error('Formatting failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async review(filePath: string, options: any) {
    this.logger.info('📝 Reviewing code...', { filePath });

    try {
      await this.devTools.connect();

      // Read file content
      const fileContent = await this.devTools.readFile({
        filePath
      });

      // Perform interactive code review
      const review = await this.devTools.interactiveCodeReview({
        code: fileContent.content,
        language: this.detectLanguage(filePath)
      });

      // Display review results
      this.displayReviewResults(review);

    } catch (error) {
      this.logger.error('Code review failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async interactive() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('🤖 Welcome to the Development Assistant!');
    console.log('Type "help" for available commands or "exit" to quit.\n');

    while (true) {
      const input = await this.prompt(rl, 'assistant> ');
      const [command, ...args] = input.trim().split(' ');

      if (command === 'exit') {
        break;
      }

      await this.handleInteractiveCommand(command, args);
    }

    rl.close();
    await this.cleanup();
  }

  private async handleInteractiveCommand(command: string, args: string[]) {
    switch (command) {
      case 'help':
        this.showHelp();
        break;
      case 'analyze':
        await this.analyze(args[0] || '.', {});
        break;
      case 'format':
        if (args[0]) {
          await this.format(args[0], {});
        } else {
          console.log('Usage: format <pattern>');
        }
        break;
      case 'review':
        if (args[0]) {
          await this.review(args[0], {});
        } else {
          console.log('Usage: review <file>');
        }
        break;
      case 'search':
        await this.searchDocs(args.join(' '));
        break;
      case 'health':
        await this.checkHealth();
        break;
      default:
        console.log(`Unknown command: ${command}. Type "help" for available commands.`);
    }
  }

  private async searchDocs(query: string) {
    if (!query) {
      console.log('Usage: search <query>');
      return;
    }

    try {
      await this.knowledge.connect();
      
      const results = await this.knowledge.searchDocuments({
        query,
        limit: 5
      });

      console.log(`\n📚 Search results for "${query}":`);
      console.log(results.content[0].text);
    } catch (error) {
      this.logger.error('Search failed:', error);
    }
  }

  private async checkHealth() {
    try {
      await this.cloudOps.connect();
      
      const health = await this.cloudOps.checkServiceHealth({});
      
      console.log('\n🏥 Service Health Status:');
      console.log(health.content[0].text);
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'json': 'json',
      'css': 'css',
      'html': 'html',
      'md': 'markdown'
    };
    return languageMap[ext || ''] || 'text';
  }

  private displayAnalysisResults(scanResult: any, metrics: any) {
    console.log('\n📊 Project Analysis Results:');
    console.log('=' .repeat(50));
    console.log(`📁 Files scanned: ${scanResult.filesScanned}`);
    console.log(`📏 Lines of code: ${scanResult.totalLines}`);
    console.log(`📈 Average complexity: ${metrics.mean?.toFixed(1)}`);
    console.log(`🔧 Issues found: ${scanResult.issues?.length || 0}`);
    
    if (scanResult.issues?.length > 0) {
      console.log('\n⚠️  Issues:');
      scanResult.issues.forEach((issue: any, index: number) => {
        console.log(`  ${index + 1}. ${issue.message} (${issue.file}:${issue.line})`);
      });
    }
  }

  private displayReviewResults(review: any) {
    console.log('\n📝 Code Review Results:');
    console.log('=' .repeat(50));
    console.log(review.content[0].text);
  }

  private showHelp() {
    console.log(`
Available commands:
  analyze [dir]     - Analyze project structure
  format <pattern>  - Format code files
  review <file>     - Review code file
  search <query>    - Search documentation
  health           - Check service health
  help             - Show this help
  exit             - Exit assistant
`);
  }

  private prompt(rl: any, question: string): Promise<string> {
    return new Promise(resolve => {
      rl.question(question, resolve);
    });
  }

  private async cleanup() {
    await this.devTools.disconnect();
    await this.knowledge.disconnect();
    await this.cloudOps.disconnect();
    await this.analytics.disconnect();
  }
}
```

### Service Clients

```typescript
// src/services/dev-tools.ts
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class DevToolsService {
  private client: McpClient;
  private transport: StdioClientTransport;

  constructor() {
    this.transport = new StdioClientTransport({
      command: 'node',
      args: ['../../../../packages/servers/dev-tools/dist/index.js']
    });

    this.client = new McpClient({
      name: 'dev-assistant-devtools',
      version: '1.0.0'
    }, {
      capabilities: { logging: {} }
    });
  }

  async connect() {
    await this.client.connect(this.transport);
    await this.client.initialize();
  }

  async disconnect() {
    await this.client.disconnect();
  }

  async scanProject(params: any) {
    return await this.client.callTool('scan_project', params);
  }

  async formatCode(params: any) {
    return await this.client.callTool('format_code', params);
  }

  async listProjectFiles(params: any) {
    return await this.client.callTool('list_project_files', params);
  }

  async readFile(params: any) {
    return await this.client.callTool('read_file', params);
  }

  async interactiveCodeReview(params: any) {
    return await this.client.callTool('interactive_code_review', params);
  }
}
```

## Configuration

```json
// config/servers.json
{
  "servers": {
    "devTools": {
      "transport": "stdio",
      "command": "node",
      "args": ["../../../packages/servers/dev-tools/dist/index.js"],
      "port": 3001
    },
    "knowledge": {
      "transport": "stdio", 
      "command": "node",
      "args": ["../../../packages/servers/knowledge/dist/index.js"],
      "port": 3004
    },
    "analytics": {
      "transport": "stdio",
      "command": "node", 
      "args": ["../../../packages/servers/analytics/dist/index.js"],
      "port": 3002
    },
    "cloudOps": {
      "transport": "stdio",
      "command": "node",
      "args": ["../../../packages/servers/cloud-ops/dist/index.js"],
      "port": 3003
    }
  }
}
```

## Example Workflows

### 1. Pre-commit Code Review
```bash
# Format all changed files
assistant format $(git diff --name-only --cached)

# Review critical files
assistant review src/server.ts
assistant review src/database.ts

# Run project analysis
assistant analyze --detailed
```

### 2. Deployment Preparation
```bash
# Check current service health
assistant health --env=staging

# Plan deployment
assistant deploy --service=api-server --version=2.1.0 --env=staging

# Update documentation
assistant create-doc --title="Deployment v2.1.0" --content="$(cat CHANGELOG.md)"
```

### 3. Code Quality Audit
```bash
# Scan entire project
assistant scan --pattern="**/*.ts" --detailed

# Generate documentation for new modules
assistant docs src/new-feature.ts --style=markdown

# Search for existing patterns
assistant search "error handling patterns"
```

This development assistant demonstrates how to integrate multiple MCP servers into a cohesive tool that enhances developer productivity across the entire development lifecycle.