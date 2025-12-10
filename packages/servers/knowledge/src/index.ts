#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Logger } from '@mcp-demo/core';
import Fuse from 'fuse.js';
import { marked } from 'marked';

const logger = new Logger('knowledge-server');

// Command line argument parsing
const args = process.argv.slice(2);
const hasHttpFlag = args.includes('--http');
const transportArg = args.find(arg => arg.startsWith('--transport='))?.split('=')[1] || (hasHttpFlag ? 'http' : 'stdio');
const portArg = args.find(arg => arg.startsWith('--port='))?.split('=')[1];
const port = portArg ? parseInt(portArg, 10) : 3004;

/**
 * Creates and configures the MCP Knowledge Server with all capabilities
 * @returns Object containing the MCP server instance, base server, and notification function
 */
function createMCPServer(): { mcpServer: McpServer, baseServer: any, notifyResourceSubscribers?: (uri: string, changeType: 'created' | 'updated' | 'deleted') => Promise<void> } {
  const server = new McpServer({
    name: 'knowledge-server',
    version: '1.0.0',
  }, {
    capabilities: { 
      logging: {},
      elicitation: {},
      completion: {},
      prompts: {
        listChanged: true
      },
      resources: {
        subscribe: true,
        listChanged: true
      },
      sampling: {}
    }
  });
  
  // Access the underlying base server for elicitation capabilities
  const baseServer = (server as any).server;
  
  // This will be set later after we define the function
  let notifyResourceSubscribers: ((uri: string, changeType: 'created' | 'updated' | 'deleted') => Promise<void>) | undefined;

/**
 * Document interface representing a knowledge base document
 * @interface Document
 */
interface Document {
  /** Unique identifier for the document */
  id: string;
  /** Human-readable title of the document */
  title: string;
  /** Main content of the document (supports Markdown) */
  content: string;
  /** Array of tags for categorization and search */
  tags: string[];
  /** Category classification for the document */
  category: string;
  /** ISO timestamp when the document was created */
  createdAt: string;
  /** ISO timestamp when the document was last updated */
  updatedAt: string;
  /** Optional author name */
  author?: string;
  /** Optional brief summary of the document */
  summary?: string;
}

// In-memory document store (in production, this would be a database)
let documents: Document[] = [
  {
    id: 'doc-1',
    title: 'MCP Protocol Overview',
    content: `# Model Context Protocol (MCP)

The Model Context Protocol (MCP) is an open standard for connecting AI assistants to data sources and tools. It provides a standardized way for AI models to securely access and interact with various resources.

## Key Features

- **Standardized Communication**: JSON-RPC 2.0 based protocol
- **Security**: Built-in authentication and authorization
- **Flexibility**: Supports various transport methods
- **Extensibility**: Pluggable architecture for tools and resources

## Architecture

MCP follows a client-server architecture where:
- **Clients** (AI assistants) consume capabilities
- **Servers** provide tools, resources, and prompts
- **Hosts** manage the connection between clients and servers`,
    tags: ['mcp', 'protocol', 'overview'],
    category: 'documentation',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    author: 'MCP Team',
    summary: 'Introduction to the Model Context Protocol and its architecture',
  },
  {
    id: 'doc-2',
    title: 'TypeScript SDK Guide',
    content: `# MCP TypeScript SDK

The official TypeScript SDK for building MCP servers and clients.

## Installation

\`\`\`bash
npm install @modelcontextprotocol/sdk
\`\`\`

## Creating a Server

\`\`\`typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
});

// Register tools, resources, and prompts
server.registerTool('my-tool', /* ... */);
\`\`\`

## Best Practices

- Use proper error handling
- Implement security checks
- Document your tools and resources
- Test with MCP Inspector`,
    tags: ['typescript', 'sdk', 'tutorial'],
    category: 'development',
    createdAt: '2024-01-16T14:30:00Z',
    updatedAt: '2024-01-16T14:30:00Z',
    author: 'SDK Team',
    summary: 'Guide for using the TypeScript SDK to build MCP servers',
  },
  {
    id: 'doc-3',
    title: 'Security Best Practices',
    content: `# MCP Security Best Practices

Security is crucial when building MCP servers and clients.

## Input Validation

Always validate user inputs:
- Use schema validation (Zod recommended)
- Sanitize file paths
- Prevent path traversal attacks

## Authentication

- Implement proper OAuth 2.1 flows
- Use secure token storage
- Rotate credentials regularly

## Authorization

- Implement role-based access control
- Use the principle of least privilege
- Audit access patterns

## Transport Security

- Use HTTPS for HTTP transport
- Validate certificates
- Implement rate limiting`,
    tags: ['security', 'best-practices', 'oauth'],
    category: 'security',
    createdAt: '2024-01-17T09:15:00Z',
    updatedAt: '2024-01-17T09:15:00Z',
    author: 'Security Team',
    summary: 'Essential security practices for MCP implementations',
  },
];

// Setup Fuse.js for search
const searchOptions = {
  keys: ['title', 'content', 'tags', 'category', 'author', 'summary'],
  threshold: 0.3,
  includeScore: true,
};

let fuse = new Fuse(documents, searchOptions);

// Store active progress tokens
const activeProgressTokens = new Map<string | number, boolean>();

// Timeout configurations for elicitation requests
const SIMPLE_ELICITATION_TIMEOUT = 2 * 60 * 1000; // 2 minutes for simple forms
const COMPLEX_ELICITATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes for complex forms
const MAX_ELICITATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes maximum

// Helper function to update search index
function updateSearchIndex() {
  fuse = new Fuse(documents, searchOptions);
}

// Register tools
server.registerTool(
  'search_documents',
  {
    title: 'Search Documents',
    description: 'Search through the knowledge base using keywords',
    inputSchema: {
      query: z.string().describe('Search query'),
      category: z.string().optional().describe('Filter by category'),
      tags: z.array(z.string()).optional().describe('Filter by tags'),
      limit: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async ({ query, category, tags, limit }) => {
    logger.info('Searching documents', { query, category, tags, limit });

    try {
      let searchResults = fuse.search(query);

      // Apply filters
      if (category) {
        searchResults = searchResults.filter(result => 
          result.item.category.toLowerCase() === category.toLowerCase()
        );
      }

      if (tags && tags.length > 0) {
        searchResults = searchResults.filter(result =>
          tags.some(tag => result.item.tags.includes(tag.toLowerCase()))
        );
      }

      const limitedResults = searchResults.slice(0, limit);

      if (limitedResults.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No documents found for query: "${query}"`,
            },
          ],
          metadata: {
            query,
            resultCount: 0,
            filters: { category, tags },
          },
        };
      }

      const resultsText = limitedResults
        .map((result, index) => {
          const doc = result.item;
          const score = ((1 - (result.score || 0)) * 100).toFixed(1);
          return `## ${index + 1}. ${doc.title} (${score}% match)

**Category**: ${doc.category}
**Tags**: ${doc.tags.join(', ')}
**Author**: ${doc.author || 'Unknown'}
**Updated**: ${new Date(doc.updatedAt).toLocaleDateString()}

**Summary**: ${doc.summary || 'No summary available'}

[Document ID: ${doc.id}]`;
        })
        .join('\n\n---\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `# Search Results for "${query}"\n\nFound ${limitedResults.length} documents:\n\n${resultsText}`,
          },
        ],
        metadata: {
          query,
          resultCount: limitedResults.length,
          totalMatches: searchResults.length,
          filters: { category, tags },
        },
      };
    } catch (error) {
      logger.error('Document search failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'get_document',
  {
    title: 'Get Document',
    description: 'Retrieve a specific document by ID',
    inputSchema: {
      documentId: z.string().describe('Document ID to retrieve'),
      format: z.enum(['markdown', 'html', 'text']).default('markdown').describe('Output format'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async ({ documentId, format }) => {
    logger.info('Getting document', { documentId, format });

    try {
      const document = documents.find(doc => doc.id === documentId);

      if (!document) {
        return {
          content: [
            {
              type: 'text',
              text: `Document with ID "${documentId}" not found`,
            },
          ],
          isError: true,
        };
      }

      let content = document.content;

      if (format === 'html') {
        content = await marked(document.content);
      } else if (format === 'text') {
        // Strip markdown formatting for plain text
        content = document.content
          .replace(/#{1,6}\s+/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`{1,3}[^`]*`{1,3}/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      }

      const metadata = `**Title**: ${document.title}
**Category**: ${document.category}
**Tags**: ${document.tags.join(', ')}
**Author**: ${document.author || 'Unknown'}
**Created**: ${new Date(document.createdAt).toLocaleDateString()}
**Updated**: ${new Date(document.updatedAt).toLocaleDateString()}

---

`;

      return {
        content: [
          {
            type: 'text',
            text: metadata + content,
          },
        ],
        metadata: {
          documentId: document.id,
          title: document.title,
          category: document.category,
          tags: document.tags,
          format,
        },
      };
    } catch (error) {
      logger.error('Document retrieval failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Document retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'create_document',
  {
    title: 'Create Document',
    description: 'Create a new document in the knowledge base',
    inputSchema: {
      title: z.string().describe('Document title'),
      content: z.string().describe('Document content (Markdown supported)'),
      category: z.string().describe('Document category'),
      tags: z.array(z.string()).describe('Document tags'),
      author: z.string().optional().describe('Document author'),
      summary: z.string().optional().describe('Brief summary of the document'),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  async ({ title, content, category, tags, author, summary }) => {
    logger.info('Creating document', { title, category, tags });

    try {
      const document: Document = {
        id: `doc-${Date.now()}`,
        title,
        content,
        tags: tags.map(tag => tag.toLowerCase()),
        category: category.toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author,
        summary,
      };

      documents.push(document);
      updateSearchIndex();
      
      // Notify subscribers about new document
      if (notifyResourceSubscribers) {
        await notifyResourceSubscribers('knowledge://documents/recent', 'updated');
        await notifyResourceSubscribers('knowledge://stats/overview', 'updated');
        await notifyResourceSubscribers('knowledge://collections/list', 'updated');
      }

      return {
        content: [
          {
            type: 'text',
            text: `# Document Created Successfully

**ID**: ${document.id}
**Title**: ${document.title}
**Category**: ${document.category}
**Tags**: ${document.tags.join(', ')}

The document has been added to the knowledge base and is now searchable.`,
          },
        ],
        metadata: {
          documentId: document.id,
          title: document.title,
          category: document.category,
          tags: document.tags,
        },
      };
    } catch (error) {
      logger.error('Document creation failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Document creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'list_categories',
  {
    title: 'List Categories',
    description: 'List all document categories with counts',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async () => {
    logger.info('Listing categories');

    try {
      const categoryCount = documents.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const categories = Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)
        .map(([category, count]) => `- **${category}**: ${count} documents`)
        .join('\n');

      const allTags = [...new Set(documents.flatMap(doc => doc.tags))].sort();
      const tagsText = allTags.map(tag => `\`${tag}\``).join(', ');

      return {
        content: [
          {
            type: 'text',
            text: `# Knowledge Base Overview

## Categories
${categories}

## Available Tags
${tagsText}

## Total Documents
${documents.length} documents in the knowledge base`,
          },
        ],
        metadata: {
          totalDocuments: documents.length,
          categories: categoryCount,
          totalTags: allTags.length,
        },
      };
    } catch (error) {
      logger.error('Category listing failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Category listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register a tool that demonstrates progress notifications
server.registerTool(
  'bulk_knowledge_processing',
  {
    title: 'Bulk Knowledge Processing',
    description: 'Process multiple documents or perform bulk operations on the knowledge base with progress reporting using MCP progress notifications',
    inputSchema: {
      operation: z.enum(['analyze', 'enhance', 'categorize', 'validate']).describe('Type of bulk processing operation'),
      targetScope: z.enum(['all', 'category', 'tag', 'recent']).describe('Scope of documents to process'),
      scopeValue: z.string().optional().describe('Value for scoped operations (category name, tag name, or number of recent docs)'),
      batchSize: z.number().min(1).max(50).default(5).describe('Number of documents to process per batch'),
      includeValidation: z.boolean().default(true).describe('Include validation and quality checks'),
      enhancementLevel: z.enum(['basic', 'detailed', 'comprehensive']).default('basic').describe('Level of enhancement processing'),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  async ({ operation, targetScope, scopeValue, batchSize, includeValidation, enhancementLevel }, extra) => {
    // Check if progress token is provided in request metadata
    const progressToken = extra?._meta?.progressToken;
    
    if (progressToken) {
      activeProgressTokens.set(progressToken, true);
    }

    // Helper function to send progress notifications
    const sendProgress = async (progress: number, total: number, message: string) => {
      if (progressToken && activeProgressTokens.has(progressToken)) {
        await baseServer.notification({
          method: 'notifications/progress',
          params: { progressToken, progress, total, message }
        });
      }
    };

    try {
      logger.info('Starting bulk knowledge processing', { operation, targetScope, scopeValue, batchSize });

      // Determine target documents
      let targetDocuments = documents;
      
      if (targetScope === 'category' && scopeValue) {
        targetDocuments = documents.filter(doc => doc.category.toLowerCase() === scopeValue.toLowerCase());
      } else if (targetScope === 'tag' && scopeValue) {
        targetDocuments = documents.filter(doc => doc.tags.includes(scopeValue.toLowerCase()));
      } else if (targetScope === 'recent' && scopeValue) {
        const count = parseInt(scopeValue, 10) || 10;
        targetDocuments = documents
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, count);
      }

      if (targetDocuments.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No documents found for ${targetScope}${scopeValue ? ` "${scopeValue}"` : ''}`,
            },
          ],
          isError: true,
        };
      }

      const totalDocuments = targetDocuments.length;
      const totalBatches = Math.ceil(totalDocuments / batchSize);
      
      await sendProgress(0, totalDocuments, `Starting ${operation} operation on ${totalDocuments} documents`);

      let processedCount = 0;
      const results: any[] = [];
      const errors: string[] = [];

      // Process documents in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, totalDocuments);
        const batch = targetDocuments.slice(batchStart, batchEnd);
        
        await sendProgress(
          processedCount, 
          totalDocuments, 
          `Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} documents)`
        );

        // Simulate processing time for each document
        for (const doc of batch) {
          if (progressToken && !activeProgressTokens.has(progressToken)) {
            // Progress tracking was cancelled
            break;
          }

          try {
            // Simulate different processing operations
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time

            let operationResult: any = {};

            switch (operation) {
              case 'analyze':
                operationResult = {
                  id: doc.id,
                  title: doc.title,
                  wordCount: doc.content.split(' ').length,
                  readingTime: Math.ceil(doc.content.split(' ').length / 200),
                  complexityScore: Math.min(100, doc.content.length / 50),
                  tagRelevance: doc.tags.length > 0 ? 'good' : 'needs_tags',
                  hasSummary: !!doc.summary,
                  lastUpdated: doc.updatedAt,
                };
                break;

              case 'enhance':
                const suggestions = [];
                if (!doc.summary) suggestions.push('Add summary');
                if (doc.tags.length < 3) suggestions.push('Add more tags');
                if (!doc.author) suggestions.push('Add author information');
                if (doc.content.length < 500) suggestions.push('Expand content');
                
                operationResult = {
                  id: doc.id,
                  title: doc.title,
                  enhancementLevel,
                  suggestions,
                  qualityScore: Math.round((
                    (doc.summary ? 25 : 0) +
                    (doc.tags.length >= 3 ? 25 : doc.tags.length * 8) +
                    (doc.author ? 25 : 0) +
                    (doc.content.length >= 500 ? 25 : Math.min(25, doc.content.length / 20))
                  )),
                };
                break;

              case 'categorize':
                const predictedCategory = doc.content.toLowerCase().includes('api') ? 'api' :
                                        doc.content.toLowerCase().includes('tutorial') ? 'tutorial' :
                                        doc.content.toLowerCase().includes('guide') ? 'guide' :
                                        doc.category;
                
                operationResult = {
                  id: doc.id,
                  title: doc.title,
                  currentCategory: doc.category,
                  predictedCategory,
                  confidence: predictedCategory === doc.category ? 'high' : 'medium',
                  suggestedTags: extractSuggestedTags(doc.content),
                };
                break;

              case 'validate':
                const validationIssues = [];
                if (!doc.title || doc.title.length < 5) validationIssues.push('Title too short');
                if (!doc.content || doc.content.length < 100) validationIssues.push('Content too short');
                if (doc.tags.length === 0) validationIssues.push('No tags assigned');
                if (!doc.category) validationIssues.push('No category assigned');
                
                operationResult = {
                  id: doc.id,
                  title: doc.title,
                  isValid: validationIssues.length === 0,
                  issues: validationIssues,
                  lastUpdated: doc.updatedAt,
                  needsAttention: validationIssues.length > 2,
                };
                break;
            }

            if (includeValidation) {
              operationResult.validation = {
                hasTitle: !!doc.title,
                hasContent: doc.content.length > 0,
                hasTags: doc.tags.length > 0,
                hasCategory: !!doc.category,
                isRecent: new Date(doc.updatedAt).getTime() > Date.now() - (30 * 24 * 60 * 60 * 1000),
              };
            }

            results.push(operationResult);
            processedCount++;

            await sendProgress(
              processedCount, 
              totalDocuments, 
              `Processed "${doc.title}" (${processedCount}/${totalDocuments})`
            );

          } catch (error) {
            const errorMessage = `Error processing document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMessage);
            logger.error('Document processing error', { docId: doc.id, error });
          }
        }

        // Brief pause between batches
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Final progress update
      await sendProgress(
        totalDocuments, 
        totalDocuments, 
        `Completed ${operation} operation: ${processedCount} documents processed successfully`
      );

      // Generate summary report
      const summary = generateProcessingSummary(operation, results, errors, {
        totalProcessed: processedCount,
        totalDocuments,
        batchSize,
        enhancementLevel,
        includeValidation,
      });

      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
        metadata: {
          operation,
          targetScope,
          scopeValue,
          totalDocuments,
          processedCount,
          batchSize,
          errorCount: errors.length,
          enhancementLevel,
          includeValidation,
          operationResults: results,
        },
      };

    } catch (error) {
      logger.error('Bulk knowledge processing failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Bulk knowledge processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    } finally {
      // Clean up progress token
      if (progressToken) {
        activeProgressTokens.delete(progressToken);
      }
    }
  }
);

// Helper function to extract suggested tags from content
function extractSuggestedTags(content: string): string[] {
  const commonTechTerms = [
    'api', 'sdk', 'framework', 'library', 'database', 'server', 'client',
    'authentication', 'authorization', 'security', 'testing', 'deployment',
    'docker', 'kubernetes', 'microservices', 'rest', 'graphql', 'json',
    'typescript', 'javascript', 'python', 'react', 'node', 'express'
  ];
  
  const lowerContent = content.toLowerCase();
  return commonTechTerms.filter(term => lowerContent.includes(term)).slice(0, 5);
}

// Helper function to generate processing summary
function generateProcessingSummary(
  operation: string, 
  results: any[], 
  errors: string[], 
  metadata: any
): string {
  let summary = `# Bulk Knowledge Processing Report\n\n`;
  summary += `**Operation**: ${operation}\n`;
  summary += `**Documents Processed**: ${metadata.processedCount}/${metadata.totalDocuments}\n`;
  summary += `**Batch Size**: ${metadata.batchSize}\n`;
  summary += `**Status**: ${errors.length === 0 ? '✅ Completed Successfully' : `⚠️ Completed with ${errors.length} errors`}\n\n`;

  // Operation-specific summary
  switch (operation) {
    case 'analyze':
      const avgWordCount = results.reduce((sum, r) => sum + (r.wordCount || 0), 0) / results.length;
      const avgComplexity = results.reduce((sum, r) => sum + (r.complexityScore || 0), 0) / results.length;
      const needTagsDocs = results.filter(r => r.tagRelevance === 'needs_tags').length;
      
      summary += `## Analysis Results\n\n`;
      summary += `- **Average Word Count**: ${Math.round(avgWordCount)} words\n`;
      summary += `- **Average Complexity Score**: ${Math.round(avgComplexity)}/100\n`;
      summary += `- **Documents Needing Tags**: ${needTagsDocs}/${results.length}\n`;
      summary += `- **Documents with Summaries**: ${results.filter(r => r.hasSummary).length}/${results.length}\n\n`;
      break;

    case 'enhance':
      const avgQuality = results.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / results.length;
      const mostCommonSuggestion = getMostCommonSuggestion(results);
      
      summary += `## Enhancement Results\n\n`;
      summary += `- **Average Quality Score**: ${Math.round(avgQuality)}/100\n`;
      summary += `- **Enhancement Level**: ${metadata.enhancementLevel}\n`;
      summary += `- **Most Common Suggestion**: ${mostCommonSuggestion}\n`;
      summary += `- **Documents Needing Enhancement**: ${results.filter(r => r.suggestions.length > 0).length}/${results.length}\n\n`;
      break;

    case 'categorize':
      const correctCategories = results.filter(r => r.currentCategory === r.predictedCategory).length;
      const highConfidence = results.filter(r => r.confidence === 'high').length;
      
      summary += `## Categorization Results\n\n`;
      summary += `- **Correctly Categorized**: ${correctCategories}/${results.length}\n`;
      summary += `- **High Confidence Predictions**: ${highConfidence}/${results.length}\n`;
      summary += `- **Suggested Recategorizations**: ${results.filter(r => r.currentCategory !== r.predictedCategory).length}\n\n`;
      break;

    case 'validate':
      const validDocuments = results.filter(r => r.isValid).length;
      const needsAttention = results.filter(r => r.needsAttention).length;
      
      summary += `## Validation Results\n\n`;
      summary += `- **Valid Documents**: ${validDocuments}/${results.length}\n`;
      summary += `- **Documents Needing Attention**: ${needsAttention}/${results.length}\n`;
      summary += `- **Total Issues Found**: ${results.reduce((sum, r) => sum + (r.issues?.length || 0), 0)}\n\n`;
      break;
  }

  // Top issues or recommendations
  summary += `## Key Findings\n\n`;
  
  if (results.length > 0) {
    if (operation === 'validate') {
      const allIssues = results.flatMap(r => r.issues || []);
      const issueCounts = allIssues.reduce((acc: Record<string, number>, issue: string) => {
        acc[issue] = (acc[issue] || 0) + 1;
        return acc;
      }, {});
      
      const topIssues = Object.entries(issueCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);
      
      if (topIssues.length > 0) {
        summary += `**Most Common Issues:**\n`;
        topIssues.forEach(([issue, count]) => {
          summary += `- ${issue}: ${count} documents\n`;
        });
      }
    } else if (operation === 'enhance') {
      const allSuggestions = results.flatMap(r => r.suggestions || []);
      const suggestionCounts = allSuggestions.reduce((acc: Record<string, number>, suggestion: string) => {
        acc[suggestion] = (acc[suggestion] || 0) + 1;
        return acc;
      }, {});
      
      const topSuggestions = Object.entries(suggestionCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);
      
      if (topSuggestions.length > 0) {
        summary += `**Top Enhancement Suggestions:**\n`;
        topSuggestions.forEach(([suggestion, count]) => {
          summary += `- ${suggestion}: ${count} documents\n`;
        });
      }
    }
  }

  if (metadata.includeValidation) {
    summary += `\n## Validation Summary\n\n`;
    summary += `- Documents with validation data included\n`;
    summary += `- All processed documents checked for completeness\n`;
  }

  if (errors.length > 0) {
    summary += `\n## Errors Encountered\n\n`;
    errors.slice(0, 5).forEach(error => {
      summary += `- ${error}\n`;
    });
    if (errors.length > 5) {
      summary += `... and ${errors.length - 5} more errors\n`;
    }
  }

  summary += `\n---\n\n*Processing completed at ${new Date().toLocaleString()}*`;

  return summary;
}

// Helper to find most common suggestion
function getMostCommonSuggestion(results: any[]): string {
  const allSuggestions = results.flatMap(r => r.suggestions || []);
  if (allSuggestions.length === 0) return 'None';
  
  const counts = allSuggestions.reduce((acc: Record<string, number>, suggestion: string) => {
    acc[suggestion] = (acc[suggestion] || 0) + 1;
    return acc;
  }, {});
  
  const mostCommon = Object.entries(counts).sort(([, a], [, b]) => (b as number) - (a as number))[0];
  return mostCommon ? mostCommon[0] : 'None';
}

// Simple elicitation test tool
server.registerTool(
  'test_elicitation',
  {
    title: 'Test Elicitation',
    description: 'Simple tool to test elicitation functionality with quick response time',
    inputSchema: {
      testType: z.enum(['simple', 'complex']).default('simple').describe('Type of elicitation test to run'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async ({ testType }) => {
    logger.info('Testing elicitation', { testType });

    try {
      if (testType === 'simple') {
        // Simple elicitation with just a few fields
        const userInput = await baseServer.elicitInput({
          message: `Quick Elicitation Test\n\nPlease fill in these simple fields:`,
          requestedSchema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: {
              name: {
                type: 'string',
                title: 'Your Name',
                description: 'Enter your name'
              },
              favoriteColor: {
                type: 'string',
                enum: ['red', 'blue', 'green', 'yellow'],
                title: 'Favorite Color',
                description: 'Pick your favorite color'
              },
              isTestSuccessful: {
                type: 'boolean',
                title: 'Test Successful?',
                description: 'Do you think this elicitation test worked?',
                default: true
              }
            },
            required: ['name', 'favoriteColor']
          }
        }, {
          timeout: SIMPLE_ELICITATION_TIMEOUT,
          resetTimeoutOnProgress: true,
          maxTotalTimeout: MAX_ELICITATION_TIMEOUT
        });

        if (userInput.action !== 'accept') {
          return {
            content: [
              {
                type: 'text',
                text: `Elicitation test was ${userInput.action}ed by user.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `# Elicitation Test Results\n\n✅ **Success!** Elicitation worked correctly.\n\n**Your Input:**\n- **Name:** ${userInput.content.name}\n- **Favorite Color:** ${userInput.content.favoriteColor}\n- **Test Successful:** ${userInput.content.isTestSuccessful ? 'Yes' : 'No'}\n\n*This demonstrates that MCP elicitation is working properly in your setup.*`,
            },
          ],
          metadata: {
            testType: 'simple',
            userResponse: userInput.content,
            elicitationAction: userInput.action,
          },
        };

      } else {
        // Complex elicitation test
        const userInput = await baseServer.elicitInput({
          message: `Complex Elicitation Test\n\nThis tests more field types and validation:`,
          requestedSchema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                title: 'Project Name',
                description: 'Name of the project you are testing'
              },
              experienceLevel: {
                type: 'string',
                enum: ['beginner', 'intermediate', 'advanced', 'expert'],
                enumNames: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
                title: 'Experience Level',
                description: 'Your experience level with MCP'
              },
              features: {
                type: 'string',
                title: 'Features Tested',
                description: 'Comma-separated list of features you have tested'
              },
              rating: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                title: 'Rating (1-10)',
                description: 'Rate your experience testing MCP'
              },
              includeDetails: {
                type: 'boolean',
                title: 'Include Detailed Report',
                description: 'Generate a detailed test report',
                default: false
              }
            },
            required: ['projectName', 'experienceLevel', 'rating']
          }
        }, {
          timeout: COMPLEX_ELICITATION_TIMEOUT,
          resetTimeoutOnProgress: true,
          maxTotalTimeout: MAX_ELICITATION_TIMEOUT
        });

        if (userInput.action !== 'accept') {
          return {
            content: [
              {
                type: 'text',
                text: `Complex elicitation test was ${userInput.action}ed by user.`,
              },
            ],
          };
        }

        const content = userInput.content;
        const report = `# Complex Elicitation Test Results\n\n✅ **Advanced Test Successful!**\n\n## Your Responses:\n- **Project Name:** ${content.projectName}\n- **Experience Level:** ${content.experienceLevel}\n- **Features Tested:** ${content.features || 'Not specified'}\n- **Rating:** ${content.rating}/10\n- **Include Details:** ${content.includeDetails ? 'Yes' : 'No'}\n\n## Analysis:\n${content.rating >= 8 ? '🎉 Excellent rating! MCP is working well for you.' : content.rating >= 6 ? '👍 Good rating! MCP is mostly working as expected.' : '🔧 Lower rating suggests there might be areas for improvement.'}\n\n${content.includeDetails ? '## Detailed Report:\nElicitation successfully handled complex schema with:\n- String inputs with validation\n- Enum dropdowns with custom names\n- Number inputs with min/max constraints\n- Boolean checkboxes with defaults\n- Required vs optional field handling' : ''}`;

        return {
          content: [
            {
              type: 'text',
              text: report,
            },
          ],
          metadata: {
            testType: 'complex',
            userResponse: content,
            elicitationAction: userInput.action,
            testScore: content.rating,
          },
        };
      }

    } catch (error) {
      logger.error('Elicitation test failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Elicitation test failed:** ${error instanceof Error ? error.message : 'Unknown error'}\n\nThis might indicate:\n- Client doesn't support elicitation\n- Request timed out\n- Connection issues\n\nTry testing with a different MCP client or check connection stability.`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'interactive_knowledge_curator',
  {
    title: 'Interactive Knowledge Curator',
    description: 'Interactive tool for creating and organizing knowledge base content with guided metadata collection',
    inputSchema: {
      mode: z.enum(['create', 'organize', 'analyze']).describe('Operation mode: create new content, organize existing, or analyze knowledge gaps'),
      initialTopic: z.string().optional().describe('Initial topic or content to work with'),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  async ({ mode, initialTopic }) => {
    logger.info('Starting interactive knowledge curation', { mode, initialTopic });

    try {
      if (mode === 'create') {
        // Get document creation preferences from the user
        const creationPrefs = await baseServer.elicitInput({
          message: `Creating new knowledge base content${initialTopic ? ` for topic: ${initialTopic}` : ''}\n\nPlease provide the document details:`,
          requestedSchema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: {
              title: {
                type: 'string',
                title: 'Document Title',
                description: 'Clear, descriptive title for the document'
              },
              contentType: {
                type: 'string',
                enum: ['tutorial', 'reference', 'guide', 'faq', 'specification', 'best-practices'],
                enumNames: ['Tutorial/How-to', 'Reference Documentation', 'User Guide', 'FAQ', 'Technical Specification', 'Best Practices'],
                title: 'Content Type',
                description: 'Type of content being created'
              },
              targetAudience: {
                type: 'string',
                enum: ['beginner', 'intermediate', 'advanced', 'expert'],
                enumNames: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
                title: 'Target Audience',
                description: 'Intended audience level for this content'
              },
              category: {
                type: 'string',
                title: 'Category',
                description: 'Main category for organization (e.g., development, security, documentation)'
              },
              tags: {
                type: 'string',
                title: 'Tags',
                description: 'Comma-separated tags for better searchability'
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical'],
                enumNames: ['Low', 'Medium', 'High', 'Critical'],
                title: 'Priority Level',
                description: 'How important is this content for users'
              },
              includeExamples: {
                type: 'boolean',
                title: 'Include Code Examples',
                description: 'Should the document include practical code examples',
                default: true
              }
            },
            required: ['title', 'contentType', 'targetAudience', 'category', 'priority']
          }
        }, {
          timeout: COMPLEX_ELICITATION_TIMEOUT,
          resetTimeoutOnProgress: true,
          maxTotalTimeout: MAX_ELICITATION_TIMEOUT
        });

        if (creationPrefs.action !== 'accept') {
          return {
            content: [
              {
                type: 'text',
                text: `Document creation ${creationPrefs.action}ed by user.`,
              },
            ],
          };
        }

        const prefs = creationPrefs.content;
        
        // Generate content template based on preferences
        let contentTemplate = `# ${prefs.title}\n\n`;
        
        // Add metadata section
        contentTemplate += `> **Content Type**: ${prefs.contentType}\n`;
        contentTemplate += `> **Target Audience**: ${prefs.targetAudience}\n`;
        contentTemplate += `> **Priority**: ${prefs.priority}\n\n`;

        // Add structure based on content type
        switch (prefs.contentType) {
          case 'tutorial':
            contentTemplate += `## Overview\n\n[Brief description of what this tutorial covers]\n\n`;
            contentTemplate += `## Prerequisites\n\n- [List any requirements]\n\n`;
            contentTemplate += `## Step-by-Step Guide\n\n### Step 1: [First Step]\n\n[Detailed instructions]\n\n`;
            if (prefs.includeExamples) {
              contentTemplate += `\`\`\`typescript\n// Example code here\n\`\`\`\n\n`;
            }
            contentTemplate += `### Step 2: [Second Step]\n\n[Continue with more steps]\n\n`;
            contentTemplate += `## Troubleshooting\n\n[Common issues and solutions]\n\n`;
            break;
          case 'reference':
            contentTemplate += `## Overview\n\n[Description of the reference material]\n\n`;
            contentTemplate += `## API Reference\n\n### Function/Method Name\n\n**Parameters:**\n- \`param1\` (type): Description\n\n**Returns:** Description\n\n`;
            if (prefs.includeExamples) {
              contentTemplate += `**Example:**\n\`\`\`typescript\n// Usage example\n\`\`\`\n\n`;
            }
            break;
          case 'guide':
            contentTemplate += `## Introduction\n\n[What this guide covers]\n\n`;
            contentTemplate += `## Getting Started\n\n[Basic setup or introduction]\n\n`;
            contentTemplate += `## Key Concepts\n\n### Concept 1\n\n[Explanation]\n\n### Concept 2\n\n[Explanation]\n\n`;
            contentTemplate += `## Best Practices\n\n- [Recommendation 1]\n- [Recommendation 2]\n\n`;
            break;
          case 'faq':
            contentTemplate += `## Frequently Asked Questions\n\n### Q: [Common question]\n\nA: [Detailed answer]\n\n### Q: [Another question]\n\nA: [Answer with explanation]\n\n`;
            break;
          case 'specification':
            contentTemplate += `## Specification Version\n\n**Version:** [Version number]\n**Date:** ${new Date().toISOString().split('T')[0]}\n\n`;
            contentTemplate += `## Abstract\n\n[Brief summary of the specification]\n\n`;
            contentTemplate += `## Requirements\n\n### MUST Requirements\n\n- [Mandatory requirement 1]\n\n### SHOULD Requirements\n\n- [Recommended requirement 1]\n\n`;
            break;
          case 'best-practices':
            contentTemplate += `## Principles\n\n[Core principles that guide these practices]\n\n`;
            contentTemplate += `## Essential Practices\n\n### Practice 1: [Name]\n\n**Why:** [Explanation]\n**How:** [Implementation]\n**Example:**\n`;
            if (prefs.includeExamples) {
              contentTemplate += `\`\`\`typescript\n// Good example\n\`\`\`\n\n`;
            }
            break;
        }

        // Add common sections
        contentTemplate += `## Additional Resources\n\n- [Link 1: Description]\n- [Link 2: Description]\n\n`;
        contentTemplate += `## Related Documentation\n\n- [Related document 1]\n- [Related document 2]\n`;

        // Create the document
        const tags = prefs.tags ? prefs.tags.split(',').map((t: string) => t.trim().toLowerCase()) : [];
        const newDocument: Document = {
          id: `doc-${Date.now()}`,
          title: prefs.title,
          content: contentTemplate,
          tags,
          category: prefs.category.toLowerCase(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: 'Knowledge Curator',
          summary: `${prefs.contentType} for ${prefs.targetAudience} audience - ${prefs.priority} priority`,
        };

        documents.push(newDocument);
        updateSearchIndex();

        return {
          content: [
            {
              type: 'text',
              text: `# Document Created: ${prefs.title}\n\n**Document ID:** ${newDocument.id}\n**Type:** ${prefs.contentType}\n**Audience:** ${prefs.targetAudience}\n**Category:** ${prefs.category}\n**Priority:** ${prefs.priority}\n**Tags:** ${tags.join(', ')}\n\n## Generated Template\n\nA structured template has been created based on your preferences. The document includes:\n\n- Appropriate sections for ${prefs.contentType} content\n- Metadata targeting ${prefs.targetAudience} audience\n${prefs.includeExamples ? '- Placeholders for code examples\n' : ''}- Standard formatting and structure\n\n## Next Steps\n\n1. Use the \`get_document\` tool to review the full template\n2. Edit the content to add your specific information\n3. The document is now searchable in the knowledge base\n\n**Template Preview:**\n\`\`\`markdown\n${contentTemplate.split('\n').slice(0, 10).join('\n')}...\n\`\`\``,
            },
          ],
          metadata: {
            documentId: newDocument.id,
            mode: 'create',
            preferences: prefs,
            templateGenerated: true,
          },
        };

      } else if (mode === 'organize') {
        // Get organization preferences
        const orgPrefs = await baseServer.elicitInput({
          message: `Knowledge Base Organization Tool\n\nHelp organize and improve the knowledge base structure:`,
          requestedSchema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: {
              organizationGoal: {
                type: 'string',
                enum: ['restructure-categories', 'consolidate-duplicates', 'update-tags', 'identify-gaps'],
                enumNames: ['Restructure Categories', 'Consolidate Duplicates', 'Update Tag System', 'Identify Knowledge Gaps'],
                title: 'Organization Goal',
                description: 'What aspect of organization to focus on'
              },
              targetCategory: {
                type: 'string',
                title: 'Target Category',
                description: 'Specific category to focus on (optional - leave blank for all)'
              },
              priorityLevel: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
                enumNames: ['High Priority (critical content)', 'Medium Priority (standard content)', 'Low Priority (nice-to-have)'],
                title: 'Priority Level',
                description: 'Focus on content with this priority level'
              }
            },
            required: ['organizationGoal', 'priorityLevel']
          }
        }, {
          timeout: COMPLEX_ELICITATION_TIMEOUT,
          resetTimeoutOnProgress: true,
          maxTotalTimeout: MAX_ELICITATION_TIMEOUT
        });

        if (orgPrefs.action !== 'accept') {
          return {
            content: [
              {
                type: 'text',
                text: `Knowledge organization ${orgPrefs.action}ed by user.`,
              },
            ],
          };
        }

        const prefs = orgPrefs.content;
        let analysisResults = `# Knowledge Base Organization Report\n\n**Goal:** ${prefs.organizationGoal}\n**Priority Focus:** ${prefs.priorityLevel}\n${prefs.targetCategory ? `**Target Category:** ${prefs.targetCategory}\n` : ''}\n\n`;

        // Perform analysis based on goal
        switch (prefs.organizationGoal) {
          case 'restructure-categories':
            const categoryAnalysis = documents.reduce((acc, doc) => {
              if (!acc[doc.category]) {
                acc[doc.category] = [];
              }
              acc[doc.category]!.push(doc);
              return acc;
            }, {} as Record<string, Document[]>);

            analysisResults += `## Category Analysis\n\n`;
            Object.entries(categoryAnalysis).forEach(([category, docs]) => {
              analysisResults += `### ${category} (${docs.length} documents)\n`;
              analysisResults += `**Recent:** ${docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]?.title || 'N/A'}\n`;
              analysisResults += `**Tags:** ${[...new Set(docs.flatMap(d => d.tags))].join(', ')}\n\n`;
            });
            break;

          case 'identify-gaps':
            const allTags = [...new Set(documents.flatMap(doc => doc.tags))];
            const categories = [...new Set(documents.map(doc => doc.category))];
            
            analysisResults += `## Knowledge Gap Analysis\n\n`;
            analysisResults += `**Current Coverage:**\n`;
            analysisResults += `- ${categories.length} categories\n`;
            analysisResults += `- ${allTags.length} unique tags\n`;
            analysisResults += `- ${documents.length} total documents\n\n`;
            
            analysisResults += `**Potential Gaps:**\n`;
            if (!allTags.includes('troubleshooting')) {
              analysisResults += `- Missing troubleshooting guides\n`;
            }
            if (!allTags.includes('getting-started')) {
              analysisResults += `- Missing beginner-friendly content\n`;
            }
            if (!categories.includes('examples')) {
              analysisResults += `- No dedicated examples category\n`;
            }
            break;
        }

        analysisResults += `\n## Recommendations\n\n`;
        analysisResults += `Based on the analysis, consider these improvements:\n`;
        analysisResults += `1. Review category structure for better organization\n`;
        analysisResults += `2. Standardize tagging conventions\n`;
        analysisResults += `3. Create missing content to fill identified gaps\n`;
        analysisResults += `4. Update older documents with current information\n`;

        return {
          content: [
            {
              type: 'text',
              text: analysisResults,
            },
          ],
          metadata: {
            mode: 'organize',
            goal: prefs.organizationGoal,
            targetCategory: prefs.targetCategory,
            priorityLevel: prefs.priorityLevel,
          },
        };

      } else if (mode === 'analyze') {
        // Knowledge base analysis
        const totalDocs = documents.length;
        const categories = [...new Set(documents.map(doc => doc.category))];
        const allTags = [...new Set(documents.flatMap(doc => doc.tags))];
        
        const recentActivity = documents
          .filter(doc => new Date(doc.updatedAt).getTime() > Date.now() - (30 * 24 * 60 * 60 * 1000))
          .length;

        let analysisReport = `# Knowledge Base Analysis Report\n\n`;
        analysisReport += `**Generated:** ${new Date().toLocaleString()}\n\n`;
        
        analysisReport += `## Overview Statistics\n\n`;
        analysisReport += `- **Total Documents:** ${totalDocs}\n`;
        analysisReport += `- **Categories:** ${categories.length} (${categories.join(', ')})\n`;
        analysisReport += `- **Unique Tags:** ${allTags.length}\n`;
        analysisReport += `- **Recent Activity:** ${recentActivity} documents updated in last 30 days\n\n`;

        analysisReport += `## Content Distribution\n\n`;
        const categoryCount = documents.reduce((acc, doc) => {
          acc[doc.category] = (acc[doc.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        Object.entries(categoryCount)
          .sort(([, a], [, b]) => b - a)
          .forEach(([category, count]) => {
            const percentage = totalDocs > 0 ? ((count / totalDocs) * 100).toFixed(1) : '0.0';
            analysisReport += `- **${category}:** ${count} documents (${percentage}%)\n`;
          });

        analysisReport += `\n## Quality Indicators\n\n`;
        const docsWithSummary = documents.filter(doc => doc.summary).length;
        const docsWithAuthor = documents.filter(doc => doc.author).length;
        const avgTagCount = totalDocs > 0 ? documents.reduce((sum, doc) => sum + doc.tags.length, 0) / totalDocs : 0;

        analysisReport += `- **Documents with summaries:** ${docsWithSummary}/${totalDocs} (${totalDocs > 0 ? ((docsWithSummary/totalDocs)*100).toFixed(1) : '0.0'}%)\n`;
        analysisReport += `- **Documents with authors:** ${docsWithAuthor}/${totalDocs} (${totalDocs > 0 ? ((docsWithAuthor/totalDocs)*100).toFixed(1) : '0.0'}%)\n`;
        analysisReport += `- **Average tags per document:** ${avgTagCount.toFixed(1)}\n\n`;

        analysisReport += `## Recommendations for Improvement\n\n`;
        if (docsWithSummary < totalDocs * 0.8) {
          analysisReport += `- Add summaries to ${totalDocs - docsWithSummary} documents for better searchability\n`;
        }
        if (avgTagCount < 3) {
          analysisReport += `- Improve tagging - consider adding more descriptive tags\n`;
        }
        if (recentActivity < totalDocs * 0.1) {
          analysisReport += `- Content appears stale - review and update older documents\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: analysisReport,
            },
          ],
          metadata: {
            mode: 'analyze',
            totalDocuments: totalDocs,
            categories: categories.length,
            uniqueTags: allTags.length,
            recentActivity,
            qualityScore: Math.round((docsWithSummary + docsWithAuthor) / (totalDocs * 2) * 100),
          },
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Invalid mode: ${mode}. Please use 'create', 'organize', or 'analyze'.`,
          },
        ],
        isError: true,
      };

    } catch (error) {
      logger.error('Interactive knowledge curation failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Knowledge curation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register resources
server.registerResource(
  'knowledge_base_stats',
  'knowledge://stats/overview',
  {
    title: 'Knowledge Base Statistics',
    description: 'Overview statistics of the knowledge base',
  },
  async () => {
    logger.info('Providing knowledge base statistics');

    try {
      const totalDocs = documents.length;
      const categories = [...new Set(documents.map(doc => doc.category))];
      const tags = [...new Set(documents.flatMap(doc => doc.tags))];
      const authors = [...new Set(documents.map(doc => doc.author).filter(Boolean))];
      
      const recentDocs = documents
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

      const categoryBreakdown = documents.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statsContent = `# Knowledge Base Statistics

## Overview
- **Total Documents**: ${totalDocs}
- **Categories**: ${categories.length}
- **Unique Tags**: ${tags.length}
- **Authors**: ${authors.length}

## Category Breakdown
${Object.entries(categoryBreakdown)
  .map(([cat, count]) => `- **${cat}**: ${count} documents`)
  .join('\n')}

## Recent Documents
${recentDocs.map(doc => 
  `- [${doc.title}](knowledge://document/${doc.id}) - ${new Date(doc.updatedAt).toLocaleDateString()}`
).join('\n')}

## Popular Tags
${tags.slice(0, 10).map(tag => `\`${tag}\``).join(', ')}

*Last updated: ${new Date().toLocaleString()}*`;

      return {
        contents: [
          {
            uri: 'knowledge://stats/overview',
            mimeType: 'text/markdown',
            text: statsContent,
          },
        ],
      };
    } catch (error) {
      logger.error('Knowledge base statistics generation failed', error);
      throw new Error(`Failed to generate knowledge base statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// Register resources
server.registerResource(
  'recent_documents',
  'knowledge://documents/recent',
  {
    title: 'Recent Documents',
    description: 'Recently added documents to the knowledge base',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching recent documents');
    
    const recentDocuments = {
      timestamp: new Date().toISOString(),
      totalDocuments: documents.length,
      recentDocuments: documents
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10)
        .map(doc => ({
          id: doc.id,
          title: doc.title,
          summary: doc.summary || doc.content.substring(0, 200) + '...',
          category: doc.category,
          tags: doc.tags,
          author: doc.author,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          wordCount: doc.content.split(' ').length,
          readingTime: Math.ceil(doc.content.split(' ').length / 200) + ' min'
        }))
    };

    return {
      contents: [
        {
          uri: 'knowledge://documents/recent',
          mimeType: 'application/json',
          text: JSON.stringify(recentDocuments, null, 2)
        }
      ]
    };
  }
);

server.registerResource(
  'document_collections',
  'knowledge://collections/list',
  {
    title: 'Document Collections',
    description: 'Organized collections of documents by category and tags',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching document collections');
    
    // Group documents by category
    const categoryCounts = documents.reduce((acc, doc) => {
      acc[doc.category] = (acc[doc.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group documents by tags
    const tagCounts = documents.reduce((acc, doc) => {
      doc.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const collections = {
      timestamp: new Date().toISOString(),
      totalDocuments: documents.length,
      categories: Object.entries(categoryCounts).map(([category, count]) => ({
        name: category,
        count,
        description: getCategoryDescription(category),
        lastUpdated: getLastUpdatedForCategory(category),
        averageReadingTime: getAverageReadingTimeForCategory(category)
      })),
      tags: Object.entries(tagCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([tag, count]) => ({
          name: tag,
          count,
          relatedTags: getRelatedTags(tag),
          trending: isTagTrending(tag)
        })),
      recentCollections: [
        {
          id: 'col-mcp-docs',
          name: 'MCP Documentation',
          description: 'Complete documentation for Model Context Protocol',
          documentCount: documents.filter(d => d.tags.includes('mcp')).length,
          createdAt: '2024-09-01T00:00:00Z',
          updatedAt: '2024-09-27T08:00:00Z',
          tags: ['mcp', 'protocol', 'documentation'],
          isPublic: true
        },
        {
          id: 'col-typescript-guides',
          name: 'TypeScript Guides',
          description: 'Best practices and tutorials for TypeScript development',
          documentCount: documents.filter(d => d.tags.includes('typescript')).length,
          createdAt: '2024-08-15T00:00:00Z',
          updatedAt: '2024-09-20T14:30:00Z',
          tags: ['typescript', 'development', 'tutorial'],
          isPublic: true
        },
        {
          id: 'col-api-references',
          name: 'API References',
          description: 'Technical API documentation and specifications',
          documentCount: documents.filter(d => d.category === 'api').length,
          createdAt: '2024-07-01T00:00:00Z',
          updatedAt: '2024-09-25T16:45:00Z',
          tags: ['api', 'reference', 'specification'],
          isPublic: false
        }
      ]
    };

    return {
      contents: [
        {
          uri: 'knowledge://collections/list',
          mimeType: 'application/json',
          text: JSON.stringify(collections, null, 2)
        }
      ]
    };
  }
);

server.registerResource(
  'search_indices',
  'knowledge://search/indices',
  {
    title: 'Search Indices',
    description: 'Search index status and analytics',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching search indices status');
    
    const searchIndices = {
      timestamp: new Date().toISOString(),
      indices: [
        {
          name: 'full_text_index',
          type: 'inverted_index',
          status: 'healthy',
          documentCount: documents.length,
          indexSize: '24.5 MB',
          lastReindexed: '2024-09-27T02:00:00Z',
          searchLatency: '12ms',
          hitRate: 94.8,
          queryVolume: {
            daily: 2840,
            weekly: 18420,
            monthly: 78450
          }
        },
        {
          name: 'semantic_index',
          type: 'vector_embeddings',
          status: 'healthy',
          documentCount: documents.length,
          indexSize: '156.2 MB',
          lastReindexed: '2024-09-26T18:30:00Z',
          searchLatency: '35ms',
          hitRate: 87.3,
          embeddingModel: 'text-embedding-ada-002',
          dimensions: 1536
        },
        {
          name: 'tag_index',
          type: 'hash_index',
          status: 'healthy',
          documentCount: documents.length,
          indexSize: '2.1 MB',
          lastReindexed: '2024-09-27T06:00:00Z',
          searchLatency: '3ms',
          hitRate: 98.7,
          uniqueTags: Object.keys(documents.reduce((acc, doc) => {
            doc.tags.forEach(tag => acc[tag] = true);
            return acc;
          }, {} as Record<string, boolean>)).length
        }
      ],
      analytics: {
        popularQueries: [
          { query: 'MCP protocol', count: 245, avgLatency: '15ms' },
          { query: 'TypeScript SDK', count: 189, avgLatency: '12ms' },
          { query: 'server implementation', count: 156, avgLatency: '18ms' },
          { query: 'client setup', count: 134, avgLatency: '14ms' },
          { query: 'tools registration', count: 112, avgLatency: '16ms' }
        ],
        searchTrends: {
          totalSearches: 2840,
          uniqueUsers: 156,
          avgQueriesPerUser: 18.2,
          peakHours: ['10:00-11:00', '14:00-15:00', '16:00-17:00'],
          topCategories: ['documentation', 'tutorial', 'reference']
        },
        performance: {
          avgResponseTime: '18ms',
          p95ResponseTime: '45ms',
          p99ResponseTime: '120ms',
          errorRate: 0.08,
          cacheHitRate: 76.4
        }
      },
      maintenance: {
        lastFullReindex: '2024-09-25T20:00:00Z',
        nextScheduledReindex: '2024-10-02T20:00:00Z',
          reindexFrequency: 'weekly',
        optimizationStatus: 'up_to_date',
        diskUsage: '182.8 MB',
        compressionRatio: 3.2
      }
    };

    return {
      contents: [
        {
          uri: 'knowledge://search/indices',
          mimeType: 'application/json',
          text: JSON.stringify(searchIndices, null, 2)
        }
      ]
    };
  }
);

// Helper functions for collections resource
function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    documentation: 'Technical documentation and guides',
    tutorial: 'Step-by-step learning materials',
    reference: 'Quick reference and API documentation',
    api: 'API specifications and endpoints',
    guide: 'How-to guides and best practices'
  };
  return descriptions[category] || 'General knowledge base content';
}

function getLastUpdatedForCategory(category: string): string {
  const categoryDocs = documents.filter(d => d.category === category);
  if (categoryDocs.length === 0) return new Date().toISOString();
  const sorted = categoryDocs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return sorted.length > 0 && sorted[0] ? sorted[0].updatedAt : new Date().toISOString();
}

function getAverageReadingTimeForCategory(category: string): string {
  const categoryDocs = documents.filter(d => d.category === category);
  if (categoryDocs.length === 0) return '0 min';
  const avgWords = categoryDocs.reduce((acc, doc) => acc + doc.content.split(' ').length, 0) / categoryDocs.length;
  return Math.ceil(avgWords / 200) + ' min';
}

function getRelatedTags(tag: string): string[] {
  // Find documents with this tag and get their other tags
  const docsWithTag = documents.filter(d => d.tags.includes(tag));
  const relatedTags = docsWithTag.reduce((acc, doc) => {
    doc.tags.forEach(t => {
      if (t !== tag) acc[t] = (acc[t] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(relatedTags)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([relatedTag]) => relatedTag);
}

function isTagTrending(tag: string): boolean {
  // Simple trending logic based on tag frequency
  const tagDocs = documents.filter(d => d.tags.includes(tag));
  return tagDocs.length > 2; // Tags with more than 2 documents are "trending"
}

// Register prompts
server.registerPrompt(
  'research_assistant',
  {
    title: 'Research Assistant',
    description: 'Help research a topic using the knowledge base',
    argsSchema: {
      topic: z.string().describe('Research topic or question'),
      depth: z.string().optional()
        .describe('Level of research depth (overview, detailed, comprehensive)'),
      focusAreas: z.string().optional()
        .describe('Specific areas to focus on (comma-separated)'),
    },
  },
  async ({ topic, depth, focusAreas }) => {
    logger.info('Generating research assistant prompt', { topic, depth, focusAreas });

    const depthDescriptions: Record<string, string> = {
      overview: 'provide a high-level summary and key points',
      detailed: 'conduct thorough research with examples and context',
      comprehensive: 'perform exhaustive research with multiple perspectives and sources',
    };

    const researchApproach = depthDescriptions[depth || 'detailed'] || depthDescriptions.detailed;
    const focusContext = focusAreas ? 
      `\n\nPay special attention to these areas:\n${focusAreas.split(',').map(area => `- ${area.trim()}`).join('\n')}` : '';

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please help me research the topic: "${topic}"

I'm looking for a ${depth} analysis where you ${researchApproach}.${focusContext}

Please follow this research methodology:

1. **Initial Search**
   - Search the knowledge base for relevant documents
   - Identify key categories and tags related to the topic

2. **Information Gathering**
   - Retrieve and analyze relevant documents
   - Look for patterns, connections, and gaps in information

3. **Synthesis & Analysis**
   - Organize findings by themes or categories
   - Identify key insights and important details
   - Note any conflicting information or different perspectives

4. **Research Summary**
   - Provide a structured summary of findings
   - Highlight the most important points
   - Suggest areas for further research if applicable

Start by searching for documents related to "${topic}" and then build your analysis from there.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'concept_explanation',
  {
    title: 'Concept Explanation Assistant',
    description: 'Generate comprehensive explanations of technical concepts with learning path recommendations',
    argsSchema: {
      concept: z.string().describe('The concept or topic to explain'),
      audienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).describe('Target audience skill level'),
      format: z.enum(['tutorial', 'reference', 'overview', 'deep-dive']).describe('Explanation format'),
      includeExamples: z.string().optional().describe('Include practical examples (true/false)'),
      relatedTopics: z.string().optional().describe('Related topics to connect (comma-separated)'),
    },
  },
  async ({ concept, audienceLevel, format, includeExamples, relatedTopics }) => {
    logger.info('Generating concept explanation prompt', { concept, audienceLevel, format });

    const audienceGuidance = {
      beginner: 'assume no prior knowledge and explain fundamentals clearly',
      intermediate: 'build on basic understanding with practical applications',
      advanced: 'focus on complex scenarios, edge cases, and optimization',
    };

    const formatGuidance = {
      tutorial: 'step-by-step learning approach with hands-on exercises',
      reference: 'comprehensive documentation format with complete coverage',
      overview: 'high-level introduction covering key points and use cases',
      'deep-dive': 'thorough technical analysis with implementation details',
    };

    const relatedContext = relatedTopics ? 
      `\n\nPlease also explain how ${concept} relates to these topics:\n${relatedTopics.split(',').map(topic => `- ${topic.trim()}`).join('\n')}` : '';

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please provide a comprehensive explanation of "${concept}" using a ${format} approach for a ${audienceLevel} audience.

**Target Audience**: ${audienceLevel} - ${audienceGuidance[audienceLevel] || 'intermediate'}
**Format**: ${format} - ${formatGuidance[format] || 'overview'}
**Include Examples**: ${includeExamples !== 'false' ? 'Yes, provide practical examples' : 'No, focus on conceptual explanation'}${relatedContext}

Please structure your explanation to include:

## 1. Concept Introduction
- **Clear Definition**: What is ${concept}?
- **Purpose & Value**: Why is this concept important?
- **Context**: Where and when is this concept used?
- **Prerequisites**: What should readers know before learning this?

## 2. Core Principles & Components
${audienceLevel === 'beginner' ? `
### For Beginners:
- **Fundamental Concepts**: Break down the basic building blocks
- **Simple Analogies**: Use real-world comparisons to explain abstract ideas
- **Visual Descriptions**: Describe how things work conceptually
- **Common Terminology**: Define important terms and jargon` : ''}
${audienceLevel === 'intermediate' ? `
### For Intermediate Learners:
- **Key Components**: Detailed breakdown of main parts and their functions
- **How It Works**: Explain the underlying mechanisms and processes
- **Best Practices**: Recommended approaches and conventions
- **Common Patterns**: Typical usage patterns and implementations` : ''}
${audienceLevel === 'advanced' ? `
### For Advanced Practitioners:
- **Technical Architecture**: Deep dive into implementation details
- **Performance Considerations**: Optimization strategies and trade-offs
- **Edge Cases**: Complex scenarios and potential issues
- **Integration Patterns**: How it fits with other systems and concepts` : ''}

## 3. Practical Application
${includeExamples !== 'false' ? `
### Examples & Demonstrations
- **Basic Example**: Simple, clear demonstration of the concept
- **Real-world Use Case**: Practical application scenario
- **Code Examples**: Working implementations (if applicable)
- **Step-by-step Walkthrough**: Detailed implementation process` : `
### Application Scenarios
- **Use Cases**: When and where to apply this concept
- **Decision Criteria**: How to determine if this concept is appropriate
- **Implementation Considerations**: Key factors when applying the concept`}

## 4. Learning Path & Next Steps
### Immediate Next Steps
- What should learners practice or explore next?
- Which skills or knowledge areas to develop further?
- Recommended exercises or projects

### Progressive Learning Path
${audienceLevel === 'beginner' ? `
- **Foundation Building**: What fundamental skills to develop first
- **Guided Practice**: Structured exercises to reinforce learning
- **Milestone Goals**: Clear objectives for measuring progress` : ''}
${audienceLevel === 'intermediate' ? `
- **Skill Enhancement**: Advanced techniques and patterns to master
- **Project Applications**: Real projects to apply the knowledge
- **Specialization Areas**: Specific domains to explore deeper` : ''}
${audienceLevel === 'advanced' ? `
- **Mastery Topics**: Expert-level concepts and optimizations
- **Research Areas**: Cutting-edge developments and innovations
- **Teaching Opportunities**: Ways to share and refine knowledge` : ''}

## 5. Common Pitfalls & Troubleshooting
- **Frequent Mistakes**: Common errors and misconceptions
- **Warning Signs**: How to identify when something's wrong
- **Debugging Strategies**: Systematic approaches to problem-solving
- **Prevention Tips**: Best practices to avoid common issues

## 6. Additional Resources & References
- **Essential Reading**: Key documentation and authoritative sources
- **Community Resources**: Forums, communities, and support channels
- **Tools & Utilities**: Helpful tools for working with this concept
- **Further Learning**: Advanced topics and specialized areas

Please search the knowledge base first to gather relevant information about ${concept}, then provide a comprehensive explanation following this structure.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'learning_path',
  {
    title: 'Learning Path Designer',
    description: 'Create structured learning paths for mastering topics with progressive skill building',
    argsSchema: {
      subject: z.string().describe('Main subject or skill to learn'),
      currentLevel: z.enum(['complete-beginner', 'some-experience', 'intermediate', 'advanced'])
        .describe('Current skill level'),
      learningGoal: z.enum(['foundational', 'professional', 'expert', 'teaching'])
        .describe('Target learning goal'),
      timeCommitment: z.enum(['casual', 'regular', 'intensive', 'immersive'])
        .describe('Available time commitment'),
      learningStyle: z.enum(['theoretical', 'practical', 'project-based', 'mixed'])
        .describe('Preferred learning approach'),
      deadline: z.string().optional().describe('Target completion timeframe (e.g., 3 months, 1 year)'),
    },
  },
  async ({ subject, currentLevel, learningGoal, timeCommitment, learningStyle, deadline }) => {
    logger.info('Generating learning path prompt', { subject, currentLevel, learningGoal, timeCommitment });

    const levelGuidance = {
      'complete-beginner': 'starting from absolute basics with no prior knowledge',
      'some-experience': 'building on limited exposure and basic understanding',
      'intermediate': 'expanding existing knowledge with deeper concepts',
      'advanced': 'mastering expert-level skills and specialized knowledge',
    };

    const goalGuidance = {
      foundational: 'solid understanding of core concepts and principles',
      professional: 'job-ready skills for professional application',
      expert: 'deep expertise and ability to solve complex problems',
      teaching: 'comprehensive knowledge to teach and mentor others',
    };

    const commitmentGuidance = {
      casual: '1-3 hours per week with flexible pacing',
      regular: '5-10 hours per week with consistent progress',
      intensive: '15-20 hours per week with accelerated learning',
      immersive: '30+ hours per week with full-time dedication',
    };

    const styleGuidance = {
      theoretical: 'conceptual understanding through study and analysis',
      practical: 'hands-on learning through exercises and application',
      'project-based': 'learning through building real projects and solutions',
      mixed: 'balanced approach combining theory, practice, and projects',
    };

    const deadlineContext = deadline ? `\n**Timeline**: ${deadline} target completion` : '';

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please design a comprehensive learning path for mastering "${subject}" with these parameters:

**Current Level**: ${currentLevel} - ${levelGuidance[currentLevel]}
**Learning Goal**: ${learningGoal} - ${goalGuidance[learningGoal]}
**Time Commitment**: ${timeCommitment} - ${commitmentGuidance[timeCommitment]}
**Learning Style**: ${learningStyle} - ${styleGuidance[learningStyle]}${deadlineContext}

Please create a structured learning path that includes:

## 1. Learning Path Overview

### Prerequisites Assessment
- What foundational knowledge is needed?
- Skills or concepts to review before starting
- Recommended preparation activities

### Learning Objectives
Based on ${learningGoal} goal:
- **Core Competencies**: Essential skills to develop
- **Key Milestones**: Major learning achievements
- **Success Metrics**: How to measure progress and completion

### Timeline & Pacing
For ${timeCommitment} commitment${deadline ? ` with ${deadline} target` : ''}:
- **Overall Duration**: Estimated time to completion
- **Phase Breakdown**: Major learning phases with timeframes
- **Weekly Schedule**: Recommended study schedule and time allocation

## 2. Structured Learning Phases

### Phase 1: Foundation Building
**Duration**: [Estimated time]
**Focus**: Core concepts and fundamental understanding

${currentLevel === 'complete-beginner' ? `
**Starting from Basics:**
- Essential vocabulary and terminology
- Fundamental concepts and principles
- Basic tools and environment setup
- Simple exercises to build confidence` : `
**Building on Experience:**
- Review and solidify existing knowledge
- Fill knowledge gaps and misconceptions
- Standardize understanding of core concepts
- Establish strong foundation for advanced topics`}

**Learning Activities**:
${learningStyle === 'theoretical' ? `
- Read foundational texts and documentation
- Study concept explanations and theoretical frameworks
- Complete conceptual exercises and quizzes
- Analyze case studies and examples` : ''}
${learningStyle === 'practical' ? `
- Complete hands-on exercises and tutorials
- Practice with guided examples and solutions
- Build simple projects with clear instructions
- Experiment with tools and basic implementations` : ''}
${learningStyle === 'project-based' ? `
- Start with a simple foundational project
- Break down project into learning milestones
- Build incrementally while learning concepts
- Document learning through project development` : ''}
${learningStyle === 'mixed' ? `
- Combine reading with practical exercises
- Alternate between theory and hands-on practice
- Use projects to apply theoretical knowledge
- Balance study with experimentation` : ''}

### Phase 2: Skill Development
**Duration**: [Estimated time]
**Focus**: Practical application and skill building

**Core Skills Development:**
- Intermediate concepts and techniques
- Problem-solving methodologies
- Tool proficiency and workflow optimization
- Real-world application scenarios

**Learning Activities**:
- Progressive complexity exercises
- Challenging projects with guided support
- Peer collaboration and code/work review
- Performance optimization and best practices

### Phase 3: Advanced Mastery
**Duration**: [Estimated time]
**Focus**: Expert-level skills and specialization

${learningGoal === 'foundational' ? `
**Completing Foundation:**
- Comprehensive understanding of all core concepts
- Ability to apply knowledge to various scenarios
- Confidence in fundamental skills and principles` : ''}
${learningGoal === 'professional' ? `
**Professional Readiness:**
- Industry-standard practices and workflows
- Complex problem-solving capabilities
- Portfolio development and professional presentation
- Interview preparation and skill demonstration` : ''}
${learningGoal === 'expert' ? `
**Expert-Level Mastery:**
- Advanced optimization and architecture patterns
- Complex system design and implementation
- Innovation and custom solution development
- Mentoring and knowledge sharing capabilities` : ''}
${learningGoal === 'teaching' ? `
**Teaching Preparation:**
- Deep conceptual understanding for explanation
- Curriculum design and learning objective creation
- Common misconception identification and correction
- Effective communication and demonstration techniques` : ''}

## 3. Learning Resources & Materials

### Primary Resources
- Essential books, documentation, and authoritative sources
- Core tools and platforms for hands-on practice
- Key online courses or tutorials
- Community resources and support channels

### Supplementary Materials
- Additional reading for deeper understanding
- Practice platforms and coding challenges
- Video tutorials and demonstrations
- Blogs, articles, and industry insights

### Practice Opportunities
- Structured exercises and progressively challenging problems
- Open-source projects for contribution
- Community challenges and competitions
- Real-world project ideas and specifications

## 4. Assessment & Progress Tracking

### Milestone Checkpoints
- Regular progress assessments at phase completion
- Self-evaluation criteria and competency checklists
- Practical demonstrations of learned skills
- Portfolio projects showcasing capabilities

### Continuous Learning Strategies
- Daily/weekly practice routines
- Progress journaling and reflection
- Peer learning and mentorship opportunities
- Regular skill application and experimentation

## 5. Troubleshooting & Support

### Common Challenges
- Typical learning obstacles and how to overcome them
- Motivation maintenance strategies
- Time management and consistency tips
- Dealing with complexity and information overload

### Support Systems
- Where to get help when stuck
- Community resources and mentorship
- Alternative learning approaches for different concepts
- Adaptation strategies for different learning preferences

## 6. Next Steps & Continued Growth

### Beyond This Learning Path
- Advanced specialization areas to explore
- Professional development opportunities
- Contribution and teaching opportunities
- Staying current with field developments

Please search the knowledge base for relevant information about "${subject}" and create a detailed, actionable learning path following this structure.`,
          },
        },
      ],
    };
  }
);

  // Note: Resource subscriptions in MCP are handled automatically by the SDK
  // When a client subscribes to resources, they will receive notifications
  // via the notifications/resources/list_changed method when resources change.
  // The subscription management is handled internally by the MCP protocol.
  
  // Function to notify subscribers when a resource changes
  notifyResourceSubscribers = async function(uri: string, changeType: 'created' | 'updated' | 'deleted') {
    logger.info('Notifying resource subscribers', { uri, changeType });
    
    // Send resource change notification
    // This will notify any clients that have subscribed to resource updates
    await baseServer.notification({
      method: 'notifications/resources/list_changed',
      params: {}
    });
  }
  
  // Simulate resource updates for demonstration
  // In production, this would be triggered by actual document changes
  let updateInterval: NodeJS.Timeout | null = null;
  
  // Start simulating resource updates every 30 seconds
  function startResourceUpdateSimulation() {
    updateInterval = setInterval(async () => {
      // Randomly update document statistics
      const shouldUpdate = Math.random() > 0.7; // 30% chance of update
      
      if (shouldUpdate) {
        // Simulate a document being added or updated
        const resources = [
          'knowledge://stats/overview',
          'knowledge://documents/recent',
          'knowledge://collections/list'
        ];
        
        const randomResource = resources[Math.floor(Math.random() * resources.length)];
        if (randomResource && notifyResourceSubscribers) {
          await notifyResourceSubscribers(randomResource, 'updated');
        }
        
        logger.info('Simulated resource update', { resource: randomResource });
      }
    }, 30000); // Every 30 seconds
  }
  
  // Start simulation when server starts
  startResourceUpdateSimulation();
  
  // Clean up on server shutdown
  process.on('beforeExit', () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
  
  // Handle sampling requests
  // Note: The MCP SDK may handle sampling differently or automatically
  // This is a placeholder for when sampling support is properly documented
  // For now, sampling capability is enabled but the handler implementation
  // would depend on the SDK's actual sampling interface
  
  // Example sampling implementation (when SDK support is available):
  /*
  server.on('sampling/createMessage', async (request) => {
    logger.info('Sampling request received', { request });
    
    try {
      // Extract context from the messages
      const lastMessage = request.messages[request.messages.length - 1];
      const userQuery = lastMessage.content.type === 'text' ? lastMessage.content.text : '';
      
      // Search for relevant documents using Fuse.js
      const searchResults = fuse.search(userQuery).slice(0, 5);
      
      // Build context from search results
      let context = 'Based on the knowledge base:\n\n';
      searchResults.forEach((result, index) => {
        const doc = result.item;
        context += `${index + 1}. ${doc.title}\n`;
        context += `   ${doc.summary || doc.content.substring(0, 200)}...\n\n`;
      });
      
      // Generate a response based on the query and context
      let responseText = '';
      
      if (userQuery.toLowerCase().includes('summary') || userQuery.toLowerCase().includes('summarize')) {
        responseText = `Here's a summary of relevant information from the knowledge base:\n\n${context}`;
      } else if (userQuery.toLowerCase().includes('explain')) {
        responseText = `I'll explain based on the available documentation:\n\n${context}\n\nThe key points are:\n`;
        searchResults.slice(0, 3).forEach(result => {
          const doc = result.item;
          if (doc.summary) {
            responseText += `- ${doc.summary}\n`;
          }
        });
      } else {
        // Default response format
        responseText = `Based on your query "${userQuery}", here's what I found:\n\n${context}`;
      }
      
      return {
        role: 'assistant',
        content: {
          type: 'text',
          text: responseText
        }
      };
    } catch (error) {
      logger.error('Sampling request failed', error);
      
      return {
        role: 'assistant',
        content: {
          type: 'text',
          text: `I apologize, but I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  });
  */

  /**
   * Register completion handler for tool arguments
   * 
   * NOTE: Commented out temporarily as custom request handlers require proper
   * schema definitions. In production, you would define a proper Zod schema
   * for the completion request.
   */
  /*
  (baseServer as any).setRequestHandler(
    'completion/complete',
    async (request: any) => {
      const { ref } = request.params;
      logger.info('Handling completion request', { ref });

      // Handle tool argument completions
      if (ref.type === 'ref/tool') {
        const toolName = ref.name;
        const argumentName = request.params.argument?.name;
        
        logger.info(`Providing completion for tool: ${toolName}, argument: ${argumentName}`);

        switch (toolName) {
          case 'search_documents':
            if (argumentName === 'category') {
              return {
                completion: {
                  values: [
                    { value: 'api', description: 'API documentation' },
                    { value: 'best-practices', description: 'Best practices' },
                    { value: 'tutorial', description: 'Tutorials' },
                    { value: 'troubleshooting', description: 'Troubleshooting guides' },
                    { value: 'reference', description: 'Reference materials' },
                  ],
                  hasMore: false,
                },
              };
            } else if (argumentName === 'sortBy') {
              return {
                completion: {
                  values: [
                    { value: 'relevance', description: 'Sort by relevance' },
                    { value: 'date', description: 'Sort by date' },
                    { value: 'title', description: 'Sort by title' },
                    { value: 'views', description: 'Sort by view count' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;

          case 'create_document':
            if (argumentName === 'category') {
              return {
                completion: {
                  values: [
                    { value: 'api', description: 'API documentation' },
                    { value: 'best-practices', description: 'Best practices' },
                    { value: 'tutorial', description: 'Tutorials' },
                    { value: 'troubleshooting', description: 'Troubleshooting guides' },
                    { value: 'reference', description: 'Reference materials' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;

          case 'bulk_knowledge_processing':
            if (argumentName === 'operation') {
              return {
                completion: {
                  values: [
                    { value: 'import', description: 'Import documents from files' },
                    { value: 'export', description: 'Export documents to files' },
                    { value: 'update-metadata', description: 'Update document metadata' },
                    { value: 'categorize', description: 'Auto-categorize documents' },
                    { value: 'validate', description: 'Validate document structure' },
                  ],
                  hasMore: false,
                },
              };
            } else if (argumentName === 'format') {
              return {
                completion: {
                  values: [
                    { value: 'json', description: 'JSON format' },
                    { value: 'markdown', description: 'Markdown format' },
                    { value: 'yaml', description: 'YAML format' },
                    { value: 'csv', description: 'CSV format' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;

          case 'interactive_knowledge_curator':
            if (argumentName === 'mode') {
              return {
                completion: {
                  values: [
                    { value: 'review', description: 'Review existing documents' },
                    { value: 'organize', description: 'Organize and categorize' },
                    { value: 'enhance', description: 'Enhance document quality' },
                    { value: 'merge', description: 'Merge related documents' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;
        }
      }

      // Default empty completion if no specific suggestions
      return {
        completion: {
          values: [],
          hasMore: false,
        },
      };
    }
  );
  */

  return { mcpServer: server, baseServer, notifyResourceSubscribers };
}

// Store transports by session ID for HTTP mode
const transports: Record<string, StreamableHTTPServerTransport> = {};

async function startStdioServer() {
  logger.info('Starting MCP Knowledge Base Server (stdio mode)');

  try {
    const { mcpServer } = createMCPServer();
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    
    logger.info('Knowledge Base Server connected and ready (stdio)');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      await mcpServer.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down server...');
      await mcpServer.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start stdio server', error);
    process.exit(1);
  }
}

async function startHttpServer() {
  logger.info(`Starting MCP Knowledge Base Server (HTTP mode on port ${port})`);

  const app = express();
  app.use(express.json());
  
  // Configure CORS
  app.use(cors({
    origin: '*',
    exposedHeaders: ['Mcp-Session-Id']
  }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'knowledge-server', version: '1.0.0' });
  });

  // Server info endpoint
  app.get('/', (_req, res) => {
    res.json({
      server: 'knowledge-server',
      version: '1.0.0',
      description: 'MCP Knowledge Base Server',
      endpoints: ['/health', '/mcp', '/sse'],
      protocol: 'MCP 2025-06-18',
      capabilities: ['tools', 'resources', 'prompts', 'sampling', 'elicitation']
    });
  });

  // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-06-18)
  app.all('/mcp', async (req, res) => {
    logger.info(`Received ${req.method} request to /mcp`);
    
    try {
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            logger.info(`StreamableHTTP session initialized with ID: ${sessionId}`);
            transports[sessionId] = transport;
          }
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            logger.info(`Transport closed for session ${sid}, removing from transports map`);
            delete transports[sid];
          }
        };

        const { mcpServer } = createMCPServer();
        await mcpServer.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // Start the server
  app.listen(port, (error?: Error) => {
    if (error) {
      logger.error('Failed to start HTTP server:', error);
      process.exit(1);
    }
    
    logger.info(`Knowledge Base HTTP Server listening on port ${port}`);
    console.log(`
==============================================
MCP KNOWLEDGE BASE SERVER

Transport: HTTP
Port: ${port}

Available Tools:
- search_documents: Search through document collection
- get_document: Retrieve specific document by ID
- add_document: Add new document to knowledge base
- update_document: Update existing document
- delete_document: Remove document from knowledge base

Available Resources:
- knowledge://documents/all: All documents in knowledge base
- knowledge://categories: Document categories
- knowledge://tags: Available document tags

Available Prompts:
- research_topic: Comprehensive topic research workflow
==============================================
`);
  });

  // Handle server shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down HTTP server...');
    for (const sessionId in transports) {
      try {
        await transports[sessionId]!.close();
        delete transports[sessionId];
      } catch (error) {
        logger.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
    process.exit(0);
  });
}

// Main execution
async function main() {
  if (transportArg === 'http') {
    await startHttpServer();
  } else {
    await startStdioServer();
  }
}

// Run the server
main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});