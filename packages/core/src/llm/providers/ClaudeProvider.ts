/**
 * Claude/Anthropic LLM Provider Implementation
 */

import { 
  LLMProvider, 
  CompletionOptions, 
  CompletionResponse, 
  StreamingChunk, 
  LLMCapabilities, 
  ModelInfo, 
  ProviderConfig,
  ChatCompletionOptions,
  Message,
  ToolCall
} from '../types.js';
import { LLMError } from '../ProviderFactory.js';

export interface ClaudeConfig extends ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  version?: string;
}

export class ClaudeProvider extends LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private version: string;

  constructor(config: ClaudeConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.version = config.version || '2023-06-01';
  }

  get name(): string {
    return 'claude';
  }

  get models(): ModelInfo[] {
    return [
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most intelligent model, best for complex reasoning and analysis',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: true,
          maxContextTokens: 200000,
          maxOutputTokens: 8192,
          inputFormats: ['text', 'image']
        },
        costPer1kTokens: {
          input: 0.003,
          output: 0.015
        }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model, best for quick tasks and high-volume processing',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: true,
          maxContextTokens: 200000,
          maxOutputTokens: 8192,
          inputFormats: ['text', 'image']
        },
        costPer1kTokens: {
          input: 0.0008,
          output: 0.004
        }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for highly complex tasks',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: true,
          maxContextTokens: 200000,
          maxOutputTokens: 4096,
          inputFormats: ['text', 'image']
        },
        costPer1kTokens: {
          input: 0.015,
          output: 0.075
        }
      }
    ];
  }

  get capabilities(): LLMCapabilities {
    return {
      streaming: true,
      tools: true,
      multimodal: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
      inputFormats: ['text', 'image']
    };
  }

  async complete(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<CompletionResponse> {
    const messages: Message[] = [
      { role: 'user', content: prompt }
    ];

    if (options.systemPrompt) {
      messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    return this.chatCompletion({ messages, ...options });
  }

  async *stream(
    prompt: string,
    options: CompletionOptions = {}
  ): AsyncIterable<StreamingChunk> {
    const messages: Message[] = [
      { role: 'user', content: prompt }
    ];

    if (options.systemPrompt) {
      messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    yield* this.chatCompletionStream({ messages, ...options });
  }

  override async chatCompletion(options: ChatCompletionOptions): Promise<CompletionResponse> {
    const requestBody = this.buildRequestBody(options);
    
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.version,
          'anthropic-beta': 'tools-2024-04-04'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw await this.handleApiError(response);
      }

      const data = await response.json();
      return this.parseCompletionResponse(data, options.requestId);
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(`Claude API request failed: ${error}`, {
        code: 'API_ERROR',
        provider: 'claude',
        retryable: true,
        details: error
      });
    }
  }

  override async *chatCompletionStream(options: ChatCompletionOptions): AsyncIterable<StreamingChunk> {
    const requestBody = { ...this.buildRequestBody(options), stream: true };
    
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.version,
          'anthropic-beta': 'tools-2024-04-04'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw await this.handleApiError(response);
      }

      if (!response.body) {
        throw new LLMError('No response body received', {
          code: 'NO_BODY',
          provider: 'claude',
          retryable: false
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const streamChunk = this.parseStreamingChunk(parsed);
                if (streamChunk) {
                  yield streamChunk;
                }
              } catch (e) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(`Claude streaming request failed: ${error}`, {
        code: 'STREAM_ERROR',
        provider: 'claude',
        retryable: true,
        details: error
      });
    }
  }

  async callTool(toolCall: ToolCall): Promise<any> {
    // This would integrate with MCP servers for actual tool execution
    // For now, return a mock response
    return {
      toolCallId: toolCall.id,
      result: `Tool ${toolCall.name} executed with args: ${JSON.stringify(toolCall.arguments)}`
    };
  }

  async getUsage(): Promise<{
    requestsToday: number;
    tokensToday: number;
    remainingQuota?: number;
  }> {
    // Claude doesn't provide usage stats via API, return mock data
    return {
      requestsToday: 0,
      tokensToday: 0,
      remainingQuota: undefined
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.complete('Hello', { maxTokens: 10 });
      return response.content.length > 0;
    } catch (error) {
      return false;
    }
  }

  async validateConfig(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    return this.healthCheck();
  }

  private buildRequestBody(options: ChatCompletionOptions) {
    const { messages, model = 'claude-3-5-haiku-20241022', ...otherOptions } = options;

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const body: any = {
      model,
      messages: conversationMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: otherOptions.maxTokens || 4096,
      temperature: otherOptions.temperature,
      top_p: otherOptions.topP,
      stop_sequences: otherOptions.stopSequences
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (otherOptions.tools && otherOptions.tools.length > 0) {
      body.tools = otherOptions.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters
      }));
    }

    return body;
  }

  private parseCompletionResponse(data: any, requestId?: string): CompletionResponse {
    const content = data.content?.[0]?.text || '';
    const toolCalls = data.content?.filter((c: any) => c.type === 'tool_use')?.map((c: any) => ({
      id: c.id,
      name: c.name,
      arguments: c.input
    })) || [];

    return {
      content,
      finishReason: this.mapStopReason(data.stop_reason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: data.model,
      requestId
    };
  }

  private parseStreamingChunk(data: any): StreamingChunk | null {
    if (data.type === 'content_block_delta' && data.delta?.text) {
      return {
        content: data.delta.text
      };
    }

    if (data.type === 'message_stop') {
      return {
        finishReason: 'stop'
      };
    }

    if (data.type === 'usage') {
      return {
        usage: {
          promptTokens: data.input_tokens || 0,
          completionTokens: data.output_tokens || 0,
          totalTokens: (data.input_tokens || 0) + (data.output_tokens || 0)
        }
      };
    }

    return null;
  }

  private mapStopReason(reason: string): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  private async handleApiError(response: Response): Promise<LLMError> {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch (e) {
      // If we can't parse the error response, use status text
    }

    const code = this.mapErrorCode(response.status);
    const message = errorData.error?.message || response.statusText || 'Unknown error';

    return new LLMError(message, {
      code,
      provider: 'claude',
      retryable: response.status >= 500 || response.status === 429,
      rateLimited: response.status === 429,
      details: errorData
    });
  }

  private mapErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'INVALID_REQUEST';
      case 401:
        return 'INVALID_API_KEY';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 429:
        return 'RATE_LIMITED';
      case 500:
        return 'INTERNAL_ERROR';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'UNKNOWN_ERROR';
    }
  }
}

