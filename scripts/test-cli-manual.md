# Manual CLI Testing Script

Since automated testing of interactive CLI menus can be challenging, here's a manual testing approach that you can follow:

## Prerequisites
1. Start all MCP servers in HTTP mode (in separate terminals):
```bash
cd packages/servers/dev-tools && pnpm start -- --http
cd packages/servers/analytics && pnpm start -- --http  
cd packages/servers/cloud-ops && pnpm start -- --http
cd packages/servers/knowledge && pnpm start -- --http
cd packages/servers/chat-server && pnpm dev
```

## CLI Test Steps

### 1. Start CLI Client
```bash
cd packages/clients/cli
pnpm start
```

### 2. Test Sequence

#### Connect to Server
- Press `Enter` on "Connect to Server" 
- Press `Enter` to select "Development Tools"
- Verify: "✔ Connected to Development Tools" message

#### List Tools
- Press `Enter` on "List Tools"
- Verify: Table shows tools including `format_code`

#### List Resources  
- Press `↓` then `Enter` on "List Resources"
- Verify: Table shows resources including `project_config`

#### List Prompts
- Press `↓` `↓` then `Enter` on "List Prompts"
- Verify: Table shows prompts including `code_review`

#### Call Tool
- Press `↓` `↓` `↓` then `Enter` on "Call Tool"
- Press `Enter` to select `format_code`
- Enter: `{"code": "function test(){console.log('hello')}", "language": "javascript"}`
- Verify: Formatted code is displayed

#### Read Resource
- Press `↓` `↓` `↓` `↓` then `Enter` on "Read Resource"
- Press `Enter` to select first resource
- Verify: Resource content is displayed

#### Get Prompt
- Press `↓` `↓` `↓` `↓` `↓` then `Enter` on "Get Prompt"
- Press `Enter` to select `code_review`
- Enter: `{"filePath": "test.js"}`
- Verify: Prompt template is displayed

#### Disconnect
- Press `↓` `↓` `↓` `↓` `↓` `↓` then `Enter` on "Disconnect"
- Verify: "Disconnected from server" message

#### Exit
- Press `↓` then `Enter` on "Exit"
- Verify: "Goodbye!" message and CLI exits

## Alternative: Semi-Automated Testing

You can also create a simple expect script for basic testing:

```bash
#!/usr/bin/expect -f
set timeout 30

# Start CLI
spawn pnpm --dir packages/clients/cli start

# Wait and connect
expect "What would you like to do?"
send "\r"
expect "Select a server"
send "\r"
expect "Connected to Development Tools"

# Test basic operations
expect "What would you like to do?"
send "\r"
expect "format_code"

# Exit
expect "What would you like to do?"
send "\033\[B\033\[B\033\[B\033\[B\033\[B\033\[B\r"
expect "Disconnected"
send "\033\[B\r"
expect "Goodbye!"
```

Save as `test-cli-basic.exp` and run with:
```bash
chmod +x test-cli-basic.exp
./test-cli-basic.exp
```