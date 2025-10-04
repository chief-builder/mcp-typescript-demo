/**
 * LLM Provider Factory for creating and managing different providers
 */

import { 
  LLMProvider, 
  LLMProviderFactory, 
  ProviderConfig, 
  ProviderType
} from './types.js';
import { ClaudeProvider } from './providers/ClaudeProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';

export class DefaultLLMProviderFactory implements LLMProviderFactory {
  private static instance: DefaultLLMProviderFactory;
  private providers: Map<string, new (config: ProviderConfig) => LLMProvider> = new Map();

  private constructor() {
    this.registerDefaultProviders();
  }

  static getInstance(): DefaultLLMProviderFactory {
    if (!DefaultLLMProviderFactory.instance) {
      DefaultLLMProviderFactory.instance = new DefaultLLMProviderFactory();
    }
    return DefaultLLMProviderFactory.instance;
  }

  private registerDefaultProviders(): void {
    this.providers.set('claude', ClaudeProvider);
    this.providers.set('openai', OpenAIProvider);
  }

  /**
   * Register a custom provider
   */
  registerProvider(
    type: string,
    providerClass: new (config: ProviderConfig) => LLMProvider
  ): void {
    this.providers.set(type, providerClass);
  }

  /**
   * Create a provider instance
   */
  createProvider(type: string, config: ProviderConfig): LLMProvider {
    const ProviderClass = this.providers.get(type);
    
    if (!ProviderClass) {
      throw new LLMError(`Unknown provider type: ${type}`, {
        code: 'UNKNOWN_PROVIDER',
        provider: type,
        retryable: false
      });
    }

    try {
      return new ProviderClass(config);
    } catch (error) {
      throw new LLMError(`Failed to create provider ${type}: ${error}`, {
        code: 'PROVIDER_CREATION_FAILED',
        provider: type,
        retryable: false,
        details: error
      });
    }
  }

  /**
   * Get list of supported provider types
   */
  getSupportedProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Validate provider configuration
   */
  async validateProviderConfig(type: string, config: ProviderConfig): Promise<boolean> {
    try {
      // Ensure apiKey is required for validation
      if (!config.apiKey) {
        return false;
      }
      const provider = this.createProvider(type, config);
      return await provider.validateConfig();
    } catch (error) {
      return false;
    }
  }
}

/**
 * Provider Manager for handling multiple providers and switching between them
 */
export class LLMProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private factory: LLMProviderFactory;
  private defaultProvider?: string;

  constructor(factory?: LLMProviderFactory) {
    this.factory = factory || DefaultLLMProviderFactory.getInstance();
  }

  /**
   * Add a provider to the manager
   */
  async addProvider(
    name: string,
    type: ProviderType,
    config: ProviderConfig
  ): Promise<void> {
    try {
      const provider = this.factory.createProvider(type, config);
      
      // Validate the provider configuration
      const isValid = await provider.validateConfig();
      if (!isValid) {
        throw new LLMError(`Provider configuration validation failed for ${name}`, {
          code: 'INVALID_CONFIG',
          provider: type,
          retryable: false
        });
      }

      this.providers.set(name, provider);
      
      // Set as default if it's the first provider
      if (!this.defaultProvider) {
        this.defaultProvider = name;
      }
    } catch (error) {
      throw new LLMError(`Failed to add provider ${name}: ${error}`, {
        code: 'PROVIDER_ADD_FAILED',
        provider: type,
        retryable: false,
        details: error
      });
    }
  }

  /**
   * Remove a provider
   */
  removeProvider(name: string): void {
    this.providers.delete(name);
    
    // Update default if removed
    if (this.defaultProvider === name) {
      const remainingProviders = Array.from(this.providers.keys());
      this.defaultProvider = remainingProviders.length > 0 ? remainingProviders[0] : undefined;
    }
  }

  /**
   * Get a provider by name
   */
  getProvider(name?: string): LLMProvider {
    const providerName = name || this.defaultProvider;
    
    if (!providerName) {
      throw new LLMError('No provider specified and no default provider set', {
        code: 'NO_PROVIDER',
        provider: 'none',
        retryable: false
      });
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new LLMError(`Provider not found: ${providerName}`, {
        code: 'PROVIDER_NOT_FOUND',
        provider: providerName,
        retryable: false
      });
    }

    return provider;
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new LLMError(`Cannot set default provider: ${name} not found`, {
        code: 'PROVIDER_NOT_FOUND',
        provider: name,
        retryable: false
      });
    }
    this.defaultProvider = name;
  }

  /**
   * Get the default provider name
   */
  getDefaultProvider(): string | undefined {
    return this.defaultProvider;
  }

  /**
   * List all available providers
   */
  listProviders(): { name: string; type: string; isDefault: boolean }[] {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      type: provider.name,
      isDefault: name === this.defaultProvider
    }));
  }

  /**
   * Check health of all providers
   */
  async checkProvidersHealth(): Promise<Map<string, boolean>> {
    const healthResults = new Map<string, boolean>();
    
    const healthChecks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
      try {
        const isHealthy = await provider.healthCheck();
        healthResults.set(name, isHealthy);
      } catch (error) {
        healthResults.set(name, false);
      }
    });

    await Promise.all(healthChecks);
    return healthResults;
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(name?: string) {
    const provider = this.getProvider(name);
    return {
      name: provider.name,
      capabilities: provider.capabilities,
      models: provider.models
    };
  }

  /**
   * Auto-select best provider for a task
   */
  selectBestProvider(requirements: {
    needsStreaming?: boolean;
    needsTools?: boolean;
    needsMultimodal?: boolean;
    maxTokens?: number;
    preferredCost?: 'low' | 'medium' | 'high';
  }): string | undefined {
    const candidates = Array.from(this.providers.entries()).filter(([_, provider]) => {
      const caps = provider.capabilities;
      
      if (requirements.needsStreaming && !caps.streaming) return false;
      if (requirements.needsTools && !caps.tools) return false;
      if (requirements.needsMultimodal && !caps.multimodal) return false;
      if (requirements.maxTokens && caps.maxContextTokens < requirements.maxTokens) return false;
      
      return true;
    });

    if (candidates.length === 0) return undefined;

    // Simple selection logic - could be enhanced with more sophisticated scoring
    if (requirements.preferredCost === 'low') {
      // Prefer providers with lower cost models
      const lowCostProviders = candidates.filter(([_, provider]) =>
        provider.models.some(model => 
          model.costPer1kTokens && model.costPer1kTokens.input < 0.001
        )
      );
      if (lowCostProviders.length > 0) {
        return lowCostProviders[0]?.[0];
      }
    }

    // Default to first available candidate
    return candidates[0]?.[0];
  }
}

// LLM Error class
export class LLMError extends Error {
  public code: string;
  public provider: string;
  public model?: string;
  public retryable: boolean;
  public rateLimited?: boolean;
  public details?: any;

  constructor(message: string, options: {
    code: string;
    provider: string;
    model?: string;
    retryable: boolean;
    rateLimited?: boolean;
    details?: any;
  }) {
    super(message);
    this.name = 'LLMError';
    this.code = options.code;
    this.provider = options.provider;
    this.model = options.model;
    this.retryable = options.retryable;
    this.rateLimited = options.rateLimited;
    this.details = options.details;
  }
}