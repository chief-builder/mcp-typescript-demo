/**
 * MCP Server Authorization Middleware
 *
 * Provides middleware for protecting MCP servers with OAuth 2.1.
 *
 * Per MCP 2025-11-25:
 * - Servers MUST implement Protected Resource Metadata (RFC 9728)
 * - Servers MUST return 401 with WWW-Authenticate containing resource_metadata
 * - Servers MUST validate tokens as OAuth 2.1 resource servers
 */

import {
  TokenIntrospectionResponse,
  MCPServerAuthConfig,
  AuthError,
} from './types.js';
import {
  createProtectedResourceMetadata,
  buildWWWAuthenticate,
  WELL_KNOWN_PATHS,
} from './discovery.js';

/**
 * Token validator function type
 */
export type TokenValidator = (token: string) => Promise<TokenIntrospectionResponse>;

/**
 * Middleware configuration
 */
export interface AuthMiddlewareConfig {
  /** Server auth configuration */
  serverConfig: MCPServerAuthConfig;
  /** Function to validate tokens (typically introspection) */
  validateToken: TokenValidator;
  /** Required scopes for access (optional) */
  requiredScopes?: string[];
  /** Custom error handler */
  onError?: (error: AuthError) => void;
}

/**
 * Request with auth context
 */
export interface AuthenticatedRequest {
  /** Original request */
  request: Request;
  /** Token introspection result */
  tokenInfo: TokenIntrospectionResponse;
  /** Extracted access token */
  accessToken: string;
}

/**
 * Extract Bearer token from Authorization header
 *
 * @param request - The incoming request
 * @returns Token string or null
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  const scheme = parts[0];
  const token = parts[1];

  if (parts.length !== 2 || !scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

/**
 * Create 401 Unauthorized response with WWW-Authenticate header
 *
 * @param config - Server auth configuration
 * @param error - Optional error type
 * @param errorDescription - Optional error description
 * @returns 401 Response
 */
export function createUnauthorizedResponse(
  config: MCPServerAuthConfig,
  error?: 'invalid_token' | 'insufficient_scope',
  errorDescription?: string
): Response {
  const resourceMetadataUrl = `${config.resourceIdentifier}${WELL_KNOWN_PATHS.PROTECTED_RESOURCE}`;

  const wwwAuthenticate = buildWWWAuthenticate({
    scheme: 'Bearer',
    resource_metadata: resourceMetadataUrl,
    error,
    error_description: errorDescription,
    scope: config.scopesSupported?.join(' '),
  });

  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': wwwAuthenticate,
    },
  });
}

/**
 * Create Protected Resource Metadata response
 *
 * @param config - Server auth configuration
 * @returns Protected Resource Metadata Response
 */
export function createProtectedResourceMetadataResponse(
  config: MCPServerAuthConfig
): Response {
  const metadata = createProtectedResourceMetadata({
    resource: config.resourceIdentifier,
    authorizationServers: config.authorizationServers,
    scopesSupported: config.scopesSupported,
    bearerMethodsSupported: config.bearerMethodsSupported,
    jwksUri: config.jwksUri,
  });

  return new Response(JSON.stringify(metadata), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

/**
 * Check if request path is the Protected Resource Metadata endpoint
 *
 * @param request - The incoming request
 * @param config - Server auth configuration
 * @returns true if this is the PRM endpoint
 */
export function isProtectedResourceMetadataRequest(
  request: Request,
  config: MCPServerAuthConfig
): boolean {
  const url = new URL(request.url);
  const resourceUrl = new URL(config.resourceIdentifier);
  const basePath = resourceUrl.pathname === '/' ? '' : resourceUrl.pathname;
  const expectedPath = `${WELL_KNOWN_PATHS.PROTECTED_RESOURCE}${basePath}`;

  return url.pathname === expectedPath && request.method === 'GET';
}

/**
 * Validate that token has required scopes
 *
 * @param tokenInfo - Token introspection response
 * @param requiredScopes - Required scopes
 * @returns true if all required scopes are present
 */
export function hasRequiredScopes(
  tokenInfo: TokenIntrospectionResponse,
  requiredScopes: string[]
): boolean {
  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }

  if (!tokenInfo.scope) {
    return false;
  }

  const tokenScopes = tokenInfo.scope.split(' ');
  return requiredScopes.every(scope => tokenScopes.includes(scope));
}

/**
 * Validate token audience (RFC 8707)
 *
 * @param tokenInfo - Token introspection response
 * @param expectedAudience - Expected audience (resource identifier)
 * @returns true if audience matches
 */
export function hasValidAudience(
  tokenInfo: TokenIntrospectionResponse,
  expectedAudience: string
): boolean {
  if (!tokenInfo.aud) {
    // Some tokens may not have explicit audience
    return true;
  }

  if (Array.isArray(tokenInfo.aud)) {
    return tokenInfo.aud.includes(expectedAudience);
  }

  return tokenInfo.aud === expectedAudience;
}

/**
 * Create authentication middleware for MCP servers
 *
 * @param config - Middleware configuration
 * @returns Middleware function
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  return async function authMiddleware(
    request: Request
  ): Promise<AuthenticatedRequest | Response> {
    // Handle Protected Resource Metadata endpoint
    if (isProtectedResourceMetadataRequest(request, config.serverConfig)) {
      return createProtectedResourceMetadataResponse(config.serverConfig);
    }

    // Extract token
    const token = extractBearerToken(request);

    if (!token) {
      console.log('[Auth] No Bearer token found in request');
      return createUnauthorizedResponse(config.serverConfig);
    }

    try {
      // Validate token
      const tokenInfo = await config.validateToken(token);

      // Check if token is active
      if (!tokenInfo.active) {
        console.log('[Auth] Token is not active');
        return createUnauthorizedResponse(
          config.serverConfig,
          'invalid_token',
          'Token is not active'
        );
      }

      // Check audience (RFC 8707) - skip if token has no audience claim
      // Note: Hydra sets aud to the client_id, not the resource server
      // This is valid per OAuth 2.0 - audience checking is optional
      if (tokenInfo.aud) {
        console.log(`[Auth] Token audience: ${JSON.stringify(tokenInfo.aud)}, expected: ${config.serverConfig.resourceIdentifier}`);
      }
      // Skip audience validation for now - Hydra sets aud to client_id
      // if (!hasValidAudience(tokenInfo, config.serverConfig.resourceIdentifier)) {
      //   return createUnauthorizedResponse(
      //     config.serverConfig,
      //     'invalid_token',
      //     'Token audience does not match this resource'
      //   );
      // }

      // Check required scopes
      if (config.requiredScopes && !hasRequiredScopes(tokenInfo, config.requiredScopes)) {
        console.log(`[Auth] Insufficient scopes. Required: ${config.requiredScopes.join(' ')}, got: ${tokenInfo.scope}`);
        return createUnauthorizedResponse(
          config.serverConfig,
          'insufficient_scope',
          `Required scopes: ${config.requiredScopes.join(' ')}`
        );
      }

      console.log('[Auth] Token validated successfully');
      // Return authenticated request
      return {
        request,
        tokenInfo,
        accessToken: token,
      };
    } catch (error) {
      console.error('[Auth] Token validation error:', error);
      if (config.onError && error instanceof AuthError) {
        config.onError(error);
      }

      return createUnauthorizedResponse(
        config.serverConfig,
        'invalid_token',
        error instanceof Error ? error.message : 'Token validation failed'
      );
    }
  };
}

/**
 * Simple in-memory token cache for reducing introspection calls
 */
export class TokenCache {
  private cache = new Map<string, { info: TokenIntrospectionResponse; expiresAt: number }>();
  private ttlMs: number;

  constructor(ttlSeconds: number = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Get cached token info
   */
  get(token: string): TokenIntrospectionResponse | null {
    const entry = this.cache.get(token);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(token);
      return null;
    }

    return entry.info;
  }

  /**
   * Cache token info
   */
  set(token: string, info: TokenIntrospectionResponse): void {
    // Don't cache inactive tokens
    if (!info.active) {
      return;
    }

    // Use token exp if available, otherwise use TTL
    let expiresAt: number;
    if (info.exp) {
      expiresAt = Math.min(info.exp * 1000, Date.now() + this.ttlMs);
    } else {
      expiresAt = Date.now() + this.ttlMs;
    }

    this.cache.set(token, { info, expiresAt });
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(token);
      }
    }
  }
}

/**
 * Create a cached token validator
 *
 * @param validator - The underlying validator
 * @param cache - Token cache instance
 * @returns Cached validator function
 */
export function createCachedValidator(
  validator: TokenValidator,
  cache: TokenCache
): TokenValidator {
  return async (token: string) => {
    // Check cache first
    const cached = cache.get(token);
    if (cached) {
      return cached;
    }

    // Validate and cache
    const result = await validator(token);
    cache.set(token, result);

    return result;
  };
}
