# Getting Started with MCP TypeScript Demo

Welcome to the MCP TypeScript Demo! This guide will help you get up and running quickly with the Model Context Protocol implementation.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI assistants to securely connect to data sources and tools. It provides a standardized way for AI models to access and interact with various resources through a JSON-RPC based protocol.

## Quick Setup (5 minutes)

### 1. Prerequisites

Ensure you have the following installed:
- **Node.js 18+**: [Download here](https://nodejs.org/)
- **pnpm**: Install with `npm install -g pnpm`
- **Git**: [Download here](https://git-scm.com/)

### 2. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd mcp-typescript-demo

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### 3. Test Your Setup

```bash
# Run a quick test
node packages/servers/knowledge/dist/index.js --help

# You should see the Knowledge Server help output
```

## Choose Your Path

### 🚀 I want to use existing servers
→ Jump to [Using MCP Servers](#using-mcp-servers)

### 🛠️ I want to build applications with MCP
→ Check out the [Developer Guide](./DEVELOPER_GUIDE.md)

### 📚 I want to understand the APIs
→ Browse the [API Reference](./API_REFERENCE.md)

### 🎮 I want to see it in action
→ Try the [Interactive API Explorer](./api-explorer/index.html)

## Using MCP Servers

### Start Your First Server

```bash
# Start the Knowledge Server
node packages/servers/knowledge/dist/index.js

# In another terminal, test it with our CLI client
node packages/clients/cli/dist/index.js
```

### Available Servers

| Server | Purpose | Default Port | Key Features |
|--------|---------|--------------|--------------|
| **Knowledge Server** | Document management & search | 3004 | Full-text search, AI curation, bulk processing |
| **Dev Tools Server** | Code analysis & formatting | 3001 | Prettier integration, project scanning, code review |
| **Analytics Server** | Data analysis & statistics | 3002 | CSV analysis, statistical calculations, data export |
| **Cloud Ops Server** | Infrastructure management | 3003 | Health monitoring, deployment, scaling |

### Transport Options

#### STDIO (Default)
Best for: CLI tools, automation, CI/CD

```bash
node packages/servers/knowledge/dist/index.js
```

#### HTTP  
Best for: Web applications, REST integration

```bash
node packages/servers/knowledge/dist/index.js --transport=http --port=3004
```

#### Server-Sent Events (SSE)
Best for: Real-time web apps, streaming updates

```bash
node packages/servers/knowledge/dist/index.js --transport=sse --port=3004
```

## Your First MCP Application

Let's build a simple document search application:

### 1. Create Your Project

```bash
mkdir my-mcp-app
cd my-mcp-app
npm init -y
npm install @modelcontextprotocol/sdk
```

### 2. Write the Code

Create `app.js`:

```javascript
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function searchDocuments(query) {
  // Create transport to Knowledge Server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../mcp-typescript-demo/packages/servers/knowledge/dist/index.js']
  });

  // Create and connect client
  const client = new McpClient({
    name: 'my-search-app',
    version: '1.0.0'
  }, { capabilities: {} });

  await client.connect(transport);
  await client.initialize();

  // Search for documents
  const result = await client.callTool('search_documents', {
    query: query,
    limit: 5
  });

  console.log('Search Results:');
  console.log(result.content[0].text);

  await client.disconnect();
}

// Search for MCP-related documents
searchDocuments('MCP protocol').catch(console.error);
```

### 3. Run Your App

```bash
node app.js
```

You should see search results from the Knowledge Server!

## Next Steps

### 🎯 Try Interactive Examples

```bash
# Open the API Explorer in your browser
open docs/api-explorer/index.html

# Or try the command-line examples
cd docs/examples/01-basic-connection
npm install && npm start
```

### 🔧 Explore Advanced Features

1. **Real-time Updates**: Learn about resource subscriptions
2. **Progress Tracking**: Implement progress notifications for long operations
3. **Multi-server Apps**: Coordinate multiple servers in one application
4. **Error Handling**: Build resilient applications

### 📖 Deep Dive into Documentation

- [Developer Guide](./DEVELOPER_GUIDE.md) - Comprehensive development tutorial
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Examples](./examples/README.md) - Real-world usage examples
- [Use Cases](./examples/use-cases/) - Complete application examples

### 🛠️ Build Your Own Server

Follow our [Custom Server Tutorial](./examples/10-custom-server.md) to create your own MCP server.

## Common Use Cases

### Document Management System
```bash
# Search, create, and organize documents
client.callTool('search_documents', { query: 'user authentication' })
client.callTool('create_document', { title: 'API Guide', content: '...' })
```

### Code Analysis Pipeline  
```bash
# Analyze and format code across your project
client.callTool('scan_project', { directory: './src' })
client.callTool('format_code', { code: '...', language: 'typescript' })
```

### Data Processing Workflow
```bash
# Process and analyze datasets
client.callTool('generate_sample_data', { format: 'csv', recordCount: 1000 })
client.callTool('calculate_statistics', { data: [...], measures: ['mean', 'std'] })
```

### Infrastructure Monitoring
```bash
# Monitor and manage cloud services
client.callTool('check_service_health', { environment: 'production' })
client.callTool('deploy_service', { serviceName: 'api', version: '2.0.0' })
```

## Troubleshooting

### Server Won't Start
```bash
# Check if the build completed successfully
pnpm build

# Verify Node.js version
node --version  # Should be 18+

# Check for permission issues
ls -la packages/servers/*/dist/
```

### Connection Issues
```bash
# Test server directly
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node packages/servers/knowledge/dist/index.js

# Check port availability (for HTTP transport)
lsof -i :3004
```

### Import Errors
```bash
# Make sure you're using ES modules
# Add to package.json: "type": "module"

# Or use CommonJS syntax
const { McpClient } = require('@modelcontextprotocol/sdk/client/mcp.js');
```

## Community & Support

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Examples**: Contribute your own examples
- **Documentation**: Help improve the docs

## Key Concepts to Remember

1. **Transport Layer**: How client and server communicate (STDIO, HTTP, SSE)
2. **Capabilities**: What features each side supports
3. **Tools**: Functions that servers provide to clients
4. **Resources**: Data sources that can be read and subscribed to
5. **Prompts**: AI-powered assistants with templates

## What's Next?

Now that you have MCP running, explore these advanced topics:

- **Resource Subscriptions**: Get real-time updates when data changes
- **Progress Notifications**: Track long-running operations
- **Sampling**: Integrate with LLM services for AI-powered features
- **Error Handling**: Build robust, production-ready applications
- **Performance**: Optimize for high-throughput scenarios

Ready to dive deeper? Check out our [Developer Guide](./DEVELOPER_GUIDE.md) for comprehensive tutorials and best practices!

---

🎉 **Congratulations!** You're now ready to build amazing applications with the Model Context Protocol. Happy coding!