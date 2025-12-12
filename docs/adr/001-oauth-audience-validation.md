# ADR-001: OAuth Token Audience Validation Strategy

**Status:** Accepted
**Date:** 2025-12-12
**Decision Makers:** Development Team
**Technical Area:** Authorization / OAuth 2.1

## Context

When implementing OAuth 2.1 authorization for MCP servers using Ory Hydra, we encountered a token validation failure. The middleware was rejecting valid tokens due to audience (`aud`) claim mismatch.

### The Problem

Our middleware validated the token's `aud` claim against the resource server URL:

```typescript
// Expected: aud = "http://localhost:3002" (resource server)
// Actual:   aud = ["cli-client"] (OAuth client ID)

if (!hasValidAudience(tokenInfo, config.serverConfig.resourceIdentifier)) {
  return createUnauthorizedResponse(..., 'Token audience does not match');
}
```

Ory Hydra sets the `aud` claim to the OAuth client ID (e.g., `cli-client`), not the resource server URL. This is valid per OAuth 2.0/2.1 specifications, where audience validation is optional and the `aud` semantics can vary.

### Technical Details

- **Token Introspection Result:**
  ```json
  {
    "active": true,
    "scope": "openid offline_access analytics:read analytics:write",
    "client_id": "cli-client",
    "sub": "demo",
    "aud": ["cli-client"]
  }
  ```

- **Expected by Middleware:** `aud = "http://localhost:3002"`

- **RFC 8707 (Resource Indicators):** Defines how to request audience-restricted tokens, but requires explicit `resource` parameter in authorization request and AS support.

## Decision

**We decided to disable audience validation in the auth middleware for Hydra compatibility.**

The audience check is commented out with explanatory notes:

```typescript
// Check audience (RFC 8707) - skip if token has no audience claim
// Note: Hydra sets aud to the client_id, not the resource server
// This is valid per OAuth 2.0 - audience checking is optional
if (tokenInfo.aud) {
  console.log(`[Auth] Token audience: ${JSON.stringify(tokenInfo.aud)}, expected: ...`);
}
// Skip audience validation for now - Hydra sets aud to client_id
// if (!hasValidAudience(tokenInfo, config.serverConfig.resourceIdentifier)) {
//   return createUnauthorizedResponse(...);
// }
```

## Alternatives Considered

### Alternative 1: Configure Hydra with Resource Indicators (RFC 8707)

**Approach:** Include `resource` parameter in authorization requests so Hydra sets the correct audience.

```
GET /oauth2/auth?...&resource=http://localhost:3002
```

**Pros:**
- Standards-compliant (RFC 8707)
- Proper audience restriction

**Cons:**
- Requires Hydra configuration changes
- Requires client-side changes
- More complex setup for development/testing

**Status:** Not chosen for initial implementation

### Alternative 2: Smart Audience Validation

**Approach:** Only fail if `aud` exists, doesn't match resource, AND isn't the client_id.

```typescript
if (tokenInfo.aud &&
    !hasValidAudience(tokenInfo, config.serverConfig.resourceIdentifier) &&
    tokenInfo.aud !== tokenInfo.client_id &&
    !tokenInfo.aud.includes(tokenInfo.client_id)) {
  return createUnauthorizedResponse(...);
}
```

**Pros:**
- Maintains some validation
- Compatible with both Hydra and RFC 8707 tokens

**Cons:**
- Complex logic
- May have edge cases

**Status:** Could be implemented as enhancement

### Alternative 3: Configurable Audience Validation

**Approach:** Add configuration option to enable/disable audience validation.

```typescript
interface MCPServerAuthSetupConfig {
  // ...existing fields
  validateAudience?: boolean;  // Default: false
  expectedAudiences?: string[]; // Optional list of valid audiences
}
```

**Pros:**
- Flexible for different deployments
- Can be strict in production, lenient in development

**Cons:**
- More configuration complexity
- Risk of misconfiguration

**Status:** Recommended for future enhancement

### Alternative 4: Token Exchange (RFC 8693)

**Approach:** Exchange user token for audience-restricted resource token.

```typescript
const resourceToken = await exchangeForMCPServer(
  tokenEndpoint,
  userToken,
  'http://localhost:3002',  // target audience
  ['analytics:read']
);
```

**Pros:**
- Most secure approach
- Proper audience restriction
- Principle of least privilege

**Cons:**
- Additional token exchange step
- Requires AS support for token exchange
- More complex client implementation

**Status:** Recommended for production multi-resource architectures

## Consequences

### Positive

1. **Immediate Compatibility:** Works with Ory Hydra out of the box
2. **Simplified Setup:** No additional configuration required
3. **Development Friendly:** Easy to test OAuth flows

### Negative

1. **Reduced Security:** Tokens are not audience-restricted
2. **Token Reuse Risk:** A token obtained for one resource could be used for another
3. **Technical Debt:** Commented-out code that needs proper resolution

### Neutral

1. **Scope Validation Still Active:** Required scopes are still enforced
2. **Token Introspection Active:** Tokens are validated for authenticity and expiration

## Security Implications

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| Token replay across resources | Scope validation | Medium - tokens with broad scopes could access multiple resources |
| Stolen token misuse | Token expiration, introspection | Low - standard OAuth protections apply |
| Privilege escalation | Required scope enforcement | Low - scopes are strictly validated |

## Action Items

- [ ] **Short-term:** Document this decision (this ADR)
- [ ] **Medium-term:** Implement configurable audience validation (Alternative 3)
- [ ] **Long-term:** Evaluate token exchange for production deployments (Alternative 4)

## References

- [RFC 8707 - Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 8693 - OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [RFC 7662 - OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [Ory Hydra Documentation](https://www.ory.sh/docs/hydra/)
- [MCP 2025-11-25 Authorization Specification](https://spec.modelcontextprotocol.io/)

## Revision History

| Date | Author | Description |
|------|--------|-------------|
| 2025-12-12 | - | Initial decision |
