# MCP Demo VSCode Extension

A Visual Studio Code extension that integrates with the Model Context Protocol (MCP) demo servers, providing a seamless development experience for interacting with MCP capabilities.

## Features

- **Server Discovery**: Automatically discovers all MCP demo servers in your project
- **Connection Management**: Connect to servers using HTTP or stdio transport
- **Server Explorer**: Visual tree view showing all available servers and their connection status
- **Capabilities Browser**: Explore tools, resources, and prompts for each connected server
- **Tool Execution**: Execute MCP tools directly from VSCode with parameter input forms
- **Resource Reading**: View resource content in new editor tabs
- **Prompt Viewing**: Display prompt templates with argument requirements
- **Multi-Server Support**: Connect to multiple servers simultaneously
- **Status Bar Integration**: Quick overview of connected servers
- **Real-time Updates**: Tree views update automatically on server state changes
- **Error Handling**: Graceful error messages and recovery
- **Native MCP Support**: Registers servers with VSCode's native MCP integration (when available)

## Requirements

- VSCode 1.93.0 or later
- Node.js 20+ installed
- MCP demo servers built and ready to run

## Installation

1. Build the extension:
```bash
cd packages/apps/vscode-ext
npm install
npm run compile
```

2. Package the extension:
```bash
npm run package
```

3. Install the generated .vsix file in VSCode

## Usage

### Connecting to Servers

1. Open the MCP Demo view in the Activity Bar
2. Click on a disconnected server to connect
3. Or use Command Palette: `MCP: Connect to MCP Server`

### Viewing Server Capabilities

1. Connect to a server
2. Expand the "Server Capabilities" view
3. Browse available tools, resources, and prompts

### Using Commands

- `MCP: Connect to MCP Server` - Connect to an MCP server
- `MCP: Disconnect from MCP Server` - Disconnect from a server
- `MCP: Show Server Capabilities` - View server capabilities in JSON
- `MCP: Execute MCP Tool` - Run a tool with interactive parameter input
- `MCP: View MCP Resources` - List server resources
- `MCP: Refresh MCP Servers` - Rediscover available servers

## Configuration

Configure the extension in VSCode settings:

```json
{
  "mcp-demo.autoConnect": false,
  "mcp-demo.defaultTransport": "http",
  "mcp-demo.httpTimeout": 30000,
  "mcp-demo.showNotifications": true
}
```

### Settings

- `mcp-demo.autoConnect`: Automatically connect to all servers on startup
- `mcp-demo.defaultTransport`: Default transport method ("http" or "stdio")
- `mcp-demo.httpTimeout`: HTTP request timeout in milliseconds
- `mcp-demo.showNotifications`: Show notifications for server events

## Transport Modes

### HTTP Transport (Default)
- Connects to servers running with `--http` flag
- Requires servers to be started separately
- Supports multiple client connections

### stdio Transport
- Extension launches server as subprocess
- Direct communication via stdin/stdout
- Single client connection

## Architecture

```
vscode-ext/
├── src/
│   ├── extension.ts         # Main extension entry
│   ├── providers/           # MCP server providers
│   ├── config/             # Server configurations
│   ├── utils/              # Server management utilities
│   └── views/              # Tree view providers
```

## Implementation Status

### ✅ Implemented Features
- Server discovery and configuration
- HTTP transport with session management
- Server connection/disconnection
- Tool execution with parameter dialogs
- Resource reading functionality
- Prompt viewing
- Multi-server management
- Status bar integration
- Tree view UI components
- Error handling and notifications
- Output channel logging

### 🚧 Partially Implemented
- stdio transport (configuration exists but not tested)
- Prompt execution (view-only currently)
- Native VSCode MCP integration (prepared but waiting for VSCode API)

### ❌ Not Yet Implemented
- Parameter completion support in forms
- Resource subscriptions and real-time updates
- Progress notifications for long operations
- Cancellation support
- Advanced resource preview formats
- Debugging integration

## Development

1. Open the extension folder in VSCode
2. Run `npm run watch` for automatic compilation
3. Press F5 to launch Extension Development Host
4. Make changes and reload the window to test

## Known Issues

- Resource viewing is limited to JSON display
- Prompt execution shows template only (no argument UI yet)
- Completion support not integrated in parameter forms

## Future Enhancements

- Enhanced resource content preview with syntax highlighting
- Full prompt template execution with argument forms
- Server output streaming for real-time updates
- Debugging integration for MCP development
- Parameter completion support in forms
- Pagination UI for large result sets
- Progress indicators for long-running operations