/**
 * MCP HTTP Client with OAuth Support
 *
 * Provides HTTP/SSE transport for MCP servers with OAuth 2.1 authentication.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import chalk from 'chalk';
import ora from 'ora';
import { CLIAuthManager } from './auth.js';

export interface HTTPServerConfig {
  name: string;
  url: string;
  description?: string;
  requiresAuth?: boolean;
  scopes?: string[];
}

/**
 * MCP HTTP Client with OAuth support
 */
export class MCPHTTPClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private authManager: CLIAuthManager;
  private currentServer: HTTPServerConfig | null = null;

  constructor(authConfig?: { callbackPort?: number; clientId?: string }) {
    this.authManager = new CLIAuthManager({
      callbackPort: authConfig?.callbackPort ?? 8085,
      clientId: authConfig?.clientId ?? 'cli-client',
    });
  }

  /**
   * Connect to an HTTP MCP server
   */
  async connect(serverConfig: HTTPServerConfig): Promise<void> {
    const spinner = ora(`Connecting to ${serverConfig.name}...`).start();

    try {
      // Check if server requires auth
      const requiresAuth = serverConfig.requiresAuth ??
        await this.authManager.checkAuthRequired(serverConfig.url);

      if (requiresAuth) {
        spinner.text = 'Server requires authentication...';

        // Check if we already have valid tokens
        if (!this.authManager.isAuthenticated()) {
          spinner.stop();
          console.log(chalk.yellow('\nServer requires authentication.'));

          // Perform OAuth flow
          await this.authManager.authenticate(serverConfig.url);
        }

        spinner.start('Connecting with authentication...');
      }

      // Create transport with auth headers if needed
      const url = new URL(`${serverConfig.url}/mcp`);

      // Create custom fetch that includes auth
      const authFetch = this.createAuthenticatedFetch();

      this.transport = new StreamableHTTPClientTransport(url, {
        fetch: authFetch,
      });

      // Create client
      this.client = new Client({
        name: 'mcp-cli',
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      // Connect
      await this.client.connect(this.transport);
      this.currentServer = serverConfig;

      spinner.succeed(`Connected to ${serverConfig.name}${requiresAuth ? ' (authenticated)' : ''}`);
    } catch (error) {
      spinner.fail(`Failed to connect to ${serverConfig.name}`);
      throw error;
    }
  }

  /**
   * Create a fetch function that includes auth headers
   */
  private createAuthenticatedFetch(): typeof fetch {
    const authManager = this.authManager;

    return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);

      // Add Accept header for SSE
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json, text/event-stream');
      }

      // Add auth header if we have tokens
      const authHeader = authManager.getAuthorizationHeader();
      if (authHeader) {
        headers.set('Authorization', authHeader);
      }

      const response = await fetch(input, {
        ...init,
        headers,
      });

      // If we get 401, try to refresh token and retry
      if (response.status === 401 && authManager.isAuthenticated()) {
        try {
          await authManager.refreshTokens();
          const newAuthHeader = authManager.getAuthorizationHeader();
          if (newAuthHeader) {
            headers.set('Authorization', newAuthHeader);
          }
          return fetch(input, { ...init, headers });
        } catch {
          // Refresh failed, return original 401
        }
      }

      return response;
    };
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    this.transport = null;
    this.currentServer = null;
  }

  /**
   * Get the underlying MCP client
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Get current server config
   */
  getCurrentServer(): HTTPServerConfig | null {
    return this.currentServer;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Get auth manager for manual auth operations
   */
  getAuthManager(): CLIAuthManager {
    return this.authManager;
  }

  /**
   * List tools from the server
   */
  async listTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora('Fetching tools...').start();

    try {
      const response = await this.client.listTools();
      spinner.stop();

      if (!response.tools || response.tools.length === 0) {
        console.log(chalk.yellow('No tools available on this server.'));
        return;
      }

      console.log(chalk.blue.bold('\nAvailable Tools:'));
      for (const tool of response.tools) {
        console.log(`  ${chalk.green(tool.name)}: ${tool.description || 'No description'}`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch tools');
      throw error;
    }
  }

  /**
   * List resources from the server
   */
  async listResources(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora('Fetching resources...').start();

    try {
      const response = await this.client.listResources();
      spinner.stop();

      if (!response.resources || response.resources.length === 0) {
        console.log(chalk.yellow('No resources available on this server.'));
        return;
      }

      console.log(chalk.blue.bold('\nAvailable Resources:'));
      for (const resource of response.resources) {
        console.log(`  ${chalk.cyan(resource.uri)}: ${resource.description || 'No description'}`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch resources');
      throw error;
    }
  }

  /**
   * List prompts from the server
   */
  async listPrompts(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora('Fetching prompts...').start();

    try {
      const response = await this.client.listPrompts();
      spinner.stop();

      if (!response.prompts || response.prompts.length === 0) {
        console.log(chalk.yellow('No prompts available on this server.'));
        return;
      }

      console.log(chalk.blue.bold('\nAvailable Prompts:'));
      for (const prompt of response.prompts) {
        console.log(`  ${chalk.green(prompt.name)}: ${prompt.description || 'No description'}`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch prompts');
      throw error;
    }
  }

  /**
   * Call a tool
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora(`Calling tool: ${toolName}...`).start();

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      spinner.stop();

      console.log(chalk.blue.bold(`\nTool Result: ${toolName}`));

      if (response.content && Array.isArray(response.content)) {
        for (const item of response.content) {
          if (item.type === 'text') {
            console.log(item.text);
          }
        }
      }

      if (response.isError) {
        console.log(chalk.red('⚠️  Tool execution resulted in an error'));
      }

      return response;
    } catch (error) {
      spinner.fail(`Failed to call tool: ${toolName}`);
      throw error;
    }
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<unknown> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora(`Reading resource: ${uri}...`).start();

    try {
      const response = await this.client.readResource({ uri });
      spinner.stop();

      console.log(chalk.blue.bold(`\nResource: ${uri}`));

      if (response.contents) {
        for (const content of response.contents) {
          console.log('\n' + '='.repeat(50));
          if ('text' in content && content.text) {
            console.log(content.text);
          } else if ('blob' in content && content.blob) {
            console.log(chalk.gray('Binary content (blob)'));
          }
        }
      }

      return response;
    } catch (error) {
      spinner.fail(`Failed to read resource: ${uri}`);
      throw error;
    }
  }
}

/**
 * Create a pre-configured HTTP client
 */
export function createHTTPClient(config?: {
  callbackPort?: number;
  clientId?: string;
}): MCPHTTPClient {
  return new MCPHTTPClient(config);
}
