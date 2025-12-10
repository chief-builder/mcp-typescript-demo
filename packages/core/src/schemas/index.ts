import { z } from 'zod';

/**
 * MCP 2025-11-25 JSON Schema 2020-12 Compliant Schemas
 *
 * These schemas use Zod patterns that generate JSON Schema 2020-12 compatible output:
 * - .passthrough() allows additional properties (extensibility)
 * - .catchall() explicitly defines handling of unknown properties
 */

// Common validation schemas

// File path validation
export const filePathSchema = z.string().refine(
  (path) => !path.includes('..'),
  'Path traversal not allowed'
);

// URI validation
export const uriSchema = z.string().url().or(
  z.string().regex(/^file:\/\/\//, 'Must be a valid file URI')
);

// Common tool parameter schemas - uses passthrough for extensibility
export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional()
}).passthrough();

// Code-related schemas
export const programmingLanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'java',
  'csharp',
  'cpp',
  'c',
  'html',
  'css',
  'sql',
  'markdown',
  'json',
  'yaml',
  'toml'
]);

// Data format schemas
export const dataFormatSchema = z.enum([
  'json',
  'csv',
  'xml',
  'yaml',
  'parquet',
  'avro'
]);

// Cloud provider schemas
export const cloudProviderSchema = z.enum([
  'aws',
  'gcp',
  'azure',
  'digitalocean',
  'linode'
]);

// Common response schemas - use passthrough for extensibility
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  }).passthrough()
}).passthrough();

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema
  }).passthrough();

// Progress tracking schema - MCP 2025-11-25 Task progress
export const progressUpdateSchema = z.object({
  taskId: z.string(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  eta: z.string().datetime().optional()
}).passthrough();

// MCP 2025-11-25 Task status schema
export const taskStatusSchema = z.enum([
  'working',
  'input_required',
  'completed',
  'failed',
  'cancelled'
]);

// MCP 2025-11-25 Task result schema
export const taskResultSchema = z.object({
  taskId: z.string(),
  status: taskStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  result: z.unknown().optional(),
  error: z.string().optional()
}).passthrough();

// MCP 2025-11-25 Tool annotation schema
export const toolAnnotationSchema = z.object({
  title: z.string().optional(),
  readOnlyHint: z.boolean().optional(),
  idempotentHint: z.boolean().optional(),
  destructiveHint: z.boolean().optional(),
  requiresConfirmation: z.boolean().optional(),
  icon: z.string().optional()
}).passthrough();

// MCP 2025-11-25 Resource annotation schema
export const resourceAnnotationSchema = z.object({
  audience: z.array(z.enum(['user', 'assistant'])).optional(),
  priority: z.number().optional(),
  icon: z.string().optional()
}).passthrough();