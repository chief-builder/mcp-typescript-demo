# MCP Client-Server Communication Flows

## Enhanced Model Context Protocol (MCP) v2025-06-18 Diagram

```mermaid
flowchart TD
    subgraph MCP["🌐 MODEL CONTEXT PROTOCOL (MCP) v2025-06-18"]
        direction TB
        
        %% Main entities
        CLIENT["🤖 MCP CLIENT<br/>(AI Assistant/Host)"]
        SERVER["⚙️ MCP SERVER<br/>(Capability Provider)"]
        
        %% Protocol flow
        CLIENT ===|"📡 JSON-RPC 2.0"| SERVER
        
        subgraph LIFECYCLE["🚀 LIFECYCLE MANAGEMENT"]
            L1["Initialize Request<br/>(capabilities, clientInfo)"]
            L2["Initialize Result<br/>(serverInfo, capabilities)"]
            L3["Initialized Notification"]
        end
        
        subgraph CORE["⭐ CORE CAPABILITIES"]
            direction TB
            
            subgraph TOOLS["🔧 TOOLS"]
                T1["List Tools Request/Result<br/>(name, description)"]
                T2["Call Tool Request/Result<br/>(name, arguments) → (content, metadata)"]
            end
            
            subgraph PROMPTS["💬 PROMPTS"]
                P1["List Prompts Request/Result<br/>(name, description)"]
                P2["Get Prompt Request/Result<br/>(name, arguments) → (messages)"]
            end
            
            subgraph RESOURCES["📁 RESOURCES"]
                R1["List Resources Request/Result<br/>(uri, name, mime)"]
                R2["Read Resource Request/Result<br/>(uri) → (contents)"]
                R3["Subscribe/Unsubscribe Request<br/>(uri)"]
            end
        end
        
        subgraph ADVANCED["🎯 ADVANCED FEATURES"]
            direction TB
            A1["List Roots Request/Result<br/>(uri, name)"]
            A2["Complete Request/Result<br/>(ref, argument) → (completion, hasMore)"]
        end
        
        subgraph BIDIRECTIONAL["🔄 BIDIRECTIONAL COMMUNICATION"]
            direction TB
            
            subgraph SAMPLING["📤 SAMPLING (Server→Client)"]
                S1["Create Message Request<br/>(messages, maxTokens, modelPreferences)"]
                S2["Create Message Result<br/>(content, model, finishReason, usage)"]
            end
            
            subgraph ELICITATION["📥 ELICITATION (Server→Client)"]
                E1["Elicit Request<br/>(message, schema)"]
                E2["Elicit Result<br/>(action, content)"]
            end
        end
        
        subgraph NOTIFICATIONS["📢 NOTIFICATIONS (Server→Client)"]
            direction LR
            N1["Progress Notification<br/>(progress, total)"]
            N2["Logging Notification<br/>(level, data, logger)"]
            N3["Tool/Prompt/Resource List Changed"]
            N4["Resource Updated<br/>(uri)"]
            N5["Roots List Changed"]
            N6["Cancelled Notification<br/>(requestId, reason)"]
        end
        
        subgraph UTILITY["🛠️ UTILITY"]
            U1["Ping Request/Result"]
            U2["Set Logging Level Request<br/>(level)"]
        end
        
        subgraph CONTENT["📄 CONTENT TYPES"]
            C1["📝 TextContent (text)"]
            C2["🖼️ ImageContent (base64, mimeType)"]
            C3["🎵 AudioContent (base64, mimeType)"]
            C4["🔗 ResourceLink (uri)"]
            C5["📦 EmbeddedResource (contents)"]
        end
        
        subgraph TRANSPORT["🚀 TRANSPORT LAYER"]
            T_1["💻 STDIO (Standard I/O)"]
            T_2["🌐 Streamable HTTP (with SSE)"]
            T_3["🔌 Custom Transports (pluggable)"]
        end
        
        subgraph ERRORS["⚠️ ERROR HANDLING"]
            ERR1["JSONRPCError<br/>(code, message, data)"]
            ERR2["Standard Error Codes:<br/>-32700: Parse error<br/>-32600: Invalid Request<br/>-32601: Method not found<br/>-32602: Invalid params<br/>-32603: Internal error<br/>-32000 to -32099: Server error"]
        end
        
        %% Connections
        CLIENT -.->|"Initialize"| LIFECYCLE
        LIFECYCLE -.-> SERVER
        
        CLIENT <-->|"Requests/Results"| CORE
        CORE <--> SERVER
        
        CLIENT <-->|"Advanced Features"| ADVANCED
        ADVANCED <--> SERVER
        
        SERVER -->|"Bidirectional"| BIDIRECTIONAL
        BIDIRECTIONAL --> CLIENT
        
        SERVER -->|"Async"| NOTIFICATIONS
        NOTIFICATIONS -.-> CLIENT
        
        CLIENT <-->|"System"| UTILITY
        UTILITY <--> SERVER
        
        CORE -.->|"Uses"| CONTENT
        CONTENT -.-> SERVER
        
        CLIENT ===|"Transport"| TRANSPORT
        TRANSPORT === SERVER
        
        CLIENT -.->|"On Error"| ERRORS
        ERRORS -.-> SERVER
    end
    
    %% Styling
    classDef clientStyle fill:#e1f5fe,stroke:#01579b,stroke-width:3px,color:#000
    classDef serverStyle fill:#f3e5f5,stroke:#4a148c,stroke-width:3px,color:#000
    classDef lifecycleStyle fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000
    classDef coreStyle fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000
    classDef advancedStyle fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000
    classDef bidirectionalStyle fill:#e0f2f1,stroke:#00695c,stroke-width:2px,color:#000
    classDef notificationStyle fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000
    classDef utilityStyle fill:#fafafa,stroke:#424242,stroke-width:2px,color:#000
    classDef contentStyle fill:#fff8e1,stroke:#ff6f00,stroke-width:2px,color:#000
    classDef transportStyle fill:#e3f2fd,stroke:#0d47a1,stroke-width:2px,color:#000
    classDef errorStyle fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    
    class CLIENT clientStyle
    class SERVER serverStyle
    class LIFECYCLE,L1,L2,L3 lifecycleStyle
    class CORE,TOOLS,PROMPTS,RESOURCES,T1,T2,P1,P2,R1,R2,R3 coreStyle
    class ADVANCED,A1,A2 advancedStyle
    class BIDIRECTIONAL,SAMPLING,ELICITATION,S1,S2,E1,E2 bidirectionalStyle
    class NOTIFICATIONS,N1,N2,N3,N4,N5,N6 notificationStyle
    class UTILITY,U1,U2 utilityStyle
    class CONTENT,C1,C2,C3,C4,C5 contentStyle
    class TRANSPORT,T_1,T_2,T_3 transportStyle
    class ERRORS,ERR1,ERR2 errorStyle
```

## Color-Coded ASCII Diagram (Alternative)

For environments that don't support Mermaid, here's a color-coded ASCII version:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                    🌐 MODEL CONTEXT PROTOCOL (MCP) v2025-06-18 - Enhanced Diagram                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

🤖 CLIENT                                                                          ⚙️  SERVER
┌─────────────────────────┐                                                        ┌─────────────────────────┐
│   MCP CLIENT            │                     📡 JSON-RPC 2.0                    │   MCP SERVER            │
│ (AI Assistant/Host)     │◄──────────────────────────────────────────────────────►│ (Capability Provider)   │
└─────────────────────────┘                                                        └─────────────────────────┘
            │                                                                                     │
            │                         🚀 LIFECYCLE MANAGEMENT                                     │
            │                                                                                     │
            │ Initialize Request      ◄─────────────────────────────►      Initialize Result      │
            │ (capabilities, clientInfo)                                    (serverInfo, caps)    │
            │                                                                                     │
            │ Initialized Notification ──────────────────────────────►                            │
            │                                                                                     │
            │                         ⭐ CORE CAPABILITIES                                         │
            │                                                                                     │
            │ 🔧 List Tools Request    ◄─────────────────────────────►    🔧 List Tools Result    │
            │                                                              (name, description)    │
            │                                                                                     │
            │ 🔧 Call Tool Request     ◄─────────────────────────────►    🔧 Call Tool Result     │
            │ (name, arguments)                                            (content, metadata)    │
            │                                                                                     │
            │ 💬 List Prompts Request  ◄─────────────────────────────►  💬 List Prompts Result    │
            │                                                              (name, description)    │
            │                                                                                     │
            │ 💬 Get Prompt Request    ◄─────────────────────────────►   💬 Get Prompt Result     │
            │ (name, arguments)                                            (messages)             │
            │                                                                                     │
            │ 📁 List Resources Request ◄─────────────────────────────► 📁 List Resources Result  │
            │                                                              (uri, name, mime)      │
            │                                                                                     │
            │ 📁 Read Resource Request ◄─────────────────────────────►  📁 Read Resource Result   │
            │ (uri)                                                        (contents)             │
            │                                                                                     │
            │ 📁 Subscribe Request     ◄─────────────────────────────►     Empty Result           │
            │ (uri)                                                                               │
            │                                                                                     │
            │                         🎯 ADVANCED FEATURES                                        │
            │                                                                                     │
            │ List Roots Request      ◄─────────────────────────────►      List Roots Result      │
            │                                                              (uri, name)            │
            │                                                                                     │
            │ Complete Request        ◄─────────────────────────────►      Complete Result        │
            │ (ref, argument)                                              (completion, hasMore)  │
            │                                                                                     │
            │                       🔄 BIDIRECTIONAL COMMUNICATION                                │
            │                                                                                     │
            │ 📤 Create Message Request ────────────────────────────►   📤 Create Message Result   │
            │ (messages, maxTokens,                                       (content, model,        │
            │  modelPreferences)                                          finishReason, usage)    │
            │                                                                                     │
            │ 📥 Elicit Result         ◄─────────────────────────────    📥 Elicit Request        │
            │ (action, content)                                           (message, schema)       │
            │                                                                                     │
            │                         📢 NOTIFICATIONS                                            │
            │         (Server can send these any time, no response required)                      │
            │                                                                                     │
            │ Progress Notification   ◄──────────────────────────────                             │
            │ (progress, total)                                                                   │
            │                                                                                     │
            │ Logging Notification    ◄──────────────────────────────                             │
            │ (level, data, logger)                                                               │
            │                                                                                     │
            │ Tool List Changed       ◄──────────────────────────────                             │
            │ Notification                                                                        │
            │                                                                                     │
            │ Resource Updated        ◄──────────────────────────────                             │
            │ Notification (uri)                                                                  │
            │                                                                                     │
            │ Cancelled Notification  ◄────────────────────────────── or ──────────────────────►  │
            │ (requestId, reason)                                                                 │
            │                                                                                     │
            │                         🛠️ UTILITY                                                  │
            │                                                                                     │
            │ Ping Request            ◄─────────────────────────────►      Empty Result           │
            │                                                                                     │
            │ Set Logging Level       ────────────────────────────►      Empty Result             │
            │ Request (level)                                                                     │
            │                                                                                     │
            │                         📄 CONTENT TYPES                                            │
            │                                                                                     │
            │ • 📝 TextContent (text)                                                             │
            │ • 🖼️ ImageContent (base64 data, mimeType)                                          │
            │ • 🎵 AudioContent (base64 data, mimeType)                                           │
            │ • 🔗 ResourceLink (uri)                                                             │
            │ • 📦 EmbeddedResource (resource contents)                                           │
            │                                                                                     │
            │                         🚀 TRANSPORT LAYER                                          │
            │                                                                                     │
            │              • 💻 STDIO (Standard Input/Output)                                     │
            │              • 🌐 Streamable HTTP (with optional SSE streaming)                     │
            │              • 🔌 Custom Transports (pluggable)                                     │
            │                                                                                     │
            │                         ⚠️ ERROR HANDLING                                            │
            │                                                                                     │
            │ JSONRPCError           ◄─────────────────────────────► JSONRPCError                 │
            │ (code, message, data)                                  (code, message, data)        │
            │                                                                                     │
            │ Standard Error Codes:                                                               │
            │ • -32700: Parse error          • -32600: Invalid Request                            │
            │ • -32601: Method not found     • -32602: Invalid params                             │
            │ • -32603: Internal error       • -32000 to -32099: Server error                     │
            │                                                                                     │
            └──────────────────────────────────────────────────────────────────────────────────---┘
```

## Key Enhancements from Original Diagram

### **1. Complete Message Types**
- Added all request/result pairs from the specification
- Included sampling and elicitation (bidirectional communication)
- Added completion, ping, and logging utilities

### **2. Advanced Protocol Features**
- **Sampling**: Servers can request LLM completions from clients
- **Elicitation**: Servers can request user input through structured forms
- **Roots**: File system access control and permissions
- **Subscriptions**: Resource change notifications

### **3. Rich Content Support**
- Text, Image, Audio content types with base64 encoding
- Resource links and embedded resources
- MIME type support for different content formats

### **4. Comprehensive Notifications**
- Progress notifications for long-running operations
- Dynamic capability change notifications (tools, prompts, resources)
- Logging integration with standard severity levels
- Cancellation support for any operation

### **5. Protocol Metadata**
- `_meta` fields for extensibility
- Progress tokens for tracking long operations
- Annotations for UI hints and optimization
- Model preferences for sampling requests

### **6. Error Handling**
- Complete JSON-RPC 2.0 error codes
- Structured error responses with additional data
- Cancellation workflow for interrupted operations

## Protocol Flow Examples

### Typical Server Interaction Flow

```
1. Client → Server: Initialize Request
2. Server → Client: Initialize Result
3. Client → Server: Initialized Notification

4. Client → Server: List Tools Request
5. Server → Client: List Tools Result

6. Client → Server: Call Tool Request
7. Server → Client: Progress Notification (optional)
8. Server → Client: Call Tool Result

9. Client → Server: Read Resource Request
10. Server → Client: Read Resource Result
```

### Advanced Sampling Flow

```
1. Server → Client: Create Message Request
   (Server needs AI completion)
2. Client → Server: Create Message Result
   (Client provides LLM response)
```

### Elicitation Flow

```
1. Server → Client: Elicit Request
   (Server needs user input)
2. Client → Server: Elicit Result
   (Client provides user response)
```

## Implementation Notes

### For Server Developers
- Implement all core capabilities (tools, resources, prompts)
- Use proper JSON-RPC 2.0 error codes
- Send notifications for dynamic updates
- Support progress tokens for long operations

### For Client Developers
- Handle bidirectional communication (sampling, elicitation)
- Implement proper subscription management
- Support rich content types (text, images, audio)
- Manage connection lifecycle properly

### Transport Considerations
- **STDIO**: Best for command-line tools and simple integrations
- **HTTP/SSE**: Better for web applications and complex deployments
- **WebSocket**: Future transport for real-time applications

## Key Capabilities Summary

| Feature | Description | Direction |
|---------|-------------|-----------|
| **Tools** | Server-controlled functions | Client → Server |
| **Resources** | Data access points | Client → Server |
| **Prompts** | Workflow templates | Client → Server |
| **Sampling** | LLM completions | Server → Client |
| **Elicitation** | User input requests | Server → Client |
| **Notifications** | Async updates | Server → Client |
| **Roots** | File system access | Client → Server |
| **Completion** | Autocomplete support | Client → Server |

This enhanced diagram represents the complete scope of MCP v2025-06-18, showing it as a comprehensive protocol for AI-system integration with bidirectional communication, rich content support, and advanced features like sampling and elicitation.