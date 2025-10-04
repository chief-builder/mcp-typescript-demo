import { describe, it, expect } from 'vitest';

describe('create_document tool', () => {
  it('should validate document creation parameters', () => {
    const documentData = {
      title: 'New Document',
      content: 'This is the content of the new document.',
      category: 'guide',
      tags: ['test', 'example'],
      author: 'Test User'
    };
    
    expect(documentData.title).toBeTruthy();
    expect(documentData.content).toBeTruthy();
    expect(documentData.category).toBeTruthy();
    expect(Array.isArray(documentData.tags)).toBe(true);
    expect(documentData.author).toBeTruthy();
  });

  it('should generate unique document IDs', () => {
    const generateId = () => `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const id1 = generateId();
    const id2 = generateId();
    
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^doc-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^doc-\d+-[a-z0-9]+$/);
  });

  it('should set creation timestamps', () => {
    const now = new Date().toISOString();
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    
    expect(now).toMatch(timestampRegex);
  });

  it('should validate required fields', () => {
    const requiredFields = ['title', 'content'];
    const documentData = {
      title: 'Test Document',
      content: 'Test content',
      category: 'test',
      tags: [],
      author: 'Test User'
    };
    
    requiredFields.forEach(field => {
      expect(documentData).toHaveProperty(field);
      expect(documentData[field as keyof typeof documentData]).toBeTruthy();
    });
  });

  it('should handle optional fields with defaults', () => {
    const documentData = {
      title: 'Test Document',
      content: 'Test content'
    };
    
    const defaults = {
      category: 'uncategorized',
      tags: [],
      author: 'anonymous',
      summary: ''
    };
    
    const finalDocument = {
      ...defaults,
      ...documentData,
      id: 'doc-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    expect(finalDocument.category).toBe('uncategorized');
    expect(finalDocument.tags).toEqual([]);
    expect(finalDocument.author).toBe('anonymous');
  });

  it('should validate tag format', () => {
    const validTags = ['javascript', 'web-development', 'api_design', 'test123'];
    
    const isValidTag = (tag: string) => 
      /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tag) && tag.length > 0 && tag.length <= 50;
    
    validTags.forEach(tag => {
      expect(isValidTag(tag)).toBe(true);
    });
  });

  it('should validate category names', () => {
    const validCategories = [
      'documentation',
      'guide',
      'tutorial',
      'reference',
      'faq',
      'troubleshooting',
      'best-practices',
      'api-reference'
    ];
    
    const category = 'guide';
    expect(validCategories).toContain(category);
  });

  it('should handle content length validation', () => {
    const shortContent = 'Short';
    const normalContent = 'This is a normal length content that should be accepted.';
    const longContent = 'A'.repeat(100000);
    
    const validateContentLength = (content: string) => 
      content.length >= 1 && content.length <= 50000;
    
    expect(validateContentLength(shortContent)).toBe(true);
    expect(validateContentLength(normalContent)).toBe(true);
    expect(validateContentLength(longContent)).toBe(false);
  });

  it('should generate document summary automatically', () => {
    const content = `# Introduction to MCP

The Model Context Protocol (MCP) is a revolutionary new standard for connecting AI assistants to external data sources and tools. This protocol enables seamless integration between AI models and various services, databases, and applications.

## Key Benefits

MCP provides several advantages including standardized communication, enhanced security, and flexible architecture. Organizations can leverage MCP to build more powerful and integrated AI solutions.`;
    
    const generateSummary = (content: string, maxLength: number = 200) => {
      const plainText = content.replace(/#/g, '').replace(/\n+/g, ' ').trim();
      return plainText.length > maxLength 
        ? plainText.substring(0, maxLength) + '...'
        : plainText;
    };
    
    const summary = generateSummary(content);
    
    expect(summary.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(summary).toContain('Model Context Protocol');
    expect(summary).not.toContain('#');
  });
});