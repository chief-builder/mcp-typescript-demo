# Tutorial 1: Getting Started with MCP

Welcome to the Model Context Protocol (MCP) TypeScript Demo! This tutorial will guide you through your first steps with MCP, from setup to running your first server and client.

## 🎯 What You'll Learn

- What MCP is and why it's useful
- How to set up the development environment
- How to run your first MCP server
- How to connect a client to the server
- Basic MCP concepts: tools, resources, and prompts

## 📚 Prerequisites

- Basic knowledge of TypeScript/JavaScript
- Node.js 20+ installed
- pnpm 8+ installed
- A code editor (VS Code recommended)

## 🚀 Step 1: Environment Setup

### Clone the Repository
```bash
git clone https://github.com/your-username/mcp-typescript-demo.git
cd mcp-typescript-demo
```

### Install Dependencies
```bash
# Install all dependencies for the monorepo
pnpm install

# Build all packages
pnpm build
```

### Verify Installation
```bash
# Run tests to ensure everything works
pnpm test

# Check if TypeScript compilation works
pnpm typecheck
```

## 🎭 Step 2: Understanding MCP Architecture

MCP follows a **client-host-server** architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Host App      │    │   MCP Client    │    │   MCP Server    │
│  (VS Code,      │◄──►│  (Protocol      │◄──►│  (Provides      │
│   Claude, etc.) │    │   Handler)      │    │   Tools/Data)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Key Concepts:**
- **Server**: Provides tools, resources, and prompts
- **Client**: Consumes server capabilities and manages communication
- **Host**: The application that embeds the client (like VS Code or Claude)

## 🛠️ Step 3: Your First MCP Server

Let's start with the development tools server, which provides code formatting and file operations.

### Start the Dev Tools Server
```bash
cd packages/servers/dev-tools
pnpm start
```

You should see output like:
```
[INFO] dev-tools-server: Server starting on stdio transport
[INFO] dev-tools-server: Server ready and listening
```

The server is now running and waiting for client connections via stdio (standard input/output).

### Understanding the Server Code

Open `packages/servers/dev-tools/src/index.ts` and examine the structure:

```typescript
// 1. Create MCP server instance
const mcpServer = new McpServer({
  name: 'dev-tools-server',
  version: '1.0.0',
}, { 
  capabilities: { 
    tools: true,      // Can execute functions
    resources: true,  // Can provide data
    prompts: true     // Can provide templates
  } 
});

// 2. Register a tool
mcpServer.registerTool(
  'format_code',                    // Tool name
  {
    title: 'Format Code',           // Human-readable title
    description: 'Format code...',  // Description
    inputSchema: {                  // Zod validation schema
      code: z.string().describe('Code to format'),
      language: z.enum(['typescript', 'javascript', ...])
    },
  },
  async ({ code, language }) => {   // Tool handler function
    // Implementation here
    return {
      content: [{ type: 'text', text: 'Formatted code...' }]
    };
  }
);
```

## 💻 Step 4: Connect a Client

Now let's connect a client to interact with our server.

### Start the CLI Client
In a new terminal:
```bash
cd packages/clients/cli
pnpm start
```

You'll see an interactive menu:
```
🤖 MCP CLI Client
Available servers:
1. Development Tools (dev-tools)
2. Analytics (analytics)
3. Cloud Operations (cloud-ops)
4. Knowledge Base (knowledge)

Select a server (1-4):
```

### Interact with the Server

1. **Choose server 1** (Development Tools)
2. **List available tools**: The CLI will show all tools the server provides
3. **Try the format_code tool**:
   - Provide some messy JavaScript code
   - Watch it get formatted with Prettier

Example interaction:
```
🔧 Available tools:
- format_code: Format code using Prettier
- list_project_files: List files in the project
- read_file: Read file contents
- interactive_code_review: AI-powered code review

Select a tool: format_code

Enter code to format:
function test(){console.log("hello world");}

Enter language (typescript/javascript/...): javascript

✅ Tool executed successfully!
```

## 📁 Step 5: Understanding Resources

Resources provide read-only access to server data.

### List Available Resources
In the CLI, select "List Resources" to see what the dev-tools server provides:

- `devtools://config/project` - Project configuration
- `devtools://structure/current` - Current project structure

### Read a Resource
Try reading the project structure resource:
```
📚 Available resources:
- project_config: Project Configuration
- project_structure: Current Project Structure

Select a resource: project_structure

📄 Resource content:
# Project Structure
...
```

## 🎨 Step 6: HTTP Transport (Advanced)

MCP supports two transport modes:
- **stdio**: Direct process communication (what we used above)
- **HTTP**: Web-based communication with sessions

### Start Server in HTTP Mode
```bash
cd packages/servers/dev-tools
pnpm start -- --http
```

The server now runs on `http://localhost:3001` and provides:
- POST `/mcp` - Main MCP endpoint
- GET `/health` - Health check
- GET `/` - Server information

### Connect Web Client
```bash
cd packages/clients/web
pnpm dev
```

Open `http://localhost:5173` to see the web-based MCP client interface.

## 🧪 Step 7: Testing Your Understanding

Try these exercises to cement your understanding:

### Exercise 1: Explore Tools
- Connect to different servers (analytics, cloud-ops, knowledge)
- Try different tools and observe their outputs
- Notice how each server specializes in different domains

### Exercise 2: Resource Subscriptions
- Read resources from multiple servers
- Notice how some resources update dynamically
- Understand the difference between static and dynamic resources

### Exercise 3: Error Handling
- Provide invalid inputs to tools
- Observe how errors are handled and reported
- Notice the consistent error format across servers

## 🎉 What's Next?

Congratulations! You've successfully:
- ✅ Set up the MCP development environment
- ✅ Started your first MCP server
- ✅ Connected clients to servers
- ✅ Executed tools and read resources
- ✅ Understood basic MCP architecture

### Continue Learning:
- **Tutorial 2**: [Building Your First MCP Server](./02-building-your-first-server.md)
- **Tutorial 3**: [Advanced MCP Features](./03-advanced-features.md)
- **Tutorial 4**: [Client Development](./04-client-development.md)

## 🤔 Troubleshooting

### Server Won't Start
- Check Node.js version (requires 20+)
- Ensure `pnpm build` completed successfully
- Check for port conflicts if using HTTP mode

### Client Can't Connect
- Verify server is running
- Check console for error messages
- Ensure correct transport mode (stdio vs HTTP)

### Tools Return Errors
- Validate input parameters match the schema
- Check server logs for detailed error messages
- Ensure all dependencies are installed

## 📚 Additional Resources

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [Architecture Diagrams](../ARCHITECTURE_DIAGRAMS.md)
- [Contributing Guide](../CONTRIBUTING.md)