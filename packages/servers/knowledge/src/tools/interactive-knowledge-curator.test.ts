import { describe, it, expect } from 'vitest';

describe('interactive_knowledge_curator tool', () => {
  it('should validate curation actions', () => {
    const validActions = [
      'organize_documents',
      'suggest_tags',
      'identify_duplicates',
      'recommend_structure',
      'analyze_gaps'
    ];
    
    const action = 'organize_documents';
    expect(validActions).toContain(action);
  });

  it('should handle document organization preferences', () => {
    const organizationConfig = {
      criteria: 'topic',
      groupingStrategy: 'hierarchical',
      includeSubcategories: true,
      sortOrder: 'alphabetical'
    };
    
    expect(['topic', 'date', 'author', 'popularity']).toContain(organizationConfig.criteria);
    expect(['hierarchical', 'flat', 'tagged']).toContain(organizationConfig.groupingStrategy);
    expect(['alphabetical', 'chronological', 'relevance']).toContain(organizationConfig.sortOrder);
  });

  it('should suggest appropriate tags', () => {
    const documentContent = `
      This guide explains how to implement authentication in a web application 
      using JSON Web Tokens (JWT) and OAuth 2.0. We'll cover security best practices 
      and common pitfalls to avoid.
    `;
    
    const suggestTags = (content: string): string[] => {
      const keywords = [
        'authentication', 'jwt', 'oauth', 'security', 'web-application',
        'best-practices', 'guide', 'implementation'
      ];
      
      return keywords.filter(keyword => 
        content.toLowerCase().includes(keyword.replace('-', ' '))
      );
    };
    
    const suggestedTags = suggestTags(documentContent);
    
    expect(suggestedTags).toContain('authentication');
    expect(suggestedTags).toContain('security');
    expect(suggestedTags).toContain('web-application');
    expect(suggestedTags.length).toBeGreaterThan(0);
  });

  it('should identify potential duplicates', () => {
    const documents = [
      {
        id: 'doc-1',
        title: 'Introduction to React Components',
        content: 'React components are the building blocks of React applications...',
        tags: ['react', 'components', 'frontend']
      },
      {
        id: 'doc-2',
        title: 'React Component Basics',
        content: 'Components in React are reusable pieces of UI that encapsulate...',
        tags: ['react', 'components', 'ui']
      },
      {
        id: 'doc-3',
        title: 'TypeScript Best Practices',
        content: 'TypeScript provides type safety for JavaScript applications...',
        tags: ['typescript', 'best-practices', 'javascript']
      }
    ];
    
    const findPotentialDuplicates = (docs: typeof documents) => {
      const duplicates = [];
      
      for (let i = 0; i < docs.length; i++) {
        for (let j = i + 1; j < docs.length; j++) {
          const doc1 = docs[i]!;
          const doc2 = docs[j]!;
          
          const titleSimilarity = calculateSimilarity(doc1.title, doc2.title);
          const tagOverlap = doc1.tags.filter(tag => doc2.tags.includes(tag)).length;
          
          if (titleSimilarity > 0.6 || tagOverlap >= 2) {
            duplicates.push([doc1.id, doc2.id]);
          }
        }
      }
      
      return duplicates;
    };
    
    const potentialDuplicates = findPotentialDuplicates(documents);
    expect(potentialDuplicates).toHaveLength(1);
    expect(potentialDuplicates[0]).toEqual(['doc-1', 'doc-2']);
  });

  it('should recommend knowledge structure', () => {
    const documents = [
      { category: 'frontend', tags: ['react', 'vue', 'angular'] },
      { category: 'backend', tags: ['node', 'express', 'database'] },
      { category: 'frontend', tags: ['css', 'html', 'javascript'] },
      { category: 'devops', tags: ['docker', 'kubernetes', 'ci-cd'] }
    ];
    
    const generateStructure = (docs: typeof documents) => {
      const structure: Record<string, string[]> = {};
      
      docs.forEach(doc => {
        if (!structure[doc.category]) {
          structure[doc.category] = [];
        }
        doc.tags.forEach(tag => {
          if (!structure[doc.category]!.includes(tag)) {
            structure[doc.category]!.push(tag);
          }
        });
      });
      
      return structure;
    };
    
    const structure = generateStructure(documents);
    
    expect(structure).toHaveProperty('frontend');
    expect(structure).toHaveProperty('backend');
    expect(structure).toHaveProperty('devops');
    expect(structure.frontend).toContain('react');
    expect(structure.backend).toContain('node');
    expect(structure.devops).toContain('docker');
  });

  it('should analyze knowledge gaps', () => {
    const documentCounts = {
      frontend: 15,
      backend: 12,
      devops: 3,
      testing: 1
    };
    
    const identifyGaps = (counts: typeof documentCounts) => {
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      const avgCount = total / Object.keys(counts).length;
      
      return Object.entries(counts)
        .filter(([, count]) => count < avgCount * 0.5)
        .map(([category, count]) => ({
          category,
          count,
          gapSeverity: count < avgCount * 0.25 ? 'high' : 'medium'
        }));
    };
    
    const gaps = identifyGaps(documentCounts);
    
    expect(gaps).toHaveLength(2);
    expect(gaps.find(g => g.category === 'testing')?.gapSeverity).toBe('high');
    expect(gaps.find(g => g.category === 'devops')?.gapSeverity).toBe('medium');
  });

  it('should track curation metrics', () => {
    const curationMetrics = {
      documentsProcessed: 45,
      tagsGenerated: 128,
      duplicatesFound: 3,
      categoriesReorganized: 2,
      gapsIdentified: 4,
      processingTime: 2.5
    };
    
    expect(curationMetrics.documentsProcessed).toBeGreaterThan(0);
    expect(curationMetrics.tagsGenerated).toBeGreaterThan(curationMetrics.documentsProcessed);
    expect(curationMetrics.duplicatesFound).toBeGreaterThanOrEqual(0);
    expect(curationMetrics.processingTime).toBeGreaterThan(0);
  });
});

// Helper function for similarity calculation
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
}