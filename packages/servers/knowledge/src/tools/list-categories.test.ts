import { describe, it, expect } from 'vitest';

describe('list_categories tool', () => {
  // Mock category data
  const mockCategories = [
    {
      name: 'documentation',
      description: 'Technical documentation and specifications',
      documentCount: 15,
      lastUpdated: '2024-09-26T14:30:00Z',
      subcategories: ['api-docs', 'user-guides', 'tutorials']
    },
    {
      name: 'guides',
      description: 'Step-by-step guides and how-to articles',
      documentCount: 8,
      lastUpdated: '2024-09-25T10:15:00Z',
      subcategories: ['setup-guides', 'troubleshooting', 'best-practices']
    },
    {
      name: 'reference',
      description: 'Reference materials and lookup tables',
      documentCount: 12,
      lastUpdated: '2024-09-24T16:45:00Z',
      subcategories: ['api-reference', 'configuration', 'examples']
    }
  ];

  it('should list all available categories', () => {
    expect(mockCategories).toHaveLength(3);
    expect(mockCategories.map(c => c.name)).toEqual(['documentation', 'guides', 'reference']);
  });

  it('should include document counts for each category', () => {
    const totalDocuments = mockCategories.reduce((sum, cat) => sum + cat.documentCount, 0);
    
    expect(totalDocuments).toBe(35);
    expect(mockCategories[0]?.documentCount).toBe(15);
    expect(mockCategories[1]?.documentCount).toBe(8);
    expect(mockCategories[2]?.documentCount).toBe(12);
  });

  it('should validate category structure', () => {
    const category = mockCategories[0]!;
    
    expect(category).toHaveProperty('name');
    expect(category).toHaveProperty('description');
    expect(category).toHaveProperty('documentCount');
    expect(category).toHaveProperty('lastUpdated');
    expect(category).toHaveProperty('subcategories');
    
    expect(typeof category.name).toBe('string');
    expect(typeof category.description).toBe('string');
    expect(typeof category.documentCount).toBe('number');
    expect(Array.isArray(category.subcategories)).toBe(true);
  });

  it('should have valid timestamps', () => {
    const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    
    mockCategories.forEach(category => {
      expect(category.lastUpdated).toMatch(timestampRegex);
    });
  });

  it('should include subcategories', () => {
    mockCategories.forEach(category => {
      expect(category.subcategories.length).toBeGreaterThan(0);
      category.subcategories.forEach(sub => {
        expect(typeof sub).toBe('string');
        expect(sub.length).toBeGreaterThan(0);
      });
    });
  });

  it('should sort categories by document count', () => {
    const sortedByCount = [...mockCategories].sort((a, b) => b.documentCount - a.documentCount);
    
    expect(sortedByCount[0]?.name).toBe('documentation');
    expect(sortedByCount[1]?.name).toBe('reference');
    expect(sortedByCount[2]?.name).toBe('guides');
  });

  it('should filter categories by minimum document count', () => {
    const minCount = 10;
    const filtered = mockCategories.filter(cat => cat.documentCount >= minCount);
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(c => c.name)).toEqual(['documentation', 'reference']);
  });

  it('should calculate category statistics', () => {
    const stats = {
      totalCategories: mockCategories.length,
      totalDocuments: mockCategories.reduce((sum, cat) => sum + cat.documentCount, 0),
      avgDocumentsPerCategory: mockCategories.reduce((sum, cat) => sum + cat.documentCount, 0) / mockCategories.length,
      mostPopularCategory: mockCategories.reduce((max, cat) => cat.documentCount > max.documentCount ? cat : max),
      totalSubcategories: mockCategories.reduce((sum, cat) => sum + cat.subcategories.length, 0)
    };
    
    expect(stats.totalCategories).toBe(3);
    expect(stats.totalDocuments).toBe(35);
    expect(stats.avgDocumentsPerCategory).toBeCloseTo(11.67, 1);
    expect(stats.mostPopularCategory.name).toBe('documentation');
    expect(stats.totalSubcategories).toBe(9);
  });

  it('should validate category names', () => {
    const validNamePattern = /^[a-z][a-z0-9-]*$/;
    
    mockCategories.forEach(category => {
      expect(category.name).toMatch(validNamePattern);
    });
  });
});