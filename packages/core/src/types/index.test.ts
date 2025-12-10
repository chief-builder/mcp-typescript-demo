import { describe, it, expect } from 'vitest';
import { MCPError, Result, ServerConfig, ClientConfig, ResourceMetadata } from './index.js';

describe('MCPError', () => {
  it('should create error with message and code', () => {
    const error = new MCPError('Test error message', 'TEST_CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MCPError);
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('MCPError');
  });

  it('should include details when provided', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new MCPError('Validation failed', 'VALIDATION_ERROR', details);

    expect(error.details).toEqual(details);
  });

  it('should have undefined details when not provided', () => {
    const error = new MCPError('Simple error', 'SIMPLE');

    expect(error.details).toBeUndefined();
  });

  it('should be throwable and catchable', () => {
    expect(() => {
      throw new MCPError('Thrown error', 'THROWN');
    }).toThrow(MCPError);

    try {
      throw new MCPError('Caught error', 'CAUGHT', { data: 123 });
    } catch (error) {
      expect(error).toBeInstanceOf(MCPError);
      if (error instanceof MCPError) {
        expect(error.code).toBe('CAUGHT');
        expect(error.details).toEqual({ data: 123 });
      }
    }
  });

  it('should work with error codes as constants', () => {
    const NOT_FOUND = 'NOT_FOUND';
    const UNAUTHORIZED = 'UNAUTHORIZED';
    const INTERNAL = 'INTERNAL_ERROR';

    const notFoundError = new MCPError('Resource not found', NOT_FOUND);
    const authError = new MCPError('Not authorized', UNAUTHORIZED);
    const internalError = new MCPError('Internal error', INTERNAL);

    expect(notFoundError.code).toBe(NOT_FOUND);
    expect(authError.code).toBe(UNAUTHORIZED);
    expect(internalError.code).toBe(INTERNAL);
  });
});

describe('Result type', () => {
  it('should represent success result', () => {
    const successResult: Result<string> = {
      success: true,
      data: 'test data'
    };

    expect(successResult.success).toBe(true);
    if (successResult.success) {
      expect(successResult.data).toBe('test data');
    }
  });

  it('should represent error result', () => {
    const error = new MCPError('Something failed', 'FAILURE');
    const errorResult: Result<string> = {
      success: false,
      error
    };

    expect(errorResult.success).toBe(false);
    if (!errorResult.success) {
      expect(errorResult.error).toBe(error);
    }
  });

  it('should work with complex data types', () => {
    interface UserData {
      id: number;
      name: string;
      email: string;
    }

    const userData: UserData = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    };

    const result: Result<UserData> = {
      success: true,
      data: userData
    };

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe('Test User');
    }
  });

  it('should work with custom error types', () => {
    class CustomError extends Error {
      constructor(message: string, public code: number) {
        super(message);
      }
    }

    const customError = new CustomError('Custom failure', 500);
    const result: Result<string, CustomError> = {
      success: false,
      error: customError
    };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(500);
    }
  });
});

describe('ServerConfig type', () => {
  it('should accept minimal configuration', () => {
    const config: ServerConfig = {
      name: 'test-server',
      version: '1.0.0'
    };

    expect(config.name).toBe('test-server');
    expect(config.version).toBe('1.0.0');
    expect(config.description).toBeUndefined();
    expect(config.transport).toBeUndefined();
    expect(config.httpPort).toBeUndefined();
  });

  it('should accept full configuration', () => {
    const config: ServerConfig = {
      name: 'full-server',
      version: '2.0.0',
      description: 'A fully configured server',
      transport: 'http',
      httpPort: 3000
    };

    expect(config.description).toBe('A fully configured server');
    expect(config.transport).toBe('http');
    expect(config.httpPort).toBe(3000);
  });

  it('should accept stdio transport', () => {
    const config: ServerConfig = {
      name: 'stdio-server',
      version: '1.0.0',
      transport: 'stdio'
    };

    expect(config.transport).toBe('stdio');
  });
});

describe('ClientConfig type', () => {
  it('should accept client configuration', () => {
    const config: ClientConfig = {
      name: 'test-client',
      version: '1.0.0'
    };

    expect(config.name).toBe('test-client');
    expect(config.version).toBe('1.0.0');
  });
});

describe('ResourceMetadata type', () => {
  it('should accept empty metadata', () => {
    const metadata: ResourceMetadata = {};

    expect(metadata.lastModified).toBeUndefined();
    expect(metadata.size).toBeUndefined();
    expect(metadata.checksum).toBeUndefined();
    expect(metadata.tags).toBeUndefined();
  });

  it('should accept full metadata', () => {
    const now = new Date();
    const metadata: ResourceMetadata = {
      lastModified: now,
      size: 1024,
      checksum: 'abc123',
      tags: ['important', 'v1']
    };

    expect(metadata.lastModified).toBe(now);
    expect(metadata.size).toBe(1024);
    expect(metadata.checksum).toBe('abc123');
    expect(metadata.tags).toEqual(['important', 'v1']);
  });

  it('should work with partial metadata', () => {
    const metadata: ResourceMetadata = {
      size: 2048,
      tags: ['draft']
    };

    expect(metadata.size).toBe(2048);
    expect(metadata.tags).toEqual(['draft']);
    expect(metadata.lastModified).toBeUndefined();
  });
});
