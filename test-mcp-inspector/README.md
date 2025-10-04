# MCP Inspector Automated Testing Framework

A comprehensive automated testing framework for the Model Context Protocol (MCP) Inspector, designed to test all MCP server implementations across their full feature set.

## Features

- 🔍 **Automated Browser Testing**: Uses Playwright to interact with MCP Inspector
- 🎯 **Comprehensive Coverage**: Tests tools, resources, prompts, elicitation, and progress notifications
- 📊 **Multi-Server Support**: Tests all 4 MCP servers (knowledge, dev-tools, analytics, cloud-ops)
- 📸 **Screenshot Capture**: Automatic screenshots on test failures and key checkpoints
- 📄 **Rich Reporting**: Generates both JSON and HTML reports with detailed results
- 🔧 **Configurable**: Flexible configuration for timeouts, retries, and test cases
- 🚀 **CI/CD Ready**: Supports headless mode for continuous integration

## Quick Start

### 1. Install Dependencies

```bash
cd test-mcp-inspector
npm install
npm run install-browsers
```

### 2. Build MCP Servers

Ensure all MCP servers are built before testing:

```bash
cd ..
npm run build
```

### 3. Run Tests

```bash
# Run all tests with GUI
npm run test

# Run all tests in headless mode (CI/CD)
npm run test:headless

# Test specific server
npm run test:knowledge
npm run test:dev-tools
npm run test:analytics
npm run test:cloud-ops
```

## Architecture

### Core Components

- **`MCPInspectorTestRunner`**: Main orchestrator for test execution
- **`BrowserManager`**: Handles browser automation and page interactions
- **`TestReporter`**: Generates comprehensive HTML and JSON reports
- **`DataValidator`**: Validates MCP responses and test data integrity
- **`servers.json`**: Configuration file defining test cases for all servers

### Test Flow

1. **Initialize**: Start browser and MCP Inspector process
2. **Connect**: Connect to each MCP server via Inspector
3. **Test Capabilities**: Execute tests for tools, resources, prompts
4. **Test Advanced Features**: Validate elicitation and progress notifications
5. **Validate**: Check response data and timing
6. **Report**: Generate comprehensive test reports
7. **Cleanup**: Close browser and terminate processes

## Configuration

### Server Configuration (`src/configs/servers.json`)

```json
{
  "servers": {
    "knowledge": {
      "name": "Knowledge Server",
      "path": "../packages/servers/knowledge/dist/index.js",
      "expectedTools": 7,
      "expectedResources": 4,
      "expectedPrompts": 3,
      "capabilities": ["tools", "resources", "prompts", "elicitation"],
      "testCases": {
        "tools": [...],
        "resources": [...],
        "prompts": [...]
      }
    }
  },
  "testingConfig": {
    "timeouts": {
      "connection": 10000,
      "toolExecution": 30000,
      "elicitation": 300000
    }
  }
}
```

### Command Line Options

```bash
node run-inspector-tests.js [OPTIONS]

OPTIONS:
  --help, -h              Show help message
  --headless              Run in headless mode
  --gui                   Run with GUI (default)
  --server, -s <name>     Test specific server only
  --config, -c <path>     Use custom config file
  --timeout, -t <ms>      Set timeout in milliseconds
  --retries, -r <count>   Number of retries for failed tests
  --output, -o <dir>      Output directory for reports
  --no-screenshots        Disable screenshot capture
```

## Test Cases

### Tools Testing
- **Basic Tool Execution**: Tests tool calls with parameters
- **Response Validation**: Validates tool response structure and data
- **Error Handling**: Tests invalid parameters and error scenarios
- **Performance Monitoring**: Measures tool response times

### Resources Testing  
- **Resource Access**: Tests reading different resource types
- **URI Validation**: Validates resource URI patterns
- **Content Verification**: Checks resource content format and structure
- **Error Cases**: Tests invalid resource requests

### Prompts Testing
- **Prompt Execution**: Tests prompt generation with arguments
- **Template Validation**: Validates prompt template processing
- **Dynamic Arguments**: Tests prompts with various argument combinations
- **Response Quality**: Validates prompt response structure

### Elicitation Testing
- **Form Handling**: Tests interactive form completion
- **Field Validation**: Validates form field types and constraints
- **Submission Flow**: Tests form submission and response handling
- **Timeout Management**: Tests elicitation timeout configurations

### Progress Notifications Testing
- **Progress Tracking**: Tests progress notification flow
- **Token Management**: Validates progress token lifecycle
- **Notification Frequency**: Tests progress update intervals
- **Error Recovery**: Tests progress notification error handling

## Reports

### HTML Report Features
- **Interactive Dashboard**: Click to expand/collapse sections
- **Screenshot Gallery**: View test screenshots with modal popup
- **Performance Metrics**: Response times and success rates
- **Detailed Error Information**: Stack traces and error context
- **Mobile Responsive**: Works on all device sizes

### JSON Report Structure
```json
{
  "summary": {
    "totalServers": 4,
    "successfulServers": 4,
    "totalTests": 25,
    "passedTests": 23,
    "successRate": 92
  },
  "testResults": [...],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": {
    "headless": false,
    "timeout": 30000,
    "retries": 2
  }
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: MCP Inspector Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install
          cd test-mcp-inspector
          npm install
          npm run install-browsers
      
      - name: Build servers
        run: npm run build
      
      - name: Run MCP Inspector tests
        run: |
          cd test-mcp-inspector
          npm run test:headless
      
      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-reports
          path: test-mcp-inspector/reports/
```

## Troubleshooting

### Common Issues

**Browser fails to start**
```bash
# Install browser dependencies
npm run install-browsers

# Check system dependencies
npx playwright install-deps
```

**MCP Inspector won't start**
```bash
# Verify MCP Inspector is available
npx @modelcontextprotocol/inspector --help

# Check if port is already in use
lsof -i :3000
```

**Server connection fails**
```bash
# Ensure servers are built
npm run build

# Test server manually
node packages/servers/knowledge/dist/index.js
```

**Tests timeout**
```bash
# Increase timeout
node run-inspector-tests.js --timeout 60000

# Run with retries
node run-inspector-tests.js --retries 3
```

### Debug Mode

Enable detailed logging:
```bash
DEBUG=true node run-inspector-tests.js --gui
```

### Screenshots

Screenshots are automatically captured:
- On test failures (default: enabled)
- At key test checkpoints
- During elicitation form handling
- After server connections

Disable screenshots for faster execution:
```bash
node run-inspector-tests.js --no-screenshots
```

## Contributing

### Adding New Test Cases

1. Update `src/configs/servers.json` with new test cases
2. Extend `MCPInspectorTestRunner` if new test types are needed
3. Update validation logic in `DataValidator`
4. Add report formatting in `TestReporter`

### Adding New Servers

1. Add server configuration to `servers.json`
2. Define expected capabilities and test cases
3. Update package.json scripts for convenience
4. Test and validate new server integration

## License

MIT License - see [LICENSE](../LICENSE) file for details.