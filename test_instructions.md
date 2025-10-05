# MCP TypeScript Demo - Complete Testing Instructions

## 🎯 Overview

This document provides comprehensive step-by-step instructions to test all components of the MCP TypeScript Demo project. Follow these tests sequentially to validate the entire system.

## 📋 Pre-Test Checklist

- [ ] Repository successfully published to GitHub
- [ ] All packages built successfully (`pnpm build`)
- [ ] Working directory: `/mcp-typescript-demo/`
- [ ] Node.js 20+ and pnpm 8+ installed

---

## 🔧 Phase 1: Environment & Build Testing

### Test 1.1: Development Environment Setup
```bash
# Navigate to project root
cd /path/to/mcp-typescript-demo

# Test development setup script
./scripts/setup-dev.sh
```

**Expected Results:**
- [ ] Script runs without errors
- [ ] All dependencies installed
- [ ] Build completes successfully
- [ ] Tests pass
- [ ] Type checking succeeds

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 1.2: Build System Validation
```bash
# Clean and rebuild everything
pnpm clean
pnpm install
pnpm build
```

**Expected Results:**
- [ ] All 10 packages build successfully
- [ ] No TypeScript compilation errors
- [ ] Dist folders created for all packages

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 1.3: Type Checking
```bash
# Run TypeScript type checking across all packages
pnpm typecheck
```

**Expected Results:**
- [ ] No TypeScript errors
- [ ] All packages pass type checking

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 🖥️ Phase 2: Server Testing (stdio Mode)

### Test 2.1: Development Tools Server
```bash
# Terminal 1: Start dev-tools server
cd packages/servers/dev-tools
pnpm start

# Should see: Server starting on stdio transport
# Server ready and listening
```

**Expected Results:**
- [ ] Server starts without errors
- [ ] Shows "Server ready and listening" message
- [ ] Process runs in stdio mode

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 2.2: Analytics Server
```bash
# Terminal 2: Start analytics server
cd packages/servers/analytics
pnpm start
```

**Expected Results:**
- [ ] Server starts without errors
- [ ] Ready for client connections

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 2.3: Cloud Ops Server
```bash
# Terminal 3: Start cloud-ops server
cd packages/servers/cloud-ops
pnpm start
```

**Expected Results:**
- [ ] Server starts without errors
- [ ] Shows initialization messages

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 2.4: Knowledge Server
```bash
# Terminal 4: Start knowledge server
cd packages/servers/knowledge
pnpm start
```

**Expected Results:**
- [ ] Server starts without errors
- [ ] Document storage initialized

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 2.5: Chat Server
```bash
# Terminal 5: Start chat server
cd packages/servers/chat-server
pnpm dev
```

**Expected Results:**
- [ ] Express server starts
- [ ] Shows "Chat server started on port 4000"
- [ ] Multiple endpoints available

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 🌐 Phase 3: Server Testing (HTTP Mode)

### Test 3.1: Stop All stdio Servers
Stop all servers from Phase 2 (Ctrl+C in each terminal)

### Test 3.2: Start Servers in HTTP Mode
```bash
# Terminal 1: Dev Tools (Port 3001)
cd packages/servers/dev-tools
pnpm start -- --http
# Should see: "Server started on http://localhost:3001"

# Terminal 2: Analytics (Port 3002)
cd packages/servers/analytics
pnpm start -- --http
# Should see: "Server started on http://localhost:3002"

# Terminal 3: Cloud Ops (Port 3003)
cd packages/servers/cloud-ops
pnpm start -- --http
# Should see: "Server started on http://localhost:3003"

# Terminal 4: Knowledge (Port 3004)
cd packages/servers/knowledge
pnpm start -- --http
# Should see: "Server started on http://localhost:3004"

# Terminal 5: Chat Server (Port 4000)
cd packages/servers/chat-server
pnpm dev
# Should see: "Chat server started on port 4000"
```

**Expected Results:**
- [ ] All 5 servers start on different ports
- [ ] No port conflicts
- [ ] All show HTTP endpoints ready

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 3.3: HTTP Health Checks
```bash
# Test server health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health  
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:4000/health
```

**Expected Results:**
- [ ] All health checks return 200 OK
- [ ] Each returns server status information

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 3.4: MCP Endpoints
```bash
# Test MCP endpoints (should return server info)
curl http://localhost:3001/
curl http://localhost:3002/
curl http://localhost:3003/
curl http://localhost:3004/
```

**Expected Results:**
- [ ] All endpoints return server information
- [ ] JSON responses with server details

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 💻 Phase 4: Client Testing

### Test 4.1: CLI Client
```bash
# Terminal 6: Start CLI client
cd packages/clients/cli
pnpm start
```

**Expected Results:**
- [ ] CLI interface appears with "MCP CLI - Interactive Mode" header
- [ ] Shows "Type 'help' for available commands or 'exit' to quit"
- [ ] Interactive menu shows initial options

**Test CLI Operations (Complete Checklist):**

#### 1. Server Connection
- [ ] Select "Connect to Server" from main menu
- [ ] List of servers appears: Development Tools, Data Analytics, Cloud Operations, Knowledge Base
- [ ] Select a server (e.g., Development Tools)
- [ ] Connection spinner appears "Connecting to Development Tools..."
- [ ] Success message: "✔ Connected to Development Tools"
- [ ] Menu prompt changes to show server name: "[Development Tools] What would you like to do?"

#### 2. List Tools
- [ ] Select "List Tools" option
- [ ] Table displays with columns: Name, Description
- [ ] Tools shown include: format_code, list_project_files, read_file, interactive_code_review, generate_documentation, scan_project

#### 3. List Resources
- [ ] Select "List Resources" option
- [ ] Table displays with columns: Name, URI, Description
- [ ] Resources shown include: project_config, test_reports, build_configs, code_metrics

#### 4. List Prompts
- [ ] Select "List Prompts" option
- [ ] Table displays with columns: Name, Description
- [ ] Prompts shown include: code_review, debug_session, test_strategy

#### 5. Call Tool
- [ ] Select "Call Tool" option
- [ ] Tool selection list appears
- [ ] Select "format_code - Format code using Prettier with language-specific support"
- [ ] Prompted for arguments: "Enter tool arguments (JSON format, or press Enter for empty):"
- [ ] Enter test arguments: `{"code": "function test(){console.log('hello')}", "language": "javascript"}`
- [ ] Tool executes and displays formatted result
- [ ] Metadata shows execution details

#### 6. Read Resource
- [ ] Select "Read Resource" option
- [ ] Resource selection list appears
- [ ] Select a resource (e.g., "project_config (devtools://config/project)")
- [ ] Resource contents displayed with name, URI, description, content, and metadata

#### 7. Get Prompt
- [ ] Select "Get Prompt" option
- [ ] Prompt selection list appears
- [ ] Select "code_review - Perform a comprehensive code review with suggestions for improvement"
- [ ] Prompted for arguments: "Enter prompt arguments (JSON format, or press Enter for empty):"
- [ ] Enter test arguments: `{"filePath": "test.js"}`
- [ ] Prompt template displayed with messages and metadata

#### 8. Disconnect
- [ ] Select "Disconnect" option
- [ ] Success message: "✔ Disconnected from [server name]"
- [ ] Menu returns to initial "[Not Connected] What would you like to do?" state

#### 9. Reconnect Test
- [ ] After disconnecting, select "Connect to Server" again
- [ ] Connect to a different server (e.g., Data Analytics)
- [ ] Verify new connection shows different tools/resources

#### 10. Exit
- [ ] Select "Exit" option
- [ ] CLI closes gracefully with "Goodbye!" message

**Additional Tests:**
- [ ] Invalid JSON input shows error: "Invalid JSON arguments:"
- [ ] Empty arguments "{}" accepted for tools/prompts that don't require parameters
- [ ] Navigation between menus works smoothly
- [ ] Ctrl+C exits the program cleanly

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 4.2: Web Client
```bash
# Terminal 7: Start web client
cd packages/clients/web
pnpm dev
# Should start on http://localhost:5173
```

**Expected Results:**
- [ ] Vite dev server starts
- [ ] Browser opens to http://localhost:5173
- [ ] Web interface loads

**Test Web Operations:**
1. Connect to a server (enter server URL)
2. View server capabilities
3. Execute tools
4. View resources
5. Check logs panel

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 4.3: Claude Chat Client
```bash
# Terminal 8: Start Claude chat client
cd packages/clients/claude-chat
pnpm dev
# Should start on http://localhost:5174
```

**Expected Results:**
- [ ] Vite dev server starts
- [ ] Browser opens to http://localhost:5174
- [ ] Chat interface loads

**Test Chat Operations:**
1. Select LLM provider (Claude/OpenAI)
2. Enter chat message
3. View response
4. Test elicitation features

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 🔄 Phase 5: Integration Testing

### Test 5.1: Full Demo Script
```bash
# Use the demo startup script
./scripts/start-demo.sh
```

**Expected Results:**
- [ ] All servers start automatically
- [ ] All web clients start
- [ ] Health checks pass
- [ ] No port conflicts
- [ ] Demo instructions display

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 5.2: End-to-End Tool Execution

**Test dev-tools server:**
```bash
# Using CLI client or web client:
# 1. Connect to http://localhost:3001
# 2. Execute 'format_code' tool with sample JavaScript:
function test(){console.log("hello world");}
```

**Expected Results:**
- [ ] Code gets formatted properly
- [ ] Response includes formatted code
- [ ] Metadata includes operation details

**Test analytics server:**
```bash
# 1. Connect to http://localhost:3002
# 2. Execute 'calculate_statistics' tool with sample data:
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

**Expected Results:**
- [ ] Statistics calculated correctly
- [ ] Mean, median, std dev returned
- [ ] Response properly formatted

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 5.3: Resource Subscriptions

**Using web client:**
1. Connect to knowledge server
2. Subscribe to resources updates
3. Create a new document
4. Verify update notification received

**Expected Results:**
- [ ] Subscription established
- [ ] Update notifications received
- [ ] Resource changes reflected

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 🧪 Phase 6: Advanced Feature Testing

### Test 6.1: Progress Notifications

**Using analytics server:**
1. Execute 'process_large_dataset' tool
2. Monitor progress updates
3. Verify completion

**Expected Results:**
- [ ] Progress notifications received
- [ ] Progress percentage updates
- [ ] Final completion message

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 6.2: Elicitation Features

**Using knowledge server:**
1. Execute 'interactive_knowledge_curator' tool
2. Respond to elicitation prompts
3. Complete workflow

**Expected Results:**
- [ ] Elicitation requests sent
- [ ] User input handled
- [ ] Workflow completes

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 6.3: Error Handling

**Test various error scenarios:**
1. Invalid tool parameters
2. Non-existent resources
3. Server connection failures
4. Malformed requests

**Expected Results:**
- [ ] Proper error responses
- [ ] Error codes as per MCP spec
- [ ] User-friendly error messages
- [ ] No server crashes

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 🔍 Phase 7: Documentation & Usability Testing

### Test 7.1: Documentation Links
1. Check all links in README.md
2. Verify architecture diagrams load
3. Test tutorial instructions
4. Check API documentation

**Expected Results:**
- [ ] All documentation links work
- [ ] Diagrams render properly
- [ ] Tutorials are followable
- [ ] API docs are accurate

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 7.2: Tutorial Walkthrough

**Follow Tutorial 1: Getting Started**
1. Complete environment setup
2. Start first server
3. Connect client
4. Execute basic operations

**Expected Results:**
- [ ] Tutorial instructions work
- [ ] Examples execute successfully
- [ ] Learning objectives met

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 🚀 Phase 8: Production Readiness Testing

### Test 8.1: Performance Testing
```bash
# Run multiple concurrent connections
# Monitor resource usage
# Test with various payload sizes
```

**Expected Results:**
- [ ] Servers handle concurrent connections
- [ ] Reasonable response times
- [ ] No memory leaks observed

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

### Test 8.2: Security Testing
```bash
# Test input validation
# Check path traversal protection
# Verify error message sanitization
```

**Expected Results:**
- [ ] Invalid inputs rejected
- [ ] Security vulnerabilities protected
- [ ] No sensitive information leaked

**Status:** ✅ Pass / ❌ Fail  
**Notes:** _______________

---

## 📊 Final Test Summary

### Overall Results

| Phase | Component | Status | Notes |
|-------|-----------|---------|-------|
| 1 | Environment Setup | ⏳ | |
| 1 | Build System | ⏳ | |
| 1 | Type Checking | ⏳ | |
| 2 | dev-tools-server (stdio) | ⏳ | |
| 2 | analytics-server (stdio) | ⏳ | |
| 2 | cloud-ops-server (stdio) | ⏳ | |
| 2 | knowledge-server (stdio) | ⏳ | |
| 2 | chat-server | ⏳ | |
| 3 | All servers (HTTP) | ⏳ | |
| 3 | Health checks | ⏳ | |
| 3 | MCP endpoints | ⏳ | |
| 4 | CLI client | ⏳ | |
| 4 | Web client | ⏳ | |
| 4 | Claude chat client | ⏳ | |
| 5 | Demo script | ⏳ | |
| 5 | E2E tool execution | ⏳ | |
| 5 | Resource subscriptions | ⏳ | |
| 6 | Progress notifications | ⏳ | |
| 6 | Elicitation | ⏳ | |
| 6 | Error handling | ⏳ | |
| 7 | Documentation | ⏳ | |
| 7 | Tutorials | ⏳ | |
| 8 | Performance | ⏳ | |
| 8 | Security | ⏳ | |

### Critical Issues Found
- [ ] None
- [ ] List any critical issues that prevent usage:

### Minor Issues Found
- [ ] None  
- [ ] List any minor issues that should be addressed:

### Recommendations
- [ ] Project ready for production use
- [ ] Project ready for public release
- [ ] Project ready for educational use
- [ ] Additional work needed (specify):

---

## ✅ Test Completion

**Date:** ___________  
**Tester:** ___________  
**Duration:** ___________  
**Overall Status:** ✅ Pass / ❌ Fail / ⚠️ Pass with Issues

**Final Notes:**
________________________________________________________________
________________________________________________________________
________________________________________________________________

**Signature:** ___________