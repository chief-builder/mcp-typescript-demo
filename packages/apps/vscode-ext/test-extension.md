# VSCode Extension Testing Guide

## Prerequisites
1. Ensure all MCP servers are running in HTTP mode:
```bash
# Terminal 1
cd packages/servers/dev-tools && pnpm start -- --http

# Terminal 2 
cd packages/servers/analytics && pnpm start -- --http

# Terminal 3
cd packages/servers/cloud-ops && pnpm start -- --http

# Terminal 4
cd packages/servers/knowledge && pnpm start -- --http
```

## Installation
1. Install the extension:
```bash
code --install-extension mcp-demo-vscode-1.0.0.vsix
```

2. Reload VSCode when prompted

## Testing Steps

### 1. Verify Extension Activation
- Open VSCode
- Check status bar for "MCP: Not Connected"
- Open Command Palette (Cmd/Ctrl+Shift+P)
- Search for "MCP" - should see all commands

### 2. Connect to Server
- Run command: "MCP: Connect to Server"
- Select "Development Tools"
- Check status bar updates to "MCP: Development Tools"

### 3. View Server Capabilities
- Open Explorer sidebar
- Look for "MCP SERVERS" section
- Expand to see connected server
- Look for "MCP CAPABILITIES" section
- Expand to see Tools, Resources, and Prompts

### 4. Execute Tool
- In CAPABILITIES view, expand Tools
- Right-click on "format_code"
- Select "Execute"
- Enter arguments: `{"code": "function test(){return 1;}", "language": "javascript"}`
- Check output panel for result

### 5. Read Resource
- In CAPABILITIES view, expand Resources
- Right-click on "project_config"
- Select "Read"
- Verify content opens in new editor tab

### 6. Multi-Server Test
- Connect to another server (e.g., Analytics)
- Verify both servers appear in tree
- Status bar shows "MCP: 2 servers"

### 7. Disconnect
- Right-click on server in tree
- Select "Disconnect"
- Verify server removed and status updated

## Expected Results
- All commands work without errors
- Tree views update correctly
- Tool execution produces formatted output
- Resources display in editor tabs
- Multiple servers can be managed simultaneously
- Disconnection cleans up properly