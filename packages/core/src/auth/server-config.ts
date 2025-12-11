/**
 * MCP Server Auth Configuration Helper
 *
 * Provides easy integration of OAuth 2.1 authorization into MCP servers.
 * Each server just needs ~10 lines of configuration code.
 *
 * Usage:
 * ```typescript
 * import { createMCPServerAuth } from '@mcp-demo/core';
 *
 * const auth = createMCPServerAuth({
 *   resourceUrl: 'http://localhost:3002',
 *   authServerUrl: 'http://localhost:4444',
 *   introspectionEndpoint: 'http://localhost:4445/admin/oauth2/introspect',
 *   clientId: 'analytics-server',
 *   clientSecret: 'analytics-server-secret',
 *   requiredScopes: ['analytics:read'],
 * });
 *
 * // Add to Express app
 * auth.setupExpress(app);
 * ```
 */

import {
  MCPServerAuthConfig,
  TokenIntrospectionResponse,
} from './types.js';
import {
  createAuthMiddleware,
  TokenCache,
  createCachedValidator,
  TokenValidator,
  AuthMiddlewareConfig,
  AuthenticatedRequest,
} from './middleware.js';
import { createProtectedResourceMetadata, WELL_KNOWN_PATHS } from './discovery.js';

/**
 * Generic Express-like request interface
 */
interface ExpressRequest {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Generic Express-like response interface
 */
interface ExpressResponse {
  status(code: number): ExpressResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

/**
 * Generic Express-like app interface
 */
interface ExpressApp {
  get(path: string, handler: (req: ExpressRequest, res: ExpressResponse) => void): void;
  use(path: string, handler: (req: ExpressRequest, res: ExpressResponse, next: () => void) => void | Promise<void>): void;
}

/**
 * Express request with auth info attached
 */
export interface AuthenticatedExpressRequest extends ExpressRequest {
  auth?: {
    tokenInfo: TokenIntrospectionResponse;
    accessToken: string;
  };
}

/**
 * Configuration for MCP server auth setup
 */
export interface MCPServerAuthSetupConfig {
  /** This server's public URL (resource identifier) */
  resourceUrl: string;
  /** Authorization server URL (Ory Hydra public endpoint) */
  authServerUrl: string;
  /** Token introspection endpoint (Ory Hydra admin endpoint) */
  introspectionEndpoint: string;
  /** Client ID for introspection authentication */
  clientId: string;
  /** Client secret for introspection authentication */
  clientSecret: string;
  /** Scopes required for access (optional) */
  requiredScopes?: string[];
  /** Scopes this server supports (for PRM) */
  scopesSupported?: string[];
  /** Cache TTL in seconds (default: 60) */
  cacheTtlSeconds?: number;
  /** Enable/disable auth (for development) */
  enabled?: boolean;
}

/**
 * Result of createMCPServerAuth
 */
export interface MCPServerAuthSetup {
  /** Server auth configuration */
  config: MCPServerAuthConfig;
  /** Protected Resource Metadata document */
  protectedResourceMetadata: ReturnType<typeof createProtectedResourceMetadata>;
  /** Express middleware for protecting routes */
  expressMiddleware: (req: ExpressRequest, res: ExpressResponse, next: () => void) => Promise<void>;
  /** Setup Express app with PRM endpoint and auth middleware */
  setupExpress: (app: ExpressApp, mcpPath?: string) => void;
  /** Token validator function */
  validateToken: TokenValidator;
  /** Token cache for manual management */
  tokenCache: TokenCache;
  /** Whether auth is enabled */
  enabled: boolean;
}

/**
 * Create token introspection validator for Ory Hydra
 */
function createOryIntrospectionValidator(
  introspectionEndpoint: string,
  clientId: string,
  clientSecret: string
): TokenValidator {
  return async (token: string): Promise<TokenIntrospectionResponse> => {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(introspectionEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({ token }),
    });

    if (!response.ok) {
      throw new Error(`Introspection failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    return {
      active: Boolean(data.active),
      scope: data.scope as string | undefined,
      client_id: data.client_id as string | undefined,
      username: data.username as string | undefined,
      token_type: data.token_type as string | undefined,
      exp: data.exp as number | undefined,
      iat: data.iat as number | undefined,
      nbf: data.nbf as number | undefined,
      sub: data.sub as string | undefined,
      aud: data.aud as string | string[] | undefined,
      iss: data.iss as string | undefined,
      jti: data.jti as string | undefined,
    };
  };
}

/**
 * Type guard to check if result is an authenticated request
 */
function isAuthenticatedRequest(result: AuthenticatedRequest | Response): result is AuthenticatedRequest {
  return 'tokenInfo' in result && 'accessToken' in result;
}

/**
 * Create MCP server auth setup
 *
 * @param setupConfig - Server auth configuration
 * @returns Auth setup with middleware and helpers
 */
export function createMCPServerAuth(
  setupConfig: MCPServerAuthSetupConfig
): MCPServerAuthSetup {
  const enabled = setupConfig.enabled ?? true;

  // Build server auth config
  const config: MCPServerAuthConfig = {
    resourceIdentifier: setupConfig.resourceUrl,
    authorizationServers: [setupConfig.authServerUrl],
    scopesSupported: setupConfig.scopesSupported ?? setupConfig.requiredScopes,
    bearerMethodsSupported: ['header'],
  };

  // Create Protected Resource Metadata
  const protectedResourceMetadata = createProtectedResourceMetadata({
    resource: config.resourceIdentifier,
    authorizationServers: config.authorizationServers,
    scopesSupported: config.scopesSupported,
  });

  // Create token cache and validator
  const tokenCache = new TokenCache(setupConfig.cacheTtlSeconds ?? 60);
  const baseValidator = createOryIntrospectionValidator(
    setupConfig.introspectionEndpoint,
    setupConfig.clientId,
    setupConfig.clientSecret
  );
  const validateToken = createCachedValidator(baseValidator, tokenCache);

  // Create auth middleware config
  const middlewareConfig: AuthMiddlewareConfig = {
    serverConfig: config,
    validateToken,
    requiredScopes: setupConfig.requiredScopes,
  };

  // Create the core middleware
  const coreMiddleware = createAuthMiddleware(middlewareConfig);

  /**
   * Express middleware adapter
   */
  async function expressMiddleware(
    req: ExpressRequest,
    res: ExpressResponse,
    next: () => void
  ): Promise<void> {
    // Skip auth if disabled
    if (!enabled) {
      next();
      return;
    }

    // Convert Express request to Fetch Request
    const url = `${setupConfig.resourceUrl}${req.path}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    const fetchRequest = new Request(url, {
      method: req.method,
      headers,
    });

    // Run auth middleware
    const result = await coreMiddleware(fetchRequest);

    // Check if result is an error Response (not AuthenticatedRequest)
    if (!isAuthenticatedRequest(result)) {
      // It's a Response - extract status and headers
      res.status(result.status);
      result.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value);
      });
      const body = await result.json() as Record<string, unknown>;
      res.json(body);
      return;
    }

    // Auth succeeded - attach token info to request and continue
    (req as AuthenticatedExpressRequest).auth = {
      tokenInfo: result.tokenInfo,
      accessToken: result.accessToken,
    };

    next();
  }

  /**
   * Setup Express app with auth
   */
  function setupExpress(app: ExpressApp, mcpPath: string = '/mcp'): void {
    // Add Protected Resource Metadata endpoint
    const prmPath = WELL_KNOWN_PATHS.PROTECTED_RESOURCE;
    app.get(prmPath, (_req: ExpressRequest, res: ExpressResponse) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(protectedResourceMetadata);
    });

    // Add auth middleware to MCP path
    if (enabled) {
      app.use(mcpPath, expressMiddleware);
    }

    console.log(`[Auth] Protected Resource Metadata: ${setupConfig.resourceUrl}${prmPath}`);
    console.log(`[Auth] Authorization Server: ${setupConfig.authServerUrl}`);
    console.log(`[Auth] Auth ${enabled ? 'enabled' : 'disabled'} for ${mcpPath}`);
  }

  return {
    config,
    protectedResourceMetadata,
    expressMiddleware,
    setupExpress,
    validateToken,
    tokenCache,
    enabled,
  };
}

/**
 * Create auth setup from environment variables
 *
 * Environment variables:
 * - AUTH_ENABLED: Enable/disable auth (default: true)
 * - RESOURCE_URL: This server's public URL
 * - AUTH_SERVER_URL: Authorization server URL
 * - INTROSPECTION_URL: Token introspection endpoint
 * - AUTH_CLIENT_ID: Client ID for introspection
 * - AUTH_CLIENT_SECRET: Client secret for introspection
 * - AUTH_SCOPES: Required scopes (comma-separated)
 * - AUTH_CACHE_TTL: Cache TTL in seconds
 *
 * @param defaults - Default values if env vars not set
 */
export function createMCPServerAuthFromEnv(
  defaults: Partial<MCPServerAuthSetupConfig> & { resourceUrl: string }
): MCPServerAuthSetup {
  const enabled = process.env.AUTH_ENABLED !== 'false';

  return createMCPServerAuth({
    resourceUrl: process.env.RESOURCE_URL || defaults.resourceUrl,
    authServerUrl: process.env.AUTH_SERVER_URL || defaults.authServerUrl || 'http://localhost:4444',
    introspectionEndpoint: process.env.INTROSPECTION_URL || defaults.introspectionEndpoint || 'http://localhost:4445/admin/oauth2/introspect',
    clientId: process.env.AUTH_CLIENT_ID || defaults.clientId || 'mcp-server',
    clientSecret: process.env.AUTH_CLIENT_SECRET || defaults.clientSecret || 'secret',
    requiredScopes: process.env.AUTH_SCOPES?.split(',') || defaults.requiredScopes,
    scopesSupported: defaults.scopesSupported,
    cacheTtlSeconds: Number(process.env.AUTH_CACHE_TTL) || defaults.cacheTtlSeconds,
    enabled,
  });
}
