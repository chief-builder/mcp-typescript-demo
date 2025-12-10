import { describe, it, expect } from 'vitest';
import * as core from './index.js';

describe('core package exports', () => {
  describe('types exports', () => {
    it('should export MCPError class', () => {
      expect(core.MCPError).toBeDefined();
      const error = new core.MCPError('test', 'CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('utils exports', () => {
    it('should export utility functions', () => {
      expect(core.safeAsync).toBeDefined();
      expect(core.Logger).toBeDefined();
      expect(core.LogLevel).toBeDefined();
      expect(core.normalizeUri).toBeDefined();
      expect(core.generateSessionId).toBeDefined();
      expect(core.createErrorResponse).toBeDefined();
      expect(core.createSuccessResponse).toBeDefined();
    });

    it('should have working utility functions', () => {
      expect(core.normalizeUri('a\\b')).toBe('a/b');
      expect(core.generateSessionId()).toMatch(/^mcp-/);
    });
  });

  describe('schemas exports', () => {
    it('should export validation schemas', () => {
      expect(core.filePathSchema).toBeDefined();
      expect(core.paginationSchema).toBeDefined();
      expect(core.programmingLanguageSchema).toBeDefined();
      expect(core.dataFormatSchema).toBeDefined();
      expect(core.cloudProviderSchema).toBeDefined();
      expect(core.errorResponseSchema).toBeDefined();
      expect(core.successResponseSchema).toBeDefined();
      expect(core.progressUpdateSchema).toBeDefined();
    });
  });

  describe('LLM exports', () => {
    it('should export LLM provider classes', () => {
      expect(core.LLMProviderManager).toBeDefined();
      expect(core.ClaudeProvider).toBeDefined();
      expect(core.OpenAIProvider).toBeDefined();
    });

    it('should export LLMProviderManager as a class', () => {
      expect(typeof core.LLMProviderManager).toBe('function');
    });
  });
});
