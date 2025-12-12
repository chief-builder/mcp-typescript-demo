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

# List registered clients
curl http://localhost:4445/admin/clients | jq
```

### Test Credentials

| Username | Password | Description |
|----------|----------|-------------|
| demo     | demo     | Demo user   |
| admin    | admin    | Admin user  |

### Registered OAuth Clients

| Client ID | Type | Purpose |
|-----------|------|---------|
| cli-client | Public (PKCE) | User authentication |
| analytics-server | Confidential | Token introspection |
| dev-tools-server | Confidential | Token introspection |

## Step 2: Start Analytics Server with Auth

```bash
# From project root
cd packages/servers/analytics
pnpm start -- --http
```

Expected output:
```
{"timestamp":"...","level":"info","logger":"analytics-server","message":"Starting MCP Analytics Server (HTTP mode on port 3002)"}
[Auth] Protected Resource Metadata: http://localhost:3002/.well-known/oauth-protected-resource
[Auth] Authorization Server: http://localhost:4444
[Auth] Auth enabled for /mcp
{"timestamp":"...","level":"info","logger":"analytics-server","message":"Analytics HTTP Server listening on port 3002"}

==============================================
MCP ANALYTICS SERVER

Transport: HTTP/SSE
Port: 3002

Available Tools:
- analyze_csv: Analyze CSV file and provide insights
- generate_sample_data: Generate sample dataset
- calculate_statistics: Calculate statistical measures

Available Resources:
- analytics://datasets/samples: Sample datasets

Available Prompts:
- data_analysis_workflow: Data analysis workflow guide
==============================================
```

### Verify Protected Resource Metadata

```bash
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

### Verify 401 Response (No Token)

```bash
curl -v -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

Expected: HTTP 401 with header:
```
WWW-Authenticate: Bearer resource_metadata="http://localhost:3002/.well-known/oauth-protected-resource"
```

## Step 3: Test OAuth Flow Manually

### 3.1 Get Authorization Code

Open this URL in a browser:
```
http://localhost:4444/oauth2/auth?response_type=code&client_id=cli-client&redirect_uri=http://localhost:8085/callback&scope=openid%20offline_access%20analytics:read%20analytics:write&state=teststate12345678&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256
```

> **Note:** The `state` parameter is required and must be at least 8 characters for CSRF protection.

1. Login with `demo/demo`
2. Grant consent (if prompted)
3. You'll be redirected to `http://localhost:8085/callback?code=AUTH_CODE&state=teststate12345678`
4. Copy the `code` from the redirect URL (the page won't load since there's no callback server)

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

> **Note:** The `code_verifier` above matches the `code_challenge` in step 3.1. The challenge is the SHA256 hash of the verifier.

Expected response:
```json
{
  "access_token": "ory_at_...",
  "expires_in": 3600,
  "id_token": "eyJ...",
  "refresh_token": "ory_rt_...",
  "scope": "openid offline_access analytics:read analytics:write",
  "token_type": "bearer"
}
```

### 3.3 Use Token to Access MCP Server

```bash
# Replace TOKEN with the access_token from step 3.2
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

Expected response (SSE format):
```
event: message
data: {"result":{"protocolVersion":"2025-03-26","capabilities":{"logging":{},"elicitation":{},"completion":{},"prompts":{"listChanged":true},"resources":{"subscribe":true,"listChanged":true},"sampling":{},"tools":{"listChanged":true},"completions":{}},"serverInfo":{"name":"analytics-server","version":"1.0.0"}},"jsonrpc":"2.0","id":1}
```

Server logs should show:
```
[Auth] Introspecting token at http://localhost:4445/admin/oauth2/introspect
[Auth] Introspection result: active=true, scope="openid offline_access analytics:read analytics:write", sub="demo"
[Auth] Token audience: [], expected: http://localhost:3002
[Auth] Token validated successfully
{"timestamp":"...","level":"info","logger":"analytics-server","message":"Received POST request to /mcp"}
{"timestamp":"...","level":"info","logger":"analytics-server","message":"StreamableHTTP session initialized with ID: ..."}
```

### 3.4 Call a Tool (with session)

After initialize, use the session ID from the response header for subsequent requests:

```bash
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer TOKEN" \
  -H "Mcp-Session-Id: SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

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
  "token_type": "access_token",
  "exp": 1765543571,
  "iat": 1765539971
}
```

## Step 5: Test Client Credentials Flow (M2M)

For server-to-server authentication:

```bash
# Get a token using client credentials
curl -X POST http://localhost:4444/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "analytics-server:analytics-server-secret" \
  -d "grant_type=client_credentials" \
  -d "scope=introspect"
```

## Test Checklist

### Server-Side Tests

- [x] Protected Resource Metadata endpoint returns correct data
- [x] Unauthenticated requests return 401 with WWW-Authenticate header
- [x] WWW-Authenticate header includes resource_metadata URL
- [x] Valid tokens are accepted
- [x] Token introspection validates tokens
- [x] Required scopes are enforced (analytics:read)
- [ ] Expired tokens are rejected
- [ ] Invalid tokens are rejected
- [ ] Token caching works (introspection not called for cached tokens)

### Client-Side Tests

- [ ] Discovery fetches PRM from 401 response
- [ ] Discovery fetches AS metadata
- [x] PKCE code verifier is generated correctly
- [x] PKCE code challenge is S256 encoded
- [ ] Authorization URL opens in browser
- [ ] Callback server receives auth code
- [ ] Token exchange succeeds
- [ ] Access token is stored
- [ ] Refresh token flow works
- [ ] Authenticated requests include Bearer token

### Integration Tests

- [x] Full OAuth flow: authorize → token → access (manual)
- [ ] Full OAuth flow: automated with CLI client
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

### "Not Acceptable: Client must accept both application/json and text/event-stream"

Add the Accept header to your request:
```bash
-H "Accept: application/json, text/event-stream"
```

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

Ensure the code_verifier used in token exchange matches the code_challenge used in authorization. The challenge is `BASE64URL(SHA256(verifier))`.

### "Token is not active" error

1. Token may be expired - get a new token
2. Check token with introspection endpoint
3. Verify scopes are correct

### "No authorization server found" error

1. Verify PRM endpoint returns valid data
2. Check authorization_servers array is not empty

### "state is missing or does not have enough characters"

The `state` parameter must be at least 8 characters. Add `&state=teststate12345678` to the authorization URL.

## Cleanup

```bash
# Stop and remove containers
docker-compose -f docker/docker-compose.auth.yml down -v

# Remove volumes
docker volume prune -f
```

## References

- [MCP 2025-11-25 Authorization Spec](https://spec.modelcontextprotocol.io/specification/2025-11-25/basic/authorization/)
- [OAuth 2.1 (draft)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [Protected Resource Metadata RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728)
- [Ory Hydra Documentation](https://www.ory.sh/docs/hydra/)
- [ADR-001: OAuth Audience Validation](docs/adr/001-oauth-audience-validation.md)
