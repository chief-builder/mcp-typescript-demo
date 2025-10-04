import { describe, it, expect } from 'vitest';
import prettier from 'prettier';
import { createToolResult } from '@mcp-demo/test-utils';

// Mock the actual formatting logic for testing
export async function formatCode(code: string, language: string): Promise<string> {
  const parserMap: Record<string, string> = {
    typescript: 'typescript',
    javascript: 'babel',
    json: 'json',
    css: 'css',
    html: 'html',
    markdown: 'markdown',
  };

  const parser = parserMap[language];
  if (!parser) {
    throw new Error(`Unsupported language: ${language}`);
  }

  return await prettier.format(code, {
    parser,
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    printWidth: 100,
    trailingComma: 'es5',
  });
}

describe('format_code tool', () => {
  it('should format JavaScript code correctly', async () => {
    const input = 'function hello(name){console.log("Hello "+name+"!")}';
    const result = await formatCode(input, 'javascript');
    
    expect(result).toContain('function hello(name)');
    expect(result).toContain('console.log');
    expect(result).toMatch(/{\s+console\.log/); // Check for proper indentation
  });

  it('should format TypeScript code correctly', async () => {
    const input = 'interface User{id:number;name:string}';
    const result = await formatCode(input, 'typescript');
    
    expect(result).toContain('interface User');
    expect(result).toContain('id: number;');
    expect(result).toContain('name: string;');
  });

  it('should format JSON correctly', async () => {
    const input = '{"name":"test","value":123,"nested":{"key":"value"}}';
    const result = await formatCode(input, 'json');
    
    expect(result).toContain('"name": "test"');
    expect(result).toContain('"value": 123');
    expect(result).toMatch(/\n/); // Should have newlines
  });

  it('should throw error for unsupported language', async () => {
    await expect(formatCode('code', 'unknown')).rejects.toThrow('Unsupported language: unknown');
  });

  it('should handle syntax errors gracefully', async () => {
    const invalidJs = 'function hello({]}';
    
    await expect(formatCode(invalidJs, 'javascript')).rejects.toThrow();
  });

  it('should preserve comments in code', async () => {
    const codeWithComments = `
      // This is a comment
      function test() {
        /* Multi-line
           comment */
        return true;
      }
    `;
    
    const result = await formatCode(codeWithComments, 'javascript');
    expect(result).toContain('// This is a comment');
    expect(result).toContain('/* Multi-line');
  });
});