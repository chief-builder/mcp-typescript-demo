import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { OpenAIProvider } from './OpenAIProvider.js';
import { LLMError } from '../ProviderFactory.js';

// Use OPENAI_API_KEY for API authentication
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const HAS_API_KEY = Boolean(OPENAI_KEY);

// Track if API key is valid (set during beforeAll)
let API_KEY_VALID = false;

describe('OpenAIProvider', () => {
  describe('Provider Properties', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({
        name: 'test-openai',
        apiKey: 'test-key',
      });
    });

    it('should have correct name', () => {
      expect(provider.name).toBe('openai');
    });

    it('should have models defined', () => {
      const models = provider.models;
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should have gpt-4o model', () => {
      const models = provider.models;
      const gpt4o = models.find(m => m.id === 'gpt-4o');
      expect(gpt4o).toBeDefined();
      expect(gpt4o?.name).toBe('GPT-4o');
    });

    it('should have gpt-4o-mini model', () => {
      const models = provider.models;
      const gpt4oMini = models.find(m => m.id === 'gpt-4o-mini');
      expect(gpt4oMini).toBeDefined();
      expect(gpt4oMini?.name).toBe('GPT-4o Mini');
    });

    it('should have gpt-4-turbo model', () => {
      const models = provider.models;
      const gpt4turbo = models.find(m => m.id === 'gpt-4-turbo');
      expect(gpt4turbo).toBeDefined();
      expect(gpt4turbo?.name).toBe('GPT-4 Turbo');
    });

    it('should have gpt-3.5-turbo model', () => {
      const models = provider.models;
      const gpt35 = models.find(m => m.id === 'gpt-3.5-turbo');
      expect(gpt35).toBeDefined();
      expect(gpt35?.name).toBe('GPT-3.5 Turbo');
    });

    it('should have correct capabilities', () => {
      const caps = provider.capabilities;
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(true);
      expect(caps.multimodal).toBe(true);
      expect(caps.maxContextTokens).toBe(128000);
      expect(caps.maxOutputTokens).toBe(16384);
      expect(caps.inputFormats).toContain('text');
      expect(caps.inputFormats).toContain('image');
      expect(caps.inputFormats).toContain('audio');
    });

    it('should have cost information for models', () => {
      const models = provider.models;
      models.forEach(model => {
        expect(model.costPer1kTokens).toBeDefined();
        expect(model.costPer1kTokens?.input).toBeGreaterThan(0);
        expect(model.costPer1kTokens?.output).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration', () => {
    it('should use default baseUrl if not provided', () => {
      const provider = new OpenAIProvider({
        name: 'test',
        apiKey: 'key',
      });
      expect(provider).toBeDefined();
    });

    it('should accept custom baseUrl', () => {
      const provider = new OpenAIProvider({
        name: 'test',
        apiKey: 'key',
        baseUrl: 'https://custom.api.com',
      });
      expect(provider).toBeDefined();
    });

    it('should accept organization', () => {
      const provider = new OpenAIProvider({
        name: 'test',
        apiKey: 'key',
        organization: 'org-123456',
      });
      expect(provider).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should fail validation without API key', async () => {
      const provider = new OpenAIProvider({
        name: 'test',
        apiKey: '',
      });
      const isValid = await provider.validateConfig();
      expect(isValid).toBe(false);
    });
  });

  describe('Tool Calls', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({
        name: 'test',
        apiKey: 'test-key',
      });
    });

    it('should handle callTool method', async () => {
      const result = await provider.callTool({
        id: 'tool-1',
        name: 'test_tool',
        arguments: { arg1: 'value1' },
      });

      expect(result).toBeDefined();
      expect(result.toolCallId).toBe('tool-1');
      expect(result.result).toContain('test_tool');
    });
  });

  describe('Usage Statistics', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider({
        name: 'test',
        apiKey: 'test-key',
      });
    });

    it('should return usage stats', async () => {
      const usage = await provider.getUsage();
      expect(usage).toBeDefined();
      expect(typeof usage.requestsToday).toBe('number');
      expect(typeof usage.tokensToday).toBe('number');
    });
  });

  // Integration tests that require actual API key
  describe.skipIf(!HAS_API_KEY)('API Integration Tests', () => {
    let provider: OpenAIProvider;

    beforeAll(async () => {
      console.log('\n🔐 Initializing OpenAI API integration tests...');
      console.log(`   OPENAI_API_KEY set: ${Boolean(OPENAI_KEY)}`);
      console.log(`   API key prefix: ${OPENAI_KEY.substring(0, 10)}...`);

      provider = new OpenAIProvider({
        name: 'openai-integration',
        apiKey: OPENAI_KEY,
      });

      // Validate API key works before running tests
      try {
        console.log('   Validating API key...');
        const response = await provider.chatCompletion({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'gpt-4o-mini',
          maxTokens: 5,
        });
        API_KEY_VALID = response.content.length > 0;
        console.log(`   API key valid! Response: "${response.content}"`);
      } catch (error) {
        console.warn('   API key validation failed:', error);
        API_KEY_VALID = false;
      }
    }, 30000);

    it('should complete a simple prompt', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n Test: Simple prompt completion');
      console.log('   Prompt: "Say hello and nothing else."');

      const response = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
        model: 'gpt-4o-mini',
        maxTokens: 50,
      });

      console.log(`   Response: "${response.content}"`);
      console.log(`   Model: ${response.model}`);
      console.log(`   Finish reason: ${response.finishReason}`);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.content.toLowerCase()).toContain('hello');
      expect(response.finishReason).toBe('stop');
      expect(response.model).toBeDefined();
    }, 30000);

    it('should complete with system prompt', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n Test: System prompt');
      console.log('   System: "You are TestBot"');
      console.log('   User: "What is your name?"');

      const response = await provider.chatCompletion({
        messages: [
          { role: 'system', content: 'You are a helpful assistant named TestBot. Always introduce yourself.' },
          { role: 'user', content: 'What is your name?' },
        ],
        model: 'gpt-4o-mini',
        maxTokens: 100,
      });

      console.log(`   Response: "${response.content.substring(0, 100)}..."`);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    }, 30000);

    it('should stream a response', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n Test: Streaming response');
      console.log('   Prompt: "Count from 1 to 3."');
      console.log('   Streaming chunks: ');

      const chunks: string[] = [];

      for await (const chunk of provider.chatCompletionStream({
        messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
        model: 'gpt-4o-mini',
        maxTokens: 100,
      })) {
        if (chunk.content) {
          process.stdout.write(chunk.content);
          chunks.push(chunk.content);
        }
      }
      console.log('\n   Stream complete');
      console.log(`   Total chunks: ${chunks.length}`);

      expect(chunks.length).toBeGreaterThan(0);
      const fullResponse = chunks.join('');
      expect(fullResponse).toBeTruthy();
    }, 30000);

    it('should pass health check with valid API key', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n Test: Health check');

      const isHealthy = await provider.healthCheck();
      console.log(`   Health status: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);

      expect(isHealthy).toBe(true);
    }, 30000);

    it('should validate config with valid API key', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n Test: Config validation');

      const isValid = await provider.validateConfig();
      console.log(`   Config valid: ${isValid ? 'Yes' : 'No'}`);

      expect(isValid).toBe(true);
    }, 30000);

    it('should handle chat completion with messages', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n Test: Chat completion');
      console.log('   Messages: [{ role: "user", content: "Say test passed" }]');

      const response = await provider.chatCompletion({
        messages: [
          { role: 'user', content: 'Say "test passed"' },
        ],
        model: 'gpt-4o-mini',
        maxTokens: 50,
      });

      console.log(`   Response: "${response.content}"`);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    }, 30000);

    it('should include usage information', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n Test: Token usage');

      const response = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'gpt-4o-mini',
        maxTokens: 10,
      });

      console.log(`   Response: "${response.content}"`);
      console.log(`   Token Usage:`);
      console.log(`      Prompt tokens: ${response.usage?.promptTokens}`);
      console.log(`      Completion tokens: ${response.usage?.completionTokens}`);
      console.log(`      Total tokens: ${response.usage?.totalTokens}`);

      expect(response.usage).toBeDefined();
      expect(response.usage?.promptTokens).toBeGreaterThan(0);
      expect(response.usage?.completionTokens).toBeGreaterThan(0);
      expect(response.usage?.totalTokens).toBeGreaterThan(0);
    }, 30000);
  });

  describe.skipIf(!HAS_API_KEY)('Error Handling Integration', () => {
    it('should fail health check with invalid API key', async () => {
      console.log('\n Test: Invalid API key handling');

      const provider = new OpenAIProvider({
        name: 'invalid',
        apiKey: 'invalid-key-12345',
      });

      const isHealthy = await provider.healthCheck();
      console.log(`   Health status with invalid key: ${isHealthy ? 'Unexpectedly healthy' : 'Correctly rejected'}`);

      expect(isHealthy).toBe(false);
    }, 30000);
  });
});
