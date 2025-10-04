# Basic MCP Connection Tutorial

This tutorial walks you through making your first connection to an MCP server and executing a simple tool call.

## Prerequisites

- Node.js 18+ installed
- MCP TypeScript Demo project built (`pnpm build`)
- Basic understanding of TypeScript/JavaScript

## Step 1: Set up the Project

Create a new directory for this example:

```bash
mkdir basic-connection-example
cd basic-connection-example
npm init -y
npm install @modelcontextprotocol/sdk
```

## Step 2: Create the Basic Client

Create `index.ts`:

```typescript
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function basicExample() {
  console.log('🚀 Starting MCP Basic Connection Example');

  // Step 1: Create transport
  console.log('📡 Creating STDIO transport...');
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../packages/servers/knowledge/dist/index.js']
  });

  // Step 2: Create client
  console.log('🔧 Creating MCP client...');
  const client = new McpClient({
    name: 'basic-example-client',
    version: '1.0.0'
  }, {
    capabilities: {
      logging: {}
    }
  });

  try {
    // Step 3: Connect
    console.log('🔗 Connecting to server...');
    await client.connect(transport);

    // Step 4: Initialize
    console.log('🚀 Initializing connection...');
    const initResult = await client.initialize();
    console.log('✅ Connected! Server capabilities:', initResult.capabilities);

    // Step 5: List available tools
    console.log('🛠️  Fetching available tools...');
    const tools = await client.listTools();
    console.log('📋 Available tools:');
    tools.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Step 6: Make a simple tool call
    console.log('🔍 Searching for documents...');
    const searchResult = await client.callTool('search_documents', {
      query: 'MCP protocol',
      limit: 3
    });

    console.log('📄 Search results:');
    console.log(searchResult.content[0].text);

    // Step 7: List resources
    console.log('📚 Fetching available resources...');
    const resources = await client.listResources();
    console.log('🗃️  Available resources:');
    resources.resources.forEach(resource => {
      console.log(`  - ${resource.name}: ${resource.description}`);
    });

    // Step 8: Read a resource
    console.log('📊 Reading knowledge base stats...');
    const statsResult = await client.readResource('knowledge://stats/overview');
    console.log('📈 Stats:');
    console.log(statsResult.contents[0].text);

    console.log('🎉 Example completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Step 9: Clean up
    console.log('🧹 Cleaning up...');
    await client.disconnect();
  }
}

// Run the example
basicExample().catch(console.error);
```

## Step 3: Create Package Configuration

Create `package.json` script:

```json
{
  "name": "basic-connection-example",
  "scripts": {
    "start": "tsx index.ts",
    "dev": "tsx watch index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "tsx": "^4.0.0"
  }
}
```

## Step 4: Run the Example

```bash
npm run start
```

Expected output:
```
🚀 Starting MCP Basic Connection Example
📡 Creating STDIO transport...
🔧 Creating MCP client...
🔗 Connecting to server...
🚀 Initializing connection...
✅ Connected! Server capabilities: { logging: {}, elicitation: {}, ... }
🛠️  Fetching available tools...
📋 Available tools:
  - search_documents: Search through the knowledge base using keywords
  - get_document: Retrieve a specific document by ID
  - create_document: Create a new document in the knowledge base
  ...
🔍 Searching for documents...
📄 Search results:
# Search Results for "MCP protocol"

Found 1 documents:

## 1. MCP Protocol Overview (98.1% match)
...
📚 Fetching available resources...
🗃️  Available resources:
  - knowledge_base_stats: Overview statistics of the knowledge base
  - recent_documents: Recently added documents to the knowledge base
  ...
📊 Reading knowledge base stats...
📈 Stats:
## Knowledge Base Statistics

**Total Documents**: 3
**Categories**: 3 (documentation, development, security)
...
🎉 Example completed successfully!
🧹 Cleaning up...
```

## Understanding the Code

### 1. Transport Layer
```typescript
const transport = new StdioClientTransport({
  command: 'node',
  args: ['../packages/servers/knowledge/dist/index.js']
});
```
- Creates STDIO transport to communicate with the server
- Spawns the server process automatically
- Handles JSON-RPC communication over stdin/stdout

### 2. Client Creation
```typescript
const client = new McpClient({
  name: 'basic-example-client',
  version: '1.0.0'
}, {
  capabilities: { logging: {} }
});
```
- Creates MCP client with identification
- Declares client capabilities (what features it supports)

### 3. Connection Lifecycle
```typescript
await client.connect(transport);    // Connect transport
await client.initialize();         // Exchange capabilities
// ... use client ...
await client.disconnect();         // Clean up
```
- Always follow connect → initialize → use → disconnect pattern

### 4. Tool Calls
```typescript
const result = await client.callTool('search_documents', {
  query: 'MCP protocol',
  limit: 3
});
```
- Calls server tools with parameters
- Returns structured results
- Handles errors automatically

### 5. Resource Access
```typescript
const stats = await client.readResource('knowledge://stats/overview');
```
- Reads server resources by URI
- Returns typed content
- Supports different MIME types

## Error Handling

Add proper error handling:

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

## Next Steps

1. Try different servers by changing the transport path:
   - Dev Tools: `packages/servers/dev-tools/dist/index.js`
   - Analytics: `packages/servers/analytics/dist/index.js`
   - Cloud Ops: `packages/servers/cloud-ops/dist/index.js`

2. Experiment with different tool parameters

3. Try HTTP transport instead of STDIO:
   ```typescript
   const transport = new HttpClientTransport('http://localhost:3004');
   ```

4. Move on to [Document Management Tutorial](./02-document-management.md)

## Common Issues

### Server Not Found
```
Error: spawn node ENOENT
```
**Solution**: Ensure the server path is correct and the project is built.

### Connection Timeout
```
Error: Connection timeout
```
**Solution**: Check if the server starts correctly by running it manually first.

### Tool Not Found
```
Error: Tool "invalid_tool" not found
```
**Solution**: Use `client.listTools()` to see available tools first.

This completes the basic connection tutorial! You now know how to connect to MCP servers, list capabilities, call tools, and read resources.