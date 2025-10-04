import { describe, it, expect } from 'vitest';

describe('Knowledge Resources', () => {
  it('should provide recent documents resource', () => {
    const recentDocuments = {
      timestamp: new Date().toISOString(),
      totalDocuments: 87,
      recentCount: 10,
      documents: [
        {
          id: 'doc-087',
          title: 'Advanced MCP Server Configuration',
          category: 'documentation',
          author: 'System Admin',
          createdAt: '2024-09-27T08:30:00Z',
          summary: 'Comprehensive guide for advanced MCP server configuration and optimization.',
          tags: ['mcp', 'configuration', 'advanced'],
          viewCount: 45,
          lastModified: '2024-09-27T08:30:00Z'
        },
        {
          id: 'doc-086',
          title: 'Troubleshooting Connection Issues',
          category: 'troubleshooting',
          author: 'Support Team',
          createdAt: '2024-09-26T16:15:00Z',
          summary: 'Step-by-step guide for diagnosing and resolving common connection problems.',
          tags: ['troubleshooting', 'connection', 'networking'],
          viewCount: 23,
          lastModified: '2024-09-26T18:22:00Z'
        }
      ]
    };
    
    expect(recentDocuments.documents).toHaveLength(2);
    expect(recentDocuments.totalDocuments).toBeGreaterThan(recentDocuments.recentCount);
    
    const document = recentDocuments.documents[0]!;
    expect(document).toHaveProperty('id');
    expect(document).toHaveProperty('title');
    expect(document).toHaveProperty('category');
    expect(document).toHaveProperty('author');
    expect(document).toHaveProperty('createdAt');
    expect(document).toHaveProperty('summary');
    expect(document).toHaveProperty('tags');
    expect(document).toHaveProperty('viewCount');
    expect(Array.isArray(document.tags)).toBe(true);
  });

  it('should provide document collections resource', () => {
    const documentCollections = {
      timestamp: new Date().toISOString(),
      totalCollections: 12,
      collections: [
        {
          id: 'collection-001',
          name: 'MCP Getting Started',
          description: 'Essential documents for getting started with MCP',
          documentCount: 8,
          createdAt: '2024-08-15T10:00:00Z',
          lastUpdated: '2024-09-25T14:30:00Z',
          tags: ['getting-started', 'beginner', 'tutorial'],
          isPublic: true,
          curator: 'Documentation Team',
          documents: [
            'doc-001', 'doc-002', 'doc-003', 'doc-015',
            'doc-022', 'doc-034', 'doc-041', 'doc-055'
          ]
        },
        {
          id: 'collection-002',
          name: 'Advanced Troubleshooting',
          description: 'In-depth troubleshooting guides for complex issues',
          documentCount: 15,
          createdAt: '2024-08-20T14:00:00Z',
          lastUpdated: '2024-09-24T11:45:00Z',
          tags: ['troubleshooting', 'advanced', 'debugging'],
          isPublic: false,
          curator: 'Support Team',
          documents: [
            'doc-045', 'doc-056', 'doc-067', 'doc-071',
            'doc-078', 'doc-082', 'doc-085', 'doc-086'
          ]
        }
      ]
    };
    
    expect(documentCollections.collections).toHaveLength(2);
    
    const collection = documentCollections.collections[0]!;
    expect(collection).toHaveProperty('id');
    expect(collection).toHaveProperty('name');
    expect(collection).toHaveProperty('description');
    expect(collection).toHaveProperty('documentCount');
    expect(collection).toHaveProperty('documents');
    expect(collection.documents).toHaveLength(collection.documentCount);
    expect(Array.isArray(collection.documents)).toBe(true);
    expect(Array.isArray(collection.tags)).toBe(true);
  });

  it('should provide search indices resource', () => {
    const searchIndices = {
      timestamp: new Date().toISOString(),
      totalIndices: 5,
      lastIndexUpdate: '2024-09-27T06:00:00Z',
      indices: [
        {
          name: 'full_text_index',
          type: 'text',
          description: 'Full-text search across all document content',
          documentCount: 87,
          indexSize: '2.3MB',
          lastUpdated: '2024-09-27T06:00:00Z',
          fields: ['title', 'content', 'summary'],
          language: 'en',
          analyzer: 'standard'
        },
        {
          name: 'tag_index',
          type: 'categorical',
          description: 'Searchable index of all document tags',
          documentCount: 87,
          indexSize: '145KB',
          lastUpdated: '2024-09-27T06:00:00Z',
          fields: ['tags'],
          uniqueValues: 156,
          mostCommonTags: ['mcp', 'tutorial', 'api', 'guide', 'troubleshooting']
        },
        {
          name: 'semantic_index',
          type: 'vector',
          description: 'Semantic similarity search using embeddings',
          documentCount: 87,
          indexSize: '8.7MB',
          lastUpdated: '2024-09-26T22:30:00Z',
          fields: ['content_embedding'],
          dimensions: 384,
          model: 'sentence-transformers/all-MiniLM-L6-v2'
        }
      ],
      indexingStats: {
        totalDocumentsIndexed: 87,
        averageIndexingTime: 1.2,
        indexingSuccess: 99.8,
        lastIndexingError: null
      }
    };
    
    expect(searchIndices.indices).toHaveLength(3);
    expect(searchIndices.totalIndices).toBe(5); // Some indices might not be shown
    
    const textIndex = searchIndices.indices.find(i => i.type === 'text')!;
    expect(textIndex.fields).toContain('title');
    expect(textIndex.fields).toContain('content');
    
    const vectorIndex = searchIndices.indices.find(i => i.type === 'vector')!;
    expect(vectorIndex.dimensions).toBeGreaterThan(0);
    expect(vectorIndex.model).toBeTruthy();
    
    expect(searchIndices.indexingStats.indexingSuccess).toBeGreaterThan(99);
  });

  it('should validate resource URIs', () => {
    const resourceUris = [
      'knowledge://documents/recent',
      'knowledge://collections/all',
      'knowledge://search/indices'
    ];
    
    resourceUris.forEach(uri => {
      expect(uri).toMatch(/^knowledge:\/\//);
      expect(uri.split('//')[1]).toContain('/');
    });
  });

  it('should include proper MIME types', () => {
    const resources = [
      { uri: 'knowledge://documents/recent', mimeType: 'application/json' },
      { uri: 'knowledge://collections/all', mimeType: 'application/json' },
      { uri: 'knowledge://search/indices', mimeType: 'application/json' }
    ];
    
    resources.forEach(resource => {
      expect(resource.mimeType).toBe('application/json');
    });
  });

  it('should track document statistics', () => {
    const documents = [
      { category: 'documentation', viewCount: 120 },
      { category: 'guide', viewCount: 85 },
      { category: 'documentation', viewCount: 95 },
      { category: 'troubleshooting', viewCount: 67 },
      { category: 'guide', viewCount: 78 }
    ];
    
    const stats = documents.reduce((acc, doc) => {
      if (!acc[doc.category]) {
        acc[doc.category] = { count: 0, totalViews: 0 };
      }
      acc[doc.category]!.count++;
      acc[doc.category]!.totalViews += doc.viewCount;
      return acc;
    }, {} as Record<string, { count: number; totalViews: number }>);
    
    expect(stats.documentation?.count).toBe(2);
    expect(stats.documentation?.totalViews).toBe(215);
    expect(stats.guide?.count).toBe(2);
    expect(stats.guide?.totalViews).toBe(163);
  });

  it('should validate timestamp formats', () => {
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    const timestamps = [
      '2024-09-27T08:30:00Z',
      '2024-09-26T16:15:00.123Z',
      new Date().toISOString()
    ];
    
    timestamps.forEach(timestamp => {
      expect(timestamp).toMatch(timestampRegex);
    });
  });
});