// Remove unused import

// Common server configuration type
export interface ServerConfig {
  name: string;
  version: string;
  description?: string;
  transport?: 'stdio' | 'http';
  httpPort?: number;
}

// Common client configuration type
export interface ClientConfig {
  name: string;
  version: string;
}

// Enhanced error types
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// Common result types
export type Result<T, E = MCPError> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Utility type for async results
export type AsyncResult<T, E = MCPError> = Promise<Result<T, E>>;

// Common resource metadata
export interface ResourceMetadata {
  lastModified?: Date;
  size?: number;
  checksum?: string;
  tags?: string[];
}