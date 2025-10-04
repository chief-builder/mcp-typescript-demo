/**
 * OpenAI LLM Provider Implementation
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

export interface OpenAIConfig extends ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
}

export class OpenAIProvider extends LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private organization?: string;

  constructor(config: OpenAIConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.organization = config.organization;
  }

  get name(): string {
    return 'openai';
  }

  get models(): ModelInfo[] {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most advanced multimodal model, excellent for complex reasoning',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: true,
          maxContextTokens: 128000,
          maxOutputTokens: 16384,
          inputFormats: ['text', 'image', 'audio']
        },
        costPer1kTokens: {
          input: 0.0025,
          output: 0.01
        }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Affordable and intelligent small model for fast, lightweight tasks',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: true,
          maxContextTokens: 128000,
          maxOutputTokens: 16384,
          inputFormats: ['text', 'image']
        },
        costPer1kTokens: {
          input: 0.00015,
          output: 0.0006
        }
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Previous generation advanced model with large context window',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: true,
          maxContextTokens: 128000,
          maxOutputTokens: 4096,
          inputFormats: ['text', 'image']
        },
        costPer1kTokens: {
          input: 0.01,
          output: 0.03
        }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast, cost-effective model for simple tasks',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: false,
          maxContextTokens: 16385,
          maxOutputTokens: 4096,
          inputFormats: ['text']
        },
        costPer1kTokens: {
          input: 0.0005,
          output: 0.0015
        }
      }
    ];
  }

  get capabilities(): LLMCapabilities {
    return {
      streaming: true,
      tools: true,
      multimodal: true,
      maxContextTokens: 128000,
      maxOutputTokens: 16384,
      inputFormats: ['text', 'image', 'audio']
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

  async chatCompletion(options: ChatCompletionOptions): Promise<CompletionResponse> {
    const requestBody = this.buildRequestBody(options);
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...(this.organization && { 'OpenAI-Organization': this.organization })
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
      throw new LLMError(`OpenAI API request failed: ${error}`, {
        code: 'API_ERROR',
        provider: 'openai',
        retryable: true,
        details: error
      });
    }
  }

  async *chatCompletionStream(options: ChatCompletionOptions): AsyncIterable<StreamingChunk> {
    const requestBody = { ...this.buildRequestBody(options), stream: true };
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...(this.organization && { 'OpenAI-Organization': this.organization })
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw await this.handleApiError(response);
      }

      if (!response.body) {
        throw new LLMError('No response body received', {
          code: 'NO_BODY',
          provider: 'openai',
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
      throw new LLMError(`OpenAI streaming request failed: ${error}`, {
        code: 'STREAM_ERROR',
        provider: 'openai',
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

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.complete('Hello', { maxTokens: 10 });
      return response.content.length > 0;
    } catch (error) {
      return false;
    }
  }

  async getUsage(): Promise<{
    requestsToday: number;
    tokensToday: number;
    remainingQuota?: number;
  }> {
    // OpenAI doesn't provide usage stats via API, return mock data
    return {
      requestsToday: 0,
      tokensToday: 0,
      remainingQuota: undefined
    };
  }

  async validateConfig(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }
    return this.healthCheck();
  }

  private buildRequestBody(options: ChatCompletionOptions) {
    const { messages, model = 'gpt-4o-mini', ...otherOptions } = options;

    const body: any = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
        ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
        ...(msg.toolCallId && { tool_call_id: msg.toolCallId })
      })),
      max_tokens: otherOptions.maxTokens || 4096,
      temperature: otherOptions.temperature,
      top_p: otherOptions.topP,
      stop: otherOptions.stopSequences
    };

    if (otherOptions.tools && otherOptions.tools.length > 0) {
      body.tools = otherOptions.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      body.tool_choice = 'auto';
    }

    return body;
  }

  private parseCompletionResponse(data: any, requestId?: string): CompletionResponse {
    const choice = data.choices?.[0];
    const message = choice?.message;
    
    const content = message?.content || '';
    const toolCalls = message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}')
    })) || [];

    return {
      content,
      finishReason: this.mapFinishReason(choice?.finish_reason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      requestId
    };
  }

  private parseStreamingChunk(data: any): StreamingChunk | null {
    const choice = data.choices?.[0];
    const delta = choice?.delta;

    if (delta?.content) {
      return {
        content: delta.content
      };
    }

    if (delta?.tool_calls) {
      return {
        toolCalls: delta.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : undefined
        }))
      };
    }

    if (choice?.finish_reason) {
      return {
        finishReason: this.mapFinishReason(choice.finish_reason)
      };
    }

    if (data.usage) {
      return {
        usage: {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        }
      };
    }

    return null;
  }

  private mapFinishReason(reason: string): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
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
      provider: 'openai',
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

