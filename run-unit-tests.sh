#!/bin/bash

# Run all unit tests for MCP servers

echo "🧪 Running MCP Server Unit Tests..."
echo "=================================="

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

total_tests=0
total_passed=0
total_failed=0

# Function to test a server
test_server() {
    local server_name=$1
    local server_path="packages/servers/$server_name"
    
    echo ""
    echo -e "${YELLOW}Testing $server_name server...${NC}"
    
    if [ -d "$server_path" ] && [ -f "$server_path/package.json" ]; then
        cd "$server_path"
        
        # Check if test script exists
        if npm run | grep -q "test"; then
            # Run tests and capture output
            if npm test 2>&1; then
                echo -e "${GREEN}✅ $server_name tests passed${NC}"
            else
                echo -e "${RED}❌ $server_name tests failed${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  No tests found for $server_name${NC}"
        fi
        
        cd - > /dev/null
    else
        echo -e "${RED}❌ $server_name server directory not found${NC}"
    fi
}

# Test each server
test_server "dev-tools"
test_server "analytics"
test_server "cloud-ops"
test_server "knowledge"

echo ""
echo "=================================="
echo "🎉 Unit test run completed!"
echo ""
echo "To run tests for a specific server:"
echo "  cd packages/servers/[SERVER_NAME]"
echo "  npm test"
echo ""
echo "To run tests with coverage:"
echo "  npm run test:coverage"
echo ""
echo "To run tests in watch mode:"
echo "  npm run test:watch"