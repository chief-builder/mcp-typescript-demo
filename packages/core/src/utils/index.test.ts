import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  safeAsync,
  Logger,
  LogLevel,
  normalizeUri,
  generateSessionId,
  createErrorResponse,
  createSuccessResponse
} from './index.js';
import { MCPError } from '../types/index.js';

describe('safeAsync', () => {
  it('should return success result when function succeeds', async () => {
    const result = await safeAsync(async () => 'hello');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('hello');
    }
  });

  it('should return success result with complex data', async () => {
    const data = { id: 1, name: 'test', nested: { value: 42 } };
    const result = await safeAsync(async () => data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(data);
    }
  });

  it('should return error result when function throws MCPError', async () => {
    const mcpError = new MCPError('Test error', 'TEST_CODE', { detail: 'test' });
    const result = await safeAsync(async () => {
      throw mcpError;
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(mcpError);
      expect(result.error.code).toBe('TEST_CODE');
    }
  });

  it('should wrap regular Error in MCPError', async () => {
    const result = await safeAsync(async () => {
      throw new Error('Regular error');
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(MCPError);
      expect(result.error.message).toBe('Regular error');
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
  });

  it('should handle non-Error throws', async () => {
    const result = await safeAsync(async () => {
      throw 'string error';
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(MCPError);
      expect(result.error.message).toBe('Unknown error');
    }
  });
});

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should create logger with name', () => {
    const logger = new Logger('test-logger');
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log debug messages', () => {
    const logger = new Logger('test');
    logger.debug('Debug message');

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('debug');
    expect(logOutput.message).toBe('Debug message');
    expect(logOutput.logger).toBe('test');
  });

  it('should log info messages', () => {
    const logger = new Logger('test');
    logger.info('Info message');

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('info');
    expect(logOutput.message).toBe('Info message');
  });

  it('should log warn messages', () => {
    const logger = new Logger('test');
    logger.warn('Warning message');

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('warn');
    expect(logOutput.message).toBe('Warning message');
  });

  it('should log error messages', () => {
    const logger = new Logger('test');
    logger.error('Error message');

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('error');
    expect(logOutput.message).toBe('Error message');
  });

  it('should include data in log output', () => {
    const logger = new Logger('test');
    const data = { userId: 123, action: 'test' };
    logger.info('Message with data', data);

    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logOutput.data).toEqual(data);
  });

  it('should include timestamp in ISO format', () => {
    const logger = new Logger('test');
    logger.info('Test message');

    const logOutput = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logOutput.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('LogLevel', () => {
  it('should have correct log level values', () => {
    expect(LogLevel.DEBUG).toBe('debug');
    expect(LogLevel.INFO).toBe('info');
    expect(LogLevel.WARN).toBe('warn');
    expect(LogLevel.ERROR).toBe('error');
  });
});

describe('normalizeUri', () => {
  it('should replace backslashes with forward slashes', () => {
    expect(normalizeUri('path\\to\\file')).toBe('path/to/file');
  });

  it('should collapse multiple forward slashes', () => {
    expect(normalizeUri('path//to///file')).toBe('path/to/file');
  });

  it('should handle mixed slashes', () => {
    expect(normalizeUri('path\\\\to//file')).toBe('path/to/file');
  });

  it('should leave single slashes unchanged', () => {
    expect(normalizeUri('path/to/file')).toBe('path/to/file');
  });

  it('should handle empty string', () => {
    expect(normalizeUri('')).toBe('');
  });

  it('should handle URIs with protocol', () => {
    expect(normalizeUri('file:///path//to\\file')).toBe('file:/path/to/file');
  });
});

describe('generateSessionId', () => {
  it('should generate session ID with mcp prefix', () => {
    const sessionId = generateSessionId();
    expect(sessionId).toMatch(/^mcp-/);
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const sessionId = generateSessionId();
    const after = Date.now();

    const parts = sessionId.split('-');
    const timestamp = parseInt(parts[1], 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should include random suffix', () => {
    const sessionId = generateSessionId();
    const parts = sessionId.split('-');

    expect(parts[2]).toBeDefined();
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }

    // All IDs should be unique
    expect(ids.size).toBe(100);
  });
});

describe('createErrorResponse', () => {
  it('should create error response with Error message', () => {
    const error = new Error('Something went wrong');
    const response = createErrorResponse(error);

    expect(response.isError).toBe(true);
    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toBe('Something went wrong');
  });

  it('should create error response with context', () => {
    const error = new Error('File not found');
    const response = createErrorResponse(error, 'Reading file');

    expect(response.content[0].text).toBe('Reading file: File not found');
  });

  it('should handle non-Error values', () => {
    const response = createErrorResponse('string error');

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toBe('Unknown error');
  });

  it('should handle undefined context', () => {
    const error = new Error('Test error');
    const response = createErrorResponse(error);

    expect(response.content[0].text).toBe('Test error');
  });
});

describe('createSuccessResponse', () => {
  it('should create success response with text', () => {
    const response = createSuccessResponse('Operation completed');

    expect(response.isError).toBeUndefined();
    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toBe('Operation completed');
  });

  it('should include metadata when provided', () => {
    const metadata = { duration: 100, count: 5 };
    const response = createSuccessResponse('Done', metadata);

    expect(response.metadata).toEqual(metadata);
  });

  it('should not include metadata when not provided', () => {
    const response = createSuccessResponse('Done');

    expect(response.metadata).toBeUndefined();
  });

  it('should handle empty text', () => {
    const response = createSuccessResponse('');

    expect(response.content[0].text).toBe('');
  });
});
