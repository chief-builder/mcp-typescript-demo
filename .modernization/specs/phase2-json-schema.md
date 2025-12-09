# Phase 2: JSON Schema 2020-12 Migration

## Objective

Migrate all MCP schema definitions from the default JSON Schema dialect to JSON Schema 2020-12, as specified in the MCP 2025-11-25 specification. This includes updating tool input schemas, resource templates, and validation patterns.

## Background

The MCP 2025-11-25 specification establishes JSON Schema 2020-12 as the default dialect. Key changes include:
- `$schema` declaration for 2020-12
- Use of `unevaluatedProperties` instead of `additionalProperties` in some cases
- Better support for `$ref` and `$defs`
- Updated vocabulary keywords

## Files to Modify

### Server Tool Schemas
- `packages/servers/dev-tools/src/index.ts` - Update tool inputSchema definitions
- `packages/servers/analytics/src/index.ts` - Update tool inputSchema definitions
- `packages/servers/cloud-ops/src/index.ts` - Update tool inputSchema definitions
- `packages/servers/knowledge/src/index.ts` - Update tool inputSchema definitions

### Core Schemas
- `packages/core/src/schemas/index.ts` - Update Zod schemas with .catchall() patterns

### Tool-Specific Files
- `packages/servers/dev-tools/src/tools/*.ts` - Individual tool schema updates
- `packages/servers/analytics/src/tools/*.ts` - Individual tool schema updates
- `packages/servers/cloud-ops/src/tools/*.ts` - Individual tool schema updates
- `packages/servers/knowledge/src/tools/*.ts` - Individual tool schema updates

## Requirements

1. Add `$schema: "https://json-schema.org/draft/2020-12/schema"` to all tool inputSchemas
2. Update Zod schemas to use `.catchall(z.unknown())` for extensibility
3. Replace `additionalProperties: false` with appropriate 2020-12 patterns where needed
4. Ensure all schemas validate correctly with JSON Schema 2020-12 validators
5. Update resource template schemas similarly

## Schema Pattern Changes

### Before (JSON Schema draft-07)
```typescript
inputSchema: {
  type: 'object',
  properties: {
    code: { type: 'string' },
    language: { type: 'string' }
  },
  required: ['code'],
  additionalProperties: false
}
```

### After (JSON Schema 2020-12)
```typescript
inputSchema: {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    code: { type: 'string' },
    language: { type: 'string' }
  },
  required: ['code']
}
```

## Zod Pattern Changes

### Before
```typescript
const schema = z.object({
  code: z.string(),
  language: z.string().optional()
}).strict();
```

### After
```typescript
const schema = z.object({
  code: z.string(),
  language: z.string().optional()
}).catchall(z.unknown());
```

## Acceptance Criteria

- [ ] All tool inputSchemas include `$schema` for 2020-12
- [ ] Zod schemas updated with `.catchall()` patterns
- [ ] All existing tests pass
- [ ] Tools accept valid input according to new schemas
- [ ] Schema validation errors are properly reported

## References

- [JSON Schema 2020-12 Specification](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [MCP 2025-11-25 Changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog)
- [Zod catchall() documentation](https://zod.dev/?id=catchall)
