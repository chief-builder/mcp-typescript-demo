# Phase 5: Resource Annotations and Metadata

## Objective

Add annotation support to tools, resources, resource templates, and prompts as specified in MCP 2025-11-25. Annotations provide metadata including icons, hints, and behavioral descriptions that help clients display and use MCP primitives effectively.

## Background

The MCP 2025-11-25 specification allows servers to expose icons and annotations as additional metadata. This enables:
- Visual icons for tools, resources, and prompts in UI clients
- Behavioral hints (read-only, idempotent, destructive)
- Audience targeting (user-facing, assistant-facing)
- Priority/ordering hints

## Annotation Types

### Tool Annotations
```typescript
interface ToolAnnotations {
  /** Human-readable title */
  title?: string;
  /** Whether tool only reads data (no side effects) */
  readOnlyHint?: boolean;
  /** Whether repeated calls have same effect */
  idempotentHint?: boolean;
  /** Whether tool can cause destructive changes */
  destructiveHint?: boolean;
  /** Whether requires user confirmation */
  requiresConfirmation?: boolean;
  /** Icon URL or data URI */
  icon?: string;
}
```

### Resource Annotations
```typescript
interface ResourceAnnotations {
  /** Intended audience */
  audience?: ('user' | 'assistant')[];
  /** Priority for display ordering (higher = more important) */
  priority?: number;
  /** Icon URL or data URI */
  icon?: string;
}
```

## Files to Modify

### Server Tool Annotations
- `packages/servers/dev-tools/src/index.ts` - Add annotations to tools
- `packages/servers/analytics/src/index.ts` - Add annotations to tools
- `packages/servers/cloud-ops/src/index.ts` - Add annotations to tools
- `packages/servers/knowledge/src/index.ts` - Add annotations to tools

### Resource Annotations
- `packages/servers/dev-tools/src/resources/*.ts` - Add resource annotations
- `packages/servers/analytics/src/resources/*.ts` - Add resource annotations
- `packages/servers/cloud-ops/src/resources/*.ts` - Add resource annotations
- `packages/servers/knowledge/src/resources/*.ts` - Add resource annotations

### Client Updates
- `packages/clients/web/src/App.tsx` - Display tool/resource icons
- `packages/clients/claude-chat/src/App.tsx` - Show annotations in UI

### Core Types
- `packages/core/src/types/annotations.ts` - Annotation type definitions

## Implementation Pattern

### Tool with Annotations
```typescript
server.tool(
  'format_code',
  {
    description: 'Format source code using Prettier',
    annotations: {
      title: 'Format Code',
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
      icon: 'data:image/svg+xml;base64,...', // Or URL
    }
  },
  {
    code: z.string(),
    language: z.string().optional(),
  },
  async (params) => { /* ... */ }
);
```

### Resource with Annotations
```typescript
server.resource(
  'project-structure',
  'file://project/structure',
  {
    description: 'Current project directory structure',
    annotations: {
      audience: ['user', 'assistant'],
      priority: 100, // High priority
      icon: 'https://icons.example.com/folder.svg',
    }
  },
  async () => { /* ... */ }
);
```

### Prompt with Annotations
```typescript
server.prompt(
  'code-review',
  {
    description: 'Start a code review session',
    annotations: {
      title: 'Code Review',
      icon: 'data:image/svg+xml;base64,...',
    }
  },
  async (params) => { /* ... */ }
);
```

## Tool Annotation Mapping

| Tool | readOnlyHint | idempotentHint | destructiveHint |
|------|--------------|----------------|-----------------|
| format_code | false | true | false |
| read_file | true | true | false |
| list_files | true | true | false |
| scan_project | true | true | false |
| analyze_csv | true | true | false |
| generate_sample_data | false | false | false |
| deploy_service | false | false | true |
| scale_service | false | false | false |
| check_service_health | true | true | false |
| create_document | false | false | false |
| search_documents | true | true | false |

## Icon Strategy

1. **SVG Data URIs** - For small, embedded icons
2. **Icon URLs** - Reference external icon service
3. **Icon Library** - Create shared icon constants in core

```typescript
// packages/core/src/icons/index.ts
export const TOOL_ICONS = {
  code: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0c...',
  file: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0c...',
  deploy: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0c...',
  search: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0c...',
  // ...
};
```

## Requirements

1. Create annotation type definitions in core package
2. Create icon constants library in core package
3. Add annotations to all tools in all servers
4. Add annotations to all resources in all servers
5. Add annotations to all prompts
6. Update web client to display icons
7. Update claude-chat to show behavioral hints
8. Add tests for annotation validation

## Acceptance Criteria

- [ ] Core package exports annotation types
- [ ] Icon library created with SVG data URIs
- [ ] All tools have appropriate annotations
- [ ] All resources have annotations with audience/priority
- [ ] All prompts have title and icon annotations
- [ ] Web client displays tool icons
- [ ] Destructive tools show warning indicator
- [ ] All existing tests pass + new annotation tests

## References

- [MCP 2025-11-25 Specification - Annotations](https://modelcontextprotocol.io/specification/2025-11-25)
- [Lucide Icons](https://lucide.dev/) - For icon inspiration
