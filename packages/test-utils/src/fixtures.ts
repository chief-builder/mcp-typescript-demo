/**
 * Common test fixtures for MCP testing
 */

export const mockTools = {
  formatCode: {
    name: 'format_code',
    description: 'Format code using Prettier',
    inputSchema: {
      code: { type: 'string' },
      language: { type: 'string', enum: ['javascript', 'typescript'] }
    },
    mockResponse: {
      content: [
        {
          type: 'text',
          text: 'function hello() {\n  console.log("Hello");\n}'
        }
      ]
    }
  },
  
  analyzeData: {
    name: 'analyze_data',
    description: 'Analyze data and provide insights',
    inputSchema: {
      data: { type: 'array' },
      metrics: { type: 'array', items: { type: 'string' } }
    },
    mockResponse: {
      content: [
        {
          type: 'text',
          text: 'Analysis complete: mean=50, median=45'
        }
      ]
    }
  }
};

export const mockResources = {
  testReport: {
    uri: 'test://reports/latest',
    name: 'Latest Test Report',
    content: {
      timestamp: '2025-01-01T00:00:00Z',
      summary: { total: 100, passed: 95, failed: 5 }
    }
  },
  
  configFile: {
    uri: 'config://project',
    name: 'Project Configuration',
    content: {
      name: 'test-project',
      version: '1.0.0',
      settings: { debug: true }
    }
  }
};

export const mockPrompts = {
  codeReview: {
    name: 'code_review',
    description: 'Perform code review',
    argsSchema: {
      filePath: { type: 'string' },
      reviewType: { type: 'string', enum: ['security', 'performance'] }
    },
    mockResponse: {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please review the file for security issues...'
          }
        }
      ]
    }
  },
  
  debugSession: {
    name: 'debug_session',
    description: 'Start debugging session',
    argsSchema: {
      errorMessage: { type: 'string' },
      urgency: { type: 'string', enum: ['low', 'medium', 'high'] }
    },
    mockResponse: {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Help me debug this error...'
          }
        }
      ]
    }
  }
};


/**
 * Create test data
 */
export function createTestData(count: number): Array<Record<string, any>> {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    value: Math.floor(Math.random() * 100),
    category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
    timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString()
  }));
}