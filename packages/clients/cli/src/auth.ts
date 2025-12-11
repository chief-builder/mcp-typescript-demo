/**
 * MCP CLI Auth Manager
 *
 * Handles OAuth 2.1 authentication for MCP servers with HTTP transport.
 * Implements the MCP 2025-11-25 authorization spec:
 * - Discovers auth requirements from Protected Resource Metadata
 * - Performs PKCE authorization code flow
 * - Manages token storage and refresh
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import {
  discoverAuthFromMCPServer,
  OryProvider,
  parseWWWAuthenticate,
  type AuthorizationServerMetadata,
  type ProtectedResourceMetadata,
  type AuthorizationState,
} from '@mcp-demo/core';

/**
 * Stored tokens
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType: string;
  scope?: string;
}

/**
 * Auth configuration
 */
export interface CLIAuthConfig {
  /** Callback port for OAuth redirect */
  callbackPort?: number;
  /** Client ID for this CLI */
  clientId?: string;
  /** Scopes to request */
  scopes?: string[];
}

/**
 * CLI Auth Manager
 *
 * Manages OAuth 2.1 authentication for MCP CLI client.
 */
export class CLIAuthManager {
  private tokens: StoredTokens | null = null;
  private oryProvider: OryProvider | null = null;
  private authState: AuthorizationState | null = null;
  private config: Required<CLIAuthConfig>;

  constructor(config: CLIAuthConfig = {}) {
    this.config = {
      callbackPort: config.callbackPort ?? 8085,
      clientId: config.clientId ?? 'cli-client',
      scopes: config.scopes ?? ['openid', 'offline_access', 'mcp:read', 'mcp:write'],
    };
  }

  /**
   * Check if we have valid tokens
   */
  isAuthenticated(): boolean {
    if (!this.tokens) {
      return false;
    }

    // Check if token is expired
    if (this.tokens.expiresAt && Date.now() >= this.tokens.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.tokens?.accessToken ?? null;
  }

  /**
   * Get authorization header value
   */
  getAuthorizationHeader(): string | null {
    const token = this.getAccessToken();
    if (!token) {
      return null;
    }
    return `Bearer ${token}`;
  }

  /**
   * Discover auth requirements from MCP server
   *
   * @param mcpServerUrl - The MCP server URL
   */
  async discover(mcpServerUrl: string): Promise<{
    protectedResource: ProtectedResourceMetadata;
    authorizationServer: AuthorizationServerMetadata;
  }> {
    const spinner = ora('Discovering auth requirements...').start();

    try {
      const result = await discoverAuthFromMCPServer(mcpServerUrl);

      spinner.succeed('Auth requirements discovered');
      console.log(chalk.gray(`  Authorization Server: ${result.authorizationServer.issuer}`));
      console.log(chalk.gray(`  Scopes: ${result.protectedResource.scopes_supported?.join(', ') || 'none'}`));

      return result;
    } catch (error) {
      spinner.fail('Failed to discover auth requirements');
      throw error;
    }
  }

  /**
   * Check if server requires authentication by making an unauthenticated request
   */
  async checkAuthRequired(mcpServerUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${mcpServerUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'auth-check', version: '1.0.0' },
          },
          id: 1,
        }),
      });

      if (response.status === 401) {
        // Check for WWW-Authenticate header
        const wwwAuth = response.headers.get('WWW-Authenticate');
        if (wwwAuth) {
          const challenge = parseWWWAuthenticate(wwwAuth);
          if (challenge) {
            console.log(chalk.yellow('Server requires authentication'));
            console.log(chalk.gray(`  Resource Metadata: ${challenge.resource_metadata}`));
            return true;
          }
        }
        return true;
      }

      return false;
    } catch {
      // If we can't connect, assume no auth required (or server is down)
      return false;
    }
  }

  /**
   * Perform full OAuth authorization flow
   *
   * @param mcpServerUrl - The MCP server URL
   */
  async authenticate(mcpServerUrl: string): Promise<StoredTokens> {
    // Step 1: Discover auth requirements
    const { authorizationServer, protectedResource } = await this.discover(mcpServerUrl);

    // Step 2: Initialize Ory provider
    const redirectUri = `http://localhost:${this.config.callbackPort}/callback`;
    const scopes = [
      ...this.config.scopes,
      ...(protectedResource.scopes_supported || []),
    ].filter((v, i, a) => a.indexOf(v) === i); // Dedupe

    this.oryProvider = new OryProvider({
      providerType: 'hydra',
      hydraPublicUrl: authorizationServer.issuer,
      clientId: this.config.clientId,
      redirectUris: [redirectUri],
      scopes,
    });

    // Step 3: Build authorization URL (includes PKCE generation)
    const { url: authUrl, state } = await this.oryProvider.buildAuthorizationUrl(redirectUri, scopes);
    this.authState = state;

    console.log(chalk.blue('\nStarting OAuth authorization flow...'));
    console.log(chalk.gray(`Authorization URL: ${authUrl}\n`));

    // Step 4: Start callback server and open browser
    const code = await this.waitForAuthorizationCode(authUrl);

    // Step 5: Exchange code for tokens
    const spinner = ora('Exchanging authorization code for tokens...').start();

    try {
      if (!this.authState) {
        throw new Error('Auth state not available');
      }

      const tokenResponse = await this.oryProvider.exchangeCode(code, this.authState);

      this.tokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_in
          ? Date.now() + tokenResponse.expires_in * 1000
          : undefined,
        tokenType: 'Bearer',
        scope: scopes.join(' '),
      };

      spinner.succeed('Authentication successful!');
      return this.tokens;
    } catch (error) {
      spinner.fail('Failed to exchange authorization code');
      throw error;
    }
  }

  /**
   * Wait for authorization code via callback server
   */
  private waitForAuthorizationCode(authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '/', `http://localhost:${this.config.callbackPort}`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          const errorDescription = url.searchParams.get('error_description');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1 style="color: #dc3545;">Authorization Failed</h1>
                  <p>${error}: ${errorDescription || 'Unknown error'}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            server.close();
            reject(new Error(`Authorization failed: ${error} - ${errorDescription}`));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1 style="color: #28a745;">Authorization Successful!</h1>
                  <p>You can close this window and return to the CLI.</p>
                </body>
              </html>
            `);
            server.close();
            resolve(code);
            return;
          }

          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing authorization code');
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      });

      server.listen(this.config.callbackPort, () => {
        console.log(chalk.gray(`Callback server listening on port ${this.config.callbackPort}`));
        console.log(chalk.yellow('\nPlease open this URL in your browser to authenticate:'));
        console.log(chalk.cyan(authUrl));
        console.log(chalk.gray('\nWaiting for authorization callback...'));
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authorization timed out after 5 minutes'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Refresh the access token
   */
  async refreshTokens(): Promise<StoredTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (!this.oryProvider) {
      throw new Error('Not initialized - call authenticate first');
    }

    const spinner = ora('Refreshing access token...').start();

    try {
      const tokenResponse = await this.oryProvider.refreshToken(this.tokens.refreshToken);

      this.tokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || this.tokens.refreshToken,
        expiresAt: tokenResponse.expires_in
          ? Date.now() + tokenResponse.expires_in * 1000
          : undefined,
        tokenType: 'Bearer',
        scope: this.tokens.scope,
      };

      spinner.succeed('Token refreshed');
      return this.tokens;
    } catch (error) {
      spinner.fail('Failed to refresh token');
      this.tokens = null;
      throw error;
    }
  }

  /**
   * Clear stored tokens (logout)
   */
  logout(): void {
    this.tokens = null;
    this.oryProvider = null;
    this.authState = null;
    console.log(chalk.green('Logged out successfully'));
  }

  /**
   * Make an authenticated fetch request
   */
  async authenticatedFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Ensure we're authenticated
    if (!this.isAuthenticated()) {
      // Try to refresh if we have a refresh token
      if (this.tokens?.refreshToken) {
        await this.refreshTokens();
      } else {
        throw new Error('Not authenticated');
      }
    }

    const authHeader = this.getAuthorizationHeader();
    if (!authHeader) {
      throw new Error('No access token available');
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', authHeader);

    return fetch(url, {
      ...options,
      headers,
    });
  }
}

/**
 * Create a pre-configured auth manager
 */
export function createAuthManager(config?: CLIAuthConfig): CLIAuthManager {
  return new CLIAuthManager(config);
}
