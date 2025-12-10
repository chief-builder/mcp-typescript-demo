import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  filePathSchema,
  uriSchema,
  paginationSchema,
  programmingLanguageSchema,
  dataFormatSchema,
  cloudProviderSchema,
  errorResponseSchema,
  successResponseSchema,
  progressUpdateSchema,
  taskStatusSchema,
  taskResultSchema,
  toolAnnotationSchema,
  resourceAnnotationSchema
} from './index.js';

describe('filePathSchema', () => {
  it('should accept valid file paths', () => {
    expect(() => filePathSchema.parse('/path/to/file.txt')).not.toThrow();
    expect(() => filePathSchema.parse('relative/path/file.ts')).not.toThrow();
    expect(() => filePathSchema.parse('file.json')).not.toThrow();
  });

  it('should reject paths with directory traversal', () => {
    expect(() => filePathSchema.parse('../parent/file.txt')).toThrow('Path traversal not allowed');
    expect(() => filePathSchema.parse('/path/../file.txt')).toThrow('Path traversal not allowed');
    expect(() => filePathSchema.parse('path/../../file.txt')).toThrow('Path traversal not allowed');
  });

  it('should accept paths with single dots', () => {
    expect(() => filePathSchema.parse('./current/file.txt')).not.toThrow();
    expect(() => filePathSchema.parse('/path/./to/file.txt')).not.toThrow();
  });
});

describe('uriSchema', () => {
  it('should accept valid HTTP URLs', () => {
    expect(() => uriSchema.parse('https://example.com')).not.toThrow();
    expect(() => uriSchema.parse('http://localhost:3000')).not.toThrow();
    expect(() => uriSchema.parse('https://api.example.com/v1/resource')).not.toThrow();
  });

  it('should accept valid file URIs', () => {
    expect(() => uriSchema.parse('file:///path/to/file.txt')).not.toThrow();
    expect(() => uriSchema.parse('file:///home/user/document.pdf')).not.toThrow();
  });

  it('should reject invalid URIs', () => {
    expect(() => uriSchema.parse('not-a-uri')).toThrow();
    // Note: uriSchema uses z.url() OR file:/// regex, so file:// with only 2 slashes
    // still technically passes the url() validation. Test truly invalid format.
    expect(() => uriSchema.parse('')).toThrow();
  });
});

describe('paginationSchema', () => {
  it('should accept valid pagination params', () => {
    const result = paginationSchema.parse({ limit: 10 });
    expect(result.limit).toBe(10);
  });

  it('should use default limit when not provided', () => {
    const result = paginationSchema.parse({});
    expect(result.limit).toBe(20);
  });

  it('should accept cursor parameter', () => {
    const result = paginationSchema.parse({ limit: 10, cursor: 'abc123' });
    expect(result.cursor).toBe('abc123');
  });

  it('should reject limit below minimum', () => {
    expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
    expect(() => paginationSchema.parse({ limit: -1 })).toThrow();
  });

  it('should reject limit above maximum', () => {
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    expect(() => paginationSchema.parse({ limit: 1000 })).toThrow();
  });

  it('should accept limit at boundaries', () => {
    expect(() => paginationSchema.parse({ limit: 1 })).not.toThrow();
    expect(() => paginationSchema.parse({ limit: 100 })).not.toThrow();
  });
});

describe('programmingLanguageSchema', () => {
  const validLanguages = [
    'typescript', 'javascript', 'python', 'rust', 'go',
    'java', 'csharp', 'cpp', 'c', 'html', 'css',
    'sql', 'markdown', 'json', 'yaml', 'toml'
  ];

  it('should accept all valid programming languages', () => {
    for (const lang of validLanguages) {
      expect(() => programmingLanguageSchema.parse(lang)).not.toThrow();
    }
  });

  it('should reject invalid languages', () => {
    expect(() => programmingLanguageSchema.parse('ruby')).toThrow();
    expect(() => programmingLanguageSchema.parse('php')).toThrow();
    expect(() => programmingLanguageSchema.parse('unknown')).toThrow();
  });

  it('should be case-sensitive', () => {
    expect(() => programmingLanguageSchema.parse('TypeScript')).toThrow();
    expect(() => programmingLanguageSchema.parse('PYTHON')).toThrow();
  });
});

describe('dataFormatSchema', () => {
  const validFormats = ['json', 'csv', 'xml', 'yaml', 'parquet', 'avro'];

  it('should accept all valid data formats', () => {
    for (const format of validFormats) {
      expect(() => dataFormatSchema.parse(format)).not.toThrow();
    }
  });

  it('should reject invalid formats', () => {
    expect(() => dataFormatSchema.parse('excel')).toThrow();
    expect(() => dataFormatSchema.parse('txt')).toThrow();
    expect(() => dataFormatSchema.parse('binary')).toThrow();
  });
});

describe('cloudProviderSchema', () => {
  const validProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'linode'];

  it('should accept all valid cloud providers', () => {
    for (const provider of validProviders) {
      expect(() => cloudProviderSchema.parse(provider)).not.toThrow();
    }
  });

  it('should reject invalid providers', () => {
    expect(() => cloudProviderSchema.parse('heroku')).toThrow();
    expect(() => cloudProviderSchema.parse('vultr')).toThrow();
    expect(() => cloudProviderSchema.parse('IBM')).toThrow();
  });
});

describe('errorResponseSchema', () => {
  it('should accept valid error response', () => {
    const response = {
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found'
      }
    };

    expect(() => errorResponseSchema.parse(response)).not.toThrow();
  });

  it('should accept error response with details', () => {
    const response = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email', reason: 'invalid format' }
      }
    };

    const result = errorResponseSchema.parse(response);
    expect(result.error.details).toEqual({ field: 'email', reason: 'invalid format' });
  });

  it('should reject response without code', () => {
    const response = {
      error: {
        message: 'Error message'
      }
    };

    expect(() => errorResponseSchema.parse(response)).toThrow();
  });

  it('should reject response without message', () => {
    const response = {
      error: {
        code: 'ERROR_CODE'
      }
    };

    expect(() => errorResponseSchema.parse(response)).toThrow();
  });
});

describe('successResponseSchema', () => {
  it('should accept valid success response with string data', () => {
    const schema = successResponseSchema(z.string());
    const response = {
      success: true,
      data: 'result'
    };

    const result = schema.parse(response);
    expect(result.success).toBe(true);
    expect(result.data).toBe('result');
  });

  it('should accept valid success response with object data', () => {
    const dataSchema = z.object({
      id: z.number(),
      name: z.string()
    });
    const schema = successResponseSchema(dataSchema);

    const response = {
      success: true,
      data: { id: 1, name: 'test' }
    };

    const result = schema.parse(response);
    expect(result.data).toEqual({ id: 1, name: 'test' });
  });

  it('should reject response with success: false', () => {
    const schema = successResponseSchema(z.string());
    const response = {
      success: false,
      data: 'result'
    };

    expect(() => schema.parse(response)).toThrow();
  });

  it('should reject response with invalid data type', () => {
    const schema = successResponseSchema(z.number());
    const response = {
      success: true,
      data: 'not a number'
    };

    expect(() => schema.parse(response)).toThrow();
  });
});

describe('progressUpdateSchema', () => {
  it('should accept valid progress update', () => {
    const update = {
      taskId: 'task-123',
      progress: 50
    };

    const result = progressUpdateSchema.parse(update);
    expect(result.taskId).toBe('task-123');
    expect(result.progress).toBe(50);
  });

  it('should accept progress update with optional fields', () => {
    const update = {
      taskId: 'task-456',
      progress: 75,
      message: 'Processing...',
      eta: '2025-12-31T23:59:59Z'
    };

    const result = progressUpdateSchema.parse(update);
    expect(result.message).toBe('Processing...');
    expect(result.eta).toBe('2025-12-31T23:59:59Z');
  });

  it('should reject progress below 0', () => {
    const update = {
      taskId: 'task-123',
      progress: -1
    };

    expect(() => progressUpdateSchema.parse(update)).toThrow();
  });

  it('should reject progress above 100', () => {
    const update = {
      taskId: 'task-123',
      progress: 101
    };

    expect(() => progressUpdateSchema.parse(update)).toThrow();
  });

  it('should accept progress at boundaries', () => {
    expect(() => progressUpdateSchema.parse({ taskId: 't1', progress: 0 })).not.toThrow();
    expect(() => progressUpdateSchema.parse({ taskId: 't2', progress: 100 })).not.toThrow();
  });

  it('should reject invalid ETA format', () => {
    const update = {
      taskId: 'task-123',
      progress: 50,
      eta: 'not-a-datetime'
    };

    expect(() => progressUpdateSchema.parse(update)).toThrow();
  });
});

describe('taskStatusSchema', () => {
  it('should accept valid task statuses', () => {
    expect(() => taskStatusSchema.parse('working')).not.toThrow();
    expect(() => taskStatusSchema.parse('input_required')).not.toThrow();
    expect(() => taskStatusSchema.parse('completed')).not.toThrow();
    expect(() => taskStatusSchema.parse('failed')).not.toThrow();
    expect(() => taskStatusSchema.parse('cancelled')).not.toThrow();
  });

  it('should reject invalid task statuses', () => {
    expect(() => taskStatusSchema.parse('pending')).toThrow();
    expect(() => taskStatusSchema.parse('running')).toThrow();
  });
});

describe('taskResultSchema', () => {
  it('should accept valid task result', () => {
    const result = {
      taskId: 'task-123',
      status: 'completed',
      progress: 100
    };

    expect(() => taskResultSchema.parse(result)).not.toThrow();
  });

  it('should accept task result with all fields', () => {
    const result = {
      taskId: 'task-456',
      status: 'failed',
      progress: 50,
      message: 'An error occurred',
      error: 'Connection timeout'
    };

    const parsed = taskResultSchema.parse(result);
    expect(parsed.error).toBe('Connection timeout');
  });

  it('should accept task result with result field', () => {
    const result = {
      taskId: 'task-789',
      status: 'completed',
      result: { data: [1, 2, 3] }
    };

    const parsed = taskResultSchema.parse(result);
    expect(parsed.result).toEqual({ data: [1, 2, 3] });
  });

  it('should allow additional properties (passthrough)', () => {
    const result = {
      taskId: 'task-123',
      status: 'completed',
      customField: 'custom-value'
    };

    const parsed = taskResultSchema.parse(result);
    expect((parsed as any).customField).toBe('custom-value');
  });
});

describe('toolAnnotationSchema', () => {
  it('should accept empty annotations', () => {
    expect(() => toolAnnotationSchema.parse({})).not.toThrow();
  });

  it('should accept full annotations', () => {
    const annotations = {
      title: 'Format Code',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
      requiresConfirmation: false,
      icon: 'data:image/svg+xml;base64,PHN2Zy4uLg=='
    };

    const parsed = toolAnnotationSchema.parse(annotations);
    expect(parsed.title).toBe('Format Code');
    expect(parsed.idempotentHint).toBe(true);
  });

  it('should accept partial annotations', () => {
    const annotations = {
      destructiveHint: true,
      requiresConfirmation: true
    };

    const parsed = toolAnnotationSchema.parse(annotations);
    expect(parsed.destructiveHint).toBe(true);
    expect(parsed.title).toBeUndefined();
  });
});

describe('resourceAnnotationSchema', () => {
  it('should accept empty annotations', () => {
    expect(() => resourceAnnotationSchema.parse({})).not.toThrow();
  });

  it('should accept full annotations', () => {
    const annotations = {
      audience: ['user', 'assistant'],
      priority: 100,
      icon: 'https://example.com/icon.svg'
    };

    const parsed = resourceAnnotationSchema.parse(annotations);
    expect(parsed.audience).toEqual(['user', 'assistant']);
    expect(parsed.priority).toBe(100);
  });

  it('should accept user-only audience', () => {
    const annotations = {
      audience: ['user']
    };

    const parsed = resourceAnnotationSchema.parse(annotations);
    expect(parsed.audience).toEqual(['user']);
  });

  it('should reject invalid audience values', () => {
    const annotations = {
      audience: ['admin']
    };

    expect(() => resourceAnnotationSchema.parse(annotations)).toThrow();
  });
});

describe('passthrough extensibility', () => {
  it('paginationSchema should allow additional properties', () => {
    const pagination = {
      limit: 10,
      cursor: 'abc',
      extraField: 'extra'
    };

    const parsed = paginationSchema.parse(pagination);
    expect((parsed as any).extraField).toBe('extra');
  });

  it('errorResponseSchema should allow additional properties', () => {
    const response = {
      error: {
        code: 'TEST',
        message: 'Test error',
        requestId: 'req-123'
      },
      timestamp: '2025-01-01T00:00:00Z'
    };

    const parsed = errorResponseSchema.parse(response);
    expect((parsed as any).timestamp).toBe('2025-01-01T00:00:00Z');
  });
});
