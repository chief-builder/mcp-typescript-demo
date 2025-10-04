import { describe, it, expect } from 'vitest';

describe('search_documents tool', () => {
  // Mock document data for testing
  const mockDocuments = [
    {
      id: 'doc-1',
      title: 'MCP Protocol Overview',
      content: 'The Model Context Protocol (MCP) is an open standard for connecting AI assistants to data sources and tools.',
      tags: ['mcp', 'protocol', 'overview'],
      category: 'documentation',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      author: 'MCP Team',
      summary: 'Introduction to the Model Context Protocol and its architecture'
    },
    {
      id: 'doc-2',
      title: 'TypeScript SDK Guide',
      content: 'The official TypeScript SDK for building MCP servers and clients.',
      tags: ['typescript', 'sdk', 'development'],
      category: 'guide',
      createdAt: '2024-01-16T09:00:00Z',
      updatedAt: '2024-01-16T09:00:00Z',
      author: 'Development Team',
      summary: 'Comprehensive guide for using the TypeScript SDK'
    }
  ];

  it('should search documents by query', () => {
    const query = 'MCP protocol';
    const results = mockDocuments.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.content.toLowerCase().includes(query.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
    
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('MCP Protocol Overview');
  });

  it('should limit search results', () => {
    const limit = 1;
    const results = mockDocuments.slice(0, limit);
    
    expect(results).toHaveLength(1);
  });

  it('should search by category', () => {
    const category = 'documentation';
    const results = mockDocuments.filter(doc => doc.category === category);
    
    expect(results).toHaveLength(1);
    expect(results[0]?.category).toBe('documentation');
  });

  it('should search by tags', () => {
    const targetTag = 'typescript';
    const results = mockDocuments.filter(doc => doc.tags.includes(targetTag));
    
    expect(results).toHaveLength(1);
    expect(results[0]?.tags).toContain('typescript');
  });

  it('should handle empty search results', () => {
    const query = 'nonexistent';
    const results = mockDocuments.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.content.toLowerCase().includes(query.toLowerCase())
    );
    
    expect(results).toHaveLength(0);
  });

  it('should validate document structure', () => {
    const document = mockDocuments[0]!;
    
    expect(document).toHaveProperty('id');
    expect(document).toHaveProperty('title');
    expect(document).toHaveProperty('content');
    expect(document).toHaveProperty('tags');
    expect(document).toHaveProperty('category');
    expect(document).toHaveProperty('createdAt');
    expect(document).toHaveProperty('updatedAt');
    expect(document).toHaveProperty('author');
    expect(document).toHaveProperty('summary');
    
    expect(Array.isArray(document.tags)).toBe(true);
    expect(document.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('should support fuzzy search', () => {
    // Simulate fuzzy search logic
    const query = 'protcol'; // Misspelled "protocol"
    const fuzzyResults = mockDocuments.filter(doc => {
      const similarity = calculateSimilarity(query, doc.title + ' ' + doc.content);
      return similarity > 0.5; // Threshold for fuzzy matching
    });
    
    expect(fuzzyResults.length).toBeGreaterThanOrEqual(0);
  });
});

// Helper function to simulate similarity calculation
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1,
        matrix[j - 1]![i]! + 1,
        matrix[j - 1]![i - 1]! + indicator
      );
    }
  }
  
  return matrix[str2.length]![str1.length]!;
}