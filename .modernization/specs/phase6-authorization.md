# Phase 6: Authorization Improvements

## Objective

Implement MCP 2025-11-25 authorization improvements including Client Credentials Flow (SEP-1046) for machine-to-machine authentication, Client ID Metadata Documents (CIMD), and mandatory PKCE enforcement.

## Background

The MCP 2025-11-25 specification includes significant authorization enhancements:

1. **Client Credentials Flow** - M2M authentication without user interaction
2. **CIMD (Client ID Metadata Documents)** - Simpler client registration via URL-hosted metadata
3. **Mandatory PKCE** - PKCE is now required for all OAuth flows
4. **Enhanced Discovery** - OpenID Connect Discovery 1.0 support

## Authorization Modes

### 1. Client Credentials Flow (M2M)
For server-to-server communication without user involvement:
```
Client → Authorization Server: client_id + client_secret
Authorization Server → Client: access_token
Client → Resource Server: access_token
```

### 2. Authorization Code Flow with PKCE (User)
For user-facing applications:
```
Client → Authorization Server: code_verifier (SHA256) → code_challenge
User → Authorization Server: Authenticate + Consent
Authorization Server → Client: authorization_code
Client → Authorization Server: code + code_verifier
Authorization Server → Client: access_token
```

## Files to Modify

### Core Authorization Module
- `packages/core/src/auth/index.ts` - Export auth utilities
- `packages/core/src/auth/types.ts` - Authorization type definitions
- `packages/core/src/auth/pkce.ts` - PKCE code verifier/challenge generation
- `packages/core/src/auth/clientCredentials.ts` - M2M auth flow
- `packages/core/src/auth/discovery.ts` - OIDC discovery utilities

### Server Authorization
- `packages/servers/chat-server/src/index.ts` - Add auth middleware
- `packages/servers/dev-tools/src/index.ts` - Protected endpoints
- `packages/servers/cloud-ops/src/index.ts` - Require auth for destructive ops

### Client Authorization
- `packages/clients/cli/src/index.ts` - Add auth flow with PKCE
- `packages/clients/web/src/auth.ts` - Browser auth with PKCE

## Implementation Pattern

### PKCE Utilities
```typescript
// packages/core/src/auth/pkce.ts
import { createHash, randomBytes } from 'crypto';

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export function generatePKCE(): PKCEPair {
  const codeVerifier = generateCodeVerifier();
  return {
    codeVerifier,
    codeChallenge: generateCodeChallenge(codeVerifier),
    codeChallengeMethod: 'S256',
  };
}
```

### Client Credentials Flow
```typescript
// packages/core/src/auth/clientCredentials.ts
export interface ClientCredentialsConfig {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export async function getClientCredentialsToken(
  config: ClientCredentialsConfig
): Promise<TokenResponse> {
  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: config.scope || '',
    }),
  });

  if (!response.ok) {
    throw new AuthError('Failed to obtain token', await response.json());
  }

  return response.json();
}
```

### OIDC Discovery
```typescript
// packages/core/src/auth/discovery.ts
export interface OIDCConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  code_challenge_methods_supported?: string[];
}

export async function discoverOIDCConfig(issuer: string): Promise<OIDCConfiguration> {
  const wellKnownUrl = `${issuer}/.well-known/openid-configuration`;
  const response = await fetch(wellKnownUrl);

  if (!response.ok) {
    throw new AuthError('OIDC discovery failed');
  }

  const config = await response.json();

  // Verify PKCE support (mandatory per MCP spec)
  if (!config.code_challenge_methods_supported?.includes('S256')) {
    throw new AuthError('Authorization server does not support PKCE S256');
  }

  return config;
}
```

### Client Metadata Document (CIMD)
```typescript
// Example client metadata document hosted at client's URL
// https://my-mcp-client.example.com/.well-known/mcp-client.json
{
  "client_id": "https://my-mcp-client.example.com",
  "client_name": "My MCP Client",
  "redirect_uris": ["http://localhost:3000/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "code_challenge_methods_supported": ["S256"]
}
```

## Requirements

1. Create PKCE utility module in core package
2. Create client credentials flow module in core package
3. Create OIDC discovery module in core package
4. Add auth middleware to servers for protected endpoints
5. Update CLI client to use PKCE for OAuth flows
6. Verify PKCE support before proceeding with auth
7. Support both API key and OAuth token authentication
8. Add tests for all auth utilities

## Security Requirements

- [ ] PKCE code_verifier minimum 43 characters
- [ ] PKCE code_challenge_method MUST be S256 (not plain)
- [ ] Client secrets stored securely (env vars, not hardcoded)
- [ ] Token storage uses secure methods
- [ ] Refresh tokens handled properly

## Acceptance Criteria

- [ ] PKCE utility generates valid verifier/challenge pairs
- [ ] Client credentials flow obtains tokens successfully
- [ ] OIDC discovery fetches and validates config
- [ ] PKCE is enforced for all user-facing auth flows
- [ ] CLI successfully completes OAuth with PKCE
- [ ] Protected server endpoints require valid tokens
- [ ] All existing tests pass + new auth tests

## References

- [MCP 2025-11-25 Authorization Spec](https://modelcontextprotocol.io/specification/2025-11-25)
- [OAuth 2.0 PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)
- [Client Credentials Grant (RFC 6749)](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
