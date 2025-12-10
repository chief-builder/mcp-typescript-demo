import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  createToolResult,
  createResourceResult,
  createPromptResult,
  validateToolInput,
  createTestLogger,
  waitFor,
  delay,
} from './helpers.js';

describe('Test Helpers', () => {
  describe('createToolResult', () => {
    it('should create tool result from string', () => {
      const result = createToolResult('Hello, World!');

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hello, World!');
    });

    it('should create tool result from object', () => {
      const data = { status: 'success', count: 42 };
      const result = createToolResult(data);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(data);
    });

    it('should format object with proper indentation', () => {
      const data = { nested: { value: 1 } };
      const result = createToolResult(data);

      expect(result.content[0].text).toContain('\n');
      expect(result.content[0].text).toContain('  ');
    });
  });

  describe('createResourceResult', () => {
    it('should create resource result with string content', () => {
      const result = createResourceResult(
        'test://resource/1',
        'Resource content'
      );

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('test://resource/1');
      expect(result.contents[0].text).toBe('Resource content');
      expect(result.contents[0].mimeType).toBe('application/json');
    });

    it('should create resource result with object content', () => {
      const data = { id: 1, name: 'test' };
      const result = createResourceResult('test://resource/1', data);

      expect(JSON.parse(result.contents[0].text)).toEqual(data);
    });

    it('should use custom MIME type', () => {
      const result = createResourceResult(
        'test://resource/1',
        '<html></html>',
        'text/html'
      );

      expect(result.contents[0].mimeType).toBe('text/html');
    });
  });

  describe('createPromptResult', () => {
    it('should create prompt result with user role', () => {
      const result = createPromptResult('Please help me', 'user');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      expect(result.messages[0].content.text).toBe('Please help me');
    });

    it('should create prompt result with assistant role', () => {
      const result = createPromptResult('Here is my response', 'assistant');

      expect(result.messages[0].role).toBe('assistant');
    });

    it('should default to user role', () => {
      const result = createPromptResult('Test message');

      expect(result.messages[0].role).toBe('user');
    });
  });

  describe('validateToolInput', () => {
    it('should return success for valid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const result = validateToolInput(schema, { name: 'John', age: 30 });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid input', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number()
      });

      const result = validateToolInput(schema, { name: 'John', age: 'thirty' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle non-Zod schemas gracefully', () => {
      const result = validateToolInput({}, { any: 'data' });
      expect(result.success).toBe(true);
    });
  });

  describe('createTestLogger', () => {
    it('should create logger with empty logs', () => {
      const logger = createTestLogger();

      expect(logger.logs).toEqual([]);
    });

    it('should capture info logs', () => {
      const logger = createTestLogger();
      logger.info('Test message', { extra: 'data' });

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].level).toBe('info');
      expect(logger.logs[0].message).toBe('Test message');
      expect(logger.logs[0].data).toEqual({ extra: 'data' });
    });

    it('should capture error logs', () => {
      const logger = createTestLogger();
      logger.error('Error occurred');

      expect(logger.logs[0].level).toBe('error');
    });

    it('should capture warn logs', () => {
      const logger = createTestLogger();
      logger.warn('Warning');

      expect(logger.logs[0].level).toBe('warn');
    });

    it('should capture debug logs', () => {
      const logger = createTestLogger();
      logger.debug('Debug info');

      expect(logger.logs[0].level).toBe('debug');
    });

    it('should clear logs', () => {
      const logger = createTestLogger();
      logger.info('Message 1');
      logger.info('Message 2');

      expect(logger.logs).toHaveLength(2);

      logger.clear();

      expect(logger.logs).toHaveLength(0);
    });

    it('should capture multiple logs', () => {
      const logger = createTestLogger();
      logger.info('Info');
      logger.warn('Warning');
      logger.error('Error');

      expect(logger.logs).toHaveLength(3);
      expect(logger.logs.map(l => l.level)).toEqual(['info', 'warn', 'error']);
    });
  });

  describe('waitFor', () => {
    it('should resolve when condition becomes true', async () => {
      let counter = 0;
      const condition = () => {
        counter++;
        return counter >= 3;
      };

      await waitFor(condition, { interval: 10 });

      expect(counter).toBe(3);
    });

    it('should handle async conditions', async () => {
      let ready = false;
      setTimeout(() => { ready = true; }, 50);

      await waitFor(async () => ready, { interval: 10, timeout: 1000 });

      expect(ready).toBe(true);
    });

    it('should timeout when condition never becomes true', async () => {
      const condition = () => false;

      await expect(
        waitFor(condition, { timeout: 100, interval: 10 })
      ).rejects.toThrow('Timeout waiting for condition after 100ms');
    });

    it('should use default options', async () => {
      let called = false;
      const condition = () => {
        called = true;
        return true;
      };

      await waitFor(condition);

      expect(called).toBe(true);
    });
  });

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(150);
    });

    it('should resolve to undefined', async () => {
      const result = await delay(10);
      expect(result).toBeUndefined();
    });

    it('should work with zero delay', async () => {
      const start = Date.now();
      await delay(0);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});
