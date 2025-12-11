/**
 * Client Credentials Flow
 *
 * OAuth 2.1 Client Credentials grant for machine-to-machine (M2M) authentication.
 * Used when no user interaction is required.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.4
 */

import {
  TokenResponse,
  ClientCredentials,
  AuthError,
} from './types.js';

/**
 * Client Credentials configuration
 */
export interface ClientCredentialsConfig {
  /** Token endpoint URL */
  tokenEndpoint: string;
  /** Client ID */
  clientId: string;
  /** Client secret */
  clientSecret: string;
  /** Requested scopes */
  scope?: string;
  /** Resource indicator (RFC 8707) */
  resource?: string;
  /** Audience for the token */
  audience?: string;
}

/**
 * Obtain an access token using client credentials
 *
 * @param config - Client credentials configuration
 * @returns Token response
 */
export async function getClientCredentialsToken(
  config: ClientCredentialsConfig
): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');

  if (config.scope) {
    body.set('scope', config.scope);
  }

  if (config.resource) {
    body.set('resource', config.resource);
  }

  if (config.audience) {
    body.set('audience', config.audience);
  }

  // Use Basic auth for client authentication
  const credentials = Buffer.from(
    `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`
  ).toString('base64');

  try {
    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      throw new AuthError(
        String(data.error_description || data.error || 'Client credentials grant failed'),
        String(data.error || 'CLIENT_CREDENTIALS_FAILED'),
        data
      );
    }

    return {
      access_token: String(data.access_token),
      token_type: (data.token_type as 'Bearer' | 'DPoP') || 'Bearer',
      expires_in: data.expires_in as number | undefined,
      scope: data.scope as string | undefined,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      `Client credentials request failed: ${error}`,
      'CLIENT_CREDENTIALS_FAILED',
      error
    );
  }
}

/**
 * Client Credentials Token Manager
 *
 * Manages token lifecycle with automatic refresh before expiry.
 */
export class ClientCredentialsManager {
  private config: ClientCredentialsConfig;
  private currentToken: TokenResponse | null = null;
  private tokenExpiresAt: number = 0;
  private refreshBuffer: number;

  /**
   * Create a new Client Credentials Manager
   *
   * @param config - Client credentials configuration
   * @param refreshBuffer - Seconds before expiry to refresh (default: 60)
   */
  constructor(config: ClientCredentialsConfig, refreshBuffer: number = 60) {
    this.config = config;
    this.refreshBuffer = refreshBuffer;
  }

  /**
   * Get a valid access token, refreshing if necessary
   *
   * @returns Valid access token
   */
  async getToken(): Promise<string> {
    // Check if current token is still valid
    if (this.currentToken && Date.now() < this.tokenExpiresAt - this.refreshBuffer * 1000) {
      return this.currentToken.access_token;
    }

    // Obtain new token
    this.currentToken = await getClientCredentialsToken(this.config);

    // Calculate expiry time
    if (this.currentToken.expires_in) {
      this.tokenExpiresAt = Date.now() + this.currentToken.expires_in * 1000;
    } else {
      // Default to 1 hour if not specified
      this.tokenExpiresAt = Date.now() + 3600 * 1000;
    }

    return this.currentToken.access_token;
  }

  /**
   * Force refresh the token
   *
   * @returns New access token
   */
  async refresh(): Promise<string> {
    this.currentToken = null;
    this.tokenExpiresAt = 0;
    return this.getToken();
  }

  /**
   * Check if we have a valid token
   *
   * @returns true if token is valid
   */
  isValid(): boolean {
    return this.currentToken !== null && Date.now() < this.tokenExpiresAt - this.refreshBuffer * 1000;
  }

  /**
   * Clear the cached token
   */
  clear(): void {
    this.currentToken = null;
    this.tokenExpiresAt = 0;
  }
}

/**
 * Create authorization header from client credentials
 *
 * @param credentials - Client credentials
 * @returns Authorization header value
 */
export function createBasicAuthHeader(credentials: ClientCredentials): string {
  if (!credentials.clientSecret) {
    throw new AuthError(
      'Client secret is required for Basic authentication',
      'MISSING_CLIENT_SECRET'
    );
  }

  const encoded = Buffer.from(
    `${encodeURIComponent(credentials.clientId)}:${encodeURIComponent(credentials.clientSecret)}`
  ).toString('base64');

  return `Basic ${encoded}`;
}
