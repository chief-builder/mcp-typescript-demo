import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@mcp-demo/core': path.resolve(__dirname, '../../core/src'),
      '@mcp-demo/test-utils': path.resolve(__dirname, '../../test-utils/src'),
    },
  },
});