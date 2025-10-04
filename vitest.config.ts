import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      }
    },
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@mcp-demo/core': path.resolve(__dirname, './packages/core/src'),
    },
  },
});