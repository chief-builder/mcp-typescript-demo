# MCP TypeScript Demo

A comprehensive demonstration of the Model Context Protocol (MCP) using TypeScript, showcasing all protocol features through practical, real-world applications. This project implements the MCP 2025-11-25 specification with full protocol compliance.

## SDK Version

- **@modelcontextprotocol/sdk**: `^1.24.3`
- **zod**: `^3.25.0`
- **Protocol Version**: MCP 2025-11-25

## 🎯 Overview

This project demonstrates a complete MCP ecosystem following the client-host-server architecture:

### Core Components
- **4 Specialized MCP Servers**: Each focused on specific domain capabilities
  - Development Tools (port 3001)
  - Data Analytics (port 3002) 
  - Cloud Operations (port 3003)
  - Knowledge Base (port 3004)
- **1 MCP Client Server**: Chat Server (port 4000) - bridges multiple MCP servers
- **5 Client Applications**: Desktop GUI, CLI, Web, Enhanced Claude Chat UI, and VSCode Extension
- **2 Integrated Applications**: Data Science Notebook, DevOps Dashboard

### Protocol Implementation
Built on **JSON-RPC 2.0** with support for:
- Three message types: Requests, Responses, and Notifications
- Stateful sessions with capability negotiation
- Multiple transport options: stdio and Streamable HTTP

## 🏗️ Architecture

### Project Structure
```
mcp-typescript-demo/
├── packages/
│   ├── core/               # Shared utilities, types, and schemas
│   ├── servers/            # MCP server implementations
│   │   ├── dev-tools/      # Code formatting, file ops, project scanning
│   │   ├── analytics/      # Data analysis, statistics, visualizations  
│   │   ├── cloud-ops/      # Infrastructure management, monitoring
│   │   ├── knowledge/      # Documentation, search, knowledge base
│   │   └── chat-server/    # Special server that acts as MCP client
│   ├── clients/
│   │   ├── desktop/        # Electron-based GUI client
│   │   ├── cli/            # Terminal-based client
│   │   ├── web/            # Browser-based client
│   │   └── claude-chat/    # Enhanced chat UI with elicitation
│   └── apps/
│       ├── vscode-ext/     # VSCode extension integration
│       ├── notebook/       # Jupyter-style data science notebook
│       └── devops-dash/    # DevOps monitoring dashboard
```

### System Overview
```mermaid
graph TB
    subgraph MCPClients ["MCP Clients"]
        Desktop[Desktop Client]
        CLI[CLI Client]
        Web[Web Client]
        Claude[Claude Chat UI]
        VSCode[VSCode Extension]
    end

    subgraph MCPServers ["MCP Servers"]
        DevTools["dev-tools-server<br/>Port 3001"]
        Analytics["analytics-server<br/>Port 3002"]
        CloudOps["cloud-ops-server<br/>Port 3003"]
        Knowledge["knowledge-server<br/>Port 3004"]
    end

    subgraph SpecialComponents ["Special Components"]
        ChatServer["chat-server<br/>Port 4000<br/>(MCP Client)"]
    end

    Desktop -->|JSON-RPC over HTTP| DevTools
    CLI -->|JSON-RPC over HTTP| Analytics
    Web -->|JSON-RPC over HTTP| CloudOps
    Claude -->|HTTP REST API| ChatServer
    VSCode -->|JSON-RPC over HTTP| DevTools
    VSCode -->|JSON-RPC over HTTP| Analytics
    VSCode -->|JSON-RPC over HTTP| CloudOps
    VSCode -->|JSON-RPC over HTTP| Knowledge
    
    ChatServer -->|JSON-RPC over HTTP| DevTools
    ChatServer -->|JSON-RPC over HTTP| Analytics
    ChatServer -->|JSON-RPC over HTTP| CloudOps
    ChatServer -->|JSON-RPC over HTTP| Knowledge
```

📋 **For detailed architecture diagrams**: See [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md)

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd mcp-typescript-demo

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Running Servers

Servers support two transport modes:

#### stdio Mode (Default)
```bash
# Development Tools Server
cd packages/servers/dev-tools
pnpm start

# Analytics Server
cd packages/servers/analytics
pnpm start
```

#### HTTP Mode (Streamable HTTP Transport)
```bash
# Development Tools Server (HTTP on port 3001)
cd packages/servers/dev-tools
pnpm start -- --http

# Analytics Server (HTTP on port 3002)
cd packages/servers/analytics
pnpm start -- --http

# Cloud Operations Server (HTTP on port 3003)
cd packages/servers/cloud-ops
pnpm start -- --http

# Knowledge Base Server (HTTP on port 3004)
cd packages/servers/knowledge
pnpm start -- --http

# Chat Server (HTTP on port 4000)
cd packages/servers/chat-server
pnpm dev
```

### Running Clients

```bash
# Desktop Client (not yet implemented)
cd packages/clients/desktop
pnpm start

# CLI Client
cd packages/clients/cli
pnpm start

# Web Client
cd packages/clients/web
pnpm dev

# Enhanced Claude Chat UI
cd packages/clients/claude-chat
pnpm dev

# VSCode Extension
cd packages/apps/vscode-ext
pnpm install
pnpm compile
npx vsce package --no-dependencies
# Install the generated .vsix file in VSCode
```

## 📚 Features Demonstrated

### MCP 2025-11-25 Features

This demo implements modern MCP specification features:

#### Tool Annotations
All tools include behavioral metadata hints:
- **readOnlyHint**: Indicates tools that only read data (no side effects)
- **idempotentHint**: Indicates repeatable operations with same effect
- **destructiveHint**: Indicates tools that can cause irreversible changes

```typescript
// Example tool with annotations
server.registerTool('deploy_service', {
  title: 'Deploy Service',
  description: 'Deploy a service to specified environment',
  inputSchema: { /* ... */ },
  annotations: {
    readOnlyHint: false,
    idempotentHint: false,
    destructiveHint: true,  // Deployment is destructive
  },
}, async (params) => { /* ... */ });
```

#### JSON Schema 2020-12
All elicitation schemas use the modern JSON Schema dialect:
```typescript
requestedSchema: {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: { /* ... */ }
}
```

#### Server Info Endpoints
All HTTP servers expose info at root endpoint:
```bash
curl http://localhost:3001/
# Returns: { server, version, description, endpoints, protocol, capabilities }
```

### MCP Protocol Features
- ✅ **Transports**:
  - stdio (direct process communication)
  - Streamable HTTP (with session management and SSE streaming)
- ✅ **Lifecycle**: Complete initialization → operation → shutdown flow
- ✅ **Capability Negotiation**: Dynamic feature discovery and negotiation
- ✅ **Bidirectional Communication**: Full request/response and notification patterns
- ✅ **Session Management**: Stateful connections with session IDs
- ✅ **Progress Tracking**: Real-time operation progress with tokens
- ✅ **Cancellation**: Graceful operation termination support

### Server Features (All Servers)
- ✅ **Resources**: 
  - Dynamic content discovery
  - URI-based identification
  - Subscription support with change notifications
- ✅ **Tools**: 
  - Function execution with Zod schema validation
  - Structured and unstructured responses
  - Error handling with `isError` flag
- ✅ **Prompts**: 
  - Templated workflows with argument support
  - User-controlled interactions
- ✅ **Advanced Features**:
  - Elicitation for interactive user input
  - Sampling for LLM content generation
  - Completion support for argument suggestions (dev-tools server)
  - Pagination for list operations (with cursor support)
  - Cancellation notification handling

### Client Features
- ✅ **Roots**: Secure file system access boundaries
- ✅ **Sampling**: Server-initiated LLM interactions
- ✅ **Elicitation**: Interactive information gathering from users
- ✅ **Multi-server Management**: Concurrent server connections

### Server-Specific Capabilities

#### dev-tools-server (Port 3001)
- **Tools** (6 total, all with annotations):
  - `format_code` - Format code with Prettier (idempotent)
  - `list_project_files` - List source files (read-only)
  - `read_file` - Read file contents (read-only)
  - `interactive_code_review` - AI-assisted code review with elicitation (read-only)
  - `generate_documentation` - Generate docs via sampling
  - `scan_project` - Scan project with progress (read-only)
- **Resources**: `project-structure`, `recent-changes`
- **Features**: Argument completion, elicitation, sampling, progress notifications

#### analytics-server (Port 3002)
- **Tools** (6 total, all with annotations):
  - `analyze_csv` - Analyze CSV data (read-only)
  - `generate_sample_data` - Generate test datasets
  - `calculate_statistics` - Statistical calculations (read-only)
  - `interactive_data_analysis` - Guided analysis with elicitation (read-only)
  - `export_data` - Export to JSON/CSV (idempotent)
  - `process_large_dataset` - Batch processing with progress
- **Resources**: `csv-data/{filename}`, `analysis-results`
- **Features**: Progress tracking, elicitation, D3 statistics

#### cloud-ops-server (Port 3003)
- **Tools** (7 total, all with annotations):
  - `check_service_health` - Health status (read-only)
  - `deploy_service` - Deploy to environment (**destructive**)
  - `get_system_metrics` - Retrieve metrics (read-only)
  - `interactive_deployment_planner` - Guided deployment with elicitation (**destructive**)
  - `scale_service` - Scale instances
  - `manage_alerts` - Alert configuration
  - `deploy_multi_service` - Multi-service deployment with progress (**destructive**)
- **Resources**: `service-status`, `deployment-history`, `system-metrics`
- **Features**: Real-time monitoring, elicitation, progress notifications

#### knowledge-server (Port 3004)
- **Tools** (8 total, all with annotations):
  - `search_documents` - Full-text search (read-only)
  - `get_document` - Retrieve by ID (read-only)
  - `create_document` - Create new document
  - `list_categories` - List all categories (read-only)
  - `bulk_knowledge_processing` - Batch operations with progress
  - `test_elicitation` - Elicitation testing (read-only)
  - `interactive_knowledge_curator` - Guided content creation with elicitation
- **Resources**: `documents/{id}`, `categories`, `search-index`
- **Features**: Fuse.js search, elicitation, change notifications, progress tracking

#### chat-server (Port 4000)
- **Unique Role**: Acts as MCP client, not traditional server
- **Features**: Multi-provider LLM support (Claude, OpenAI) with streaming tool execution
- **Purpose**: Bridges multiple MCP servers for chat applications
- **Model**: claude-3-5-haiku-20241022 (configurable)

### VSCode Extension
- **Visual Interface**: Tree views for servers and capabilities
- **Server Management**: Connect to multiple servers simultaneously
- **Tool Execution**: Execute tools with parameter forms
- **Resource Viewer**: Read and display resource content
- **Status Integration**: Real-time connection status in status bar
- **Command Palette**: Full command integration for all operations

## 🛠️ Development

### Scripts
```bash
# Development mode (with watch)
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Type checking
pnpm typecheck

# Format code
pnpm format

# Clean build artifacts
pnpm clean
```

### Implementation Patterns

#### Creating a New Server
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'your-server',
  version: '1.0.0'
}, {
  capabilities: {
    logging: {},
    sampling: {},
    elicitation: {},
    prompts: { listChanged: true },
    resources: { subscribe: true, listChanged: true }
  }
});

// Register a tool with annotations (MCP 2025-11-25)
server.registerTool('tool_name', {
  title: 'Human-readable title',
  description: 'What this tool does',
  inputSchema: {
    param: z.string().describe('Parameter description'),
  },
  annotations: {
    readOnlyHint: true,      // Tool only reads data
    idempotentHint: true,    // Repeated calls have same effect
    destructiveHint: false,  // Doesn't cause destructive changes
  },
}, async (params) => {
  // Implementation
  return {
    content: [{ type: 'text', text: 'Result' }]
  };
});
```

#### Elicitation with JSON Schema 2020-12
```typescript
const userInput = await baseServer.elicitInput({
  message: 'Configure your preferences:',
  requestedSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      option: {
        type: 'string',
        enum: ['a', 'b', 'c'],
        title: 'Select Option',
        description: 'Choose your preference'
      }
    },
    required: ['option']
  }
});
```

### Error Handling

The project implements comprehensive error handling with standard JSON-RPC error codes:

- `-32700`: Parse error - Invalid JSON
- `-32600`: Invalid Request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error
- `-32002`: Resource not found (MCP-specific)

## 📖 Documentation

### Project Documentation
- [Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md) - Visual system documentation
- [MCP Implementation Analysis](./MCP_IMPLEMENTATION_ANALYSIS.md) - Deep dive into the implementation

### Server Documentation
- [Development Tools Server](./packages/servers/dev-tools/README.md)
- [Analytics Server](./packages/servers/analytics/README.md)
- [Cloud Operations Server](./packages/servers/cloud-ops/README.md)
- [Knowledge Base Server](./packages/servers/knowledge/README.md)
- [Chat Server](./packages/servers/chat-server/README.md)

### External Resources
- [MCP Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol/specification)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

## 🧪 Testing

Comprehensive test coverage using Vitest:

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @mcp-demo/dev-tools-server test

# Run with coverage
pnpm test:coverage

# Interactive test UI
pnpm test:ui
```

### Test Infrastructure
- Unit tests for all server tools and resources
- Integration tests for protocol compliance
- Test utilities package for shared testing helpers
- MCP Inspector for protocol validation

## 🔒 Security

This project implements MCP security best practices:

### Transport Security
- Proper Origin header validation for HTTP transports
- Session-based authentication with secure IDs
- localhost binding for development servers

### Input Validation
- All inputs validated with Zod schemas
- Path traversal prevention in file operations
- Proper error boundaries and sanitized messages

### Access Control
- Roots-based file system access restrictions
- User consent requirements for operations
- Capability-based feature negotiation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`pnpm test`)
6. Lint your code (`pnpm lint`)
7. Submit a pull request

### Development Guidelines
- Follow existing code patterns and conventions
- Use TypeScript strict mode
- Add comprehensive tests for new features
- Update documentation as needed
- Use conventional commits for clear history

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with the official [Model Context Protocol TypeScript SDK v1.24.3](https://github.com/modelcontextprotocol/typescript-sdk) by Anthropic
- Implements the [MCP 2025-11-25 specification](https://modelcontextprotocol.io/specification/2025-11-25)
- Uses modern TypeScript tooling: Vite, Vitest, Turbo, pnpm, and more
- Schema validation with [Zod v3.25](https://github.com/colinhacks/zod)