/**
 * OAuth 2.0 Discovery Utilities
 *
 * Implements:
 * - Authorization Server Metadata (RFC 8414)
 * - Protected Resource Metadata (RFC 9728) - REQUIRED for MCP servers
 *
 * Per MCP 2025-11-25:
 * - MCP servers MUST implement RFC 9728
 * - MCP servers MUST return 401 with WWW-Authenticate containing resource_metadata URL
 * - MCP clients MUST use Protected Resource Metadata for AS discovery
 */

import {
  AuthorizationServerMetadata,
  ProtectedResourceMetadata,
  WWWAuthenticateChallenge,
  AuthError,
} from './types.js';
import { requireS256Support } from './pkce.js';

/**
 * Well-known endpoint paths
 */
export const WELL_KNOWN_PATHS = {
  OAUTH_AS: '/.well-known/oauth-authorization-server',
  OPENID_CONFIG: '/.well-known/openid-configuration',
  PROTECTED_RESOURCE: '/.well-known/oauth-protected-resource',
} as const;

/**
 * Fetch Authorization Server Metadata
 *
 * @param issuer - The authorization server issuer URL
 * @param options - Fetch options
 * @returns Authorization Server Metadata
 */
export async function fetchAuthorizationServerMetadata(
  issuer: string,
  options?: { timeout?: number }
): Promise<AuthorizationServerMetadata> {
  const timeout = options?.timeout ?? 10000;

  // Try OAuth AS metadata first (RFC 8414), then OIDC discovery
  const urls = [
    `${issuer.replace(/\/$/, '')}${WELL_KNOWN_PATHS.OAUTH_AS}`,
    `${issuer.replace(/\/$/, '')}${WELL_KNOWN_PATHS.OPENID_CONFIG}`,
  ];

  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const metadata = await response.json() as AuthorizationServerMetadata;

        // Validate required fields
        if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) {
          throw new AuthError(
            'Invalid AS metadata: missing required fields',
            'DISCOVERY_INVALID_METADATA'
          );
        }

        // Validate issuer matches
        if (metadata.issuer !== issuer && metadata.issuer !== issuer.replace(/\/$/, '')) {
          throw new AuthError(
            `Issuer mismatch: expected ${issuer}, got ${metadata.issuer}`,
            'DISCOVERY_ISSUER_MISMATCH'
          );
        }

        return metadata;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof AuthError) {
        throw error;
      }
      // Continue to next URL
    }
  }

  throw new AuthError(
    `Failed to fetch AS metadata from ${issuer}: ${lastError?.message}`,
    'DISCOVERY_FAILED',
    lastError
  );
}

/**
 * Fetch Protected Resource Metadata (RFC 9728)
 *
 * MCP servers MUST implement this endpoint.
 *
 * @param resourceUrl - The resource URL (MCP server URL)
 * @param options - Fetch options
 * @returns Protected Resource Metadata
 */
export async function fetchProtectedResourceMetadata(
  resourceUrl: string,
  options?: { timeout?: number }
): Promise<ProtectedResourceMetadata> {
  const timeout = options?.timeout ?? 10000;

  // Determine the well-known path based on resource URL
  // No path: https://api.example.com → /.well-known/oauth-protected-resource
  // With path: https://api.example.com/notes → /.well-known/oauth-protected-resource/notes
  const url = new URL(resourceUrl);
  const basePath = url.pathname === '/' ? '' : url.pathname;
  const metadataUrl = `${url.origin}${WELL_KNOWN_PATHS.PROTECTED_RESOURCE}${basePath}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(metadataUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new AuthError(
        `Protected Resource Metadata request failed: ${response.status}`,
        'DISCOVERY_PRM_FAILED'
      );
    }

    const metadata = await response.json() as ProtectedResourceMetadata;

    // Validate required fields per MCP spec
    if (!metadata.resource) {
      throw new AuthError(
        'Invalid PRM: missing resource field',
        'DISCOVERY_INVALID_PRM'
      );
    }

    // MCP requires authorization_servers field
    if (!metadata.authorization_servers || metadata.authorization_servers.length === 0) {
      throw new AuthError(
        'Invalid PRM: authorization_servers is required for MCP',
        'DISCOVERY_INVALID_PRM'
      );
    }

    return metadata;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      `Failed to fetch Protected Resource Metadata: ${error}`,
      'DISCOVERY_PRM_FAILED',
      error
    );
  }
}

/**
 * Parse WWW-Authenticate header to extract resource_metadata URL
 *
 * Per RFC 9728, 401 responses include:
 * WWW-Authenticate: Bearer resource_metadata="<URL>"
 *
 * @param wwwAuthenticate - The WWW-Authenticate header value
 * @returns Parsed challenge or null if invalid
 */
export function parseWWWAuthenticate(wwwAuthenticate: string): WWWAuthenticateChallenge | null {
  if (!wwwAuthenticate) {
    return null;
  }

  // Check for Bearer scheme
  if (!wwwAuthenticate.toLowerCase().startsWith('bearer')) {
    return null;
  }

  const challenge: WWWAuthenticateChallenge = {
    scheme: 'Bearer',
    resource_metadata: '',
  };

  // Parse key=value pairs
  const params = wwwAuthenticate.substring(6).trim(); // Remove "Bearer "
  const regex = /(\w+)=(?:"([^"]*)"|([^\s,]*))/g;
  let match;

  while ((match = regex.exec(params)) !== null) {
    const keyMatch = match[1];
    const value = match[2] ?? match[3];

    if (!keyMatch || value === undefined) {
      continue;
    }

    const key = keyMatch.toLowerCase();

    switch (key) {
      case 'resource_metadata':
        challenge.resource_metadata = value;
        break;
      case 'realm':
        challenge.realm = value;
        break;
      case 'error':
        challenge.error = value as 'invalid_token' | 'insufficient_scope';
        break;
      case 'error_description':
        challenge.error_description = value;
        break;
      case 'scope':
        challenge.scope = value;
        break;
    }
  }

  // resource_metadata is required per RFC 9728
  if (!challenge.resource_metadata) {
    return null;
  }

  return challenge;
}

/**
 * Build WWW-Authenticate header value
 *
 * @param challenge - The challenge parameters
 * @returns Formatted WWW-Authenticate header value
 */
export function buildWWWAuthenticate(challenge: WWWAuthenticateChallenge): string {
  const parts = ['Bearer'];

  if (challenge.realm) {
    parts.push(`realm="${challenge.realm}"`);
  }

  parts.push(`resource_metadata="${challenge.resource_metadata}"`);

  if (challenge.error) {
    parts.push(`error="${challenge.error}"`);
  }

  if (challenge.error_description) {
    parts.push(`error_description="${challenge.error_description}"`);
  }

  if (challenge.scope) {
    parts.push(`scope="${challenge.scope}"`);
  }

  return parts.join(' ');
}

/**
 * Discover authorization server from an MCP server
 *
 * Implements the MCP discovery flow:
 * 1. Client requests MCP server
 * 2. Server returns 401 with WWW-Authenticate containing resource_metadata
 * 3. Client fetches Protected Resource Metadata
 * 4. Client fetches AS metadata from authorization_servers[0]
 * 5. Client verifies PKCE S256 support
 *
 * @param mcpServerUrl - The MCP server URL
 * @returns AS metadata and PRM
 */
export async function discoverAuthFromMCPServer(
  mcpServerUrl: string
): Promise<{
  protectedResource: ProtectedResourceMetadata;
  authorizationServer: AuthorizationServerMetadata;
}> {
  // Fetch Protected Resource Metadata
  const protectedResource = await fetchProtectedResourceMetadata(mcpServerUrl);

  // Get first authorization server (client can choose per RFC 9728 Section 7.6)
  const asUrl = protectedResource.authorization_servers[0];

  if (!asUrl) {
    throw new AuthError(
      'No authorization server found in Protected Resource Metadata',
      'DISCOVERY_NO_AUTH_SERVER'
    );
  }

  // Fetch AS metadata
  const authorizationServer = await fetchAuthorizationServerMetadata(asUrl);

  // Verify PKCE S256 support (mandatory per MCP spec)
  requireS256Support(authorizationServer.code_challenge_methods_supported);

  return {
    protectedResource,
    authorizationServer,
  };
}

/**
 * Create Protected Resource Metadata for an MCP server
 *
 * @param config - Server configuration
 * @returns Protected Resource Metadata document
 */
export function createProtectedResourceMetadata(config: {
  resource: string;
  authorizationServers: string[];
  scopesSupported?: string[];
  bearerMethodsSupported?: ('header' | 'body' | 'query')[];
  jwksUri?: string;
}): ProtectedResourceMetadata {
  return {
    resource: config.resource,
    authorization_servers: config.authorizationServers,
    bearer_methods_supported: config.bearerMethodsSupported ?? ['header'],
    scopes_supported: config.scopesSupported,
    jwks_uri: config.jwksUri,
  };
}
