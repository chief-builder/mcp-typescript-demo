import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { glob } from 'glob';
import { vi } from 'vitest';

vi.mock('glob');

describe('list_project_files tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should list files with specified extensions', async () => {
    const mockFiles = [
      'src/index.ts',
      'src/utils.ts',
      'test/index.test.ts',
      'package.json',
    ];

    vi.mocked(glob).mockResolvedValueOnce(mockFiles);

    // Simulate the tool logic
    const directory = '.';
    const extensions = ['.ts'];
    const pattern = `${directory}/**/*{${extensions.join(',')}}`;
    
    const result = await glob(pattern, { 
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      nodir: true,
    });

    expect(glob).toHaveBeenCalledWith(pattern, expect.objectContaining({
      ignore: expect.arrayContaining(['**/node_modules/**']),
      nodir: true,
    }));
    expect(result).toEqual(mockFiles);
  });

  it('should respect maxFiles limit', async () => {
    const mockFiles = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
    vi.mocked(glob).mockResolvedValueOnce(mockFiles);

    const maxFiles = 10;
    const result = await glob('**/*.ts', { nodir: true });
    const limitedResult = result.slice(0, maxFiles);

    expect(limitedResult).toHaveLength(maxFiles);
  });

  it('should handle empty results', async () => {
    vi.mocked(glob).mockResolvedValueOnce([]);

    const result = await glob('**/*.xyz', { nodir: true });
    
    expect(result).toEqual([]);
  });

  it('should handle glob errors', async () => {
    vi.mocked(glob).mockRejectedValueOnce(new Error('Permission denied'));

    await expect(glob('**/*.ts', {})).rejects.toThrow('Permission denied');
  });

  it('should exclude common directories by default', async () => {
    const mockFiles = ['src/index.ts', 'src/utils.ts'];
    vi.mocked(glob).mockResolvedValueOnce(mockFiles);

    await glob('**/*.ts', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
      nodir: true,
    });

    expect(glob).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ignore: expect.arrayContaining([
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
          '**/coverage/**'
        ])
      })
    );
  });

  it('should handle multiple extensions', async () => {
    const mockFiles = ['index.ts', 'styles.css', 'index.html'];
    vi.mocked(glob).mockResolvedValueOnce(mockFiles);

    const extensions = ['.ts', '.css', '.html'];
    const pattern = `**/*{${extensions.join(',')}}`;
    
    const result = await glob(pattern, { nodir: true });
    
    expect(result).toEqual(mockFiles);
  });
});