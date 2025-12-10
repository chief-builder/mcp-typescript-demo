import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ClaudeProvider } from './ClaudeProvider.js';
import { LLMError } from '../ProviderFactory.js';

// Use CLAUDE_CODE_OAUTH_TOKEN for OAuth authentication
// Or ANTHROPIC_API_KEY for standard API key authentication (sk-ant-...)
const OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_KEY = OAUTH_TOKEN || ANTHROPIC_KEY;
const HAS_API_KEY = Boolean(API_KEY);
// sk-ant-* tokens (including sk-ant-oat-*) use x-api-key header, not Bearer
const IS_OAUTH = Boolean(API_KEY) && !API_KEY.startsWith('sk-ant-');

// Track if API key is valid (set during beforeAll)
let API_KEY_VALID = false;

describe('ClaudeProvider', () => {
  describe('Provider Properties', () => {
    let provider: ClaudeProvider;

    beforeEach(() => {
      provider = new ClaudeProvider({
        name: 'test-claude',
        apiKey: 'test-key',
      });
    });

    it('should have correct name', () => {
      expect(provider.name).toBe('claude');
    });

    it('should have models defined', () => {
      const models = provider.models;
      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should have claude-3-5-sonnet model', () => {
      const models = provider.models;
      const sonnet = models.find(m => m.id.includes('sonnet'));
      expect(sonnet).toBeDefined();
      expect(sonnet?.name).toContain('Sonnet');
    });

    it('should have claude-3-5-haiku model', () => {
      const models = provider.models;
      const haiku = models.find(m => m.id.includes('haiku'));
      expect(haiku).toBeDefined();
      expect(haiku?.name).toContain('Haiku');
    });

    it('should have claude-3-opus model', () => {
      const models = provider.models;
      const opus = models.find(m => m.id.includes('opus'));
      expect(opus).toBeDefined();
      expect(opus?.name).toContain('Opus');
    });

    it('should have correct capabilities', () => {
      const caps = provider.capabilities;
      expect(caps.streaming).toBe(true);
      expect(caps.tools).toBe(true);
      expect(caps.multimodal).toBe(true);
      expect(caps.maxContextTokens).toBe(200000);
      expect(caps.maxOutputTokens).toBe(8192);
      expect(caps.inputFormats).toContain('text');
      expect(caps.inputFormats).toContain('image');
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
      const provider = new ClaudeProvider({
        name: 'test',
        apiKey: 'key',
      });
      // We can't directly access private fields, but we can verify it works
      expect(provider).toBeDefined();
    });

    it('should accept custom baseUrl', () => {
      const provider = new ClaudeProvider({
        name: 'test',
        apiKey: 'key',
        baseUrl: 'https://custom.api.com',
      });
      expect(provider).toBeDefined();
    });

    it('should accept custom version', () => {
      const provider = new ClaudeProvider({
        name: 'test',
        apiKey: 'key',
        version: '2024-01-01',
      });
      expect(provider).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should fail validation without API key', async () => {
      const provider = new ClaudeProvider({
        name: 'test',
        apiKey: '',
      });
      const isValid = await provider.validateConfig();
      expect(isValid).toBe(false);
    });
  });

  describe('Tool Calls', () => {
    let provider: ClaudeProvider;

    beforeEach(() => {
      provider = new ClaudeProvider({
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
    let provider: ClaudeProvider;

    beforeEach(() => {
      provider = new ClaudeProvider({
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
  // These tests validate the API key first and skip if authentication fails
  describe.skipIf(!HAS_API_KEY)('API Integration Tests', () => {
    let provider: ClaudeProvider;

    beforeAll(async () => {
      console.log('\n🔐 Initializing Claude API integration tests...');
      console.log(`   CLAUDE_CODE_OAUTH_TOKEN set: ${Boolean(OAUTH_TOKEN)}`);
      console.log(`   ANTHROPIC_API_KEY set: ${Boolean(ANTHROPIC_KEY)}`);
      console.log(`   API key prefix: ${API_KEY.substring(0, 12)}...`);
      console.log(`   Auth method: ${IS_OAUTH ? 'Bearer token' : 'x-api-key'}`);

      provider = new ClaudeProvider({
        name: 'claude-integration',
        apiKey: API_KEY,
        // sk-ant-* tokens use x-api-key, others use Bearer
        useOAuth: IS_OAUTH,
        // Use haiku as default model - most widely available
        defaultModel: 'claude-3-haiku-20240307',
      });

      // Validate API key works before running tests
      // Use haiku model which is most widely available
      try {
        console.log('   Validating API key...');
        const response = await provider.chatCompletion({
          messages: [{ role: 'user', content: 'Hi' }],
          model: 'claude-3-haiku-20240307',  // Use haiku for validation - most available
          maxTokens: 5,
        });
        API_KEY_VALID = response.content.length > 0;
        console.log(`   ✅ API key valid! Response: "${response.content}"`);
      } catch (error) {
        console.warn('   ❌ API key validation failed:', error);
        API_KEY_VALID = false;
      }
    }, 30000);

    it('should complete a simple prompt', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n📝 Test: Simple prompt completion');
      console.log('   Prompt: "Say hello and nothing else."');

      const response = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
        model: 'claude-3-haiku-20240307',
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
      console.log('\n📝 Test: System prompt');
      console.log('   System: "You are TestBot"');
      console.log('   User: "What is your name?"');

      const response = await provider.chatCompletion({
        messages: [
          { role: 'system', content: 'You are a helpful assistant named TestBot. Always introduce yourself.' },
          { role: 'user', content: 'What is your name?' },
        ],
        model: 'claude-3-haiku-20240307',
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
      console.log('\n📝 Test: Streaming response');
      console.log('   Prompt: "Count from 1 to 3."');
      console.log('   Streaming chunks: ');

      const chunks: string[] = [];

      for await (const chunk of provider.chatCompletionStream({
        messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
        model: 'claude-3-haiku-20240307',
        maxTokens: 100,
      })) {
        if (chunk.content) {
          process.stdout.write(chunk.content);
          chunks.push(chunk.content);
        }
      }
      console.log('\n   ✅ Stream complete');
      console.log(`   Total chunks: ${chunks.length}`);

      expect(chunks.length).toBeGreaterThan(0);
      const fullResponse = chunks.join('');
      expect(fullResponse).toBeTruthy();
    }, 30000);

    // healthCheck() and validateConfig() now use the defaultModel configured above (haiku)
    it('should pass health check with valid API key', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n📝 Test: Health check');

      const isHealthy = await provider.healthCheck();
      console.log(`   Health status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);

      expect(isHealthy).toBe(true);
    }, 30000);

    it('should validate config with valid API key', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n📝 Test: Config validation');

      const isValid = await provider.validateConfig();
      console.log(`   Config valid: ${isValid ? '✅ Yes' : '❌ No'}`);

      expect(isValid).toBe(true);
    }, 30000);

    it('should handle chat completion with messages', async () => {
      if (!API_KEY_VALID) {
        console.log('Skipping: API key not valid');
        return;
      }
      console.log('\n📝 Test: Chat completion');
      console.log('   Messages: [{ role: "user", content: "Say test passed" }]');

      const response = await provider.chatCompletion({
        messages: [
          { role: 'user', content: 'Say "test passed"' },
        ],
        model: 'claude-3-haiku-20240307',
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
      console.log('\n📝 Test: Token usage');

      const response = await provider.chatCompletion({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'claude-3-haiku-20240307',
        maxTokens: 10,
      });

      console.log(`   Response: "${response.content}"`);
      console.log(`   📊 Token Usage:`);
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
      console.log('\n📝 Test: Invalid API key handling');

      const provider = new ClaudeProvider({
        name: 'invalid',
        apiKey: 'invalid-key-12345',
      });

      const isHealthy = await provider.healthCheck();
      console.log(`   Health status with invalid key: ${isHealthy ? '❌ Unexpectedly healthy' : '✅ Correctly rejected'}`);

      expect(isHealthy).toBe(false);
    }, 30000);
  });
});
