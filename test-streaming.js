#!/usr/bin/env node

/**
 * Test script for the enhanced chat server with streaming support
 */

import fetch from 'node-fetch';
import { Readable } from 'stream';

const CHAT_SERVER_URL = 'http://localhost:4000';

async function testChatServer() {
  console.log('🧪 Testing Enhanced Chat Server...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${CHAT_SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    console.log('   Available providers:', healthData.llm_providers);
    console.log('   Current provider:', healthData.current_provider);
    console.log();

    // Test providers endpoint
    console.log('2. Testing providers endpoint...');
    const providersResponse = await fetch(`${CHAT_SERVER_URL}/providers`);
    const providersData = await providersResponse.json();
    console.log('✅ Providers list:', providersData);
    console.log();

    // Test regular chat
    console.log('3. Testing regular chat...');
    const chatResponse = await fetch(`${CHAT_SERVER_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello! Please respond with just "Hi there!" and nothing else.',
        provider: 'claude'
      })
    });
    
    const chatData = await chatResponse.json();
    console.log('✅ Regular chat response:', chatData);
    console.log();

    // Test streaming chat
    console.log('4. Testing streaming chat...');
    const streamResponse = await fetch(`${CHAT_SERVER_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Count from 1 to 5, one number per second.',
        provider: 'claude',
        stream: true
      })
    });

    console.log('✅ Streaming response:');
    
    // node-fetch returns a Node.js stream, not a web stream
    const stream = streamResponse.body;
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('   🏁 Stream completed');
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                process.stdout.write(parsed.content);
              }
              if (parsed.finishReason) {
                console.log(`\\n   ✅ Finished: ${parsed.finishReason}`);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('\\n\\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Make sure the chat server is running: npm run dev:chat');
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testChatServer();
}

export { testChatServer };