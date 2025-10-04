#!/usr/bin/env node

// Simple test client to validate MCP server
import { spawn } from 'child_process';

const serverPath = './packages/servers/dev-tools/dist/index.js';

console.log('Testing MCP Development Tools Server...');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Test initialization
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {
      roots: {},
      sampling: {}
    },
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('Sending initialize message...');
server.stdin.write(JSON.stringify(initMessage) + '\n');

// Test tools/list
setTimeout(() => {
  const toolsMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };
  
  console.log('Sending tools/list message...');
  server.stdin.write(JSON.stringify(toolsMessage) + '\n');
}, 100);

server.stdout.on('data', (data) => {
  const response = data.toString().trim();
  console.log('Server response:', response);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

// Clean shutdown after 3 seconds
setTimeout(() => {
  console.log('Shutting down test...');
  server.kill('SIGTERM');
  process.exit(0);
}, 3000);