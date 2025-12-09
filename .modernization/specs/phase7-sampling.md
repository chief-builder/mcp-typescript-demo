# Phase 7: Sampling with Tools

## Objective

Implement Sampling with Tools (SEP-1577) capability, allowing MCP servers to request LLM completions from connected clients with tool integration. This enables servers to leverage client-side LLM capabilities for complex reasoning while having access to server-side tools.

## Background

MCP Sampling allows servers to request that clients perform LLM completions. The 2025-11-25 specification extends this with tool support, enabling:
- Servers to request completions that can use tools
- Multi-turn conversations between server and client LLM
- Server-orchestrated agentic workflows

## Current State

The chat-server already has basic sampling support via `CreateMessageRequestSchema`. We need to enhance it with tool integration.

## Sampling Flow

```
1. Server needs LLM reasoning with tool access
2. Server → Client: CreateMessage request with tools
3. Client executes LLM completion with provided tools
4. If LLM wants to use a tool:
   a. Client → Server: Tool call
   b. Server executes tool
   c. Server → Client: Tool result
   d. Client continues LLM completion
5. Client → Server: Final completion result
```

## Files to Modify

### Server Sampling Integration
- `packages/servers/dev-tools/src/index.ts` - Add sampling capability with tools
- `packages/servers/analytics/src/index.ts` - Use sampling for data insights
- `packages/servers/knowledge/src/index.ts` - Use sampling for document analysis

### Client Sampling Handler
- `packages/servers/chat-server/src/index.ts` - Enhanced sampling with tool loop
- `packages/clients/cli/src/index.ts` - Support sampling requests
- `packages/clients/web/src/App.tsx` - Handle sampling in web client

### Core Types
- `packages/core/src/sampling/types.ts` - Sampling type definitions
- `packages/core/src/sampling/utils.ts` - Sampling utility functions

## Implementation Pattern

### Server Requests Sampling with Tools
```typescript
// Server requests LLM completion with tool access
server.tool(
  'analyze_code_quality',
  'Analyze code quality using AI',
  { filePath: z.string() },
  async (params, { sampling }) => {
    // Read the file first
    const code = await readFile(params.filePath);

    // Request client to perform LLM analysis with tools
    const result = await sampling.createMessage({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze this code for quality issues:\n\n${code}`
          }
        }
      ],
      maxTokens: 2000,
      modelPreferences: {
        hints: [{ name: 'claude-3-5-sonnet-20241022' }],
        intelligencePriority: 0.8,
      },
      // Include tools the LLM can use during analysis
      includeTools: ['format_code', 'lint_code', 'run_tests'],
    });

    return {
      content: [{ type: 'text', text: result.content.text }]
    };
  }
);
```

### Client Handles Sampling with Tool Loop
```typescript
// Enhanced sampling handler with tool execution loop
client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
  const { messages, maxTokens, modelPreferences, includeTools } = request.params;

  // Get available tools if requested
  let tools = [];
  if (includeTools && includeTools.length > 0) {
    const allTools = await client.listTools();
    tools = allTools.tools.filter(t => includeTools.includes(t.name));
  }

  // Tool execution loop
  let currentMessages = [...messages];
  while (true) {
    const response = await llm.complete({
      messages: currentMessages,
      maxTokens,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      })),
    });

    // Check if LLM wants to use tools
    if (response.stopReason === 'tool_use') {
      for (const toolCall of response.toolCalls) {
        // Execute tool via MCP
        const toolResult = await client.callTool({
          name: toolCall.name,
          arguments: toolCall.arguments,
        });

        // Add tool result to conversation
        currentMessages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: [toolCall],
        });
        currentMessages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          content: toolResult.content,
        });
      }
      continue; // Get next LLM response
    }

    // No more tool calls, return final response
    return {
      model: response.model,
      content: response.content,
      role: 'assistant',
      stopReason: response.stopReason,
    };
  }
});
```

### Sampling Use Cases

#### 1. Code Analysis (dev-tools)
```typescript
// Analyze code with ability to format and lint
await sampling.createMessage({
  messages: [{ role: 'user', content: 'Review this code...' }],
  includeTools: ['format_code', 'lint_code'],
});
```

#### 2. Data Insights (analytics)
```typescript
// Generate insights with ability to query data
await sampling.createMessage({
  messages: [{ role: 'user', content: 'What trends do you see?' }],
  includeTools: ['analyze_csv', 'calculate_statistics'],
});
```

#### 3. Document Curation (knowledge)
```typescript
// Curate documents with search and creation abilities
await sampling.createMessage({
  messages: [{ role: 'user', content: 'Organize these documents...' }],
  includeTools: ['search_documents', 'create_document'],
});
```

## Requirements

1. Add sampling type definitions to core package
2. Update server capability declarations for sampling with tools
3. Implement enhanced sampling handler in chat-server with tool loop
4. Add `includeTools` parameter to sampling requests
5. Implement at least 3 sampling-based tools (one per server type)
6. Handle multi-turn tool conversations during sampling
7. Add timeout and max iterations for tool loops
8. Add tests for sampling with tools

## Acceptance Criteria

- [ ] Core package exports sampling types
- [ ] Servers can request sampling with tool access
- [ ] Chat-server handles sampling tool loop correctly
- [ ] analyze_code_quality uses sampling with format/lint tools
- [ ] Data insights use sampling with analytics tools
- [ ] Document curation uses sampling with knowledge tools
- [ ] Tool loops have iteration limits (prevent infinite loops)
- [ ] Sampling requests timeout appropriately
- [ ] All existing tests pass + new sampling tests

## References

- [MCP Sampling Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [SDK Sampling with Tools (SEP-1577)](https://github.com/modelcontextprotocol/typescript-sdk/releases)
