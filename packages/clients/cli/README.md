# MCP CLI Client

A command-line interface for interacting with Model Context Protocol (MCP) servers.

## Features

- **Interactive Mode**: User-friendly interface for exploring servers
- **Direct Commands**: Execute specific operations from command line
- **Multiple Servers**: Connect to any of the demo servers
- **Rich Output**: Colored and formatted output with tables and spinners

## Usage

### Interactive Mode (Recommended)

```bash
# Start interactive mode
pnpm start

# Or use the interactive command
mcp-cli interactive
```

Interactive mode provides a menu-driven interface to:
- Connect to servers
- Browse available tools, resources, and prompts
- Execute tools with guided input
- Read resources and get prompts

### Command Line Mode

```bash
# List available servers
mcp-cli list-servers

# Connect and list tools
mcp-cli tools dev-tools

# Call a tool directly
mcp-cli call dev-tools list_project_files '{"pattern": "**/*.ts"}'

# Connect to a server (stays connected)
mcp-cli connect analytics
```

## Available Servers

- **dev-tools**: Development utilities (formatting, file management)
- **analytics**: Data analysis and statistics
- **cloud-ops**: Infrastructure monitoring and deployment
- **knowledge**: Document storage and search

## Examples

### Development Workflow
```bash
# Format TypeScript code
mcp-cli call dev-tools format_code '{
  "code": "const x=1;const y=2;", 
  "language": "typescript"
}'

# List project files
mcp-cli call dev-tools list_project_files '{
  "pattern": "**/*.{ts,js}",
  "limit": 20
}'
```

### Data Analysis
```bash
# Generate sample data
mcp-cli call analytics generate_sample_data '{
  "format": "json",
  "recordCount": 50,
  "outputPath": "sample.json"
}'

# Calculate statistics
mcp-cli call analytics calculate_statistics '{
  "data": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "measures": ["mean", "median", "std"]
}'
```

### Infrastructure Monitoring
```bash
# Check service health
mcp-cli call cloud-ops check_service_health '{}'

# Get system metrics
mcp-cli call cloud-ops get_system_metrics '{
  "timeRange": "1h",
  "metrics": ["cpu", "memory"]
}'
```

### Knowledge Management
```bash
# Search documents
mcp-cli call knowledge search_documents '{
  "query": "MCP protocol",
  "limit": 5
}'

# Create a new document
mcp-cli call knowledge create_document '{
  "title": "My Document",
  "content": "# Hello\\nThis is my document",
  "category": "test",
  "tags": ["example"]
}'
```

## Building and Running

```bash
# Build the CLI
pnpm build

# Run in development mode
pnpm dev

# Install globally (after build)
npm install -g dist/
```

## Dependencies

- **commander**: Command-line interface framework
- **inquirer**: Interactive prompts
- **chalk**: Terminal styling
- **ora**: Loading spinners
- **table**: Data table formatting