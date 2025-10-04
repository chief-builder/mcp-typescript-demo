# Enhanced Chat Server Features

The chat server has been upgraded with advanced LLM provider integration and streaming capabilities.

## 🚀 New Features

### Multi-Provider LLM Support

The chat server now supports multiple LLM providers through a unified abstraction layer:

- **Claude (Anthropic)**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus
- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo
- **Extensible**: Easy to add new providers

### Server-Sent Events Streaming

Real-time streaming responses using Server-Sent Events (SSE):
- Chunk-by-chunk content delivery
- Progress indicators
- Error handling
- Graceful completion

### Dynamic Provider Switching

Switch between LLM providers at runtime:
- List available providers
- Check provider capabilities
- Switch active provider
- Health monitoring

## 📡 API Endpoints

### Chat Endpoints

#### `POST /chat` - Enhanced Chat
```json
{
  "message": "Hello, world!",
  "provider": "claude",  // optional: claude | openai
  "stream": false        // optional: enable streaming
}
```

**Regular Response:**
```json
{
  "response": "Hello! How can I help you today?",
  "provider": "claude",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

**Streaming Response (SSE):**
```
data: {"content": "Hello"}
data: {"content": "! How"}
data: {"content": " can I"}
data: {"finishReason": "stop"}
data: [DONE]
```

### Provider Management

#### `GET /providers` - List Providers
```json
{
  "providers": [
    {
      "name": "claude",
      "type": "claude",
      "isDefault": true
    },
    {
      "name": "openai", 
      "type": "openai",
      "isDefault": false
    }
  ],
  "current": "claude",
  "count": 2
}
```

#### `POST /providers/:name/select` - Switch Provider
```json
{
  "success": true,
  "provider": "openai",
  "message": "Switched to provider: openai"
}
```

### Health Check

#### `GET /health` - Enhanced Health Check
```json
{
  "status": "ok",
  "server": "chat-server",
  "version": "1.0.0",
  "connected_servers": ["dev-tools"],
  "llm_providers": ["claude", "openai"],
  "current_provider": "claude"
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your_claude_api_key

# Optional
OPENAI_API_KEY=your_openai_api_key
```

### Provider Configuration

Providers are automatically configured based on available API keys:
- Claude provider is always available if `ANTHROPIC_API_KEY` is set
- OpenAI provider is available if `OPENAI_API_KEY` is set

## 🏃‍♀️ Running the Server

### Development Mode
```bash
npm run dev:chat
```

### Production Mode
```bash
cd packages/servers/chat-server
npm run build
npm run start
```

## 🧪 Testing

### Test Streaming Functionality
```bash
npm run test:streaming
```

### Manual Testing

#### Test Regular Chat
```bash
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "provider": "claude"}'
```

#### Test Streaming Chat
```bash
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Count to 5", "stream": true}' \
  --no-buffer
```

#### Test Provider Switching
```bash
# List providers
curl http://localhost:4000/providers

# Switch to OpenAI
curl -X POST http://localhost:4000/providers/openai/select
```

## 🔌 Integration with MCP

The enhanced chat server maintains full compatibility with MCP:
- Tool calling through MCP servers
- Sampling requests from MCP servers
- Elicitation support for user interaction
- Resource access via MCP protocol

## 📈 Performance

### Streaming Benefits
- Reduced perceived latency
- Better user experience
- Efficient bandwidth usage
- Real-time feedback

### Provider Selection
- Automatic provider health checking
- Cost-aware model selection
- Capability-based routing
- Fallback mechanisms

## 🛡️ Error Handling

### Robust Error Management
- Provider-specific error handling
- Retry logic with exponential backoff
- Rate limiting protection
- Graceful degradation

### Error Response Format
```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "retryable": true,
  "details": {...}
}
```

## 🔄 Migration Guide

### From Legacy Chat Server

The enhanced server is fully backward compatible:
1. Existing `/chat` endpoint works unchanged
2. New features are opt-in via request parameters
3. Health endpoint provides additional information
4. No breaking changes to existing integrations

### Configuration Updates

```bash
# Old: Only Claude
ANTHROPIC_API_KEY=your_key

# New: Multi-provider support
ANTHROPIC_API_KEY=your_claude_key
OPENAI_API_KEY=your_openai_key  # optional
```

## 🚦 Status & Monitoring

The server provides comprehensive status information:
- Provider health status
- Current active provider
- Connected MCP servers
- Real-time metrics

This enhanced chat server provides a solid foundation for building sophisticated AI applications with multiple LLM providers and real-time streaming capabilities.