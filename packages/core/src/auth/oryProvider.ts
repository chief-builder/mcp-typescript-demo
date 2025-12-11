/**
 * Ory Hydra Provider Integration
 *
 * Provides integration with Ory Hydra / Ory Network for MCP authorization.
 * This is the recommended auth provider for MCP per MCP 2025-11-25 spec.
 *
 * Features:
 * - OAuth 2.1 Authorization Code Flow with PKCE
 * - Client registration (CIMD or DCR)
 * - Token introspection and validation
 * - Protected Resource Metadata (RFC 9728)
 *
 * @see https://www.ory.sh/hydra/
 * @see https://www.npmjs.com/package/@ory/mcp-oauth-provider
 */

import {
  AuthorizationServerMetadata,
  TokenResponse,
  TokenIntrospectionResponse,
  PKCEPair,
  AuthError,
} from './types.js';
import { generatePKCE } from './pkce.js';
import { fetchAuthorizationServerMetadata } from './discovery.js';

/**
 * Ory Provider Type
 */
export type OryProviderType = 'hydra' | 'network';

/**
 * Ory Provider Configuration
 */
export interface OryProviderConfig {
  /** Provider type: 'hydra' for self-hosted, 'network' for Ory Network */
  providerType: OryProviderType;

  // Ory Network configuration
  /** Ory Network project URL (e.g., https://your-project.projects.oryapis.com) */
  networkProjectUrl?: string;
  /** Ory Network API key */
  networkProjectApiKey?: string;

  // Ory Hydra configuration
  /** Hydra public URL (for authorization/token endpoints) */
  hydraPublicUrl?: string;
  /** Hydra admin URL (for introspection/client management) */
  hydraAdminUrl?: string;
  /** Hydra admin API key (if required) */
  hydraApiKey?: string;

  // Client configuration
  /** Client ID (URL for CIMD, string for registered client) */
  clientId: string;
  /** Client secret (for confidential clients) */
  clientSecret?: string;
  /** Redirect URIs */
  redirectUris: string[];
  /** Requested scopes */
  scopes?: string[];
}

/**
 * Authorization state for OAuth flow
 */
export interface AuthorizationState {
  state: string;
  pkce: PKCEPair;
  redirectUri: string;
  nonce?: string;
}

/**
 * Ory Provider for MCP Authorization
 */
export class OryProvider {
  private config: OryProviderConfig;
  private asMetadata: AuthorizationServerMetadata | null = null;

  constructor(config: OryProviderConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * Get the authorization server URL
   */
  get issuer(): string {
    if (this.config.providerType === 'network') {
      return this.config.networkProjectUrl!;
    }
    return this.config.hydraPublicUrl!;
  }

  /**
   * Get the admin URL (for introspection)
   */
  get adminUrl(): string {
    if (this.config.providerType === 'network') {
      return this.config.networkProjectUrl!;
    }
    return this.config.hydraAdminUrl || this.config.hydraPublicUrl!;
  }

  /**
   * Initialize the provider by fetching AS metadata
   */
  async initialize(): Promise<void> {
    this.asMetadata = await fetchAuthorizationServerMetadata(this.issuer);
  }

  /**
   * Get AS metadata (initializes if needed)
   */
  async getMetadata(): Promise<AuthorizationServerMetadata> {
    if (!this.asMetadata) {
      await this.initialize();
    }
    return this.asMetadata!;
  }

  /**
   * Build authorization URL for OAuth flow
   *
   * @param redirectUri - Callback URL
   * @param scopes - Requested scopes
   * @returns Authorization URL and state to verify callback
   */
  async buildAuthorizationUrl(
    redirectUri: string,
    scopes?: string[]
  ): Promise<{ url: string; state: AuthorizationState }> {
    const metadata = await this.getMetadata();

    // Generate PKCE (mandatory per MCP spec)
    const pkce = generatePKCE();

    // Generate state for CSRF protection
    const state = generateRandomState();

    // Generate nonce for ID token validation
    const nonce = generateRandomState();

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      scope: (scopes || this.config.scopes || ['openid']).join(' '),
      state,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
      nonce,
    });

    const url = `${metadata.authorization_endpoint}?${params.toString()}`;

    return {
      url,
      state: {
        state,
        pkce,
        redirectUri,
        nonce,
      },
    };
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from callback
   * @param authState - State from buildAuthorizationUrl
   * @returns Token response
   */
  async exchangeCode(
    code: string,
    authState: AuthorizationState
  ): Promise<TokenResponse> {
    const metadata = await this.getMetadata();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: authState.redirectUri,
      client_id: this.config.clientId,
      code_verifier: authState.pkce.codeVerifier,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    // Add client authentication if we have a secret
    if (this.config.clientSecret) {
      const credentials = Buffer.from(
        `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      throw new AuthError(
        String(data.error_description || data.error || 'Token exchange failed'),
        String(data.error || 'TOKEN_EXCHANGE_FAILED'),
        data
      );
    }

    return {
      access_token: String(data.access_token),
      token_type: (data.token_type as 'Bearer' | 'DPoP') || 'Bearer',
      expires_in: data.expires_in as number | undefined,
      refresh_token: data.refresh_token as string | undefined,
      scope: data.scope as string | undefined,
      id_token: data.id_token as string | undefined,
    };
  }

  /**
   * Refresh an access token
   *
   * @param refreshToken - Refresh token
   * @returns New token response
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const metadata = await this.getMetadata();

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    if (this.config.clientSecret) {
      const credentials = Buffer.from(
        `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      throw new AuthError(
        String(data.error_description || data.error || 'Token refresh failed'),
        String(data.error || 'TOKEN_REFRESH_FAILED'),
        data
      );
    }

    return {
      access_token: String(data.access_token),
      token_type: (data.token_type as 'Bearer' | 'DPoP') || 'Bearer',
      expires_in: data.expires_in as number | undefined,
      refresh_token: data.refresh_token as string | undefined,
      scope: data.scope as string | undefined,
      id_token: data.id_token as string | undefined,
    };
  }

  /**
   * Introspect a token to check validity
   *
   * @param token - Token to introspect
   * @returns Introspection response
   */
  async introspectToken(token: string): Promise<TokenIntrospectionResponse> {
    const metadata = await this.getMetadata();

    if (!metadata.token_introspection_endpoint) {
      throw new AuthError(
        'Token introspection endpoint not available',
        'INTROSPECTION_NOT_SUPPORTED'
      );
    }

    const body = new URLSearchParams({
      token,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    // Admin authentication for introspection
    if (this.config.providerType === 'network' && this.config.networkProjectApiKey) {
      headers['Authorization'] = `Bearer ${this.config.networkProjectApiKey}`;
    } else if (this.config.hydraApiKey) {
      headers['Authorization'] = `Bearer ${this.config.hydraApiKey}`;
    } else if (this.config.clientSecret) {
      const credentials = Buffer.from(
        `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(metadata.token_introspection_endpoint, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      throw new AuthError(
        'Token introspection failed',
        'INTROSPECTION_FAILED'
      );
    }

    return response.json() as Promise<TokenIntrospectionResponse>;
  }

  /**
   * Revoke a token
   *
   * @param token - Token to revoke
   * @param tokenTypeHint - 'access_token' or 'refresh_token'
   */
  async revokeToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token'
  ): Promise<void> {
    const metadata = await this.getMetadata();

    if (!metadata.token_revocation_endpoint) {
      throw new AuthError(
        'Token revocation endpoint not available',
        'REVOCATION_NOT_SUPPORTED'
      );
    }

    const body = new URLSearchParams({ token });
    if (tokenTypeHint) {
      body.set('token_type_hint', tokenTypeHint);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (this.config.clientSecret) {
      const credentials = Buffer.from(
        `${encodeURIComponent(this.config.clientId)}:${encodeURIComponent(this.config.clientSecret)}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(metadata.token_revocation_endpoint, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      throw new AuthError(
        'Token revocation failed',
        'REVOCATION_FAILED'
      );
    }
  }

  /**
   * Validate provider configuration
   */
  private validateConfig(config: OryProviderConfig): void {
    if (config.providerType === 'network') {
      if (!config.networkProjectUrl) {
        throw new AuthError(
          'networkProjectUrl is required for Ory Network provider',
          'CONFIG_INVALID'
        );
      }
    } else if (config.providerType === 'hydra') {
      if (!config.hydraPublicUrl) {
        throw new AuthError(
          'hydraPublicUrl is required for Ory Hydra provider',
          'CONFIG_INVALID'
        );
      }
    }

    if (!config.clientId) {
      throw new AuthError('clientId is required', 'CONFIG_INVALID');
    }

    if (!config.redirectUris || config.redirectUris.length === 0) {
      throw new AuthError('At least one redirectUri is required', 'CONFIG_INVALID');
    }
  }
}

/**
 * Generate cryptographically random state parameter
 */
function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create an Ory provider for Ory Network
 */
export function createOryNetworkProvider(config: {
  projectUrl: string;
  apiKey?: string;
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  scopes?: string[];
}): OryProvider {
  return new OryProvider({
    providerType: 'network',
    networkProjectUrl: config.projectUrl,
    networkProjectApiKey: config.apiKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUris: config.redirectUris,
    scopes: config.scopes,
  });
}

/**
 * Create an Ory provider for self-hosted Hydra
 */
export function createOryHydraProvider(config: {
  publicUrl: string;
  adminUrl?: string;
  apiKey?: string;
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  scopes?: string[];
}): OryProvider {
  return new OryProvider({
    providerType: 'hydra',
    hydraPublicUrl: config.publicUrl,
    hydraAdminUrl: config.adminUrl,
    hydraApiKey: config.apiKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUris: config.redirectUris,
    scopes: config.scopes,
  });
}
