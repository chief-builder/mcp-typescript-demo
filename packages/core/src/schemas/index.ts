import { z } from 'zod';

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

// Common tool parameter schemas
export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional()
});

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

// Common response schemas
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema
  });

// Progress tracking schema
export const progressUpdateSchema = z.object({
  taskId: z.string(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  eta: z.string().datetime().optional()
});