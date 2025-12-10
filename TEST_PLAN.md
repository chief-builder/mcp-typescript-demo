# MCP TypeScript Demo - Comprehensive Test Plan

## Executive Summary

This document provides a comprehensive testing strategy for the MCP TypeScript Demo project, covering all 5 MCP servers, 3 clients, and the VSCode extension. The plan includes unit testing, integration testing, end-to-end testing, manual testing procedures, and demo recording scenarios.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Testing Infrastructure](#2-testing-infrastructure)
3. [Unit Testing Strategy](#3-unit-testing-strategy)
4. [Integration Testing Strategy](#4-integration-testing-strategy)
5. [End-to-End Testing Strategy](#5-end-to-end-testing-strategy)
6. [Manual Testing Procedures](#6-manual-testing-procedures)
7. [Performance Testing](#7-performance-testing)
8. [Security Testing](#8-security-testing)
9. [Test Coverage Strategy](#9-test-coverage-strategy)
10. [Test Automation](#10-test-automation)
11. [Test Data Management](#11-test-data-management)
12. [Demo Recording Guide](#12-demo-recording-guide)
13. [Test Execution Checklist](#13-test-execution-checklist)

---

## 1. Project Overview

### Components Under Test

| Component | Type | Port | Package Name |
|-----------|------|------|--------------|
| Dev Tools Server | MCP Server | 3001 | `@mcp-demo/dev-tools-server` |
| Analytics Server | MCP Server | 3002 | `@mcp-demo/analytics-server` |
| Cloud Ops Server | MCP Server | 3003 | `@mcp-demo/cloud-ops-server` |
| Knowledge Server | MCP Server | 3004 | `@mcp-demo/knowledge-server` |
| Chat Server | MCP Client/API | 4000 | `@mcp-demo/chat-server` |
| CLI Client | MCP Client | N/A | `@mcp-demo/cli-client` |
| Web Client | MCP Client | 5173 | `@mcp-demo/web-client` |
| Claude Chat | MCP Client | 5174 | `@mcp-demo/claude-chat` |
| VSCode Extension | Extension | N/A | `@mcp-demo/vscode-extension` |
| Core Library | Shared | N/A | `@mcp-demo/core` |

### Server Capabilities Summary

| Server | Tools | Resources | Prompts | Special Features |
|--------|-------|-----------|---------|------------------|
| Dev Tools | 6 | 4 | 3 | Code formatting, file operations |
| Analytics | 6 | 4 | 3 | Statistics, progress tracking |
| Cloud Ops | 7 | 4 | 3 | Mock infrastructure, scheduling |
| Knowledge | 7 | 4 | 3 | Full-text search, subscriptions |
| Chat Server | N/A | N/A | N/A | LLM integration, elicitation |

---

## 2. Testing Infrastructure

### Test Framework Stack

- **Unit/Integration Tests**: Vitest 3.2.4
- **Coverage**: v8 provider (@vitest/coverage-v8)
- **Assertions**: Vitest built-in + custom matchers
- **Mocking**: Vitest mocking utilities
- **Test Utilities**: `@mcp-demo/test-utils` package

### Directory Structure

```
mcp-typescript-demo/
├── packages/
│   ├── test-utils/                    # Shared test utilities
│   │   ├── src/
│   │   │   ├── fixtures.ts            # Mock data and fixtures
│   │   │   └── helpers.ts             # Test helper functions
│   ├── servers/
│   │   └── [server]/
│   │       └── src/
│   │           ├── tools/
│   │           │   └── *.test.ts      # Tool unit tests
│   │           └── resources/
│   │               └── *.test.ts      # Resource unit tests
│   └── core/
│       └── src/
│           └── **/*.test.ts           # Core library tests
├── vitest.config.ts                   # Global test configuration
└── vitest.setup.ts                    # Test setup and globals
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Run specific package tests
pnpm --filter @mcp-demo/analytics-server test

# Watch mode
pnpm --filter @mcp-demo/dev-tools-server test:watch
```

---

## 3. Unit Testing Strategy

### 3.1 Server Tools Testing

Each server tool requires comprehensive unit tests covering:

#### 3.1.1 Dev Tools Server Tests

| Tool | Test File | Test Cases |
|------|-----------|------------|
| `format_code` | `format-code.test.ts` | Valid JS/TS formatting, invalid syntax handling, language support, comment preservation |
| `list_project_files` | `list-files.test.ts` | File listing, filtering, empty directories, permission errors |
| `read_file` | `read-file.test.ts` | File reading, encoding, large files, missing files |
| `interactive_code_review` | `interactive-code-review.test.ts` | Elicitation flow, review criteria, response handling |
| `generate_documentation` | `generate-documentation.test.ts` | Doc generation, sampling requests, format output |
| `scan_project` | `scan-project.test.ts` | Progress reporting, file scanning, metrics |

#### 3.1.2 Analytics Server Tests

| Tool | Test File | Test Cases |
|------|-----------|------------|
| `analyze_csv` | `analyze-csv.test.ts` | CSV parsing, column detection, statistical analysis |
| `generate_sample_data` | `generate-sample-data.test.ts` | Record generation, format validation, limit handling |
| `calculate_statistics` | `calculate-statistics.test.ts` | Mean, median, mode, std dev, quartiles, edge cases |
| `interactive_data_analysis` | `interactive-data-analysis.test.ts` | Elicitation preferences, analysis flow |
| `export_data` | `export-data.test.ts` | JSON/CSV export, formatting, large datasets |
| `process_large_dataset` | `process-large-dataset.test.ts` | Progress tracking, operations, chunking |

#### 3.1.3 Cloud Ops Server Tests

| Tool | Test File | Test Cases |
|------|-----------|------------|
| `check_service_health` | `check-service-health.test.ts` | Service status, mock data, multi-service checks |
| `deploy_service` | `deploy-service.test.ts` | Deployment flow, environment validation, version handling |
| `get_system_metrics` | `get-system-metrics.test.ts` | Metric retrieval, time ranges, aggregations |
| `interactive_deployment_planner` | `interactive-deployment-planner.test.ts` | Planning flow, elicitation |
| `scale_service` | `scale-service.test.ts` | Scaling operations, instance counts, validation |
| `manage_alerts` | `manage-alerts.test.ts` | Alert CRUD, filtering, notification handling |
| `deploy_multi_service` | `deploy-multi-service.test.ts` | Multi-service coordination, rollback strategies |

#### 3.1.4 Knowledge Server Tests

| Tool | Test File | Test Cases |
|------|-----------|------------|
| `search_documents` | `search-documents.test.ts` | Fuzzy search, relevance scoring, limit handling |
| `get_document` | `get-document.test.ts` | Document retrieval, missing docs, metadata |
| `create_document` | `create-document.test.ts` | Document creation, validation, categorization |
| `list_categories` | `list-categories.test.ts` | Category listing, counts, filtering |
| `bulk_knowledge_processing` | `bulk-knowledge-processing.test.ts` | Batch operations, validation |
| `test_elicitation` | `test-elicitation.test.ts` | Elicitation feature testing |
| `interactive_knowledge_curator` | `interactive-knowledge-curator.test.ts` | Curation flow, user preferences |

### 3.2 Resource Testing

Each server's resources require tests for:

```typescript
describe('Server Resources', () => {
  it('should list all available resources');
  it('should return proper URI format');
  it('should include resource descriptions');
  it('should read resource by URI');
  it('should return proper MIME type');
  it('should handle missing resources');
});
```

### 3.3 Prompt Testing

```typescript
describe('Server Prompts', () => {
  it('should list all available prompts');
  it('should include argument schemas');
  it('should return prompt with valid arguments');
  it('should handle missing required arguments');
  it('should generate proper message format');
});
```

---

## 4. Integration Testing Strategy

### 4.1 Server-Client Integration

```typescript
describe('Server-Client Integration', () => {
  describe('Stdio Transport', () => {
    it('should establish connection via stdio');
    it('should exchange messages correctly');
    it('should handle disconnection');
  });

  describe('HTTP Transport', () => {
    it('should establish connection via HTTP');
    it('should maintain session across requests');
    it('should handle session expiration');
    it('should support CORS properly');
  });
});
```

### 4.2 Multi-Server Integration

```typescript
describe('Multi-Server Integration', () => {
  it('should connect to multiple servers simultaneously');
  it('should route requests to correct server');
  it('should handle server failures independently');
  it('should support concurrent tool executions');
});
```

---

## 5. End-to-End Testing Strategy

### 5.1 CLI Client E2E Tests

| Scenario | Server | Operation | Expected Result |
|----------|--------|-----------|-----------------|
| Format code | dev-tools | Call format_code | Formatted output |
| Calculate stats | analytics | Call calculate_statistics | Statistics result |
| Check health | cloud-ops | Call check_service_health | Health report |
| Search docs | knowledge | Call search_documents | Search results |
| Read resource | All | Read resource | Resource content |
| Get prompt | All | Get prompt | Prompt messages |

### 5.2 Web Client E2E Tests

Using Playwright or Cypress for automated browser testing.

### 5.3 VSCode Extension E2E Tests

Using VSCode Extension Test framework.

---

## 6. Manual Testing Procedures

### 6.1 Pre-Test Environment Setup

#### Step 1: Verify Prerequisites
- [ ] Node.js 20+ installed: `node --version`
- [ ] pnpm 8+ installed: `pnpm --version`
- [ ] Git installed: `git --version`
- [ ] VSCode installed (for extension testing)

#### Step 2: Initial Setup
```bash
# Clone and setup
cd /path/to/mcp-typescript-demo
pnpm install
pnpm build
```

**Expected Results:**
- [ ] All dependencies install without errors
- [ ] All 10 packages build successfully
- [ ] No TypeScript compilation errors

#### Step 3: Verify Build
```bash
pnpm typecheck
pnpm lint
```

**Expected Results:**
- [ ] Type checking passes with no errors
- [ ] Linting passes with no errors/warnings

---

### 6.2 Phase 1: Server Testing (Stdio Mode)

#### Test 1.1: Dev Tools Server (Stdio)
```bash
cd packages/servers/dev-tools
pnpm start
```

**Checklist:**
- [ ] Server starts without errors
- [ ] Shows "Server ready" or similar message
- [ ] Process stays running (waiting for stdio input)
- [ ] Ctrl+C cleanly stops the server

#### Test 1.2: Analytics Server (Stdio)
```bash
cd packages/servers/analytics
pnpm start
```

**Checklist:**
- [ ] Server starts without errors
- [ ] Ready for client connections

#### Test 1.3: Cloud Ops Server (Stdio)
```bash
cd packages/servers/cloud-ops
pnpm start
```

**Checklist:**
- [ ] Server starts without errors
- [ ] Shows initialization messages

#### Test 1.4: Knowledge Server (Stdio)
```bash
cd packages/servers/knowledge
pnpm start
```

**Checklist:**
- [ ] Server starts without errors
- [ ] Document storage initialized

#### Test 1.5: Chat Server
```bash
cd packages/servers/chat-server
pnpm dev
```

**Checklist:**
- [ ] Express server starts on port 4000
- [ ] Shows "Chat server started on port 4000"
- [ ] Health endpoint accessible

---

### 6.3 Phase 2: Server Testing (HTTP Mode)

Start all servers in HTTP mode (use separate terminals):

```bash
# Terminal 1: Dev Tools (Port 3001)
cd packages/servers/dev-tools && pnpm start -- --http

# Terminal 2: Analytics (Port 3002)
cd packages/servers/analytics && pnpm start -- --http

# Terminal 3: Cloud Ops (Port 3003)
cd packages/servers/cloud-ops && pnpm start -- --http

# Terminal 4: Knowledge (Port 3004)
cd packages/servers/knowledge && pnpm start -- --http

# Terminal 5: Chat Server (Port 4000)
cd packages/servers/chat-server && pnpm dev
```

#### Test 2.1: HTTP Health Checks
```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:4000/health
```

**Checklist:**
- [ ] All health checks return 200 OK
- [ ] Each returns server status information

#### Test 2.2: MCP Endpoints
```bash
curl http://localhost:3001/
curl http://localhost:3002/
curl http://localhost:3003/
curl http://localhost:3004/
```

**Checklist:**
- [ ] All endpoints respond
- [ ] JSON responses with server info

---

### 6.4 Phase 3: CLI Client Testing

```bash
cd packages/clients/cli
pnpm start
```

#### Test 3.1: Interface Verification
- [ ] CLI header "MCP CLI - Interactive Mode" appears
- [ ] Help text displayed
- [ ] Interactive menu shows options

#### Test 3.2: Server Connection
- [ ] Select "Connect to Server"
- [ ] List shows: Development Tools, Data Analytics, Cloud Operations, Knowledge Base
- [ ] Select "Development Tools"
- [ ] Connection spinner appears
- [ ] Success message: "Connected to Development Tools"

#### Test 3.3: List Operations
- [ ] "List Tools" shows 6 tools with names and descriptions
- [ ] "List Resources" shows 4 resources with URIs
- [ ] "List Prompts" shows 3 prompts

#### Test 3.4: Tool Execution
- [ ] Select "Call Tool" → "format_code"
- [ ] Enter: `{"code": "function test(){console.log('hello')}", "language": "javascript"}`
- [ ] Formatted code returned
- [ ] Metadata shows execution details

#### Test 3.5: Resource Reading
- [ ] Select "Read Resource" → "project_config"
- [ ] Resource content displayed

#### Test 3.6: Prompt Retrieval
- [ ] Select "Get Prompt" → "code_review"
- [ ] Enter: `{"filePath": "test.js"}`
- [ ] Prompt template displayed

#### Test 3.7: Server Switching
- [ ] Disconnect from current server
- [ ] Connect to "Data Analytics"
- [ ] Verify different tools/resources shown

#### Test 3.8: Exit
- [ ] Select "Exit"
- [ ] CLI closes with "Goodbye!" message

---

### 6.5 Phase 4: Web Client Testing

**Prerequisites:** All 4 MCP servers running in HTTP mode.

```bash
cd packages/clients/web
pnpm dev
# Open http://localhost:5173
```

#### Test 4.1: Initial Interface
- [ ] "MCP Web Client" title displayed
- [ ] 4 server cards visible:
  - [ ] Development Tools (Port 3001)
  - [ ] Data Analytics (Port 3002)
  - [ ] Cloud Operations (Port 3003)
  - [ ] Knowledge Base (Port 3004)
- [ ] Console output panel at bottom

#### Test 4.2: Server Connection
- [ ] Click "Connect" on Development Tools
- [ ] Green checkmark and "Connected" status appears
- [ ] Session ID displayed
- [ ] "Disconnect" button becomes available

#### Test 4.3: Tools Tab Testing
- [ ] "Tools (6)" tab shows all dev-tools
- [ ] Click "Configure" on format_code
- [ ] Modal dialog opens with form fields
- [ ] Code textarea pre-filled
- [ ] Language dropdown works
- [ ] Click "Execute Tool"
- [ ] Result displayed in console
- [ ] Modal closes after execution

#### Test 4.4: Test Each Tool

**Dev Tools Server:**
| Tool | Input | Expected Output |
|------|-------|-----------------|
| format_code | `function test(){return 1;}` + JavaScript | Formatted code |
| list_project_files | Default | List of project files |
| read_file | `README.md` | File contents |
| scan_project | Default | Project structure |

**Analytics Server:**
| Tool | Input | Expected Output |
|------|-------|-----------------|
| calculate_statistics | `[1,2,3,4,5]` + `["mean","median"]` | Statistics result |
| generate_sample_data | `json`, 10 records | Generated data |
| export_data | Sample data array | Exported format |

**Cloud Ops Server:**
| Tool | Input | Expected Output |
|------|-------|-----------------|
| check_service_health | Empty + `prod` | Health report |
| deploy_service | `user-service`, `2.2.0`, `staging` | Deployment status |
| get_system_metrics | `1h` + `["cpu","memory"]` | Metrics data |
| scale_service | `api-gateway`, 3, `prod` | Scaling result |

**Knowledge Server:**
| Tool | Input | Expected Output |
|------|-------|-----------------|
| search_documents | `MCP protocol`, 5 | Search results |
| get_document | `doc-1` | Document content |
| create_document | Title, content, tags | Created doc ID |
| list_categories | None | Category list |

#### Test 4.5: Resources Tab Testing
- [ ] Switch to "Resources" tab
- [ ] 4 resources displayed
- [ ] Click "Read" on project_config
- [ ] Resource content shown in console
- [ ] Click "Custom" to modify URI
- [ ] Modal opens with URI field

#### Test 4.6: Prompts Tab Testing
- [ ] Switch to "Prompts" tab
- [ ] 3 prompts displayed
- [ ] Click "Configure" on code_review
- [ ] Modal with argument fields
- [ ] Enter file path
- [ ] Click "Get Prompt"
- [ ] Prompt template displayed

#### Test 4.7: Multi-Server Testing
- [ ] Connect to Analytics server (while Dev Tools connected)
- [ ] Both show "Connected" status
- [ ] Switch between servers
- [ ] Each shows its own tools/resources/prompts

#### Test 4.8: Error Handling
- [ ] Stop a server (Ctrl+C)
- [ ] Try to connect to stopped server
- [ ] Error message displayed
- [ ] UI remains responsive
- [ ] Restart server and reconnect

---

### 6.6 Phase 5: Claude Chat Client Testing

**Prerequisites:** Chat server running on port 4000, at least one MCP server running.

```bash
cd packages/clients/claude-chat
pnpm dev
# Open http://localhost:5174
```

#### Test 5.1: Initial Interface
- [ ] "AI Chat" title displayed
- [ ] Connection status shows "Connected"
- [ ] Welcome message from assistant
- [ ] Provider dropdown shows "Claude"
- [ ] Streaming checkbox is checked

#### Test 5.2: Basic Chat
- [ ] Type message: "Hello, can you help me?"
- [ ] Press Enter or click Send
- [ ] Message appears with user avatar
- [ ] Assistant response streams in
- [ ] Timestamp displayed

#### Test 5.3: Provider Switching
- [ ] Click provider dropdown
- [ ] Select "OpenAI" (if available)
- [ ] System message: "Switched to OPENAI provider"
- [ ] New messages use OpenAI

#### Test 5.4: Streaming Toggle
- [ ] Uncheck "Enable streaming"
- [ ] Send message
- [ ] Response appears all at once (not streaming)
- [ ] Re-enable streaming

#### Test 5.5: MCP Tool Integration (Claude)
- [ ] Send: "Please format this code: function hello(){console.log('hi')}"
- [ ] Look for "[Executing tool: format_code...]"
- [ ] Formatted code in response

#### Test 5.6: MCP Tool Integration (OpenAI)
- [ ] Switch to OpenAI provider
- [ ] Send same formatting request
- [ ] Tool execution indicator appears
- [ ] Formatted result returned

#### Test 5.7: File Operations via Chat
- [ ] "Read the README.md file"
- [ ] read_file tool executed
- [ ] File contents discussed

#### Test 5.8: Error Handling
- [ ] Stop chat server
- [ ] Status shows "Disconnected"
- [ ] Send button disabled
- [ ] Restart server
- [ ] Refresh page
- [ ] Connection restored

---

### 6.7 Phase 6: VSCode Extension Testing

#### Test 6.1: Build and Install
```bash
cd packages/apps/vscode-ext
pnpm install
pnpm compile
npx vsce package --no-dependencies
```

- [ ] Extension packages as `mcp-demo-vscode-1.0.0.vsix`
- [ ] Install via VSCode: Extensions → Install from VSIX
- [ ] Reload VSCode

#### Test 6.2: Extension Activation
- [ ] "MCP Demo" icon in activity bar (left sidebar)
- [ ] Click opens MCP views panel
- [ ] "MCP SERVERS" view shows 4 servers
- [ ] "SERVER CAPABILITIES" view (empty initially)
- [ ] Status bar shows "MCP: Not connected"

#### Test 6.3: Server Connection
- [ ] Click "Connect" on Development Tools Server
- [ ] Output channel shows connection logs
- [ ] Server status changes to "Connected" (green)
- [ ] Status bar updates to "MCP: 1 connected"

#### Test 6.4: Capabilities View
- [ ] SERVER CAPABILITIES shows connected server
- [ ] Expand "Tools (6)" → all tools listed
- [ ] Expand "Resources (4)" → all resources listed
- [ ] Expand "Prompts (3)" → all prompts listed

#### Test 6.5: Tool Execution
- [ ] Click on "format_code" tool
- [ ] Input dialog appears for each parameter
- [ ] Enter test code and language
- [ ] Tool executes
- [ ] Result opens in new editor tab

#### Test 6.6: Multi-Server
- [ ] Connect to Analytics server
- [ ] Both servers in SERVERS tree
- [ ] Status bar shows "MCP: 2 connected"
- [ ] Both servers' capabilities visible

#### Test 6.7: Disconnect
- [ ] Right-click server → Disconnect
- [ ] Server removed from capabilities
- [ ] Status bar updates

---

### 6.8 Phase 7: Advanced Features Testing

#### Test 7.1: Elicitation Features
*Note: Elicitation requires chat client support*

- [ ] Use interactive_code_review tool via Claude Chat
- [ ] Elicitation modal appears (if supported)
- [ ] Fill in requested information
- [ ] Submit response
- [ ] Tool completes with user preferences

#### Test 7.2: Progress Notifications
- [ ] Connect to Analytics server
- [ ] Execute `process_large_dataset` tool
- [ ] Progress updates displayed
- [ ] Final completion message

#### Test 7.3: Resource Subscriptions
- [ ] Connect to Knowledge server
- [ ] Read a resource
- [ ] Create a new document
- [ ] Check for update notifications

---

## 7. Performance Testing

### 7.1 Load Testing Scenarios

| Scenario | Target | Metric |
|----------|--------|--------|
| Concurrent connections | 100 clients | Connection success rate |
| Tool throughput | 1000 req/min | Response time p95 |
| Large data processing | 10MB dataset | Processing time |
| Streaming performance | 100KB response | Time to first byte |

### 7.2 Manual Performance Checks

- [ ] Server response time < 500ms for simple tools
- [ ] Web client remains responsive during operations
- [ ] No visible lag in streaming responses
- [ ] Memory usage stable over extended use

---

## 8. Security Testing

### 8.1 Input Validation Checks

- [ ] Path traversal blocked: `../../../etc/passwd`
- [ ] Invalid JSON rejected gracefully
- [ ] Long inputs handled without crash
- [ ] Special characters properly escaped

### 8.2 Session Security

- [ ] Session IDs are unique UUIDs
- [ ] Invalid session tokens rejected
- [ ] No sensitive data in error messages

---

## 9. Test Coverage Strategy

### 9.1 Current State

The existing tests (129 passing) test helper functions defined within test files, not actual server implementations. To achieve real coverage:

### 9.2 Required Integration Tests

Create tests that import actual server code:

```typescript
// Example: packages/servers/analytics/src/index.integration.test.ts
import { createServer } from './index.js';

describe('Analytics Server Integration', () => {
  let server: MCPServer;

  beforeAll(async () => {
    server = await createServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should execute calculate_statistics tool', async () => {
    const result = await server.callTool('calculate_statistics', {
      values: [1, 2, 3, 4, 5],
      measures: ['mean', 'median']
    });
    expect(result.content[0].text).toContain('mean');
  });
});
```

### 9.3 Coverage Targets (After Integration Tests)

| Metric | Target |
|--------|--------|
| Statements | 80% |
| Branches | 80% |
| Functions | 80% |
| Lines | 80% |

---

## 10. Test Automation

### 10.1 CI/CD Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:coverage
```

### 10.2 Test Scripts

```json
{
  "scripts": {
    "test": "turbo test",
    "test:unit": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

---

## 11. Test Data Management

### 11.1 Fixtures

Located in `packages/test-utils/src/fixtures.ts`:
- Mock tool definitions
- Mock resource data
- Mock prompt definitions
- Test data generators

### 11.2 Test Helpers

Located in `packages/test-utils/src/helpers.ts`:
- `createToolResult()` - MCP-compliant tool response
- `createResourceResult()` - MCP-compliant resource response
- `validateToolInput()` - Schema validation
- `createTestLogger()` - Log capture for assertions

---

## 12. Demo Recording Guide

### 12.1 Demo Environment Setup

Before recording:
```bash
# Terminal 1: Start all servers
cd packages/servers/dev-tools && pnpm start -- --http &
cd packages/servers/analytics && pnpm start -- --http &
cd packages/servers/cloud-ops && pnpm start -- --http &
cd packages/servers/knowledge && pnpm start -- --http &
cd packages/servers/chat-server && pnpm dev &

# Terminal 2: Start web client
cd packages/clients/web && pnpm dev

# Terminal 3: Start Claude chat
cd packages/clients/claude-chat && pnpm dev
```

### 12.2 Demo Scenarios

#### Scenario 1: Project Overview (2 min)
1. Show project structure in VSCode/terminal
2. Explain MCP architecture briefly
3. Point out servers, clients, core packages

#### Scenario 2: Web Client Demo (5 min)
1. Open http://localhost:5173
2. Show 4 server cards with descriptions
3. Connect to Dev Tools server
4. Show Tools/Resources/Prompts tabs
5. Execute `format_code` tool with messy JavaScript
6. Show formatted output in console
7. Read a resource
8. Get a prompt template
9. Connect to second server (Analytics)
10. Execute `calculate_statistics` with sample data

#### Scenario 3: CLI Client Demo (3 min)
1. Start CLI client
2. Connect to Knowledge server
3. Search for documents
4. Create a new document
5. List categories
6. Disconnect and exit

#### Scenario 4: Claude Chat Demo (5 min)
1. Open http://localhost:5174
2. Show connection status
3. Ask Claude to format code
4. Show tool execution happening
5. Ask Claude to read a file
6. Switch to OpenAI provider
7. Show both providers can use tools
8. Toggle streaming on/off

#### Scenario 5: VSCode Extension Demo (4 min)
1. Show extension icon in sidebar
2. View server list
3. Connect to Dev Tools
4. Expand capabilities tree
5. Execute a tool from tree
6. View result in editor
7. Connect to multiple servers
8. Show status bar

#### Scenario 6: Advanced Features (3 min)
1. Show progress tracking with large dataset
2. Demonstrate elicitation (if chat client supports)
3. Show multi-server tool execution

### 12.3 Demo Recording Checklist

#### Pre-Recording
- [ ] All servers running and healthy
- [ ] Web client accessible
- [ ] Claude chat accessible
- [ ] VSCode extension installed
- [ ] Clean terminal history
- [ ] Browser bookmarks organized
- [ ] Screen recording software ready
- [ ] Microphone tested

#### During Recording
- [ ] Speak clearly and pace yourself
- [ ] Highlight key features
- [ ] Show both success and error handling
- [ ] Pause after important actions
- [ ] Keep terminal output visible

#### Post-Recording
- [ ] Review for errors
- [ ] Trim unnecessary pauses
- [ ] Add captions if needed
- [ ] Export in appropriate format

### 12.4 Demo Script Template

```
[INTRO - 30 sec]
"Welcome to the MCP TypeScript Demo. This project demonstrates
the Model Context Protocol with multiple servers and clients."

[WEB CLIENT - 5 min]
"Let's start with the web client..."
[Show connections, tool execution, resources]

[CHAT CLIENT - 5 min]
"Now let's see how AI assistants can use MCP tools..."
[Show Claude formatting code, reading files]

[CLI CLIENT - 3 min]
"For terminal users, we have an interactive CLI..."
[Show basic operations]

[VSCODE - 4 min]
"Developers can use the VSCode extension..."
[Show tree views, tool execution]

[CONCLUSION - 30 sec]
"That's the MCP TypeScript Demo. Check out the repository
for documentation and to try it yourself."
```

---

## 13. Test Execution Checklist

### Pre-Test Setup
- [ ] Install dependencies: `pnpm install`
- [ ] Build all packages: `pnpm build`
- [ ] Verify environment: Node 20+, pnpm 8+
- [ ] Copy `.env.example` to `.env`

### Automated Tests
| Test | Command | Pass Criteria |
|------|---------|---------------|
| Unit Tests | `pnpm test` | All 129 tests pass |
| Type Check | `pnpm typecheck` | No errors |
| Lint | `pnpm lint` | No errors |
| Coverage | `pnpm test:coverage` | Report generated |

### Manual Test Phases
| Phase | Section | Duration | Status |
|-------|---------|----------|--------|
| 1 | Server Stdio Mode | 10 min | [ ] |
| 2 | Server HTTP Mode | 10 min | [ ] |
| 3 | CLI Client | 15 min | [ ] |
| 4 | Web Client | 20 min | [ ] |
| 5 | Claude Chat | 15 min | [ ] |
| 6 | VSCode Extension | 15 min | [ ] |
| 7 | Advanced Features | 10 min | [ ] |

### Post-Test Validation
- [ ] All automated tests pass
- [ ] All manual test phases completed
- [ ] No critical bugs found
- [ ] Demo scenarios verified
- [ ] Ready for recording

---

## 14. Test Results Summary

### Overall Results

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Unit Tests | 129 | 129 | 0 | 0 |
| Manual Tests | TBD | - | - | - |
| E2E Tests | TBD | - | - | - |

### Issues Found
- [ ] List any issues discovered during testing

### Recommendations
- [ ] Project ready for demo recording
- [ ] Project ready for public release

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-07 | Claude | Initial test plan |
| 1.1 | 2025-12-07 | Claude | Added manual testing and demo sections |

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Project Manual Test Instructions](./test_instructions.md)
- [Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md)
