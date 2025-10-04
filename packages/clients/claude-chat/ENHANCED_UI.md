# Enhanced Claude Chat UI

The Claude Chat UI has been upgraded with multi-provider support and streaming capabilities.

## 🚀 New Features

### 1. Multi-Provider Support
- **Provider Dropdown**: Select between available LLM providers (Claude, OpenAI)
- **Dynamic Switching**: Change providers on-the-fly without restarting
- **Provider Icons**: Visual indicators for different providers
- **Default Provider**: Server-configured default provider

### 2. Streaming Support
- **Real-time Responses**: Watch AI responses appear word-by-word
- **Streaming Toggle**: Enable/disable streaming per preference
- **Visual Cursor**: Blinking cursor during streaming
- **Smooth Experience**: No UI freezing during long responses

### 3. Enhanced Message Display
- **Provider Attribution**: See which AI provider generated each response
- **Timestamps**: Message timing for all interactions
- **Tool Usage Indicators**: When MCP tools are used
- **Error States**: Clear error messages with styling

## 🎨 UI Components

### Provider Dropdown
Located in the input area, shows:
- Current provider with icon
- Dropdown menu with all available providers
- Default provider indicator
- Provider count

### Streaming Toggle
- Checkbox to enable/disable streaming
- Persists across messages
- Located next to provider dropdown

### Message Enhancements
- Provider icon and name in assistant messages
- Streaming cursor animation
- Improved spacing and layout

## 🔧 Configuration

### Environment Setup
The UI automatically detects available providers from the chat server:
- If only Claude is configured, dropdown is disabled
- If multiple providers available, switching is enabled

### Streaming Behavior
When streaming is enabled:
- Responses appear character by character
- A blinking cursor shows active streaming
- UI remains responsive
- Can still type while receiving responses

## 🎯 Usage Tips

### Provider Selection
1. Click the provider dropdown
2. Select desired provider
3. System message confirms the switch
4. Next message uses selected provider

### Streaming Mode
- **Enable**: For real-time feedback on long responses
- **Disable**: For faster complete responses
- Best for: Code generation, explanations, creative writing

### Performance
- Streaming reduces perceived latency
- Provider switching is instant
- No page refresh needed

## 🖼️ Visual Guide

### Provider Icons
- 🧠 **Claude**: Brain icon (Anthropic)
- ✨ **OpenAI**: Sparkles icon
- ⚡ **Others**: Lightning icon

### Status Indicators
- 🟢 Green: Connected to chat server
- 🔴 Red: Server error
- ⚫ Gray: Disconnected

### Message States
- Loading: Spinning indicator
- Streaming: Blinking cursor
- Complete: Static text
- Error: Red background

## 🔌 Server Integration

The enhanced UI requires the enhanced chat server with:
- `/providers` endpoint for listing
- `/providers/:name/select` for switching
- Streaming support in `/chat` endpoint
- Provider info in responses

## 🚦 Running the Enhanced UI

### Development Mode
```bash
cd packages/clients/claude-chat
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### With Chat Server
1. Start dev-tools server (HTTP mode)
2. Start enhanced chat server
3. Start claude-chat UI
4. Navigate to http://localhost:5173

The enhanced UI provides a modern, responsive interface for interacting with multiple AI providers through the MCP protocol!