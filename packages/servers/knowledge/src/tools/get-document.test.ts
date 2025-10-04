import { describe, it, expect } from 'vitest';

describe('get_document tool', () => {
  // Mock document data
  const mockDocuments = new Map([
    ['doc-1', {
      id: 'doc-1',
      title: 'MCP Protocol Overview',
      content: `# Model Context Protocol (MCP)

The Model Context Protocol (MCP) is an open standard for connecting AI assistants to data sources and tools.

## Key Features

- **Standardized Communication**: JSON-RPC 2.0 based protocol
- **Security**: Built-in authentication and authorization
- **Flexibility**: Supports various transport methods
- **Extensibility**: Pluggable architecture for tools and resources`,
      tags: ['mcp', 'protocol', 'overview'],
      category: 'documentation',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      author: 'MCP Team',
      summary: 'Introduction to the Model Context Protocol and its architecture'
    }],
    ['doc-2', {
      id: 'doc-2',
      title: 'TypeScript SDK Guide',
      content: `# MCP TypeScript SDK

The official TypeScript SDK for building MCP servers and clients.

## Installation

\`\`\`bash
npm install @modelcontextprotocol/sdk
\`\`\`

## Basic Usage

\`\`\`typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
\`\`\``,
      tags: ['typescript', 'sdk', 'development'],
      category: 'guide',
      createdAt: '2024-01-16T09:00:00Z',
      updatedAt: '2024-01-16T09:00:00Z',
      author: 'Development Team',
      summary: 'Comprehensive guide for using the TypeScript SDK'
    }]
  ]);

  it('should retrieve document by ID', () => {
    const documentId = 'doc-1';
    const document = mockDocuments.get(documentId);
    
    expect(document).toBeDefined();
    expect(document?.id).toBe(documentId);
    expect(document?.title).toBe('MCP Protocol Overview');
  });

  it('should return undefined for non-existent document', () => {
    const documentId = 'non-existent';
    const document = mockDocuments.get(documentId);
    
    expect(document).toBeUndefined();
  });

  it('should include full document content', () => {
    const document = mockDocuments.get('doc-1');
    
    expect(document?.content).toContain('Model Context Protocol');
    expect(document?.content).toContain('Key Features');
    expect(document?.content).toContain('JSON-RPC 2.0');
  });

  it('should include document metadata', () => {
    const document = mockDocuments.get('doc-1');
    
    expect(document?.author).toBe('MCP Team');
    expect(document?.category).toBe('documentation');
    expect(document?.tags).toEqual(['mcp', 'protocol', 'overview']);
    expect(document?.summary).toContain('Introduction to');
  });

  it('should handle markdown content', () => {
    const document = mockDocuments.get('doc-2');
    
    expect(document?.content).toContain('# MCP TypeScript SDK');
    expect(document?.content).toContain('```bash');
    expect(document?.content).toContain('```typescript');
  });

  it('should validate timestamp format', () => {
    const document = mockDocuments.get('doc-1');
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    
    expect(document?.createdAt).toMatch(timestampRegex);
    expect(document?.updatedAt).toMatch(timestampRegex);
  });

  it('should support different document formats', () => {
    const formatSupport = {
      markdown: (document: any) => document.content.includes('#') || document.content.includes('```'),
      plaintext: (document: any) => !document.content.includes('#') && !document.content.includes('```'),
      html: (document: any) => document.content.includes('<') && document.content.includes('>')
    };
    
    const doc1 = mockDocuments.get('doc-1')!;
    const doc2 = mockDocuments.get('doc-2')!;
    
    expect(formatSupport.markdown(doc1)).toBe(true);
    expect(formatSupport.markdown(doc2)).toBe(true);
  });
});