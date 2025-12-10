import { describe, it, expect } from 'vitest';
import * as testUtils from './index.js';

describe('test-utils exports', () => {
  it('should export fixtures', () => {
    expect(testUtils.mockTools).toBeDefined();
    expect(testUtils.mockResources).toBeDefined();
    expect(testUtils.mockPrompts).toBeDefined();
    expect(testUtils.createTestData).toBeDefined();
  });

  it('should export helpers', () => {
    expect(testUtils.createToolResult).toBeDefined();
    expect(testUtils.createResourceResult).toBeDefined();
    expect(testUtils.createPromptResult).toBeDefined();
    expect(testUtils.validateToolInput).toBeDefined();
    expect(testUtils.createTestLogger).toBeDefined();
    expect(testUtils.waitFor).toBeDefined();
    expect(testUtils.delay).toBeDefined();
  });

  it('should have correct types for exported functions', () => {
    expect(typeof testUtils.createToolResult).toBe('function');
    expect(typeof testUtils.createResourceResult).toBe('function');
    expect(typeof testUtils.createTestData).toBe('function');
  });
});
