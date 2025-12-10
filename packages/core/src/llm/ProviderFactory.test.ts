import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DefaultLLMProviderFactory,
  LLMProviderManager,
  LLMError
} from './ProviderFactory.js';
import { LLMProvider, ProviderConfig, LLMCapabilities, ModelInfo } from './types.js';

// Mock provider for testing
class MockProvider extends LLMProvider {
  private _isHealthy = true;
  private _isValidConfig = true;

  constructor(config: ProviderConfig) {
    super(config);
  }

  get name(): string {
    return 'mock';
  }

  get models(): ModelInfo[] {
    return [
      {
        id: 'mock-model-1',
        name: 'Mock Model 1',
        description: 'A mock model for testing',
        capabilities: {
          streaming: true,
          tools: true,
          multimodal: false,
          maxContextTokens: 100000,
          maxOutputTokens: 4096,
          inputFormats: ['text']
        },
        costPer1kTokens: {
          input: 0.001,
          output: 0.002
        }
      }
    ];
  }

  get capabilities(): LLMCapabilities {
    return {
      streaming: true,
      tools: true,
      multimodal: false,
      maxContextTokens: 100000,
      maxOutputTokens: 4096,
      inputFormats: ['text']
    };
  }

  async complete() {
    return {
      content: 'Mock response',
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-model-1'
    };
  }

  async *stream() {
    yield { content: 'Mock ' };
    yield { content: 'streaming ' };
    yield { content: 'response' };
    yield { finishReason: 'stop' as const };
  }

  async healthCheck(): Promise<boolean> {
    return this._isHealthy;
  }

  async validateConfig(): Promise<boolean> {
    return this._isValidConfig;
  }

  // Test helpers
  setHealthy(healthy: boolean) {
    this._isHealthy = healthy;
  }

  setValidConfig(valid: boolean) {
    this._isValidConfig = valid;
  }
}

describe('DefaultLLMProviderFactory', () => {
  let factory: DefaultLLMProviderFactory;

  beforeEach(() => {
    // Get a fresh instance by accessing the singleton
    factory = DefaultLLMProviderFactory.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DefaultLLMProviderFactory.getInstance();
      const instance2 = DefaultLLMProviderFactory.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('getSupportedProviders', () => {
    it('should return default providers', () => {
      const providers = factory.getSupportedProviders();

      expect(providers).toContain('claude');
      expect(providers).toContain('openai');
    });
  });

  describe('registerProvider', () => {
    it('should register custom provider', () => {
      factory.registerProvider('mock', MockProvider);

      const providers = factory.getSupportedProviders();
      expect(providers).toContain('mock');
    });
  });

  describe('createProvider', () => {
    beforeEach(() => {
      factory.registerProvider('mock', MockProvider);
    });

    it('should create registered provider', () => {
      const provider = factory.createProvider('mock', {
        name: 'test',
        apiKey: 'test-key'
      });

      expect(provider).toBeInstanceOf(MockProvider);
      expect(provider.name).toBe('mock');
    });

    it('should throw LLMError for unknown provider', () => {
      expect(() =>
        factory.createProvider('unknown', { name: 'test', apiKey: 'key' })
      ).toThrow(LLMError);

      try {
        factory.createProvider('unknown', { name: 'test', apiKey: 'key' });
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe('UNKNOWN_PROVIDER');
      }
    });
  });

  describe('validateProviderConfig', () => {
    beforeEach(() => {
      factory.registerProvider('mock', MockProvider);
    });

    it('should return false for missing apiKey', async () => {
      const isValid = await factory.validateProviderConfig('mock', {
        name: 'test'
      } as ProviderConfig);

      expect(isValid).toBe(false);
    });
  });
});

describe('LLMProviderManager', () => {
  let manager: LLMProviderManager;
  let factory: DefaultLLMProviderFactory;

  beforeEach(() => {
    factory = DefaultLLMProviderFactory.getInstance();
    factory.registerProvider('mock', MockProvider);
    manager = new LLMProviderManager(factory);
  });

  describe('addProvider', () => {
    it('should add provider successfully', async () => {
      await manager.addProvider('test-provider', 'mock', {
        name: 'Test Provider',
        apiKey: 'test-key'
      });

      const providers = manager.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('test-provider');
    });

    it('should set first provider as default', async () => {
      await manager.addProvider('first', 'mock', {
        name: 'First',
        apiKey: 'key'
      });

      expect(manager.getDefaultProvider()).toBe('first');
    });

    it('should not change default when adding second provider', async () => {
      await manager.addProvider('first', 'mock', {
        name: 'First',
        apiKey: 'key'
      });
      await manager.addProvider('second', 'mock', {
        name: 'Second',
        apiKey: 'key'
      });

      expect(manager.getDefaultProvider()).toBe('first');
    });
  });

  describe('getProvider', () => {
    beforeEach(async () => {
      await manager.addProvider('test', 'mock', {
        name: 'Test',
        apiKey: 'key'
      });
    });

    it('should get provider by name', () => {
      const provider = manager.getProvider('test');
      expect(provider).toBeInstanceOf(MockProvider);
    });

    it('should get default provider when name not specified', () => {
      const provider = manager.getProvider();
      expect(provider).toBeInstanceOf(MockProvider);
    });

    it('should throw when provider not found', () => {
      expect(() => manager.getProvider('nonexistent')).toThrow(LLMError);
    });

    it('should throw when no default provider', () => {
      const emptyManager = new LLMProviderManager(factory);
      expect(() => emptyManager.getProvider()).toThrow(LLMError);
    });
  });

  describe('removeProvider', () => {
    beforeEach(async () => {
      await manager.addProvider('first', 'mock', { name: 'First', apiKey: 'key' });
      await manager.addProvider('second', 'mock', { name: 'Second', apiKey: 'key' });
    });

    it('should remove provider', () => {
      manager.removeProvider('second');

      const providers = manager.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('first');
    });

    it('should update default when removing default provider', () => {
      manager.removeProvider('first');

      expect(manager.getDefaultProvider()).toBe('second');
    });

    it('should clear default when removing last provider', async () => {
      manager.removeProvider('first');
      manager.removeProvider('second');

      expect(manager.getDefaultProvider()).toBeUndefined();
    });
  });

  describe('setDefaultProvider', () => {
    beforeEach(async () => {
      await manager.addProvider('first', 'mock', { name: 'First', apiKey: 'key' });
      await manager.addProvider('second', 'mock', { name: 'Second', apiKey: 'key' });
    });

    it('should set default provider', () => {
      manager.setDefaultProvider('second');
      expect(manager.getDefaultProvider()).toBe('second');
    });

    it('should throw when provider not found', () => {
      expect(() => manager.setDefaultProvider('nonexistent')).toThrow(LLMError);
    });
  });

  describe('listProviders', () => {
    beforeEach(async () => {
      await manager.addProvider('first', 'mock', { name: 'First', apiKey: 'key' });
      await manager.addProvider('second', 'mock', { name: 'Second', apiKey: 'key' });
    });

    it('should list all providers with correct info', () => {
      const providers = manager.listProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0]).toMatchObject({
        name: 'first',
        type: 'mock',
        isDefault: true
      });
      expect(providers[1]).toMatchObject({
        name: 'second',
        type: 'mock',
        isDefault: false
      });
    });
  });

  describe('checkProvidersHealth', () => {
    beforeEach(async () => {
      await manager.addProvider('healthy', 'mock', { name: 'Healthy', apiKey: 'key' });
      await manager.addProvider('unhealthy', 'mock', { name: 'Unhealthy', apiKey: 'key' });

      // Make one provider unhealthy
      const unhealthyProvider = manager.getProvider('unhealthy') as MockProvider;
      unhealthyProvider.setHealthy(false);
    });

    it('should check health of all providers', async () => {
      const health = await manager.checkProvidersHealth();

      expect(health.get('healthy')).toBe(true);
      expect(health.get('unhealthy')).toBe(false);
    });
  });

  describe('getProviderCapabilities', () => {
    beforeEach(async () => {
      await manager.addProvider('test', 'mock', { name: 'Test', apiKey: 'key' });
    });

    it('should return provider capabilities', () => {
      const caps = manager.getProviderCapabilities('test');

      expect(caps.name).toBe('mock');
      expect(caps.capabilities.streaming).toBe(true);
      expect(caps.capabilities.tools).toBe(true);
      expect(caps.models).toHaveLength(1);
    });
  });

  describe('selectBestProvider', () => {
    beforeEach(async () => {
      await manager.addProvider('streaming', 'mock', {
        name: 'Streaming',
        apiKey: 'key'
      });
    });

    it('should select provider matching requirements', () => {
      const selected = manager.selectBestProvider({
        needsStreaming: true,
        needsTools: true
      });

      expect(selected).toBe('streaming');
    });

    it('should return undefined when no provider matches', () => {
      const selected = manager.selectBestProvider({
        needsMultimodal: true // MockProvider doesn't support multimodal
      });

      expect(selected).toBeUndefined();
    });

    it('should prefer low cost providers when requested', async () => {
      const selected = manager.selectBestProvider({
        preferredCost: 'low'
      });

      // MockProvider has low cost, should be selected
      expect(selected).toBe('streaming');
    });
  });
});

describe('LLMError', () => {
  it('should create error with all properties', () => {
    const error = new LLMError('Test error', {
      code: 'TEST_CODE',
      provider: 'test-provider',
      model: 'test-model',
      retryable: true,
      rateLimited: true,
      details: { extra: 'info' }
    });

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('LLMError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.provider).toBe('test-provider');
    expect(error.model).toBe('test-model');
    expect(error.retryable).toBe(true);
    expect(error.rateLimited).toBe(true);
    expect(error.details).toEqual({ extra: 'info' });
  });

  it('should be instance of Error', () => {
    const error = new LLMError('Test', {
      code: 'TEST',
      provider: 'test',
      retryable: false
    });

    expect(error).toBeInstanceOf(Error);
  });

  it('should work with optional properties', () => {
    const error = new LLMError('Minimal error', {
      code: 'MINIMAL',
      provider: 'test',
      retryable: false
    });

    expect(error.model).toBeUndefined();
    expect(error.rateLimited).toBeUndefined();
    expect(error.details).toBeUndefined();
  });
});
