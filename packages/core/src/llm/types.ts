/**
 * Core types for LLM provider abstraction
 */

export interface CompletionOptions {
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Temperature for randomness (0.0 to 1.0) */
  temperature?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Stop sequences to end generation */
  stopSequences?: string[];
  /** Enable streaming response */
  stream?: boolean;
  /** System prompt/instructions */
  systemPrompt?: string;
  /** Tool/function definitions available to the model */
  tools?: ToolDefinition[];
  /** Unique identifier for the request */
  requestId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface CompletionResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  requestId?: string;
}

export interface StreamingChunk {
  content?: string;
  toolCalls?: Partial<ToolCall>[];
  finishReason?: CompletionResponse['finishReason'];
  usage?: CompletionResponse['usage'];
}

export interface LLMCapabilities {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports function/tool calling */
  tools: boolean;
  /** Supports multimodal inputs (images, etc.) */
  multimodal: boolean;
  /** Maximum context window size */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Supported input formats */
  inputFormats: ('text' | 'image' | 'audio' | 'video')[];
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  capabilities: LLMCapabilities;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitRpm?: number;
  extra?: Record<string, any>;
}

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /** Provider identifier */
  abstract get name(): string;

  /** Available models */
  abstract get models(): ModelInfo[];

  /** Provider capabilities */
  abstract get capabilities(): LLMCapabilities;

  /**
   * Generate a completion for the given prompt
   */
  abstract complete(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResponse>;

  /**
   * Generate a streaming completion
   */
  abstract stream(
    prompt: string,
    options?: CompletionOptions
  ): AsyncIterable<StreamingChunk>;

  /**
   * Generate a chat completion with full message history
   * Optional method - providers can implement if they support it
   */
  chatCompletion?(options: ChatCompletionOptions): Promise<CompletionResponse>;

  /**
   * Generate a streaming chat completion with full message history
   * Optional method - providers can implement if they support it
   */
  chatCompletionStream?(options: ChatCompletionOptions): AsyncIterable<StreamingChunk>;

  /**
   * Execute a tool call (if supported)
   */
  abstract callTool?(
    toolCall: ToolCall,
    context?: any
  ): Promise<any>;

  /**
   * Health check for the provider
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get usage statistics (if available)
   */
  abstract getUsage?(): Promise<{
    requestsToday: number;
    tokensToday: number;
    remainingQuota?: number;
  }>;

  /**
   * Validate provider configuration
   */
  abstract validateConfig(): Promise<boolean>;
}

export interface LLMProviderFactory {
  createProvider(type: string, config: ProviderConfig): LLMProvider;
  getSupportedProviders(): string[];
}

export type ProviderType = 'claude' | 'openai' | 'local' | 'custom';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ChatCompletionOptions extends CompletionOptions {
  messages: Message[];
  model?: string;
}

