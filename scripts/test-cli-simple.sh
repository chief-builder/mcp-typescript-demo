#!/bin/bash

# Simple CLI Testing Script
# This script provides a basic automated test of the CLI functionality

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MCP CLI Client Simple Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages/clients/cli" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

# Navigate to CLI directory
cd packages/clients/cli

echo -e "${YELLOW}Building CLI client...${NC}"
pnpm build

echo ""
echo -e "${GREEN}Build complete!${NC}"
echo ""
echo -e "${YELLOW}Running basic connectivity test...${NC}"
echo ""

# Create a simple test using expect (if available) or provide manual instructions
if command -v expect &> /dev/null; then
    echo -e "${GREEN}Running automated test with expect...${NC}"
    
    # Create expect script
    cat > /tmp/cli-test.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 30

spawn pnpm start

# Wait for initial menu
expect "[Not Connected] What would you like to do?"

# Connect to server (Enter on first option)
send "\r"
expect "Select a server to connect to:"

# Select Development Tools (Enter on first option)
send "\r"
expect -re "(Connected to Development Tools|Development Tools.*What would you like to do)"

# The connection succeeded!
puts "\n\033\[0;32m✓ Successfully connected to Development Tools server\033\[0m"

# Try to list tools - navigate to correct option
send "\033\[B\r"  ;# Down arrow + Enter
expect {
    "Available Tools:" {
        puts "\033\[0;32m✓ Successfully listed tools\033\[0m"
    }
    timeout {
        puts "\033\[0;31m✗ Failed to list tools\033\[0m"
    }
}

# Exit - send Ctrl+C
send "\003"
expect eof
EOF

    chmod +x /tmp/cli-test.exp
    /tmp/cli-test.exp
    rm -f /tmp/cli-test.exp
    
else
    echo -e "${YELLOW}expect not found. Here's how to test manually:${NC}"
    echo ""
    echo "1. Run: pnpm start"
    echo "2. Press Enter to select 'Connect to Server'"
    echo "3. Press Enter to select 'Development Tools'"
    echo "4. After connection, press Down Arrow then Enter to select 'List Tools'"
    echo "5. Press Ctrl+C to exit"
    echo ""
    echo -e "${BLUE}Starting CLI for manual testing...${NC}"
    pnpm start
fi

echo ""
echo -e "${GREEN}Test completed!${NC}"