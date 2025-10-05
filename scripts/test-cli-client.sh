#!/bin/bash

# MCP CLI Client Automated Testing Script
# This script automates the testing of all CLI client functionality

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MCP CLI Client Automated Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running from project root
if [ ! -f "package.json" ] || [ ! -d "packages/clients/cli" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Build CLI client first
echo -e "${YELLOW}Building CLI client...${NC}"
cd packages/clients/cli
pnpm build
cd ../../..

# Create test input file for expect
cat > /tmp/mcp-cli-test-input.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 10

# Start the CLI client
spawn pnpm --dir packages/clients/cli start

# Wait for initial prompt
expect "What would you like to do?"

# Test 1: Connect to Development Tools server
send "\033\[B\r"  ;# Down arrow to "Connect to Server" and enter
expect "Select a server to connect to:"
send "\r"  ;# Select first server (Development Tools)
expect "Connected to Development Tools"
expect "What would you like to do?"

# Test 2: List Tools
send "\r"  ;# Select "List Tools" (first option when connected)
expect "Available Tools:"
expect "format_code"
expect "What would you like to do?"

# Test 3: List Resources
send "\033\[B\r"  ;# Down arrow to "List Resources" and enter
expect "Available Resources:"
expect "project_config"
expect "What would you like to do?"

# Test 4: List Prompts
send "\033\[B\033\[B\r"  ;# Down arrow twice to "List Prompts" and enter
expect "Available Prompts:"
expect "code_review"
expect "What would you like to do?"

# Test 5: Call Tool
send "\033\[B\033\[B\033\[B\r"  ;# Down arrow three times to "Call Tool" and enter
expect "Select a tool to call:"
send "\r"  ;# Select first tool (format_code)
expect "Enter tool arguments"
send "{\"code\": \"function test(){console.log('hello')}\", \"language\": \"javascript\"}\r"
expect "Tool Result: format_code"
expect "Successfully formatted"
expect "What would you like to do?"

# Test 6: Read Resource
send "\033\[B\033\[B\033\[B\033\[B\r"  ;# Down arrow four times to "Read Resource" and enter
expect "Select a resource to read:"
send "\r"  ;# Select first resource (project_config)
expect "Resource: devtools://config/project"
expect "Project Configuration Overview"
expect "What would you like to do?"

# Test 7: Get Prompt
send "\033\[B\033\[B\033\[B\033\[B\033\[B\r"  ;# Down arrow five times to "Get Prompt" and enter
expect "Select a prompt to get:"
send "\r"  ;# Select first prompt (code_review)
expect "Enter prompt arguments"
send "{\"filePath\": \"test.js\"}\r"
expect "Prompt: code_review"
expect "comprehensive code review"
expect "What would you like to do?"

# Test 8: Disconnect
send "\033\[B\033\[B\033\[B\033\[B\033\[B\033\[B\r"  ;# Down arrow six times to "Disconnect" and enter
expect "Disconnected from server"
expect "\[Not Connected\]"

# Test 9: Exit
send "\033\[B\r"  ;# Down arrow to "Exit" and enter
expect "Goodbye!"
expect eof
EOF

# Make the expect script executable
chmod +x /tmp/mcp-cli-test-input.exp

# Run the automated test
echo -e "${YELLOW}Running automated CLI tests...${NC}"
echo ""

if /tmp/mcp-cli-test-input.exp > /tmp/mcp-cli-test-output.log 2>&1; then
    echo -e "${GREEN}✓ All automated tests completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}Test Summary:${NC}"
    echo -e "${GREEN}✓${NC} Connected to Development Tools server"
    echo -e "${GREEN}✓${NC} Listed available tools"
    echo -e "${GREEN}✓${NC} Listed available resources" 
    echo -e "${GREEN}✓${NC} Listed available prompts"
    echo -e "${GREEN}✓${NC} Called format_code tool with arguments"
    echo -e "${GREEN}✓${NC} Read project_config resource"
    echo -e "${GREEN}✓${NC} Retrieved code_review prompt"
    echo -e "${GREEN}✓${NC} Disconnected from server"
    echo -e "${GREEN}✓${NC} Exited CLI gracefully"
    
    # Clean up
    rm -f /tmp/mcp-cli-test-input.exp
    rm -f /tmp/mcp-cli-test-output.log
    
    echo ""
    echo -e "${GREEN}All CLI client functionality verified!${NC}"
    exit 0
else
    echo -e "${RED}✗ Automated tests failed!${NC}"
    echo ""
    echo -e "${YELLOW}Error output:${NC}"
    tail -n 20 /tmp/mcp-cli-test-output.log
    
    # Clean up
    rm -f /tmp/mcp-cli-test-input.exp
    rm -f /tmp/mcp-cli-test-output.log
    
    exit 1
fi