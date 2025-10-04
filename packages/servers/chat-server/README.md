# Chat Server

A server that integrates Claude with MCP servers, enabling natural language interaction with development tools.

## Overview

The chat server acts as a bridge between users and MCP servers, using Claude to intelligently decide which tools to use based on natural language requests.

## Architecture

```
User → Claude Chat UI → Chat Server → Claude API → MCP Servers
```

Currently connected to:
- **Dev-Tools Server** (port 3001) - Code formatting, file operations, project analysis

## Setup

1. **Environment Variables**
   ```bash
   export ANTHROPIC_API_KEY="your_api_key_here"
   ```

2. **Start the dev-tools server first**
   ```bash
   cd packages/servers/dev-tools
   pnpm start:http
   ```

3. **Start the chat server**
   ```bash
   cd packages/servers/chat-server
   pnpm dev
   ```

4. **Start the Claude chat UI**
   ```bash
   cd packages/clients/claude-chat
   pnpm dev
   ```

## Usage

### API Endpoints

- `GET /health` - Health check and connection status
- `POST /chat` - Send message to Claude

### Example Chat Request

```bash
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Format this code: function hello(){console.log(\"test\")}"}'
```

### Example Natural Language Commands

- "Format this code: function hello(){console.log('test')}"
- "Create a file called demo.txt with 'Hello World'"
- "Analyze the current project structure"

## How It Works

1. User sends natural language message
2. Chat server gets available tools from connected MCP servers
3. Claude receives the message + tool descriptions
4. Claude decides which tools to use (if any)
5. Chat server executes Claude's tool requests via MCP
6. Results are sent back to Claude for synthesis
7. Claude provides final response to user

This demonstrates the full MCP flow: User → Claude → MCP Client → MCP Server → External Service