/**
 * MCP 2025-11-25 Authorization Types
 *
 * Implements OAuth 2.1 with mandatory PKCE, Protected Resource Metadata (RFC 9728),
 * Client ID Metadata Documents (CIMD), and Token Exchange (RFC 8693).
 */

/**
 * PKCE (Proof Key for Code Exchange) types
 * Per MCP 2025-11-25: PKCE is mandatory, S256 method required
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256'; // Only S256 allowed per MCP spec
}

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 */
export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  token_endpoint_auth_methods_supported?: string[];
  token_endpoint_auth_signing_alg_values_supported?: string[];
  userinfo_endpoint?: string;
  jwks_uri?: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[]; // Must include 'S256'
  token_introspection_endpoint?: string;
  token_revocation_endpoint?: string;

  // MCP 2025-11-25 additions
  client_id_metadata_document_supported?: boolean; // CIMD support
}

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 * MCP servers MUST implement this
 */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[]; // Required for MCP
  bearer_methods_supported?: ('header' | 'body' | 'query')[];
  scopes_supported?: string[];
  resource_signing_alg_values_supported?: string[];
  resource_documentation?: string;
  resource_policy_uri?: string;
  resource_tos_uri?: string;
  jwks_uri?: string;
}

/**
 * Client ID Metadata Document (CIMD)
 * New default for MCP client registration (replaces DCR)
 */
export interface ClientIDMetadataDocument {
  client_id: string; // Must be HTTPS URL pointing to this document
  client_name?: string;
  client_uri?: string;
  redirect_uris: string[];
  grant_types?: ('authorization_code' | 'refresh_token' | 'client_credentials')[];
  response_types?: string[];
  scope?: string;
  contacts?: string[];
  logo_uri?: string;
  policy_uri?: string;
  tos_uri?: string;
  jwks_uri?: string;
  jwks?: object;
  software_id?: string;
  software_version?: string;

  // PKCE requirement
  code_challenge_methods_supported?: ('S256')[]; // Only S256 per MCP spec
}

/**
 * OAuth 2.0 Token Response
 */
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer' | 'DPoP';
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * OAuth 2.0 Token Error Response
 */
export interface TokenErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Token Exchange Request (RFC 8693)
 */
export interface TokenExchangeRequest {
  grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange';
  subject_token: string;
  subject_token_type: TokenType;
  actor_token?: string;
  actor_token_type?: TokenType;
  requested_token_type?: TokenType;
  audience?: string;
  scope?: string;
  resource?: string;
}

/**
 * Token Exchange Response (RFC 8693)
 */
export interface TokenExchangeResponse {
  access_token: string;
  issued_token_type: TokenType;
  token_type: 'Bearer' | 'N_A';
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
}

/**
 * Token Types for Token Exchange (RFC 8693)
 */
export type TokenType =
  | 'urn:ietf:params:oauth:token-type:access_token'
  | 'urn:ietf:params:oauth:token-type:refresh_token'
  | 'urn:ietf:params:oauth:token-type:id_token'
  | 'urn:ietf:params:oauth:token-type:saml1'
  | 'urn:ietf:params:oauth:token-type:saml2'
  | 'urn:ietf:params:oauth:token-type:jwt';

/**
 * Client Credentials for authentication
 */
export interface ClientCredentials {
  clientId: string;
  clientSecret?: string;
}

/**
 * Authorization Code Request Parameters
 */
export interface AuthorizationRequest {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state: string;
  code_challenge: string;
  code_challenge_method: 'S256';
  nonce?: string;
}

/**
 * Token Request (Authorization Code Grant)
 */
export interface AuthorizationCodeTokenRequest {
  grant_type: 'authorization_code';
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier: string;
}

/**
 * Client Credentials Token Request
 */
export interface ClientCredentialsTokenRequest {
  grant_type: 'client_credentials';
  scope?: string;
  client_id: string;
  client_secret: string;
}

/**
 * Refresh Token Request
 */
export interface RefreshTokenRequest {
  grant_type: 'refresh_token';
  refresh_token: string;
  scope?: string;
  client_id: string;
}

/**
 * Token Introspection Response (RFC 7662)
 */
export interface TokenIntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  jti?: string;
}

/**
 * WWW-Authenticate Challenge for 401 responses
 */
export interface WWWAuthenticateChallenge {
  scheme: 'Bearer';
  realm?: string;
  resource_metadata: string; // URL to Protected Resource Metadata
  error?: 'invalid_token' | 'insufficient_scope';
  error_description?: string;
  scope?: string;
}

/**
 * Auth Provider Configuration
 */
export interface AuthProviderConfig {
  /** Authorization server issuer URL */
  issuer: string;
  /** Client ID (URL for CIMD, string for traditional) */
  clientId: string;
  /** Client secret (for confidential clients) */
  clientSecret?: string;
  /** Redirect URIs for authorization callback */
  redirectUris: string[];
  /** Requested scopes */
  scopes?: string[];
  /** Use CIMD for client registration */
  useCIMD?: boolean;
}

/**
 * MCP Server Auth Configuration
 */
export interface MCPServerAuthConfig {
  /** This server's resource identifier */
  resourceIdentifier: string;
  /** Trusted authorization servers */
  authorizationServers: string[];
  /** Supported scopes */
  scopesSupported?: string[];
  /** Bearer token methods supported */
  bearerMethodsSupported?: ('header' | 'body' | 'query')[];
  /** JWKS URI for local token validation */
  jwksUri?: string;
}

/**
 * Auth Error
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
