#!/bin/bash

# MCP TypeScript Demo - Development Setup Script
# This script sets up a complete development environment for MCP

set -e  # Exit on any error

echo "🚀 Setting up MCP TypeScript Demo development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

# Check Node.js version
log_info "Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    log_error "Node.js version $REQUIRED_VERSION or higher is required. Found: $NODE_VERSION"
    echo "Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi
log_success "Node.js version $NODE_VERSION is compatible"

# Check pnpm installation
log_info "Checking pnpm installation..."
if ! command -v pnpm &> /dev/null; then
    log_warning "pnpm not found. Installing pnpm..."
    npm install -g pnpm
fi

PNPM_VERSION=$(pnpm --version)
log_success "pnpm version $PNPM_VERSION is available"

# Clean previous installations
log_info "Cleaning previous installations..."
rm -rf node_modules packages/*/node_modules packages/*/dist
log_success "Cleaned previous installations"

# Install dependencies
log_info "Installing dependencies..."
pnpm install --frozen-lockfile
log_success "Dependencies installed"

# Build all packages
log_info "Building all packages..."
pnpm build
log_success "All packages built successfully"

# Run tests to verify everything works
log_info "Running tests to verify installation..."
pnpm test --run
log_success "All tests passed"

# Check linting
log_info "Checking code quality..."
pnpm lint
log_success "Code quality checks passed"

# Type checking
log_info "Running TypeScript type checks..."
pnpm typecheck
log_success "TypeScript compilation successful"

# Create development configuration
log_info "Creating development configuration..."

# Create .env template if it doesn't exist
if [ ! -f ".env.example" ]; then
    cat > .env.example << 'EOF'
# MCP Development Environment Configuration

# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Server ports (adjust if needed)
DEV_TOOLS_PORT=3001
ANALYTICS_PORT=3002
CLOUD_OPS_PORT=3003
KNOWLEDGE_PORT=3004
CHAT_SERVER_PORT=4000

# Client ports
WEB_CLIENT_PORT=5173
CLAUDE_CHAT_PORT=5174

# Optional: LLM API keys for chat functionality
# ANTHROPIC_API_KEY=your_api_key_here
# OPENAI_API_KEY=your_api_key_here
EOF
    log_success "Created .env.example file"
fi

# Set up Git hooks (if this is a Git repository)
if [ -d ".git" ]; then
    log_info "Setting up Git hooks..."
    
    # Create pre-commit hook
    mkdir -p .git/hooks
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."

# Run linting
echo "🔍 Linting code..."
pnpm lint

# Run type checking
echo "🔧 Type checking..."
pnpm typecheck

# Run tests
echo "🧪 Running tests..."
pnpm test --run

echo "✅ Pre-commit checks passed!"
EOF
    chmod +x .git/hooks/pre-commit
    log_success "Git pre-commit hook installed"
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Quick Start Commands:"
echo "  pnpm dev          - Start development mode with watch"
echo "  pnpm build        - Build all packages"
echo "  pnpm test         - Run all tests"
echo "  pnpm lint         - Run linting"
echo "  pnpm typecheck    - Run TypeScript checks"
echo ""
echo "🖥️  Start Individual Servers:"
echo "  cd packages/servers/dev-tools && pnpm start"
echo "  cd packages/servers/analytics && pnpm start"
echo "  cd packages/servers/cloud-ops && pnpm start"
echo "  cd packages/servers/knowledge && pnpm start"
echo "  cd packages/servers/chat-server && pnpm dev"
echo ""
echo "💻 Start Clients:"
echo "  cd packages/clients/cli && pnpm start"
echo "  cd packages/clients/web && pnpm dev"
echo "  cd packages/clients/claude-chat && pnpm dev"
echo ""
echo "📚 Next Steps:"
echo "  - Read README.md for detailed usage instructions"
echo "  - Check out docs/tutorials/ for step-by-step guides"
echo "  - Explore ARCHITECTURE_DIAGRAMS.md for system overview"
echo ""
echo "Happy coding! 🚀"