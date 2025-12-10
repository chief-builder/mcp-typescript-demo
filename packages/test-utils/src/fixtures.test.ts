import { describe, it, expect } from 'vitest';
import {
  mockTools,
  mockResources,
  mockPrompts,
  createTestData,
} from './fixtures.js';

describe('Test Fixtures', () => {
  describe('mockTools', () => {
    it('should have formatCode tool definition', () => {
      expect(mockTools.formatCode).toBeDefined();
      expect(mockTools.formatCode.name).toBe('format_code');
      expect(mockTools.formatCode.description).toBe('Format code using Prettier');
    });

    it('should have formatCode input schema', () => {
      expect(mockTools.formatCode.inputSchema).toBeDefined();
      expect(mockTools.formatCode.inputSchema.code).toBeDefined();
      expect(mockTools.formatCode.inputSchema.language).toBeDefined();
    });

    it('should have formatCode mock response', () => {
      expect(mockTools.formatCode.mockResponse).toBeDefined();
      expect(mockTools.formatCode.mockResponse.content).toHaveLength(1);
      expect(mockTools.formatCode.mockResponse.content[0].type).toBe('text');
    });

    it('should have analyzeData tool definition', () => {
      expect(mockTools.analyzeData).toBeDefined();
      expect(mockTools.analyzeData.name).toBe('analyze_data');
      expect(mockTools.analyzeData.description).toBe('Analyze data and provide insights');
    });

    it('should have analyzeData input schema', () => {
      expect(mockTools.analyzeData.inputSchema.data.type).toBe('array');
      expect(mockTools.analyzeData.inputSchema.metrics.type).toBe('array');
    });
  });

  describe('mockResources', () => {
    it('should have testReport resource', () => {
      expect(mockResources.testReport).toBeDefined();
      expect(mockResources.testReport.uri).toBe('test://reports/latest');
      expect(mockResources.testReport.name).toBe('Latest Test Report');
    });

    it('should have testReport content', () => {
      const content = mockResources.testReport.content;
      expect(content.timestamp).toBeDefined();
      expect(content.summary).toBeDefined();
      expect(content.summary.total).toBe(100);
      expect(content.summary.passed).toBe(95);
      expect(content.summary.failed).toBe(5);
    });

    it('should have configFile resource', () => {
      expect(mockResources.configFile).toBeDefined();
      expect(mockResources.configFile.uri).toBe('config://project');
      expect(mockResources.configFile.name).toBe('Project Configuration');
    });

    it('should have configFile content', () => {
      const content = mockResources.configFile.content;
      expect(content.name).toBe('test-project');
      expect(content.version).toBe('1.0.0');
      expect(content.settings.debug).toBe(true);
    });
  });

  describe('mockPrompts', () => {
    it('should have codeReview prompt', () => {
      expect(mockPrompts.codeReview).toBeDefined();
      expect(mockPrompts.codeReview.name).toBe('code_review');
      expect(mockPrompts.codeReview.description).toBe('Perform code review');
    });

    it('should have codeReview args schema', () => {
      const schema = mockPrompts.codeReview.argsSchema;
      expect(schema.filePath.type).toBe('string');
      expect(schema.reviewType.enum).toContain('security');
      expect(schema.reviewType.enum).toContain('performance');
    });

    it('should have codeReview mock response', () => {
      const response = mockPrompts.codeReview.mockResponse;
      expect(response.messages).toHaveLength(1);
      expect(response.messages[0].role).toBe('user');
      expect(response.messages[0].content.type).toBe('text');
    });

    it('should have debugSession prompt', () => {
      expect(mockPrompts.debugSession).toBeDefined();
      expect(mockPrompts.debugSession.name).toBe('debug_session');
      expect(mockPrompts.debugSession.description).toBe('Start debugging session');
    });

    it('should have debugSession args schema', () => {
      const schema = mockPrompts.debugSession.argsSchema;
      expect(schema.errorMessage.type).toBe('string');
      expect(schema.urgency.enum).toContain('low');
      expect(schema.urgency.enum).toContain('high');
    });
  });

  describe('createTestData', () => {
    it('should create specified number of records', () => {
      const data = createTestData(10);
      expect(data).toHaveLength(10);
    });

    it('should create records with required fields', () => {
      const data = createTestData(1);
      const record = data[0];

      expect(record.id).toBe(1);
      expect(record.name).toBe('Item 1');
      expect(typeof record.value).toBe('number');
      expect(['A', 'B', 'C']).toContain(record.category);
      expect(record.timestamp).toBeDefined();
    });

    it('should create sequential IDs', () => {
      const data = createTestData(5);
      expect(data.map(r => r.id)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should create sequential names', () => {
      const data = createTestData(3);
      expect(data.map(r => r.name)).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should create values in valid range', () => {
      const data = createTestData(100);
      data.forEach(record => {
        expect(record.value).toBeGreaterThanOrEqual(0);
        expect(record.value).toBeLessThan(100);
      });
    });

    it('should create valid timestamps', () => {
      const data = createTestData(5);
      data.forEach(record => {
        const timestamp = new Date(record.timestamp);
        expect(timestamp.toISOString()).toBe(record.timestamp);
      });
    });

    it('should create empty array for zero count', () => {
      const data = createTestData(0);
      expect(data).toEqual([]);
    });

    it('should handle large count', () => {
      const data = createTestData(1000);
      expect(data).toHaveLength(1000);
      expect(data[999].id).toBe(1000);
    });

    it('should have variety in categories', () => {
      const data = createTestData(100);
      const categories = new Set(data.map(r => r.category));
      // With 100 random samples, we should have all 3 categories
      expect(categories.size).toBeGreaterThanOrEqual(2);
    });
  });
});
