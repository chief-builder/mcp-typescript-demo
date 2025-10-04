# MCP Control Patterns Demonstration

## Understanding MCP Primitives Control

### 1. Tools (Model-Controlled) ✅ Demonstrated
- **Who decides**: Claude/AI model decides when to use
- **Test in Claude Chat**: "Format this code: function test(){}"
- **What happens**: Claude analyzes request → decides to use format_code tool → executes it
- **Use case**: Adding capabilities to AI assistants

### 2. Resources (App-Controlled) 
- **Who decides**: Application fetches directly (NOT Claude)
- **Test in existing web client**: 
  - Connect to dev-tools server
  - Go to Resources tab
  - Click "Read" on `devtools://config/project`
- **What happens**: App directly fetches resource → displays in UI
- **Use case**: Populating UI elements, autocomplete, file browsers

### 3. Prompts (User-Controlled)
- **Who decides**: User explicitly triggers via UI action
- **Test in existing web client**:
  - Connect to dev-tools server
  - Go to Prompts tab
  - Select `code_review` prompt
  - Fill in arguments and execute
- **What happens**: User action → server returns pre-defined prompt template → sent to AI
- **Use case**: Slash commands, workflow templates, guided interactions

## Key Differences

| Primitive | Control | Example | Who Initiates |
|-----------|---------|---------|---------------|
| Tools | Model | Claude decides to format code | AI based on user intent |
| Resources | App | File browser fetches directory listing | App UI directly |
| Prompts | User | User clicks "/review" button | User explicit action |

## Testing All Three

1. **Model-Controlled (Tools)**: Use Claude Chat UI - natural language
2. **App-Controlled (Resources)**: Use existing web client - Resources tab
3. **User-Controlled (Prompts)**: Use existing web client - Prompts tab

This demonstrates the full MCP protocol design where different primitives serve different purposes!