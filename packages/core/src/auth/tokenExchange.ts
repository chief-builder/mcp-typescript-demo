/**
 * OAuth 2.0 Token Exchange (RFC 8693)
 *
 * Implements the Security Token Service (STS) pattern for:
 * - Impersonation: A acts as B (indistinguishable)
 * - Delegation: A acts on behalf of B (A visible as actor)
 *
 * Use cases:
 * - Service-to-service token exchange
 * - Audience-restricted token acquisition
 * - Scope reduction for principle of least privilege
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8693
 */

import {
  TokenExchangeResponse,
  TokenType,
  ClientCredentials,
  AuthError,
} from './types.js';

/**
 * Token type URNs per RFC 8693
 */
export const TOKEN_TYPES = {
  ACCESS_TOKEN: 'urn:ietf:params:oauth:token-type:access_token' as TokenType,
  REFRESH_TOKEN: 'urn:ietf:params:oauth:token-type:refresh_token' as TokenType,
  ID_TOKEN: 'urn:ietf:params:oauth:token-type:id_token' as TokenType,
  SAML1: 'urn:ietf:params:oauth:token-type:saml1' as TokenType,
  SAML2: 'urn:ietf:params:oauth:token-type:saml2' as TokenType,
  JWT: 'urn:ietf:params:oauth:token-type:jwt' as TokenType,
} as const;

/**
 * Token Exchange Grant Type
 */
export const TOKEN_EXCHANGE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:token-exchange';

/**
 * Options for token exchange
 */
export interface TokenExchangeOptions {
  /** The subject token to exchange */
  subjectToken: string;

  /** Type of the subject token */
  subjectTokenType?: TokenType;

  /** Target audience (e.g., MCP server resource identifier) */
  audience?: string;

  /** Requested scopes for the new token */
  scope?: string;

  /** Resource indicator (RFC 8707) */
  resource?: string;

  /** Requested token type */
  requestedTokenType?: TokenType;

  /** Actor token for delegation (optional) */
  actorToken?: string;

  /** Type of the actor token */
  actorTokenType?: TokenType;
}

/**
 * Perform token exchange at an authorization server
 *
 * @param tokenEndpoint - The AS token endpoint URL
 * @param options - Token exchange options
 * @param clientCredentials - Client authentication (optional for public clients)
 * @returns Exchanged token response
 */
export async function exchangeToken(
  tokenEndpoint: string,
  options: TokenExchangeOptions,
  clientCredentials?: ClientCredentials
): Promise<TokenExchangeResponse> {
  const body = new URLSearchParams();

  // Required parameters
  body.set('grant_type', TOKEN_EXCHANGE_GRANT_TYPE);
  body.set('subject_token', options.subjectToken);
  body.set('subject_token_type', options.subjectTokenType ?? TOKEN_TYPES.ACCESS_TOKEN);

  // Optional parameters
  if (options.audience) {
    body.set('audience', options.audience);
  }

  if (options.scope) {
    body.set('scope', options.scope);
  }

  if (options.resource) {
    body.set('resource', options.resource);
  }

  if (options.requestedTokenType) {
    body.set('requested_token_type', options.requestedTokenType);
  }

  // Actor token for delegation
  if (options.actorToken) {
    body.set('actor_token', options.actorToken);
    body.set('actor_token_type', options.actorTokenType ?? TOKEN_TYPES.ACCESS_TOKEN);
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  };

  // Client authentication
  if (clientCredentials) {
    if (clientCredentials.clientSecret) {
      // Use Basic auth for confidential clients
      const credentials = Buffer.from(
        `${encodeURIComponent(clientCredentials.clientId)}:${encodeURIComponent(clientCredentials.clientSecret)}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else {
      // Public client - include client_id in body
      body.set('client_id', clientCredentials.clientId);
    }
  }

  try {
    const response = await fetch(tokenEndpoint, {
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
      issued_token_type: data.issued_token_type as TokenType,
      token_type: (data.token_type as 'Bearer' | 'N_A') || 'Bearer',
      expires_in: data.expires_in as number | undefined,
      scope: data.scope as string | undefined,
      refresh_token: data.refresh_token as string | undefined,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      `Token exchange request failed: ${error}`,
      'TOKEN_EXCHANGE_FAILED',
      error
    );
  }
}

/**
 * Exchange token for a specific MCP server audience
 *
 * Convenience method for the common case of exchanging a token
 * to access a specific MCP server.
 *
 * @param tokenEndpoint - The AS token endpoint URL
 * @param subjectToken - The token to exchange
 * @param mcpServerAudience - The target MCP server resource identifier
 * @param scopes - Optional scopes to request
 * @param clientCredentials - Optional client credentials
 * @returns Audience-restricted token
 */
export async function exchangeForMCPServer(
  tokenEndpoint: string,
  subjectToken: string,
  mcpServerAudience: string,
  scopes?: string[],
  clientCredentials?: ClientCredentials
): Promise<TokenExchangeResponse> {
  return exchangeToken(
    tokenEndpoint,
    {
      subjectToken,
      subjectTokenType: TOKEN_TYPES.ACCESS_TOKEN,
      audience: mcpServerAudience,
      scope: scopes?.join(' '),
      requestedTokenType: TOKEN_TYPES.ACCESS_TOKEN,
    },
    clientCredentials
  );
}

/**
 * Exchange token with delegation (actor token)
 *
 * Creates a token where the actor (service) is acting on behalf
 * of the subject (user). The resulting token identifies both.
 *
 * @param tokenEndpoint - The AS token endpoint URL
 * @param userToken - The user's token (subject)
 * @param serviceToken - The service's token (actor)
 * @param audience - Target audience
 * @param scopes - Optional scopes
 * @param clientCredentials - Client credentials
 * @returns Delegation token
 */
export async function exchangeWithDelegation(
  tokenEndpoint: string,
  userToken: string,
  serviceToken: string,
  audience: string,
  scopes?: string[],
  clientCredentials?: ClientCredentials
): Promise<TokenExchangeResponse> {
  return exchangeToken(
    tokenEndpoint,
    {
      subjectToken: userToken,
      subjectTokenType: TOKEN_TYPES.ACCESS_TOKEN,
      actorToken: serviceToken,
      actorTokenType: TOKEN_TYPES.ACCESS_TOKEN,
      audience,
      scope: scopes?.join(' '),
      requestedTokenType: TOKEN_TYPES.ACCESS_TOKEN,
    },
    clientCredentials
  );
}

/**
 * Exchange token for impersonation
 *
 * Creates a token where the requester becomes indistinguishable
 * from the subject. Use with caution - requires proper authorization.
 *
 * @param tokenEndpoint - The AS token endpoint URL
 * @param subjectToken - Token of the user to impersonate
 * @param audience - Target audience
 * @param scopes - Optional scopes (should not exceed subject's scopes)
 * @param clientCredentials - Client credentials (usually required for impersonation)
 * @returns Impersonation token
 */
export async function exchangeForImpersonation(
  tokenEndpoint: string,
  subjectToken: string,
  audience: string,
  scopes?: string[],
  clientCredentials?: ClientCredentials
): Promise<TokenExchangeResponse> {
  // Impersonation = no actor token, just subject token
  return exchangeToken(
    tokenEndpoint,
    {
      subjectToken,
      subjectTokenType: TOKEN_TYPES.ACCESS_TOKEN,
      audience,
      scope: scopes?.join(' '),
      requestedTokenType: TOKEN_TYPES.ACCESS_TOKEN,
      // No actor token = impersonation semantics
    },
    clientCredentials
  );
}

/**
 * Validate token exchange response
 *
 * @param response - The token exchange response
 * @returns true if valid
 */
export function isValidTokenExchangeResponse(response: unknown): response is TokenExchangeResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const r = response as Record<string, unknown>;

  return (
    typeof r.access_token === 'string' &&
    r.access_token.length > 0 &&
    typeof r.issued_token_type === 'string'
  );
}
