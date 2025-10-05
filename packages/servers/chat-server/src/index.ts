#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CreateMessageRequestSchema, ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { 
  Logger,
  LLMProviderManager,
  Message as LLMMessage,
  ChatCompletionOptions,
  StreamingChunk
} from '@mcp-demo/core';

const logger = new Logger('chat-server');

// Configuration
const PORT = 4000;
const DEV_TOOLS_URL = 'http://localhost:3001/mcp';
const SKIP_MCP_CONNECTION = process.env.SKIP_MCP_CONNECTION === 'true';

// Elicitation request tracking
interface PendingElicitation {
  id: string;
  message: string;
  schema: any;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

// Enhanced Chat Service with LLM Provider Support
class EnhancedChatService {
  private anthropic: Anthropic; // Keep for backward compatibility
  private devToolsClient: Client | null = null;
  private pendingElicitations: Map<string, PendingElicitation> = new Map();
  private llmManager: LLMProviderManager;
  private currentProvider: string = 'claude';

  constructor(apiKey: string, openaiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey,
    });
    
    // Initialize LLM provider manager
    this.llmManager = new LLMProviderManager();
    this.initializeProviders(apiKey, openaiKey);
  }

  private async initializeProviders(claudeKey: string, openaiKey?: string): Promise<void> {
    try {
      // Add Claude provider
      await this.llmManager.addProvider('claude', 'claude', {
        name: 'Claude',
        apiKey: claudeKey
      });
      
      // Add OpenAI provider if key is available
      if (openaiKey) {
        await this.llmManager.addProvider('openai', 'openai', {
          name: 'OpenAI',
          apiKey: openaiKey
        });
      }
      
      logger.info('✅ LLM providers initialized successfully');
      logger.info('📋 Available providers:', this.llmManager.listProviders());
    } catch (error) {
      logger.error('❌ Failed to initialize LLM providers:', error);
    }
  }

  async connectToDevTools(): Promise<void> {
    try {
      logger.info('Connecting to dev-tools server...');
      
      this.devToolsClient = new Client({
        name: 'chat-server-client',
        version: '1.0.0'
      }, {
        capabilities: {
          sampling: {},
          elicitation: {}
        }
      });

      const transport = new StreamableHTTPClientTransport(new URL(DEV_TOOLS_URL));
      await this.devToolsClient.connect(transport);
      
      // Set up sampling request handler using the proper schema
      this.devToolsClient.setRequestHandler(CreateMessageRequestSchema, async (request) => {
        logger.info('🔄 INCOMING MCP SAMPLING REQUEST:');
        logger.info('📡 Request method:', request.method);
        logger.info('📋 Request params:', JSON.stringify(request.params, null, 2));
        
        try {
          const { messages, maxTokens, modelPreferences } = request.params;
          
          if (!messages || !Array.isArray(messages)) {
            throw new Error('Invalid messages in sampling request');
          }

          logger.info('📤 Forwarding sampling request to Claude API...');

          // Convert MCP message format to Claude API format
          const claudeMessages = messages.map((msg: any) => ({
            role: msg.role,
            content: typeof msg.content === 'string' ? msg.content : 
                    msg.content?.type === 'text' ? msg.content.text : 
                    JSON.stringify(msg.content)
          }));

          // Use our Claude service to handle the sampling request
          const response = await this.anthropic.messages.create({
            model: modelPreferences?.hints?.[0]?.name || 'claude-3-5-sonnet-20241022',
            max_tokens: maxTokens || 1000,
            messages: claudeMessages
          });

          // Extract the first text content from Claude's response array
          const textContent = response.content.find((item: any) => item.type === 'text');
          
          const result = {
            model: response.model,
            content: textContent || { type: 'text' as const, text: 'No response generated' },
            role: 'assistant' as const,
            stopReason: response.stop_reason || 'end_turn'
          };

          logger.info('📥 MCP SAMPLING RESPONSE sent back to server:');
          logger.info('🎯 Response model:', result.model);
          logger.info('📄 Response content:', JSON.stringify(result.content, null, 2));
          
          return result;
          
        } catch (error) {
          logger.error('❌ Sampling request failed:', error);
          throw new Error(`Sampling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
      
      logger.info('✅ Sampling request handler configured - ready to process sampling requests');

      // Set up elicitation request handler 
      this.devToolsClient.setRequestHandler(ElicitRequestSchema, async (request) => {
        logger.info('🔄 INCOMING MCP ELICITATION REQUEST:');
        logger.info('📡 Request method:', request.method);
        logger.info('📋 Request params:', JSON.stringify(request.params, null, 2));
        
        try {
          const { message, requestedSchema } = request.params;
          
          if (!message || !requestedSchema) {
            throw new Error('Invalid elicitation request: missing message or schema');
          }

          logger.info('📤 Creating elicitation request for user...');

          // Create a promise-based elicitation request
          const elicitationId = `elicit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const response = await new Promise<any>((resolve, reject) => {
            const pendingRequest: PendingElicitation = {
              id: elicitationId,
              message,
              schema: requestedSchema,
              resolve,
              reject,
              timestamp: Date.now()
            };
            
            this.pendingElicitations.set(elicitationId, pendingRequest);
            logger.info(`📋 Created elicitation request with ID: ${elicitationId}`);
            
            // Note: This is a demo implementation that simulates user interaction
            // In a real implementation, you would send this to a connected UI
            setTimeout(() => {
              if (this.pendingElicitations.has(elicitationId)) {
                logger.warn(`⏱️ Elicitation ${elicitationId} timed out - no UI connected`);
                this.pendingElicitations.delete(elicitationId);
                resolve({
                  action: 'decline',
                  // No UI connected yet
                });
              }
            }, 30000); // 30 second timeout for testing
          });
          
          logger.info('📥 Elicitation response received:', response);
          return response;
          
        } catch (error) {
          logger.error('❌ Elicitation request failed:', error);
          throw new Error(`Elicitation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
      
      logger.info('✅ Elicitation request handler configured - ready to process elicitation requests');
      
      logger.info('Successfully connected to dev-tools server with sampling and elicitation support');
    } catch (error) {
      logger.error('Failed to connect to dev-tools server:', error);
      throw error;
    }
  }

  // Methods for handling elicitation responses from UI
  handleElicitationResponse(elicitationId: string, response: any): void {
    const pendingRequest = this.pendingElicitations.get(elicitationId);
    
    if (!pendingRequest) {
      logger.warn(`No pending elicitation found for ID: ${elicitationId}`);
      return;
    }
    
    logger.info(`✅ Processing elicitation response for ${elicitationId}:`, response);
    
    // Resolve the promise with the user's response
    pendingRequest.resolve(response);
    this.pendingElicitations.delete(elicitationId);
  }
  
  getPendingElicitations(): Array<{ id: string; message: string; schema: any; timestamp: number }> {
    return Array.from(this.pendingElicitations.entries()).map(([id, request]) => ({
      id,
      message: request.message,
      schema: request.schema,
      timestamp: request.timestamp
    }));
  }

  async getAvailableTools(): Promise<any[]> {
    if (!this.devToolsClient) {
      logger.info('Dev-tools client not connected, returning empty tools list');
      return [];
    }

    try {
      const toolsResponse = await this.devToolsClient.listTools();
      return toolsResponse.tools?.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema
      })) || [];
    } catch (error) {
      logger.error('Failed to get available tools:', error);
      return [];
    }
  }

  async executeToolCall(toolName: string, args: any): Promise<any> {
    if (!this.devToolsClient) {
      logger.info('Dev-tools client not connected, cannot execute tool calls');
      return {
        content: [{ type: 'text', text: 'Tool execution not available - MCP servers not connected' }],
        isError: false
      };
    }

    try {
      logger.info(`Executing tool: ${toolName}`, args);
      
      const response = await this.devToolsClient.callTool({
        name: toolName,
        arguments: args
      });

      return {
        content: response.content,
        isError: response.isError
      };
    } catch (error) {
      logger.error(`Tool execution failed for ${toolName}:`, error);
      return {
        content: [{ type: 'text', text: `Tool execution failed: ${error}` }],
        isError: true
      };
    }
  }

  // New streaming chat method using LLM providers
  async *chatStream(userMessage: string, provider?: string): AsyncIterable<StreamingChunk> {
    try {
      logger.info('Processing streaming chat request:', userMessage);

      // Get available tools from dev-tools server
      const tools = await this.getAvailableTools();

      const selectedProvider = provider || this.currentProvider;
      const llmProvider = this.llmManager.getProvider(selectedProvider);
      
      // Convert MCP tools to LLM tool format
      const llmTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }));

      // For streaming, we need to use the simpler stream interface
      const streamOptions = {
        tools: llmTools,
        maxTokens: 4096,
        model: selectedProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022'
      };

      // Stream the response
      yield* llmProvider.stream(userMessage, streamOptions);
      
    } catch (error) {
      logger.error('Streaming chat processing failed:', error);
      throw error;
    }
  }

  // Enhanced chat method with provider selection
  async chat(userMessage: string, provider?: string): Promise<string> {
    try {
      logger.info('Processing chat request:', userMessage);

      // Get available tools from dev-tools server
      const tools = await this.getAvailableTools();
      
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: userMessage
        }
      ];

      const selectedProvider = provider || this.currentProvider;
      const llmProvider = this.llmManager.getProvider(selectedProvider);
      
      // Convert MCP tools to LLM tool format
      const llmTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }));

      const chatOptions: ChatCompletionOptions = {
        messages,
        tools: llmTools,
        maxTokens: 4096,
        model: selectedProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022'
      };

      // Use direct LLM provider for completion
      // Tool calling is handled separately through MCP tool integration
      const response = await llmProvider.complete(userMessage, chatOptions);
      
      logger.info('Chat completed');
      return response.content;
      
    } catch (error) {
      logger.error('Chat processing failed:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async legacyChat(userMessage: string): Promise<string> {
    try {
      logger.info('Processing legacy chat request:', userMessage);

      // Get available tools from dev-tools server
      const tools = await this.getAvailableTools();
      
      const messages: Anthropic.Messages.MessageParam[] = [
        {
          role: 'user',
          content: userMessage
        }
      ];

      // Chat loop - similar to Python reference
      while (true) {
        const response = await this.anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: messages,
          tools: tools
        });

        // Add Claude's response to conversation
        messages.push({
          role: 'assistant',
          content: response.content
        });

        // Check if Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          logger.info('Claude wants to use tools');
          
          const toolResults: any[] = [];
          
          for (const content of response.content) {
            if (content.type === 'tool_use') {
              const toolResult = await this.executeToolCall(
                content.name,
                content.input
              );
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: content.id,
                content: toolResult.content,
                is_error: toolResult.isError
              });
            }
          }

          // Add tool results back to conversation
          messages.push({
            role: 'user',
            content: toolResults
          });
        } else {
          // Claude is done, extract final response
          const finalResponse = response.content
            .filter(content => content.type === 'text')
            .map(content => (content as any).text)
            .join('\n');
          
          logger.info('Chat completed');
          return finalResponse;
        }
      }
    } catch (error) {
      logger.error('Chat processing failed:', error);
      throw error;
    }
  }

  // Provider management methods
  getAvailableProviders() {
    return this.llmManager.listProviders();
  }

  setCurrentProvider(providerName: string) {
    this.currentProvider = providerName;
    logger.info(`Switched to provider: ${providerName}`);
  }

  getCurrentProvider() {
    return this.currentProvider;
  }
}

// Express server setup
async function startServer() {
  const app = express();
  
  app.use(express.json());
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));

  // Check for API keys
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!claudeApiKey) {
    logger.error('ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  // Initialize Enhanced Chat service
  const chatService = new EnhancedChatService(claudeApiKey, openaiApiKey);
  
  if (!SKIP_MCP_CONNECTION) {
    try {
      await chatService.connectToDevTools();
    } catch (error) {
      logger.error('Failed to initialize chat service:', error);
      process.exit(1);
    }
  } else {
    logger.info('Skipping MCP server connections (SKIP_MCP_CONNECTION=true)');
  }

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ 
      status: 'ok', 
      server: 'chat-server', 
      version: '1.0.0',
      connected_servers: ['dev-tools'],
      llm_providers: chatService.getAvailableProviders().map((p: any) => p.name),
      current_provider: chatService.getCurrentProvider()
    });
  });

  // Chat endpoint with provider selection
  app.post('/chat', async (req, res) => {
    try {
      const { message, provider, stream = false } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (stream) {
        // Set up Server-Sent Events for streaming
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });

        try {
          for await (const chunk of chatService.chatStream(message, provider)) {
            const data = JSON.stringify(chunk);
            res.write(`data: ${data}\n\n`);
          }
          
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (streamError) {
          logger.error('Streaming error:', streamError);
          const errorData = JSON.stringify({ 
            error: 'Streaming failed',
            message: streamError instanceof Error ? streamError.message : 'Unknown error'
          });
          res.write(`data: ${errorData}\n\n`);
          res.end();
        }
      } else {
        // Regular chat response
        const response = await chatService.chat(message, provider);
        
        return res.json({ 
          response,
          provider: provider || chatService.getCurrentProvider(),
          timestamp: new Date().toISOString()
        });
      }
      
      // This should never be reached, but TypeScript requires a return
      return;
    } catch (error) {
      logger.error('Chat endpoint error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Provider management endpoints
  app.get('/providers', (_req, res) => {
    try {
      const providers = chatService.getAvailableProviders();
      const current = chatService.getCurrentProvider();
      
      return res.json({
        providers,
        current,
        count: providers.length
      });
    } catch (error) {
      logger.error('Error fetching providers:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/providers/:name/select', (req, res) => {
    try {
      const { name } = req.params;
      const providers = chatService.getAvailableProviders();
      
      const providerExists = providers.some((p: any) => p.name === name);
      if (!providerExists) {
        return res.status(404).json({ 
          error: 'Provider not found',
          available: providers.map((p: any) => p.name)
        });
      }
      
      chatService.setCurrentProvider(name);
      
      return res.json({ 
        success: true,
        provider: name,
        message: `Switched to provider: ${name}`
      });
    } catch (error) {
      logger.error('Error switching provider:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Elicitation endpoints for UI integration
  
  // Get pending elicitation requests
  app.get('/elicitations', (_req, res) => {
    try {
      const pending = chatService.getPendingElicitations();
      return res.json({ 
        elicitations: pending,
        count: pending.length
      });
    } catch (error) {
      logger.error('Error fetching elicitations:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Submit elicitation response
  app.post('/elicitations/:id/response', (req, res) => {
    try {
      const { id } = req.params;
      const { action, content } = req.body;
      
      if (!action || !['accept', 'decline', 'cancel'].includes(action)) {
        return res.status(400).json({ 
          error: 'Invalid action. Must be: accept, decline, or cancel' 
        });
      }
      
      const response: any = { action };
      if (action === 'accept' && content) {
        response.content = content;
      }
      
      chatService.handleElicitationResponse(id, response);
      
      return res.json({ 
        success: true,
        elicitationId: id,
        action
      });
    } catch (error) {
      logger.error('Error handling elicitation response:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Start server
  app.listen(PORT, () => {
    logger.info(`Chat server listening on port ${PORT}`);
    console.log(`
==============================================
ENHANCED MCP CHAT SERVER

Port: ${PORT}
Connected to: dev-tools server (${DEV_TOOLS_URL})

Endpoints:
- GET  /health - Health check
- POST /chat   - Chat with LLM providers + MCP tools (supports streaming)
- GET  /providers - List available LLM providers
- POST /providers/:name/select - Switch LLM provider
- GET  /elicitations - Get pending elicitation requests
- POST /elicitations/:id/response - Submit elicitation response

Environment:
- ANTHROPIC_API_KEY: ${claudeApiKey ? '✓ Set' : '✗ Missing'}
- OPENAI_API_KEY: ${openaiApiKey ? '✓ Set' : '✗ Missing'}

Features:
- Multi-provider LLM support (Claude, OpenAI)
- Server-Sent Events streaming
- Dynamic provider switching
- MCP tool integration
==============================================
`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down chat server...');
    process.exit(0);
  });
}

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start chat server:', error);
  process.exit(1);
});