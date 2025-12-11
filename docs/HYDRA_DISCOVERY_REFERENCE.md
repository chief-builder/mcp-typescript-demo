# Ory Hydra OIDC Discovery Reference

This document explains the OpenID Connect Discovery response from Ory Hydra and maps each field to our MCP authorization implementation status.

## Discovery Endpoint

```bash
curl http://localhost:4444/.well-known/openid-configuration | jq
```

> **Note:** Hydra uses `/.well-known/openid-configuration` (OIDC standard), not `/.well-known/oauth-authorization-server` (RFC 8414). Our discovery module tries both endpoints automatically.

---

## Core Endpoints

| Field | Value | Our Implementation | Status |
|-------|-------|-------------------|--------|
| `issuer` | `http://localhost:4444` | Used to validate tokens and build URLs | **USED** |
| `authorization_endpoint` | `http://localhost:4444/oauth2/auth` | Used by `OryProvider.buildAuthorizationUrl()` | **USED** |
| `token_endpoint` | `http://localhost:4444/oauth2/token` | Used by `OryProvider.exchangeCode()`, `refreshToken()`, and client credentials | **USED** |
| `userinfo_endpoint` | `http://localhost:4444/userinfo` | Not used - MCP doesn't require OIDC userinfo | **NOT USED** |
| `jwks_uri` | `http://localhost:4444/.well-known/jwks.json` | Available for local JWT validation (optional) | **OPTIONAL** |
| `revocation_endpoint` | `http://localhost:4444/oauth2/revoke` | Used by `OryProvider.revokeToken()` | **USED** |
| `end_session_endpoint` | `http://localhost:4444/oauth2/sessions/logout` | Not used - logout handled by client | **NOT USED** |

### Examples

**Authorization Request:**
```typescript
// From OryProvider.buildAuthorizationUrl()
const url = `${metadata.authorization_endpoint}?${params.toString()}`;
// Result: http://localhost:4444/oauth2/auth?response_type=code&client_id=cli-client&...
```

**Token Exchange:**
```typescript
// From OryProvider.exchangeCode()
const response = await fetch(metadata.token_endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: 'http://localhost:8085/callback',
    client_id: 'cli-client',
    code_verifier: pkce.codeVerifier
  })
});
```

---

## Grant Types

| Grant Type | Hydra Support | Our Implementation | MCP Use Case |
|------------|---------------|-------------------|--------------|
| `authorization_code` | **YES** | `OryProvider.exchangeCode()` | User authentication with PKCE |
| `refresh_token` | **YES** | `OryProvider.refreshToken()` | Token refresh without re-auth |
| `client_credentials` | **YES** | `ClientCredentialsManager` | Server-to-server (introspection) |
| `implicit` | **YES** | **NOT USED** | Deprecated in OAuth 2.1 |

### Authorization Code Flow Example

```typescript
import { OryProvider } from '@mcp-demo/core';

const provider = new OryProvider({
  providerType: 'hydra',
  hydraPublicUrl: 'http://localhost:4444',
  clientId: 'cli-client',
  redirectUris: ['http://localhost:8085/callback'],
  scopes: ['openid', 'analytics:read']
});

// Step 1: Build authorization URL with PKCE
const { url, state } = await provider.buildAuthorizationUrl(
  'http://localhost:8085/callback',
  ['openid', 'analytics:read']
);

// Step 2: User visits URL, authenticates, gets redirected with code
// http://localhost:8085/callback?code=AUTH_CODE&state=STATE

// Step 3: Exchange code for tokens
const tokens = await provider.exchangeCode(authCode, state);
console.log(tokens.access_token);
```

### Client Credentials Flow Example

```typescript
import { getClientCredentialsToken } from '@mcp-demo/core';

// Server obtaining token for introspection
const token = await getClientCredentialsToken({
  tokenEndpoint: 'http://localhost:4444/oauth2/token',
  clientId: 'analytics-server',
  clientSecret: 'analytics-server-secret',
  scope: 'introspect'
});
```

---

## Response Types

| Response Type | Hydra Support | Our Implementation | Notes |
|---------------|---------------|-------------------|-------|
| `code` | **YES** | **USED** | Required for authorization code flow |
| `code id_token` | **YES** | **NOT USED** | Hybrid flow |
| `id_token` | **YES** | **NOT USED** | Implicit ID token |
| `token` | **YES** | **NOT USED** | Implicit access token (deprecated) |
| `token id_token` | **YES** | **NOT USED** | Implicit flow |
| `token id_token code` | **YES** | **NOT USED** | Hybrid flow |

> **MCP Requirement:** Only `response_type=code` is used per OAuth 2.1 best practices.

---

## PKCE Support (Critical for MCP)

| Field | Value | Our Implementation |
|-------|-------|-------------------|
| `code_challenge_methods_supported` | `["plain", "S256"]` | **S256 required** - enforced in `pkce.ts` |

### PKCE Validation

```typescript
// From packages/core/src/auth/pkce.ts
export function requireS256Support(methods?: string[]): void {
  if (!methods?.includes('S256')) {
    throw new AuthError(
      'Authorization server must support S256 PKCE method (required by MCP spec)',
      'PKCE_S256_NOT_SUPPORTED'
    );
  }
}
```

### PKCE Example

```typescript
import { generatePKCE } from '@mcp-demo/core';

const pkce = generatePKCE();
// {
//   codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
//   codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
//   codeChallengeMethod: "S256"
// }

// Include in authorization request:
const params = new URLSearchParams({
  response_type: 'code',
  client_id: 'cli-client',
  code_challenge: pkce.codeChallenge,
  code_challenge_method: 'S256',
  // ...
});
```

---

## Token Endpoint Authentication

| Method | Hydra Support | Our Implementation | Use Case |
|--------|---------------|-------------------|----------|
| `client_secret_basic` | **YES** | **USED** | Confidential clients (servers) |
| `client_secret_post` | **YES** | **NOT USED** | Alternative to Basic auth |
| `private_key_jwt` | **YES** | **NOT USED** | JWT client assertion |
| `none` | **YES** | **USED** | Public clients (CLI, mobile) |

### Confidential Client Example (Basic Auth)

```typescript
// From OryProvider - confidential client with secret
const credentials = Buffer.from(
  `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`
).toString('base64');

headers['Authorization'] = `Basic ${credentials}`;
```

### Public Client Example (No Auth)

```typescript
// From OryProvider - public client (CLI)
// No Authorization header, client_id in request body
const body = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: 'cli-client',  // Only identifier, no secret
  code: authCode,
  code_verifier: pkce.codeVerifier,
  redirect_uri: redirectUri
});
```

---

## Scopes

| Scope | Hydra Default | Our Custom Scopes | Purpose |
|-------|---------------|-------------------|---------|
| `openid` | **YES** | Used | OIDC identity |
| `offline_access` | **YES** | Used | Refresh tokens |
| `offline` | **YES** | Not used | Legacy alias |
| - | - | `mcp:read` | MCP read operations |
| - | - | `mcp:write` | MCP write operations |
| - | - | `analytics:read` | Analytics server read |
| - | - | `analytics:write` | Analytics server write |
| - | - | `introspect` | Token introspection |

> **Note:** Custom scopes (mcp:*, analytics:*) are registered when clients are created. Hydra only advertises built-in scopes in discovery.

### Scope Example

```bash
# Request analytics scopes
curl "http://localhost:4444/oauth2/auth?\
  response_type=code&\
  client_id=cli-client&\
  scope=openid%20offline_access%20analytics:read&\
  redirect_uri=http://localhost:8085/callback&\
  ..."
```

---

## Additional Features

### Supported but Not Used in MCP

| Feature | Field | Status | Reason |
|---------|-------|--------|--------|
| **Claims** | `claims_supported: ["sub"]` | Not used | MCP uses scopes, not claims |
| **ID Token Signing** | `id_token_signing_alg_values_supported` | Not used | JWT validation optional |
| **Request Objects** | `request_parameter_supported: true` | Not used | Standard params sufficient |
| **Backchannel Logout** | `backchannel_logout_supported: true` | Not used | Client handles logout |
| **Frontchannel Logout** | `frontchannel_logout_supported: true` | Not used | Client handles logout |
| **Verifiable Credentials** | `credentials_endpoint_draft_00` | Not used | Experimental feature |

### Token Introspection (Not in Discovery)

Hydra's introspection endpoint is on the **admin API** (port 4445), not advertised in public discovery:

```bash
# Introspect a token (admin API)
curl -X POST http://localhost:4445/admin/oauth2/introspect \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "analytics-server:analytics-server-secret" \
  -d "token=ACCESS_TOKEN"
```

Response:
```json
{
  "active": true,
  "scope": "openid analytics:read",
  "client_id": "cli-client",
  "sub": "user-id",
  "exp": 1702345678,
  "iat": 1702342078
}
```

---

## Implementation Summary

### What We Use

| Component | Endpoints/Features Used |
|-----------|------------------------|
| **Discovery** | `issuer`, `authorization_endpoint`, `token_endpoint`, `code_challenge_methods_supported` |
| **Authorization** | `authorization_code` grant, PKCE S256, `response_type=code` |
| **Token Exchange** | Token endpoint with `authorization_code` and `refresh_token` grants |
| **Client Credentials** | Token endpoint with `client_credentials` grant |
| **Client Auth** | `client_secret_basic` (servers), `none` (CLI) |
| **Token Revocation** | `revocation_endpoint` |

### What We Don't Use

| Feature | Reason |
|---------|--------|
| Implicit grants | Deprecated in OAuth 2.1 |
| Hybrid flows | Not required for MCP |
| OIDC UserInfo | MCP uses scopes for authorization |
| Request objects | Standard parameters sufficient |
| Logout endpoints | Client-side handling |
| Verifiable credentials | Experimental |

---

## Testing Commands

```bash
# 1. Check discovery endpoint
curl http://localhost:4444/.well-known/openid-configuration | jq

# 2. List registered clients
curl http://localhost:4445/admin/clients | jq

# 3. Get specific client
curl http://localhost:4445/admin/clients/cli-client | jq

# 4. Health check
curl http://localhost:4444/health/ready

# 5. JWKS (for JWT validation)
curl http://localhost:4444/.well-known/jwks.json | jq
```

---

## Related Files

- `packages/core/src/auth/discovery.ts` - Discovery implementation
- `packages/core/src/auth/oryProvider.ts` - Ory Hydra provider
- `packages/core/src/auth/pkce.ts` - PKCE implementation
- `packages/core/src/auth/clientCredentials.ts` - Client credentials flow
- `packages/core/src/auth/tokenExchange.ts` - RFC 8693 token exchange
- `packages/core/src/auth/types.ts` - Type definitions
- `docker/docker-compose.auth.yml` - Hydra Docker setup
