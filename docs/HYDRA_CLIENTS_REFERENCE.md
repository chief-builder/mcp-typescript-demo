# Ory Hydra OAuth Clients Reference

This document explains the registered OAuth clients in Hydra and their configuration fields.

## List Clients Endpoint

```bash
curl http://localhost:4445/admin/clients | jq
```

---

## Registered Clients Overview

| Client ID | Type | Purpose | Auth Method |
|-----------|------|---------|-------------|
| `cli-client` | Public | User authentication (CLI/browser) | `none` (PKCE) |
| `analytics-server` | Confidential | Server introspection | `client_secret_basic` |
| `dev-tools-server` | Confidential | Server introspection | `client_secret_basic` |

---

## Client: `cli-client`

**Purpose:** Public client for CLI tools and browser-based apps that authenticate users via OAuth.

```json
{
  "client_id": "cli-client",
  "client_name": "MCP CLI Client",
  "redirect_uris": ["http://localhost:8085/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "scope": "openid offline_access mcp:read mcp:write analytics:read analytics:write",
  "token_endpoint_auth_method": "none",
  "skip_consent": true,
  "subject_type": "public"
}
```

### Field Explanations

| Field | Value | Explanation |
|-------|-------|-------------|
| `client_id` | `cli-client` | Unique identifier used in OAuth requests |
| `client_name` | `MCP CLI Client` | Human-readable name shown in consent screens |
| `redirect_uris` | `["http://localhost:8085/callback"]` | Allowed callback URLs after authentication |
| `grant_types` | `["authorization_code", "refresh_token"]` | Allowed OAuth grant types |
| `response_types` | `["code"]` | Authorization response types (code = auth code flow) |
| `scope` | `openid offline_access mcp:read...` | Allowed scopes this client can request |
| `token_endpoint_auth_method` | `none` | No client secret - uses PKCE instead |
| `skip_consent` | `true` | Skip consent screen (first-party app) |
| `subject_type` | `public` | User IDs are not pairwise (same across clients) |

### Usage Example

```typescript
import { OryProvider } from '@mcp-demo/core';

const provider = new OryProvider({
  providerType: 'hydra',
  hydraPublicUrl: 'http://localhost:4444',
  clientId: 'cli-client',
  redirectUris: ['http://localhost:8085/callback'],
  scopes: ['openid', 'offline_access', 'analytics:read']
});

// Build authorization URL with PKCE (no client secret needed)
const { url, state } = await provider.buildAuthorizationUrl(
  'http://localhost:8085/callback'
);

// User authenticates, then exchange code
const tokens = await provider.exchangeCode(authCode, state);
```

### Test Authorization Flow

```bash
# Step 1: Generate PKCE values
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=/+' | cut -c1-43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | base64 | tr -d '=' | tr '+/' '-_')

# Step 2: Open in browser
open "http://localhost:4444/oauth2/auth?\
response_type=code&\
client_id=cli-client&\
redirect_uri=http://localhost:8085/callback&\
scope=openid%20offline_access%20analytics:read&\
state=random-state-123&\
code_challenge=$CODE_CHALLENGE&\
code_challenge_method=S256"

# Step 3: After redirect, exchange code for tokens
curl -X POST http://localhost:4444/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE_FROM_REDIRECT" \
  -d "redirect_uri=http://localhost:8085/callback" \
  -d "client_id=cli-client" \
  -d "code_verifier=$CODE_VERIFIER"
```

---

## Client: `analytics-server`

**Purpose:** Confidential client for the Analytics MCP server to introspect tokens.

```json
{
  "client_id": "analytics-server",
  "client_name": "Analytics Server",
  "redirect_uris": [],
  "grant_types": ["client_credentials"],
  "response_types": ["token"],
  "scope": "introspect",
  "token_endpoint_auth_method": "client_secret_basic",
  "skip_consent": false
}
```

### Field Explanations

| Field | Value | Explanation |
|-------|-------|-------------|
| `client_id` | `analytics-server` | Identifier for the Analytics server |
| `client_secret` | `analytics-server-secret` | Secret for authentication (not shown in listing) |
| `redirect_uris` | `[]` | Empty - server doesn't use redirects |
| `grant_types` | `["client_credentials"]` | Machine-to-machine authentication |
| `response_types` | `["token"]` | Direct token response |
| `scope` | `introspect` | Permission to introspect tokens |
| `token_endpoint_auth_method` | `client_secret_basic` | HTTP Basic auth with client_id:secret |

### Usage Example

```typescript
import { getClientCredentialsToken } from '@mcp-demo/core';

// Server obtains its own token for introspection
const serverToken = await getClientCredentialsToken({
  tokenEndpoint: 'http://localhost:4444/oauth2/token',
  clientId: 'analytics-server',
  clientSecret: 'analytics-server-secret',
  scope: 'introspect'
});

// Use credentials to introspect user tokens
const introspection = await fetch('http://localhost:4445/admin/oauth2/introspect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${Buffer.from('analytics-server:analytics-server-secret').toString('base64')}`
  },
  body: `token=${userAccessToken}`
});
```

### Test Client Credentials Flow

```bash
# Get server token using client credentials
curl -X POST http://localhost:4444/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "analytics-server:analytics-server-secret" \
  -d "grant_type=client_credentials" \
  -d "scope=introspect"

# Response:
# {
#   "access_token": "ory_at_...",
#   "expires_in": 3600,
#   "scope": "introspect",
#   "token_type": "bearer"
# }
```

### Test Token Introspection

```bash
# Introspect a user's access token
curl -X POST http://localhost:4445/admin/oauth2/introspect \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "analytics-server:analytics-server-secret" \
  -d "token=USER_ACCESS_TOKEN"

# Response (active token):
# {
#   "active": true,
#   "scope": "openid analytics:read",
#   "client_id": "cli-client",
#   "sub": "demo",
#   "exp": 1702345678,
#   "iat": 1702342078,
#   "token_type": "Bearer"
# }

# Response (invalid/expired token):
# {
#   "active": false
# }
```

---

## Client: `dev-tools-server`

**Purpose:** Confidential client for the Dev Tools MCP server to introspect tokens.

```json
{
  "client_id": "dev-tools-server",
  "client_name": "Dev Tools Server",
  "client_secret": "dev-tools-server-secret",
  "grant_types": ["client_credentials"],
  "response_types": ["token"],
  "scope": "introspect",
  "token_endpoint_auth_method": "client_secret_basic"
}
```

Same configuration pattern as `analytics-server` - used for a different MCP server.

---

## Client Configuration Fields Reference

### Core Identity

| Field | Type | Description |
|-------|------|-------------|
| `client_id` | string | **Required.** Unique identifier for the client |
| `client_name` | string | Human-readable name for consent screens |
| `client_secret` | string | Secret for confidential clients (not returned in GET) |
| `client_uri` | string | URL of client's homepage |
| `logo_uri` | string | URL to client's logo for consent screens |
| `contacts` | string[] | Contact emails for the client owner |

### OAuth Configuration

| Field | Type | Description |
|-------|------|-------------|
| `redirect_uris` | string[] | Allowed callback URLs (required for auth code flow) |
| `grant_types` | string[] | Allowed grant types (see below) |
| `response_types` | string[] | Allowed response types for authorization endpoint |
| `scope` | string | Space-separated allowed scopes |
| `audience` | string[] | Allowed audiences for tokens |

### Grant Types

| Grant Type | Use Case | Client Type |
|------------|----------|-------------|
| `authorization_code` | User authentication with browser | Public or Confidential |
| `refresh_token` | Obtain new access token | Public or Confidential |
| `client_credentials` | Machine-to-machine | Confidential only |
| `implicit` | Legacy browser flow (deprecated) | Public |

### Authentication Methods

| Method | Description | Security |
|--------|-------------|----------|
| `none` | No authentication - relies on PKCE | Public clients |
| `client_secret_basic` | HTTP Basic auth header | Confidential clients |
| `client_secret_post` | Secret in request body | Confidential clients |
| `private_key_jwt` | JWT signed with private key | High security |

### Consent & Logout

| Field | Type | Description |
|-------|------|-------------|
| `skip_consent` | boolean | Skip consent screen (first-party apps) |
| `skip_logout_consent` | boolean | Skip logout confirmation |
| `policy_uri` | string | URL to privacy policy |
| `tos_uri` | string | URL to terms of service |

### Token Lifespans

| Field | Type | Description |
|-------|------|-------------|
| `authorization_code_grant_access_token_lifespan` | duration | Access token TTL for auth code flow |
| `authorization_code_grant_id_token_lifespan` | duration | ID token TTL |
| `authorization_code_grant_refresh_token_lifespan` | duration | Refresh token TTL |
| `client_credentials_grant_access_token_lifespan` | duration | Access token TTL for client credentials |
| `refresh_token_grant_access_token_lifespan` | duration | Access token TTL when using refresh token |
| `refresh_token_grant_refresh_token_lifespan` | duration | New refresh token TTL (rotation) |

> **Note:** `null` values use Hydra's default lifespans (typically 1 hour for access tokens, 30 days for refresh tokens).

### Advanced

| Field | Type | Description |
|-------|------|-------------|
| `subject_type` | `public` or `pairwise` | Whether user IDs are shared across clients |
| `jwks` | object | Client's public keys for JWT validation |
| `jwks_uri` | string | URL to fetch client's public keys |
| `allowed_cors_origins` | string[] | Allowed CORS origins for browser requests |
| `metadata` | object | Custom key-value metadata |

---

## Client Management Commands

```bash
# List all clients
curl http://localhost:4445/admin/clients | jq

# Get specific client
curl http://localhost:4445/admin/clients/cli-client | jq

# Create new client
curl -X POST http://localhost:4445/admin/clients \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "my-new-client",
    "client_name": "My New Client",
    "grant_types": ["authorization_code"],
    "response_types": ["code"],
    "redirect_uris": ["http://localhost:8080/callback"],
    "scope": "openid",
    "token_endpoint_auth_method": "none"
  }'

# Update client
curl -X PUT http://localhost:4445/admin/clients/my-new-client \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Updated Name",
    "scope": "openid profile"
  }'

# Delete client
curl -X DELETE http://localhost:4445/admin/clients/my-new-client
```

---

## Our MCP Implementation Usage

### Public Client (CLI)

```typescript
// packages/clients/cli/src/auth.ts
const provider = new OryProvider({
  providerType: 'hydra',
  hydraPublicUrl: 'http://localhost:4444',
  clientId: 'cli-client',  // Public client
  // No clientSecret - uses PKCE
  redirectUris: ['http://localhost:8085/callback'],
  scopes: ['openid', 'offline_access', 'analytics:read']
});
```

### Confidential Client (Server)

```typescript
// packages/servers/analytics/src/index.ts
const auth = createMCPServerAuthFromEnv({
  resourceUrl: 'http://localhost:3001',
  authServerUrl: 'http://localhost:4444',
  introspectionEndpoint: 'http://localhost:4445/admin/oauth2/introspect',
  clientId: 'analytics-server',      // Confidential client
  clientSecret: 'analytics-server-secret',
  requiredScopes: ['analytics:read'],
  scopesSupported: ['analytics:read', 'analytics:write']
});
```

---

## Related Files

- `docker/docker-compose.auth.yml` - Client registration on startup
- `packages/core/src/auth/oryProvider.ts` - OAuth provider implementation
- `packages/core/src/auth/clientCredentials.ts` - Client credentials flow
- `packages/core/src/auth/middleware.ts` - Token validation middleware
- `packages/clients/cli/src/auth.ts` - CLI authentication
- `packages/servers/analytics/src/index.ts` - Server auth integration
