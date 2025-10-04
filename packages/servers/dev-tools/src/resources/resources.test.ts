import { describe, it, expect } from 'vitest';
import { createResourceResult } from '@mcp-demo/test-utils';

describe('dev-tools resources', () => {
  describe('test_reports resource', () => {
    it('should return test execution report', () => {
      const mockReport = {
        timestamp: '2025-09-27T00:00:00Z',
        summary: {
          total: 150,
          passed: 145,
          failed: 3,
          skipped: 2,
          coverage: 87.5
        },
        suites: [
          {
            name: 'Unit Tests',
            tests: 100,
            passed: 97,
            failed: 2,
            skipped: 1,
            duration: 45.3
          },
          {
            name: 'Integration Tests',
            tests: 50,
            passed: 48,
            failed: 1,
            skipped: 1,
            duration: 120.5
          }
        ]
      };

      const result = createResourceResult('devtools://reports/testing', mockReport);
      
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('devtools://reports/testing');
      expect(result.contents[0].mimeType).toBe('application/json');
      expect(JSON.parse(result.contents[0].text)).toEqual(mockReport);
    });
  });

  describe('build_configs resource', () => {
    it('should return build configurations', () => {
      const mockConfig = {
        typescript: {
          target: 'ES2020',
          module: 'ESNext',
          strict: true,
          esModuleInterop: true
        },
        bundler: {
          entryPoints: ['src/index.ts'],
          outdir: 'dist',
          bundle: true,
          minify: true,
          sourcemap: true,
          platform: 'node',
          target: 'node20'
        },
        optimization: {
          treeshake: true,
          sideEffects: false,
          splitChunks: true,
          cacheGroups: {
            vendor: {
              test: /node_modules/,
              name: 'vendor',
              chunks: 'all'
            }
          }
        }
      };

      const result = createResourceResult('devtools://config/build', mockConfig);
      
      expect(result.contents[0].uri).toBe('devtools://config/build');
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.typescript.strict).toBe(true);
      expect(parsed.bundler.minify).toBe(true);
    });
  });

  describe('code_metrics resource', () => {
    it('should return code quality metrics', () => {
      const mockMetrics = {
        timestamp: '2025-09-27T00:00:00Z',
        summary: {
          totalFiles: 42,
          totalLines: 5420,
          totalFunctions: 156,
          totalClasses: 23,
          avgComplexity: 3.2,
          avgMaintainability: 78.5
        },
        byFile: [
          {
            path: 'src/index.ts',
            lines: 250,
            functions: 12,
            complexity: 4.5,
            maintainability: 82.3,
            issues: [
              {
                type: 'complexity',
                line: 145,
                message: 'Function exceeds complexity threshold'
              }
            ]
          }
        ],
        technicalDebt: {
          total: '8.5 hours',
          critical: 2,
          major: 5,
          minor: 12
        }
      };

      const result = createResourceResult('devtools://metrics/code-quality', mockMetrics);
      
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.summary.totalFiles).toBe(42);
      expect(parsed.technicalDebt.total).toBe('8.5 hours');
    });
  });

  describe('project_config resource', () => {
    it('should return project configuration', () => {
      const mockConfig = {
        name: 'mcp-demo',
        version: '1.0.0',
        type: 'module',
        scripts: {
          build: 'tsc',
          test: 'vitest',
          lint: 'eslint .'
        },
        dependencies: {},
        devDependencies: {},
        workspaces: ['packages/*']
      };

      const result = createResourceResult('devtools://config/project', mockConfig);
      
      const parsed = JSON.parse(result.contents[0].text);
      expect(parsed.name).toBe('mcp-demo');
      expect(parsed.workspaces).toContain('packages/*');
    });
  });
});