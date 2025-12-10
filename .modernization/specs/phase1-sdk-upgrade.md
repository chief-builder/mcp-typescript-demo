# Phase 1: SDK Upgrade to @modelcontextprotocol/sdk ^1.24.3

## Objective

Upgrade all packages from the current MCP SDK versions (^1.0.0 and ^1.18.1) to ^1.24.3, which aligns with the MCP 2025-11-25 specification and includes support for Tasks, URL Elicitation, JSON Schema 2020-12, and other new features.

## Current State

| Package | Current Version |
|---------|-----------------|
| @mcp-demo/core | ^1.0.0 |
| @mcp-demo/dev-tools-server | ^1.0.0 |
| @mcp-demo/analytics-server | ^1.0.0 |
| @mcp-demo/cloud-ops-server | ^1.0.0 |
| @mcp-demo/knowledge-server | ^1.0.0 |
| @mcp-demo/chat-server | ^1.18.1 |

## Files to Modify

### Package Files
- `packages/core/package.json` - Update @modelcontextprotocol/sdk to ^1.24.3
- `packages/servers/dev-tools/package.json` - Update @modelcontextprotocol/sdk to ^1.24.3
- `packages/servers/analytics/package.json` - Update @modelcontextprotocol/sdk to ^1.24.3
- `packages/servers/cloud-ops/package.json` - Update @modelcontextprotocol/sdk to ^1.24.3
- `packages/servers/knowledge/package.json` - Update @modelcontextprotocol/sdk to ^1.24.3
- `packages/servers/chat-server/package.json` - Update @modelcontextprotocol/sdk to ^1.24.3

### Zod Upgrade
- All package.json files with zod dependency - Upgrade to ^3.25+ for Zod v4 compatibility

## Requirements

1. Update `@modelcontextprotocol/sdk` to `^1.24.3` in all packages
2. Upgrade `zod` to `^3.25.0` or later for Zod v4 compatibility (SDK imports from zod/v4)
3. Run `pnpm install` to update lockfile
4. Run `pnpm build` to verify TypeScript compilation
5. Run `pnpm test` to ensure all existing tests pass
6. Fix any breaking API changes from SDK upgrade

## Breaking Changes to Address

From SDK 1.18 to 1.24:
- Zod import paths may need adjustment (SDK uses zod/v4 internally)
- New schema validation patterns with `.catchall()`
- Updated type definitions for Tasks, Elicitation

## Acceptance Criteria

- [ ] All packages use @modelcontextprotocol/sdk ^1.24.3
- [ ] All packages use zod ^3.25.0 or later
- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` succeeds for all packages
- [ ] `pnpm test` shows all tests passing (259+ tests)
- [ ] No TypeScript compilation errors

## Commands to Run

```bash
# Update dependencies
pnpm install

# Verify build
pnpm build

# Run tests
pnpm test
```

## References

- [MCP TypeScript SDK Releases](https://github.com/modelcontextprotocol/typescript-sdk/releases)
- [npm @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [MCP 2025-11-25 Specification](https://modelcontextprotocol.io/specification/2025-11-25)
