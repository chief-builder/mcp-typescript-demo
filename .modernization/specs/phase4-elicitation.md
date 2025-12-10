# Phase 4: Elicitation Enhancements

## Objective

Enhance elicitation capabilities with URL Elicitation (SEP-1036) support, enabling secure browser-based flows for OAuth authentication, payments, API key input, and other sensitive operations that require user interaction outside the chat interface.

## Background

MCP supports two elicitation modes:
1. **Form Elicitation** (existing) - Server requests structured input via JSON schema
2. **URL Elicitation** (new) - Server requests user to visit URL for secure flows

URL Elicitation is critical for:
- OAuth authorization flows
- Payment processing
- Secure credential entry
- External service authorization
- File uploads via web interface

## Current State

The chat-server already has basic form elicitation support via `ElicitRequestSchema`. We need to add URL elicitation.

## Files to Modify

### Server Updates
- `packages/servers/chat-server/src/index.ts` - Add URL elicitation handling
- `packages/servers/dev-tools/src/index.ts` - Add elicitation capability declaration
- `packages/servers/cloud-ops/src/index.ts` - Use URL elicitation for cloud auth

### Client Updates
- `packages/clients/claude-chat/src/App.tsx` - Add URL elicitation UI
- `packages/clients/web/src/App.tsx` - Add URL elicitation component
- `packages/clients/cli/src/index.ts` - Handle URL elicitation (open browser)

### Core Types
- `packages/core/src/types/elicitation.ts` - URL elicitation type definitions

## Implementation Pattern

### Server Capability Declaration
```typescript
const server = new McpServer({
  name: 'cloud-ops-server',
  version: '1.0.0',
}, {
  capabilities: {
    elicitation: {
      supportsUrlElicitation: true,
      supportedSchemes: ['https'],
    }
  }
});
```

### URL Elicitation Request
```typescript
// Server requests OAuth flow
async function requestOAuthAuthorization(server: McpServer, service: string) {
  const result = await server.elicit({
    type: 'url',
    title: `Authorize ${service}`,
    message: `Please authorize access to your ${service} account`,
    url: `https://oauth.${service}.com/authorize?client_id=...&redirect_uri=...`,
    callbackUrl: 'http://localhost:3003/oauth/callback',
  });

  if (result.action === 'completed') {
    return result.data; // Contains OAuth tokens
  }
  throw new Error('Authorization cancelled');
}
```

### Client URL Elicitation Handler
```typescript
// React component for URL elicitation
function UrlElicitationModal({ elicitation, onComplete, onCancel }) {
  const handleOpenUrl = () => {
    window.open(elicitation.url, '_blank');
  };

  return (
    <Modal>
      <h2>{elicitation.title}</h2>
      <p>{elicitation.message}</p>
      <Button onClick={handleOpenUrl}>Open Authorization Page</Button>
      <Button onClick={onCancel}>Cancel</Button>
    </Modal>
  );
}
```

### CLI URL Elicitation
```typescript
// CLI handler opens browser
async function handleUrlElicitation(elicitation: UrlElicitation) {
  console.log(`\n${elicitation.title}`);
  console.log(elicitation.message);
  console.log(`\nOpening: ${elicitation.url}`);

  // Open browser
  await open(elicitation.url);

  // Wait for callback
  const result = await waitForCallback(elicitation.callbackUrl);
  return result;
}
```

## Use Cases to Implement

### 1. Cloud Service OAuth (cloud-ops)
```typescript
// When deploying to cloud, request OAuth if not authenticated
server.tool('deploy_service', ..., async (params) => {
  if (!hasCloudCredentials()) {
    const auth = await server.elicit({
      type: 'url',
      title: 'Cloud Authorization Required',
      url: getOAuthUrl('aws'),
    });
  }
  // Continue with deployment
});
```

### 2. GitHub Integration (dev-tools)
```typescript
// Request GitHub OAuth for repository access
server.tool('scan_project', ..., async (params) => {
  if (params.includeGitHub && !hasGitHubToken()) {
    await server.elicit({
      type: 'url',
      title: 'GitHub Authorization',
      url: getGitHubOAuthUrl(),
    });
  }
});
```

## Requirements

1. Add URL elicitation type definitions to core package
2. Update server capability declarations with elicitation support
3. Implement URL elicitation request/response handling in chat-server
4. Add URL elicitation UI component to claude-chat client
5. Add URL elicitation support to CLI (opens browser)
6. Implement at least one OAuth flow (e.g., GitHub in dev-tools)
7. Handle callback URL processing
8. Add tests for URL elicitation flows

## Acceptance Criteria

- [ ] Core types include URL elicitation definitions
- [ ] Servers declare elicitation capabilities
- [ ] Chat-server handles URL elicitation requests
- [ ] claude-chat shows URL elicitation modal
- [ ] CLI opens browser for URL elicitation
- [ ] At least one OAuth integration works end-to-end
- [ ] Elicitation can be cancelled by user
- [ ] All existing tests pass + new elicitation tests

## References

- [MCP Elicitation Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [SDK URL Elicitation (SEP-1036)](https://github.com/modelcontextprotocol/typescript-sdk/releases)
- [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
