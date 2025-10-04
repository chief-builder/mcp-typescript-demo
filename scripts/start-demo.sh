#!/bin/bash

# MCP TypeScript Demo - Quick Demo Startup Script
# Starts all servers and clients for a complete demo experience

set -e

echo "🎭 Starting MCP TypeScript Demo..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if everything is built
if [ ! -d "packages/servers/dev-tools/dist" ]; then
    log_warning "Packages not built. Building now..."
    pnpm build
fi

# Function to start a server in the background
start_server() {
    local server_name=$1
    local port=$2
    local package_path="packages/servers/$server_name"
    
    if [ ! -d "$package_path" ]; then
        log_error "Server $server_name not found at $package_path"
        return 1
    fi
    
    log_info "Starting $server_name on port $port..."
    cd "$package_path"
    pnpm start -- --http &
    local pid=$!
    cd - > /dev/null
    
    # Wait a moment and check if process is still running
    sleep 2
    if kill -0 $pid 2>/dev/null; then
        log_success "$server_name started (PID: $pid)"
        echo $pid >> /tmp/mcp-demo-pids
    else
        log_error "Failed to start $server_name"
    fi
}

# Function to start a client in the background
start_client() {
    local client_name=$1
    local port=$2
    local package_path="packages/clients/$client_name"
    
    if [ ! -d "$package_path" ]; then
        log_error "Client $client_name not found at $package_path"
        return 1
    fi
    
    log_info "Starting $client_name on port $port..."
    cd "$package_path"
    pnpm dev &
    local pid=$!
    cd - > /dev/null
    
    # Wait a moment and check if process is still running
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log_success "$client_name started (PID: $pid)"
        echo $pid >> /tmp/mcp-demo-pids
    else
        log_error "Failed to start $client_name"
    fi
}

# Clean up function
cleanup() {
    echo ""
    log_info "Shutting down MCP Demo..."
    
    if [ -f /tmp/mcp-demo-pids ]; then
        while read pid; do
            if kill -0 $pid 2>/dev/null; then
                log_info "Stopping process $pid..."
                kill $pid
            fi
        done < /tmp/mcp-demo-pids
        rm -f /tmp/mcp-demo-pids
    fi
    
    log_success "Demo stopped"
    exit 0
}

# Set up signal handlers
trap cleanup INT TERM

# Clear previous PID file
rm -f /tmp/mcp-demo-pids
touch /tmp/mcp-demo-pids

echo ""
echo "🚀 Starting MCP Servers..."
echo "================================"

# Start all MCP servers
start_server "dev-tools" 3001
start_server "analytics" 3002
start_server "cloud-ops" 3003
start_server "knowledge" 3004

# Start chat server (special case)
log_info "Starting chat-server on port 4000..."
cd packages/servers/chat-server
pnpm dev &
chat_pid=$!
cd - > /dev/null
sleep 3
if kill -0 $chat_pid 2>/dev/null; then
    log_success "chat-server started (PID: $chat_pid)"
    echo $chat_pid >> /tmp/mcp-demo-pids
else
    log_error "Failed to start chat-server"
fi

echo ""
echo "🌐 Starting Web Clients..."
echo "============================"

# Start web clients
start_client "web" 5173
start_client "claude-chat" 5174

echo ""
echo "⏳ Waiting for all services to be ready..."
sleep 5

echo ""
echo "🎉 MCP TypeScript Demo is running!"
echo "=================================="
echo ""
echo "📊 Available Services:"
echo ""
echo "🔧 MCP Servers (HTTP mode):"
echo "  • Dev Tools Server:    http://localhost:3001"
echo "  • Analytics Server:    http://localhost:3002"
echo "  • Cloud Ops Server:    http://localhost:3003"
echo "  • Knowledge Server:    http://localhost:3004"
echo "  • Chat Server:         http://localhost:4000"
echo ""
echo "💻 Web Clients:"
echo "  • Web Client:          http://localhost:5173"
echo "  • Claude Chat UI:      http://localhost:5174"
echo ""
echo "🧪 Health Checks:"
echo "  curl http://localhost:3001/health"
echo "  curl http://localhost:3002/health"
echo "  curl http://localhost:3003/health"
echo "  curl http://localhost:3004/health"
echo "  curl http://localhost:4000/health"
echo ""
echo "📱 CLI Client (run in new terminal):"
echo "  cd packages/clients/cli && pnpm start"
echo ""
echo "📚 Documentation:"
echo "  • README.md - Main documentation"
echo "  • docs/tutorials/ - Step-by-step guides"
echo "  • ARCHITECTURE_DIAGRAMS.md - System overview"
echo ""
echo "🛑 To stop the demo: Press Ctrl+C"
echo ""

# Wait for interrupt
while true; do
    sleep 1
done