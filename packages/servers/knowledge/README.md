# Knowledge Base Server

MCP server providing document storage, search, and retrieval capabilities.

## Features

### Tools
- **search_documents**: Search through documents using keywords with filtering
- **get_document**: Retrieve specific documents by ID with format options
- **create_document**: Add new documents to the knowledge base
- **list_categories**: View all categories and tags with document counts

### Resources
- **knowledge_base_stats**: Overview statistics and recent documents

### Prompts
- **research_assistant**: Guided research workflow using the knowledge base

## Usage

```bash
# Build the server
pnpm build

# Start the server
pnpm start

# Development mode
pnpm dev
```

## Testing with MCP Inspector

1. Build the server: `pnpm build`
2. Open MCP Inspector
3. Add server with command: `node packages/servers/knowledge/dist/index.js`
4. Test the tools, resources, and prompts

## Features

- **Full-text Search**: Powered by Fuse.js for fuzzy matching
- **Document Management**: Create, retrieve, and organize documents
- **Categorization**: Organize documents by categories and tags
- **Multiple Formats**: Support for Markdown, HTML, and plain text output
- **Research Assistance**: Structured workflows for knowledge exploration

## Sample Documents

The server comes pre-loaded with sample documents covering:
- MCP Protocol Overview
- TypeScript SDK Guide
- Security Best Practices

## Dependencies

- **fuse.js**: Advanced search capabilities
- **marked**: Markdown to HTML conversion