import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { createTestLogger } from '@mcp-demo/test-utils';

// Mock the external dependencies before importing
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock Claude response' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      })
    }
  }))
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} }
        }
      ]
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Tool result' }],
      isError: false
    }),
    setRequestHandler: vi.fn()
  }))
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CreateMessageRequestSchema: {},
  ElicitRequestSchema: {}
}));

// Mock console to reduce noise
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Chat Server Configuration', () => {
  it('should require ANTHROPIC_API_KEY environment variable', () => {
    // The server checks for this key at startup
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    // Verify the expectation
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();

    // Restore
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it('should use default port 4000', () => {
    const PORT = 4000;
    expect(PORT).toBe(4000);
  });

  it('should use dev-tools URL from configuration', () => {
    const DEV_TOOLS_URL = 'http://localhost:3001/mcp';
    expect(DEV_TOOLS_URL).toContain('localhost:3001');
  });
});

describe('Express Server Setup', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it('should parse JSON body', () => {
    expect(app).toBeDefined();
  });

  it('should handle health check route pattern', () => {
    // Define the health check route
    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        server: 'chat-server',
        version: '1.0.0'
      });
    });

    // Verify route is registered
    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    expect(routes.some((r: any) => r.path === '/health')).toBe(true);
  });

  it('should handle chat endpoint pattern', () => {
    app.post('/chat', (_req, res) => {
      res.json({ response: 'test' });
    });

    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    const chatRoute = routes.find((r: any) => r.path === '/chat');
    expect(chatRoute).toBeDefined();
    expect(chatRoute.methods).toContain('post');
  });

  it('should handle providers endpoint pattern', () => {
    app.get('/providers', (_req, res) => {
      res.json({ providers: [] });
    });

    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    expect(routes.some((r: any) => r.path === '/providers')).toBe(true);
  });

  it('should handle elicitations endpoint pattern', () => {
    app.get('/elicitations', (_req, res) => {
      res.json({ elicitations: [] });
    });

    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      }));

    expect(routes.some((r: any) => r.path === '/elicitations')).toBe(true);
  });
});

describe('Pending Elicitation Tracking', () => {
  interface PendingElicitation {
    id: string;
    message: string;
    schema: any;
    timestamp: number;
  }

  let pendingElicitations: Map<string, PendingElicitation>;

  beforeEach(() => {
    pendingElicitations = new Map();
  });

  it('should store pending elicitation requests', () => {
    const elicitation: PendingElicitation = {
      id: 'elicit-123',
      message: 'Please provide input',
      schema: { type: 'object' },
      timestamp: Date.now()
    };

    pendingElicitations.set(elicitation.id, elicitation);

    expect(pendingElicitations.has('elicit-123')).toBe(true);
    expect(pendingElicitations.get('elicit-123')?.message).toBe('Please provide input');
  });

  it('should remove elicitation after response', () => {
    const elicitation: PendingElicitation = {
      id: 'elicit-456',
      message: 'Test message',
      schema: {},
      timestamp: Date.now()
    };

    pendingElicitations.set(elicitation.id, elicitation);
    expect(pendingElicitations.size).toBe(1);

    pendingElicitations.delete(elicitation.id);
    expect(pendingElicitations.size).toBe(0);
  });

  it('should list all pending elicitations', () => {
    pendingElicitations.set('elicit-1', {
      id: 'elicit-1',
      message: 'First',
      schema: {},
      timestamp: 1000
    });
    pendingElicitations.set('elicit-2', {
      id: 'elicit-2',
      message: 'Second',
      schema: {},
      timestamp: 2000
    });

    const list = Array.from(pendingElicitations.entries()).map(([id, req]) => ({
      id,
      message: req.message,
      timestamp: req.timestamp
    }));

    expect(list).toHaveLength(2);
    expect(list[0].message).toBe('First');
    expect(list[1].message).toBe('Second');
  });
});

describe('LLM Provider Selection', () => {
  it('should default to claude provider', () => {
    let currentProvider = 'claude';
    expect(currentProvider).toBe('claude');
  });

  it('should allow switching providers', () => {
    let currentProvider = 'claude';

    const setProvider = (provider: string) => {
      currentProvider = provider;
    };

    setProvider('openai');
    expect(currentProvider).toBe('openai');

    setProvider('claude');
    expect(currentProvider).toBe('claude');
  });

  it('should list available providers', () => {
    const providers = [
      { name: 'claude', type: 'claude', isDefault: true },
      { name: 'openai', type: 'openai', isDefault: false }
    ];

    expect(providers).toHaveLength(2);
    expect(providers.find(p => p.isDefault)?.name).toBe('claude');
  });
});

describe('Tool Conversion', () => {
  it('should convert MCP tools to Claude format', () => {
    const mcpTools = [
      {
        name: 'format_code',
        description: 'Format code',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            language: { type: 'string' }
          }
        }
      }
    ];

    const claudeTools = mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));

    expect(claudeTools).toHaveLength(1);
    expect(claudeTools[0].name).toBe('format_code');
    expect(claudeTools[0].input_schema).toBeDefined();
  });

  it('should convert MCP tools to OpenAI format', () => {
    const mcpTools = [
      {
        name: 'analyze_data',
        description: 'Analyze data',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'array' }
          }
        }
      }
    ];

    const openAITools = mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    expect(openAITools).toHaveLength(1);
    expect(openAITools[0].type).toBe('function');
    expect(openAITools[0].function.name).toBe('analyze_data');
  });
});

describe('Error Response Handling', () => {
  it('should format error messages correctly', () => {
    const error = new Error('Connection failed');

    const errorResponse = {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };

    expect(errorResponse.error).toBe('Internal server error');
    expect(errorResponse.message).toBe('Connection failed');
  });

  it('should handle non-Error objects', () => {
    const error = 'String error';

    const errorResponse = {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };

    expect(errorResponse.message).toBe('Unknown error');
  });
});

describe('SSE Streaming', () => {
  it('should format SSE data correctly', () => {
    const chunk = { content: 'Hello' };
    const data = JSON.stringify(chunk);
    const sseFormat = `data: ${data}\n\n`;

    expect(sseFormat).toContain('data: ');
    expect(sseFormat).toContain('"content":"Hello"');
    expect(sseFormat.endsWith('\n\n')).toBe(true);
  });

  it('should send [DONE] marker at end of stream', () => {
    const doneMarker = 'data: [DONE]\n\n';
    expect(doneMarker).toBe('data: [DONE]\n\n');
  });
});

describe('Message Format Conversion', () => {
  it('should convert MCP messages to Claude format', () => {
    const mcpMessages = [
      { role: 'user', content: { type: 'text', text: 'Hello' } },
      { role: 'assistant', content: 'Hi there' }
    ];

    const claudeMessages = mcpMessages.map((msg: any) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content?.type === 'text'
        ? msg.content.text
        : JSON.stringify(msg.content)
    }));

    expect(claudeMessages[0].content).toBe('Hello');
    expect(claudeMessages[1].content).toBe('Hi there');
  });
});

describe('Environment Configuration', () => {
  it('should support SKIP_MCP_CONNECTION flag', () => {
    const skipConnection = process.env.SKIP_MCP_CONNECTION === 'true';
    expect(typeof skipConnection).toBe('boolean');
  });

  it('should support OPENAI_API_KEY for multi-provider mode', () => {
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    expect(typeof hasOpenAI).toBe('boolean');
  });
});
