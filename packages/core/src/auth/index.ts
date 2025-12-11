/**
 * MCP 2025-11-25 Authorization Module
 *
 * Implements OAuth 2.1 authorization for MCP servers and clients:
 * - Mandatory PKCE (S256 only)
 * - Protected Resource Metadata (RFC 9728)
 * - Client ID Metadata Documents (CIMD)
 * - Token Exchange (RFC 8693)
 * - Ory Hydra/Network Integration
 *
 * @example
 * ```typescript
 * // Generate PKCE pair for OAuth flow
 * import { generatePKCE, requireS256Support } from '@mcp-demo/core';
 *
 * const pkce = generatePKCE();
 * // { codeVerifier: '...', codeChallenge: '...', codeChallengeMethod: 'S256' }
 *
 * // Discover auth from MCP server
 * import { discoverAuthFromMCPServer } from '@mcp-demo/core';
 *
 * const { protectedResource, authorizationServer } = await discoverAuthFromMCPServer(
 *   'https://mcp-server.example.com'
 * );
 *
 * // Create Ory provider
 * import { createOryHydraProvider } from '@mcp-demo/core';
 *
 * const provider = createOryHydraProvider({
 *   publicUrl: 'https://hydra.example.com',
 *   clientId: 'my-client',
 *   redirectUris: ['http://localhost:3000/callback'],
 * });
 * ```
 */

// Types
export type {
  PKCEPair,
  AuthorizationServerMetadata,
  ProtectedResourceMetadata,
  ClientIDMetadataDocument,
  TokenResponse,
  TokenErrorResponse,
  TokenExchangeRequest,
  TokenExchangeResponse,
  TokenType,
  ClientCredentials,
  AuthorizationRequest,
  AuthorizationCodeTokenRequest,
  ClientCredentialsTokenRequest,
  RefreshTokenRequest,
  TokenIntrospectionResponse,
  WWWAuthenticateChallenge,
  AuthProviderConfig,
  MCPServerAuthConfig,
} from './types.js';

export { AuthError } from './types.js';

// PKCE utilities (mandatory per MCP 2025-11-25)
export {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCE,
  verifyCodeChallenge,
  isValidCodeVerifier,
  supportsS256,
  requireS256Support,
  PKCE_VERIFIER_MIN_LENGTH,
  PKCE_VERIFIER_MAX_LENGTH,
  PKCE_VERIFIER_DEFAULT_LENGTH,
} from './pkce.js';

// Discovery (RFC 8414, RFC 9728)
export {
  fetchAuthorizationServerMetadata,
  fetchProtectedResourceMetadata,
  parseWWWAuthenticate,
  buildWWWAuthenticate,
  discoverAuthFromMCPServer,
  createProtectedResourceMetadata,
  WELL_KNOWN_PATHS,
} from './discovery.js';

// Token Exchange (RFC 8693)
export {
  exchangeToken,
  exchangeForMCPServer,
  exchangeWithDelegation,
  exchangeForImpersonation,
  isValidTokenExchangeResponse,
  TOKEN_TYPES,
  TOKEN_EXCHANGE_GRANT_TYPE,
  type TokenExchangeOptions,
} from './tokenExchange.js';

// Client ID Metadata Documents (CIMD)
export {
  createClientIDMetadataDocument,
  fetchClientIDMetadata,
  validateClientIDMetadata,
  supportsCIMD,
  getCIMDWellKnownUrl,
  isSafeToFetch,
  CIMD_WELL_KNOWN_PATH,
  CIMD_MAX_SIZE_BYTES,
} from './cimd.js';

// Client Credentials
export {
  getClientCredentialsToken,
  ClientCredentialsManager,
  createBasicAuthHeader,
  type ClientCredentialsConfig,
} from './clientCredentials.js';

// Ory Provider
export {
  OryProvider,
  createOryNetworkProvider,
  createOryHydraProvider,
  type OryProviderConfig,
  type OryProviderType,
  type AuthorizationState,
} from './oryProvider.js';

// Middleware
export {
  extractBearerToken,
  createUnauthorizedResponse,
  createProtectedResourceMetadataResponse,
  isProtectedResourceMetadataRequest,
  hasRequiredScopes,
  hasValidAudience,
  createAuthMiddleware,
  TokenCache,
  createCachedValidator,
  type TokenValidator,
  type AuthMiddlewareConfig,
  type AuthenticatedRequest,
} from './middleware.js';

// Server Auth Configuration (Express integration)
export {
  createMCPServerAuth,
  createMCPServerAuthFromEnv,
  type MCPServerAuthSetupConfig,
  type MCPServerAuthSetup,
  type AuthenticatedExpressRequest,
} from './server-config.js';
