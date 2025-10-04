#!/usr/bin/env node

// Simple test to verify streaming works
async function testStreaming() {
  console.log('Testing streaming endpoint...\n');

  try {
    const response = await fetch('http://localhost:4000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Count from 1 to 5',
        stream: true
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('\nStreaming data:');
    console.log('---');

    const text = await response.text();
    console.log(text);
    console.log('---');

    // Parse SSE data
    const lines = text.split('\n');
    let content = '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('\n✓ Stream completed');
        } else {
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              content += parsed.content;
            }
          } catch (e) {
            // Skip
          }
        }
      }
    }

    console.log('\nFull content:', content);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testStreaming();