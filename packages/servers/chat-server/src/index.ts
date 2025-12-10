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
  StreamingChunk,
  Message as LLMMessage,
  ChatCompletionOptions,
  ToolCall
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
            model: modelPreferences?.hints?.[0]?.name || 'claude-3-5-haiku-20241022',
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
      logger.error('Failed to connect to dev-tools server:', error instanceof Error ? error.message : String(error));
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
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

  // Enhanced streaming chat method with tool execution support
  async *chatStream(userMessage: string, provider?: string): AsyncIterable<StreamingChunk> {
    try {
      logger.info('Processing streaming chat request with tool support:', userMessage);

      const selectedProvider = provider || this.currentProvider;
      
      // Check if provider supports chat completion streaming
      const llmProvider = this.llmManager.getProvider(selectedProvider);
      if (!llmProvider.chatCompletionStream) {
        // Fall back to simple streaming without tool execution
        logger.warn(`Provider ${selectedProvider} doesn't support chatCompletionStream, falling back to simple streaming`);
        yield* this.simpleStream(userMessage, selectedProvider);
        return;
      }

      // Get available tools from dev-tools server
      const tools = await this.getAvailableTools();
      
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: userMessage
        }
      ];
      
      // Convert MCP tools to LLM tool format
      const llmTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }));

      // Tool execution loop for streaming
      while (true) {
        const chatOptions: ChatCompletionOptions = {
          messages,
          tools: llmTools,
          maxTokens: 4096,
          model: selectedProvider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022'
        };

        // Accumulate tool calls from streaming chunks
        let accumulatedContent = '';
        let accumulatedToolCalls: ToolCall[] = [];
        let finishReason: string | undefined;
        let hasYieldedContent = false;
        
        // Stream the response
        for await (const chunk of llmProvider.chatCompletionStream(chatOptions)) {
          // Yield content chunks to client immediately
          if (chunk.content) {
            accumulatedContent += chunk.content;
            hasYieldedContent = true;
            yield chunk;
          }
          
          // Accumulate tool calls
          if (chunk.toolCalls) {
            logger.info('Received tool call chunk:', JSON.stringify(chunk.toolCalls));
            // Handle partial tool calls in streaming
            for (const partialToolCall of chunk.toolCalls) {
              if (partialToolCall.id) {
                // Find or create tool call
                let toolCallIndex = accumulatedToolCalls.findIndex(tc => tc.id === partialToolCall.id);
                
                if (toolCallIndex === -1) {
                  // New tool call
                  accumulatedToolCalls.push({
                    id: partialToolCall.id,
                    name: partialToolCall.name || '',
                    arguments: {}
                  });
                  toolCallIndex = accumulatedToolCalls.length - 1;
                }
                
                // Update tool call info
                const toolCall = accumulatedToolCalls[toolCallIndex];
                if (toolCall && partialToolCall.name) {
                  toolCall.name = partialToolCall.name;
                  logger.info(`Updated tool call name: ${toolCall.name}`);
                }
                
                // Handle arguments - OpenAI sends them as strings that need to be accumulated
                if (toolCall && partialToolCall.arguments !== undefined) {
                  if (selectedProvider === 'openai' && typeof partialToolCall.arguments === 'string') {
                    // For OpenAI, accumulate argument strings
                    // Use any casting for the temporary argumentsStr property
                    const toolCallAny = toolCall as any;
                    if (!toolCallAny.argumentsStr) {
                      toolCallAny.argumentsStr = '';
                    }
                    toolCallAny.argumentsStr += partialToolCall.arguments;
                    
                    // Try to parse accumulated arguments on each chunk
                    try {
                      toolCall.arguments = JSON.parse(toolCallAny.argumentsStr);
                      logger.info(`Parsed tool arguments for ${toolCall.name}:`, toolCall.arguments);
                    } catch (e) {
                      // Not complete JSON yet, keep accumulating
                      logger.debug(`Accumulating args for ${toolCall.name}, current: ${toolCallAny.argumentsStr}`);
                    }
                  } else if (typeof partialToolCall.arguments === 'object') {
                    // For Claude or parsed arguments
                    Object.assign(toolCall.arguments, partialToolCall.arguments);
                  }
                }
              }
            }
            
            // Don't yield tool call chunks to client yet
          }
          
          // Track finish reason
          if (chunk.finishReason) {
            finishReason = chunk.finishReason;
            // Yield finish reason to client
            yield chunk;
          }
        }

        // Final parse of accumulated arguments for OpenAI (in case parsing failed during streaming)
        if (selectedProvider === 'openai') {
          for (const toolCall of accumulatedToolCalls) {
            if ((toolCall as any).argumentsStr && Object.keys(toolCall.arguments).length === 0) {
              try {
                toolCall.arguments = JSON.parse((toolCall as any).argumentsStr);
                delete (toolCall as any).argumentsStr;
                logger.info(`Successfully parsed accumulated args for ${toolCall.name}:`, toolCall.arguments);
              } catch (e) {
                logger.error(`Failed to parse tool arguments for ${toolCall.name}:`, e);
                logger.error(`Raw arguments string: "${(toolCall as any).argumentsStr}"`);
                toolCall.arguments = {};
              }
            }
          }
        }

        // Add assistant's response to conversation history
        const assistantMessage: LLMMessage = {
          role: 'assistant',
          content: accumulatedContent
        };
        
        if (accumulatedToolCalls.length > 0) {
          assistantMessage.toolCalls = accumulatedToolCalls;
        }
        
        messages.push(assistantMessage);

        // Log accumulated state for debugging
        logger.info('Streaming accumulation complete:', {
          provider: selectedProvider,
          hasContent: accumulatedContent.length > 0,
          toolCallCount: accumulatedToolCalls.length,
          toolCalls: accumulatedToolCalls.map(tc => ({ name: tc.name, hasArgs: Object.keys(tc.arguments).length > 0 })),
          finishReason
        });

        // Check if we need to execute tools
        if (accumulatedToolCalls.length > 0 && (finishReason === 'tool_calls' || selectedProvider === 'claude')) {
          logger.info(`${selectedProvider} wants to use tools in streaming:`, accumulatedToolCalls.map(tc => tc.name));
          logger.info('Tool calls with arguments:', accumulatedToolCalls.map(tc => ({ 
            name: tc.name, 
            args: tc.arguments,
            hasArgs: Object.keys(tc.arguments).length > 0 
          })));
          
          // Notify client that we're executing tools
          if (hasYieldedContent) {
            // Add a newline before tool results if we've already yielded content
            yield { content: '\n\n' };
          }
          
          // Execute all tool calls
          for (const toolCall of accumulatedToolCalls) {
            try {
              logger.info(`Executing tool: ${toolCall.name} with args:`, toolCall.arguments);
              
              // Yield tool execution indicator
              yield { content: `[Executing tool: ${toolCall.name}...]\n` };
              
              // For OpenAI with empty arguments, provide defaults based on context
              let toolArgs = toolCall.arguments;
              if (selectedProvider === 'openai' && Object.keys(toolArgs).length === 0) {
                logger.warn(`Empty arguments for tool ${toolCall.name}, attempting to extract from context`);
                
                if (toolCall.name === 'format_code') {
                  // Extract code from the user message - handle multiline code
                  const codeMatch = userMessage.match(/format this code[:\s]*(.+)/is);
                  if (codeMatch && codeMatch[1]) {
                    toolArgs = {
                      code: codeMatch[1].trim(),
                      language: 'javascript'
                    };
                  }
                } else if (toolCall.name === 'read_file') {
                  // Extract file path from user message
                  const pathMatch = userMessage.match(/read\s+(?:file\s+)?([\w\/.]+)/i);
                  if (pathMatch && pathMatch[1]) {
                    toolArgs = {
                      path: pathMatch[1]
                    };
                  }
                }
              }
              
              logger.info(`Executing tool with final args:`, toolArgs);
              
              const toolResult = await this.executeToolCall(
                toolCall.name,
                toolArgs
              );
              
              // Add tool result to messages
              if (selectedProvider === 'openai') {
                messages.push({
                  role: 'tool',
                  content: toolResult && typeof toolResult.content === 'string' 
                    ? toolResult.content 
                    : JSON.stringify(toolResult?.content || {}),
                  toolCallId: toolCall.id
                });
              } else {
                messages.push({
                  role: 'user',
                  content: JSON.stringify([{
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: toolResult.content,
                    is_error: toolResult.isError
                  }])
                });
              }
            } catch (error) {
              logger.error(`Tool execution failed for ${toolCall.name}:`, error);
              
              // Yield error indicator
              yield { content: `[Tool execution failed: ${error}]\n` };
              
              if (selectedProvider === 'openai') {
                messages.push({
                  role: 'tool',
                  content: `Tool execution failed: ${error}`,
                  toolCallId: toolCall.id
                });
              } else {
                messages.push({
                  role: 'user',
                  content: JSON.stringify([{
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: `Tool execution failed: ${error}`,
                    is_error: true
                  }])
                });
              }
            }
          }
          
          // Add separator before continuing
          yield { content: '\n' };
          
          // Continue the loop to get the final response after tool execution
          continue;
        }
        
        // No tool calls or tools completed, we're done
        logger.info('Streaming chat completed');
        break;
      }
      
    } catch (error) {
      logger.error('Streaming chat processing failed:', error);
      throw error;
    }
  }

  // Simple streaming fallback for providers without chatCompletionStream
  private async *simpleStream(userMessage: string, provider: string): AsyncIterable<StreamingChunk> {
    const llmProvider = this.llmManager.getProvider(provider);
    
    // Get available tools from dev-tools server
    const tools = await this.getAvailableTools();
    
    // Convert MCP tools to LLM tool format
    const llmTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }));

    const streamOptions = {
      tools: llmTools,
      maxTokens: 4096,
      model: provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022'
    };

    // Stream the response without tool execution
    yield* llmProvider.stream(userMessage, streamOptions);
  }

  // Enhanced chat method with provider selection using provider-specific implementations
  async chat(userMessage: string, provider?: string): Promise<string> {
    try {
      logger.info('Processing chat request:', userMessage);
      
      const selectedProvider = provider || this.currentProvider;
      
      // For Claude, use the legacy implementation that has proper tool handling
      if (selectedProvider === 'claude') {
        return this.legacyChat(userMessage);
      }
      
      // For OpenAI, implement tool handling directly
      if (selectedProvider === 'openai') {
        return this.openAIChat(userMessage);
      }
      
      // For other providers, fall back to simple completion without tool execution
      const llmProvider = this.llmManager.getProvider(selectedProvider);
      const response = await llmProvider.complete(userMessage, { maxTokens: 4096 });
      return response.content;
      
    } catch (error) {
      logger.error('Chat processing failed:', error);
      throw error;
    }
  }

  // OpenAI-specific chat implementation with tool handling
  private async openAIChat(userMessage: string): Promise<string> {
    try {
      logger.info('Processing OpenAI chat request:', userMessage);

      // Get available tools from dev-tools server
      const tools = await this.getAvailableTools();
      
      // We'll need to make direct API calls to OpenAI
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      const messages: any[] = [
        {
          role: 'user',
          content: userMessage
        }
      ];

      // Convert MCP tools to OpenAI format
      const openAITools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));

      // Tool execution loop
      while (true) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: openAITools,
            tool_choice: 'auto',
            max_tokens: 4096
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const choice = data.choices[0];
        const message = choice.message;

        // Add assistant's response to conversation
        messages.push(message);

        // Check if OpenAI wants to use tools
        if (message.tool_calls && message.tool_calls.length > 0) {
          logger.info('OpenAI wants to use tools:', message.tool_calls.map((tc: any) => tc.function.name));
          
          // Execute all tool calls
          for (const toolCall of message.tool_calls) {
            try {
              logger.info(`Executing tool: ${toolCall.function.name} with args:`, toolCall.function.arguments);
              
              const args = JSON.parse(toolCall.function.arguments);
              const toolResult = await this.executeToolCall(
                toolCall.function.name,
                args
              );
              
              // Add tool result as a tool message
              messages.push({
                role: 'tool',
                content: toolResult && typeof toolResult.content === 'string' 
                  ? toolResult.content 
                  : JSON.stringify(toolResult?.content || {}),
                tool_call_id: toolCall.id
              });
            } catch (error) {
              logger.error(`Tool execution failed for ${toolCall.function.name}:`, error);
              
              // Add error result
              messages.push({
                role: 'tool',
                content: `Tool execution failed: ${error}`,
                tool_call_id: toolCall.id
              });
            }
          }
          
          // Continue the loop to get the final response after tool execution
          continue;
        }
        
        // No tool calls, return the final response
        logger.info('OpenAI chat completed');
        return message.content || '';
      }
    } catch (error) {
      logger.error('OpenAI chat processing failed:', error);
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
          model: 'claude-3-5-haiku-20241022',
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
      logger.error('Failed to initialize chat service:', error instanceof Error ? error.message : String(error));
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
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