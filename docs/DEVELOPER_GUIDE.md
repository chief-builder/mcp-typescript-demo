# MCP TypeScript Demo - Developer Guide

## Quick Start

This guide will help you get started with the MCP TypeScript Demo project in under 10 minutes.

### Prerequisites

- Node.js 18+ and pnpm
- Basic knowledge of TypeScript and JSON-RPC
- Understanding of the Model Context Protocol (MCP) concepts

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd mcp-typescript-demo
pnpm install

# Build all packages
pnpm build
```

### Your First MCP Server Connection

Let's connect to the Knowledge Server and perform a basic search:

```typescript
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// 1. Create and connect to the Knowledge Server
const transport = new StdioClientTransport({
  command: 'node',
  args: ['packages/servers/knowledge/dist/index.js']
});

const client = new McpClient({
  name: 'example-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// 2. Initialize the connection
await client.initialize();

// 3. Search for documents
const searchResult = await client.callTool('search_documents', {
  query: 'MCP protocol',
  limit: 5
});

console.log('Search results:', searchResult);
```

## Core Concepts

### MCP Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Client    │◄──►│   Transport     │◄──►│   MCP Server    │
│                 │    │ (STDIO/HTTP/SSE)│    │                 │
│ - Your App      │    │                 │    │ - Tools         │
│ - Claude        │    │                 │    │ - Resources     │
│ - Custom Tool   │    │                 │    │ - Prompts       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

1. **Tools**: Executable functions that perform specific tasks
2. **Resources**: Data sources that can be read and subscribed to
3. **Prompts**: AI-powered assistants with predefined templates
4. **Transport**: Communication layer (STDIO, HTTP, SSE)

## Server Overview

### Knowledge Server
**Best for**: Document management, search, content creation
**Port**: 3004 (HTTP), STDIO (default)

```bash
# Start Knowledge Server
node packages/servers/knowledge/dist/index.js

# With HTTP transport
node packages/servers/knowledge/dist/index.js --transport=http --port=3004
```

### Development Tools Server
**Best for**: Code analysis, formatting, project management
**Port**: 3001 (HTTP), STDIO (default)

```bash
# Start Dev Tools Server
node packages/servers/dev-tools/dist/index.js --transport=http --port=3001
```

### Analytics Server
**Best for**: Data analysis, statistics, visualization
**Port**: 3002 (HTTP), STDIO (default)

```bash
# Start Analytics Server  
node packages/servers/analytics/dist/index.js --transport=http --port=3002
```

### Cloud Operations Server
**Best for**: Infrastructure management, deployments, monitoring
**Port**: 3003 (HTTP), STDIO (default)

```bash
# Start Cloud Ops Server
node packages/servers/cloud-ops/dist/index.js --transport=http --port=3003
```

## Common Usage Patterns

### 1. Document Management with Knowledge Server

```typescript
// Search for documents
const searchResult = await client.callTool('search_documents', {
  query: 'TypeScript tutorial',
  category: 'development',
  limit: 10
});

// Create a new document
const createResult = await client.callTool('create_document', {
  title: 'My TypeScript Guide',
  content: '# TypeScript Basics\n\nTypeScript is...',
  category: 'development',
  tags: ['typescript', 'tutorial', 'programming'],
  author: 'Developer',
  summary: 'A comprehensive guide to TypeScript basics'
});

// Get document by ID
const document = await client.callTool('get_document', {
  documentId: 'doc-123',
  format: 'markdown'
});
```

### 2. Code Analysis with Dev Tools Server

```typescript
// Format code
const formatted = await client.callTool('format_code', {
  code: 'const x=1;const y=2;',
  language: 'typescript'
});

// List project files
const files = await client.callTool('list_project_files', {
  pattern: '**/*.ts',
  exclude: ['node_modules', 'dist'],
  maxDepth: 3
});

// Read file contents
const fileContent = await client.callTool('read_file', {
  filePath: 'src/index.ts',
  maxLines: 50
});
```

### 3. Data Analysis with Analytics Server

```typescript
// Generate sample data
const sampleData = await client.callTool('generate_sample_data', {
  format: 'json',
  recordCount: 1000,
  outputPath: './sample.json'
});

// Calculate statistics
const stats = await client.callTool('calculate_statistics', {
  data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  measures: ['mean', 'median', 'std']
});

// Process large dataset with progress
const processing = await client.callTool('process_large_dataset', {
  operation: 'analyze',
  recordCount: 5000,
  batchSize: 100
});
```

### 4. Infrastructure Management with Cloud Ops Server

```typescript
// Check service health
const health = await client.callTool('check_service_health', {
  serviceName: 'api-gateway',
  environment: 'prod'
});

// Deploy a service
const deployment = await client.callTool('deploy_service', {
  serviceName: 'user-service',
  version: '2.1.0',
  environment: 'staging',
  dryRun: false
});

// Get system metrics
const metrics = await client.callTool('get_system_metrics', {
  timeRange: '1h',
  metrics: ['cpu', 'memory']
});
```

## Working with Resources

Resources provide access to server data and can be subscribed to for real-time updates.

```typescript
// List available resources
const resources = await client.listResources();

// Read a specific resource
const stats = await client.readResource('knowledge://stats/overview');

// Subscribe to resource changes (if supported)
client.subscribe('knowledge://documents/recent', (notification) => {
  console.log('Documents updated:', notification);
});
```

## Using Prompts

Prompts are AI-powered assistants that help with complex tasks.

```typescript
// List available prompts
const prompts = await client.listPrompts();

// Use the research assistant prompt
const research = await client.getPrompt('research_assistant', {
  topic: 'Machine Learning fundamentals',
  depth: 'comprehensive',
  focusAreas: 'neural networks, deep learning'
});

// Use the code review prompt
const review = await client.getPrompt('code_review', {
  filePath: './src/complex-algorithm.ts',
  reviewType: 'security',
  language: 'typescript'
});
```

## Progress Notifications

Long-running operations send progress updates:

```typescript
// Listen for progress notifications
client.setNotificationHandler('notifications/progress', (notification) => {
  const { progressToken, progress, total } = notification.params;
  console.log(`Progress: ${progress}/${total} (${Math.round(progress/total*100)}%)`);
});

// Start a long-running operation
await client.callTool('bulk_knowledge_processing', {
  operation: 'analyze',
  targetScope: 'all',
  batchSize: 10
});
```

## Error Handling

```typescript
try {
  const result = await client.callTool('search_documents', {
    query: 'test'
  });
} catch (error) {
  if (error.code === -32602) {
    console.error('Invalid parameters:', error.message);
  } else if (error.code === -32603) {
    console.error('Internal server error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Transport Options

### STDIO Transport (Default)
Best for: Command-line tools, CI/CD, local development

```typescript
const transport = new StdioClientTransport({
  command: 'node',
  args: ['path/to/server.js']
});
```

### HTTP Transport
Best for: Web applications, REST API integration

```typescript
const transport = new HttpClientTransport('http://localhost:3001');
```

### SSE Transport
Best for: Real-time web applications, streaming updates

```typescript
const transport = new SSEClientTransport('http://localhost:3001/sse');
```

## Testing Your Integration

### Unit Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';

describe('Knowledge Server Integration', () => {
  let client: McpClient;

  beforeEach(async () => {
    // Setup client
    client = new McpClient({
      name: 'test-client',
      version: '1.0.0'
    }, { capabilities: {} });
    
    // Connect and initialize
    await client.connect(transport);
    await client.initialize();
  });

  afterEach(async () => {
    await client.disconnect();
  });

  it('should search documents successfully', async () => {
    const result = await client.callTool('search_documents', {
      query: 'test',
      limit: 5
    });
    
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Found');
  });
});
```

### Integration Testing

Use the provided MCP Inspector test framework:

```bash
# Run automated tests across all servers
cd test-mcp-inspector
node run-inspector-tests.js
```

## Performance Optimization

### Connection Pooling

```typescript
class MCPConnectionPool {
  private connections = new Map<string, McpClient>();
  
  async getConnection(serverType: string): Promise<McpClient> {
    if (!this.connections.has(serverType)) {
      const client = await this.createConnection(serverType);
      this.connections.set(serverType, client);
    }
    return this.connections.get(serverType)!;
  }
  
  private async createConnection(serverType: string): Promise<McpClient> {
    // Connection logic
  }
}
```

### Batch Operations

```typescript
// Instead of multiple single calls
const results = [];
for (const query of queries) {
  results.push(await client.callTool('search_documents', { query }));
}

// Use batch processing tools
const batchResult = await client.callTool('bulk_knowledge_processing', {
  operation: 'analyze',
  targetScope: 'all',
  batchSize: 50
});
```

### Caching

```typescript
class MCPCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes
  
  async get(key: string, fetcher: () => Promise<any>): Promise<any> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if server is running
   ps aux | grep node
   
   # Check port availability
   lsof -i :3001
   ```

2. **Protocol Version Mismatch**
   ```typescript
   // Ensure client and server use same protocol version
   const client = new McpClient({
     name: 'my-client',
     version: '1.0.0'
   }, {
     capabilities: {},
     protocolVersion: '2025-06-18' // Match server version
   });
   ```

3. **Tool Not Found**
   ```typescript
   // List available tools first
   const tools = await client.listTools();
   console.log('Available tools:', tools.map(t => t.name));
   ```

### Debug Mode

Enable debug logging:

```typescript
// Set logging level
await client.callTool('logging/setLevel', { level: 'debug' });

// Or set environment variable
process.env.MCP_LOG_LEVEL = 'debug';
```

## Next Steps

1. **Explore the [API Reference](./API_REFERENCE.md)** for detailed tool documentation
2. **Try the [Interactive Examples](./examples/)** to see real-world usage
3. **Build your own MCP server** using the provided templates
4. **Join the community** for support and contributions

## Best Practices

1. **Always initialize connections** before making calls
2. **Handle errors gracefully** with proper try-catch blocks
3. **Use appropriate transports** for your use case
4. **Implement connection pooling** for high-throughput applications
5. **Subscribe to resource updates** for real-time data
6. **Leverage progress notifications** for long-running operations
7. **Cache frequently accessed data** to improve performance
8. **Test your integrations** thoroughly with automated tests

Happy coding with MCP! 🚀