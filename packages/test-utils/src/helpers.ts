/**
 * Test helpers for MCP servers
 */

import { z } from 'zod';

/**
 * Create a mock tool result
 */
export function createToolResult(content: string | object) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
      }
    ]
  };
}

/**
 * Create a mock resource result
 */
export function createResourceResult(uri: string, content: any, mimeType = 'application/json') {
  return {
    contents: [
      {
        uri,
        mimeType,
        text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
      }
    ]
  };
}

/**
 * Create a mock prompt result
 */
export function createPromptResult(text: string, role: 'user' | 'assistant' = 'user') {
  return {
    messages: [
      {
        role,
        content: {
          type: 'text' as const,
          text
        }
      }
    ]
  };
}

/**
 * Validate tool input against schema
 */
export function validateToolInput(schema: any, input: any): { success: boolean; error?: string } {
  try {
    // If schema is already a Zod schema, use it directly
    if (schema && typeof schema.parse === 'function') {
      schema.parse(input);
    }
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Validation failed'
    };
  }
}

/**
 * Create a test logger that captures log messages
 */
export function createTestLogger() {
  const logs: Array<{ level: string; message: string; data?: any }> = [];
  
  return {
    logs,
    info: (message: string, data?: any) => {
      logs.push({ level: 'info', message, data });
    },
    error: (message: string, data?: any) => {
      logs.push({ level: 'error', message, data });
    },
    warn: (message: string, data?: any) => {
      logs.push({ level: 'warn', message, data });
    },
    debug: (message: string, data?: any) => {
      logs.push({ level: 'debug', message, data });
    },
    clear: () => {
      logs.length = 0;
    }
  };
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();
  
  while (true) {
    const result = await condition();
    if (result) return;
    
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Create a delay for testing
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}