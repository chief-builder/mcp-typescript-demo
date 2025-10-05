#!/bin/bash

# Simple wrapper script to run CLI tests

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Building CLI client before testing...${NC}"

# Navigate to project root
cd "$(dirname "$0")/.."

# Build the CLI client
cd packages/clients/cli
pnpm build
cd ../../..

echo -e "${GREEN}Build complete. Starting automated tests...${NC}"
echo ""

# Run the automated test
node scripts/test-cli-automated.js