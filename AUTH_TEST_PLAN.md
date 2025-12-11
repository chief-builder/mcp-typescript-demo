# MCP Authorization Testing Plan

This document describes how to test the MCP 2025-11-25 OAuth 2.1 authorization implementation with real Ory Hydra.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ installed
- Project built (`npm run build`)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ory Hydra (Docker)                           │
│  Port 4444: Public API (authorization, token endpoints)         │
│  Port 4445: Admin API (introspection, client management)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Consent App (Docker)                         │
│  Port 3000: Login/Consent UI for OAuth flows                    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐      ┌──────────────┐
│ Analytics    │     │ CLI Client   │      │ Other        │
│ Server       │     │ with Auth    │      │ Clients      │
│ Port 3002    │     │ Port 8085    │      │              │
└──────────────┘     └──────────────┘      └──────────────┘
```

## Step 1: Start Ory Hydra Auth Server

```bash
# Start the auth stack (Hydra + Consent App)
docker-compose -f docker/docker-compose.auth.yml up -d

# Wait for services to be ready
docker-compose -f docker/docker-compose.auth.yml logs -f hydra-clients

# You should see: "OAuth clients registered successfully!"
```

### Verify Hydra is running:

```bash
# Check Hydra health
curl http://localhost:4444/health/ready

# Check AS metadata (Hydra uses OIDC discovery endpoint)
curl http://localhost:4444/.well-known/openid-configuration | jq
```

### Test Credentials

| Username | Password | Description |
|----------|----------|-------------|
| demo     | demo     | Demo user   |
| admin    | admin    | Admin user  |

## Step 2: Start Analytics Server with Auth

```bash
# Start the analytics server with auth enabled (default)
cd packages/servers/analytics
npm run build
node dist/index.js --http

# Or with auth explicitly disabled for comparison
AUTH_ENABLED=false node dist/index.js --http
```

### Verify Protected Resource Metadata

```bash
# Fetch PRM endpoint
curl http://localhost:3002/.well-known/oauth-protected-resource | jq
```

Expected response:
```json
{
  "resource": "http://localhost:3002",
  "authorization_servers": ["http://localhost:4444"],
  "scopes_supported": ["analytics:read", "analytics:write"],
  "bearer_methods_supported": ["header"]
}
```

### Verify 401 Response

```bash
# Make unauthenticated request
curl -v -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

Expected: HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="http://localhost:3002/.well-known/oauth-protected-resource"`

## Step 3: Test OAuth Flow Manually

### 3.1 Get Authorization Code

Open this URL in a browser:
```
http://localhost:4444/oauth2/auth?response_type=code&client_id=cli-client&redirect_uri=http://localhost:8085/callback&scope=openid%20offline_access%20analytics:read%20analytics:write&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256
```

1. Login with `demo/demo`
2. Grant consent
3. Copy the `code` from the redirect URL

### 3.2 Exchange Code for Token

```bash
# Replace CODE with the actual code from step 3.1
curl -X POST http://localhost:4444/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=CODE" \
  -d "redirect_uri=http://localhost:8085/callback" \
  -d "client_id=cli-client" \
  -d "code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
```

Note: The code_verifier above matches the code_challenge in step 3.1.

### 3.3 Use Token to Access Server

```bash
# Replace TOKEN with the access_token from step 3.2
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

Expected: HTTP 200 with MCP initialize response

## Step 4: Test Token Introspection

```bash
# Introspect a token (using admin endpoint)
curl -X POST http://localhost:4445/admin/oauth2/introspect \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "analytics-server:analytics-server-secret" \
  -d "token=TOKEN"
```

Expected response:
```json
{
  "active": true,
  "scope": "openid offline_access analytics:read analytics:write",
  "client_id": "cli-client",
  "sub": "demo",
  "token_type": "access_token"
}
```

## Step 5: Test with CLI Client Auth Manager

```typescript
// Example usage of CLI auth manager
import { CLIAuthManager } from '@mcp-demo/cli-client/auth';

const auth = new CLIAuthManager();

// Check if auth is required
const requiresAuth = await auth.checkAuthRequired('http://localhost:3002');
console.log('Requires auth:', requiresAuth);

// Authenticate (opens browser)
const tokens = await auth.authenticate('http://localhost:3002');
console.log('Access token:', tokens.accessToken);

// Make authenticated request
const response = await auth.authenticatedFetch('http://localhost:3002/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1,
  }),
});
```

## Test Checklist

### Server-Side Tests

- [ ] Protected Resource Metadata endpoint returns correct data
- [ ] Unauthenticated requests return 401 with WWW-Authenticate header
- [ ] WWW-Authenticate header includes resource_metadata URL
- [ ] Valid tokens are accepted
- [ ] Expired tokens are rejected
- [ ] Invalid tokens are rejected
- [ ] Token caching works (introspection not called for cached tokens)
- [ ] Required scopes are enforced

### Client-Side Tests

- [ ] Discovery fetches PRM from 401 response
- [ ] Discovery fetches AS metadata
- [ ] PKCE code verifier is generated correctly
- [ ] PKCE code challenge is S256 encoded
- [ ] Authorization URL opens in browser
- [ ] Callback server receives auth code
- [ ] Token exchange succeeds
- [ ] Access token is stored
- [ ] Refresh token flow works
- [ ] Authenticated requests include Bearer token

### Integration Tests

- [ ] Full OAuth flow: discover → authorize → token → access
- [ ] Token refresh when expired
- [ ] Multiple concurrent sessions
- [ ] Logout clears tokens

## Environment Variables

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| AUTH_ENABLED | true | Enable/disable auth |
| RESOURCE_URL | http://localhost:PORT | Server's resource identifier |
| AUTH_SERVER_URL | http://localhost:4444 | Ory Hydra public URL |
| INTROSPECTION_URL | http://localhost:4445/admin/oauth2/introspect | Introspection endpoint |
| AUTH_CLIENT_ID | server-name | Client ID for introspection |
| AUTH_CLIENT_SECRET | secret | Client secret for introspection |
| AUTH_SCOPES | - | Required scopes (comma-separated) |
| AUTH_CACHE_TTL | 60 | Token cache TTL in seconds |

### Client Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| MCP_CLIENT_ID | cli-client | OAuth client ID |
| MCP_CALLBACK_PORT | 8085 | Local callback server port |
| MCP_SCOPES | openid,offline_access,mcp:read,mcp:write | Scopes to request |

## Troubleshooting

### "Invalid client credentials" error

1. Verify the client is registered:
   ```bash
   curl http://localhost:4445/admin/clients | jq
   ```

2. Re-register clients:
   ```bash
   docker-compose -f docker/docker-compose.auth.yml restart hydra-clients
   ```

### "PKCE code challenge mismatch" error

Ensure the code_verifier used in token exchange matches the code_challenge used in authorization.

### "Token is not active" error

1. Token may be expired - get a new token
2. Check token with introspection endpoint
3. Verify scopes are correct

### "No authorization server found" error

1. Verify PRM endpoint returns valid data
2. Check authorization_servers array is not empty

## Cleanup

```bash
# Stop and remove containers
docker-compose -f docker/docker-compose.auth.yml down -v

# Remove volumes
docker volume prune -f
```
