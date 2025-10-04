import { MCPError, Result } from '../types/index.js';

// Safe error handling wrapper
export async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof MCPError 
        ? error 
        : new MCPError(
            error instanceof Error ? error.message : 'Unknown error',
            'UNKNOWN_ERROR',
            error
          )
    };
  }
}

// Logger utility
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export class Logger {
  constructor(private name: string) {}

  private log(level: LogLevel, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      logger: this.name,
      message,
    };
    
    if (data) {
      (logEntry as any).data = data;
    }
    
    console.error(JSON.stringify(logEntry));
  }

  debug(message: string, data?: unknown) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: unknown) {
    this.log(LogLevel.ERROR, message, error);
  }
}

// Path utilities
export function normalizeUri(uri: string): string {
  // Ensure consistent URI format
  return uri.replace(/\\/g, '/').replace(/\/+/g, '/');
}

// Session ID generator
export function generateSessionId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Creates a standardized error response for MCP tools
 * Ensures consistent error handling across all servers
 */
export function createErrorResponse(error: unknown, context?: string) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;
  
  return {
    content: [
      {
        type: 'text' as const,
        text: fullMessage,
      },
    ],
    isError: true,
  };
}

/**
 * Creates a standardized success response for MCP tools
 * Ensures consistent response format across all servers
 */
export function createSuccessResponse(text: string, metadata?: Record<string, any>) {
  const response: any = {
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
  
  if (metadata) {
    response.metadata = metadata;
  }
  
  return response;
}