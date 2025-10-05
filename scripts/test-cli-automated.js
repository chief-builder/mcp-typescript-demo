#!/usr/bin/env node

/**
 * MCP CLI Client Automated Testing Script
 * Uses Node.js child_process to automate CLI testing
 */

import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Test configuration
const CLI_PATH = path.join(__dirname, '..', 'packages', 'clients', 'cli', 'dist', 'index.js');
const LOG_FILE = '/tmp/mcp-cli-test.log';

class CLITester {
  constructor() {
    this.cli = null;
    this.output = '';
    this.logStream = null;
    this.testResults = [];
    this.isConnected = false;
  }

  log(message, color = RESET) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`${color}${message}${RESET}`);
    
    if (this.logStream) {
      this.logStream.write(logMessage + '\n');
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async startCLI() {
    this.logStream = createWriteStream(LOG_FILE);
    
    return new Promise((resolve, reject) => {
      this.log('Starting CLI client...', YELLOW);
      
      this.cli = spawn('node', [CLI_PATH], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let startupBuffer = '';
      
      // Capture all output
      this.cli.stdout.on('data', (data) => {
        const text = data.toString();
        this.output += text;
        startupBuffer += text;
        this.logStream.write(`[STDOUT] ${text}`);
      });

      this.cli.stderr.on('data', (data) => {
        const text = data.toString();
        this.logStream.write(`[STDERR] ${text}`);
      });

      this.cli.on('error', (error) => {
        this.log(`Process error: ${error.message}`, RED);
        reject(error);
      });

      this.cli.on('close', (code) => {
        this.log(`CLI process exited with code ${code}`, code === 0 ? GREEN : RED);
      });

      // Wait for initial prompt with increased timeout
      const checkStartup = setInterval(() => {
        if (startupBuffer.includes('[Not Connected] What would you like to do?') ||
            startupBuffer.includes('What would you like to do?')) {
          clearInterval(checkStartup);
          this.log('✓ CLI started successfully', GREEN);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkStartup);
        this.log(`Startup buffer: ${startupBuffer}`, RED);
        reject(new Error('CLI did not start properly - no prompt found'));
      }, 10000);
    });
  }

  async sendKeySequence(keys) {
    for (const key of keys) {
      if (key === 'ENTER') {
        this.cli.stdin.write('\n');
      } else if (key === 'DOWN') {
        this.cli.stdin.write('\x1B[B');
      } else if (key === 'UP') {
        this.cli.stdin.write('\x1B[A');
      } else {
        this.cli.stdin.write(key);
      }
      await this.delay(50);
    }
  }

  async sendInput(input) {
    this.logStream.write(`[INPUT] ${input}\n`);
    this.output = ''; // Clear output buffer
    
    if (input === 'ENTER') {
      this.cli.stdin.write('\n');
    } else if (input === 'DOWN') {
      this.cli.stdin.write('\x1B[B');
    } else {
      this.cli.stdin.write(input + '\n');
    }
    
    await this.delay(1500); // Wait for response
  }

  async waitForText(expectedText, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.output.includes(expectedText)) {
        return true;
      }
      await this.delay(100);
    }
    
    this.log(`Timeout waiting for: "${expectedText}"`, RED);
    this.log(`Current output: ${this.output.slice(-500)}`, YELLOW);
    return false;
  }

  async runTest(testName, testFn) {
    this.log(`\n${testName}`, YELLOW);
    
    try {
      const result = await testFn();
      if (result !== false) {
        this.testResults.push({ name: testName, passed: true });
        this.log(`✓ ${testName}`, GREEN);
      } else {
        throw new Error('Test returned false');
      }
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: error.message });
      this.log(`✗ ${testName}: ${error.message}`, RED);
      
      // Log recent output for debugging
      this.log('Recent output:', YELLOW);
      this.log(this.output.slice(-500), YELLOW);
    }
  }

  async runAllTests() {
    this.log('========================================', BLUE);
    this.log('MCP CLI Client Automated Test', BLUE);
    this.log('========================================', BLUE);
    
    try {
      await this.startCLI();

      // Test 1: Connect to server
      await this.runTest('Test 1: Connect to Development Tools server', async () => {
        // Send DOWN arrow to navigate to "Connect to Server"
        await this.sendKeySequence(['DOWN', 'ENTER']);
        
        if (!await this.waitForText('Select a server to connect to:')) {
          throw new Error('Server selection prompt not shown');
        }
        
        // Select first server (Development Tools)
        await this.sendInput('');
        
        if (!await this.waitForText('Connected to Development Tools')) {
          throw new Error('Failed to connect to server');
        }
        
        this.isConnected = true;
        return true;
      });

      // Test 2: List Tools  
      await this.runTest('Test 2: List available tools', async () => {
        await this.sendInput(''); // Select first option (List Tools)
        
        if (!await this.waitForText('Available Tools:')) {
          throw new Error('Tools header not found');
        }
        
        if (!await this.waitForText('format_code')) {
          throw new Error('format_code tool not found');
        }
        
        return true;
      });

      // Test 3: List Resources
      await this.runTest('Test 3: List available resources', async () => {
        await this.sendKeySequence(['DOWN', 'ENTER']);
        
        if (!await this.waitForText('Available Resources:')) {
          throw new Error('Resources header not found');
        }
        
        if (!await this.waitForText('project_config')) {
          throw new Error('project_config resource not found');
        }
        
        return true;
      });

      // Test 4: List Prompts
      await this.runTest('Test 4: List available prompts', async () => {
        await this.sendKeySequence(['DOWN', 'DOWN', 'ENTER']);
        
        if (!await this.waitForText('Available Prompts:')) {
          throw new Error('Prompts header not found');
        }
        
        if (!await this.waitForText('code_review')) {
          throw new Error('code_review prompt not found');
        }
        
        return true;
      });

      // Test 5: Call Tool
      await this.runTest('Test 5: Call format_code tool', async () => {
        await this.sendKeySequence(['DOWN', 'DOWN', 'DOWN', 'ENTER']);
        
        if (!await this.waitForText('Select a tool to call:')) {
          throw new Error('Tool selection prompt not shown');
        }
        
        await this.sendInput(''); // Select first tool
        
        if (!await this.waitForText('Enter tool arguments')) {
          throw new Error('Arguments prompt not shown');
        }
        
        await this.sendInput('{"code": "function test(){console.log(\'hello\')}", "language": "javascript"}');
        
        if (!await this.waitForText('Successfully formatted')) {
          throw new Error('Tool execution failed');
        }
        
        return true;
      });

      // Test 6: Disconnect
      await this.runTest('Test 6: Disconnect from server', async () => {
        // Navigate to Disconnect option (6 down arrows)
        await this.sendKeySequence(['DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'ENTER']);
        
        if (!await this.waitForText('Disconnected from server')) {
          throw new Error('Failed to disconnect');
        }
        
        this.isConnected = false;
        return true;
      });

      // Test 7: Exit
      await this.runTest('Test 7: Exit CLI gracefully', async () => {
        await this.sendKeySequence(['DOWN', 'ENTER']);
        
        if (!await this.waitForText('Goodbye!')) {
          throw new Error('Failed to exit gracefully');
        }
        
        return true;
      });

    } catch (error) {
      this.log(`\nFatal error: ${error.message}`, RED);
    } finally {
      // Ensure process is terminated
      if (this.cli && !this.cli.killed) {
        this.cli.kill('SIGTERM');
      }
      
      // Close log stream
      if (this.logStream) {
        this.logStream.end();
      }
    }

    // Print summary
    this.log('\n========================================', BLUE);
    this.log('Test Summary', BLUE);
    this.log('========================================', BLUE);
    
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    
    this.log(`Tests passed: ${passed}`, passed > 0 ? GREEN : YELLOW);
    if (failed > 0) {
      this.log(`Tests failed: ${failed}`, RED);
      this.log(`\nFailed tests:`, RED);
      this.testResults.filter(r => !r.passed).forEach(r => {
        this.log(`  - ${r.name}: ${r.error}`, RED);
      });
      this.log(`\nCheck log file for details: ${LOG_FILE}`, YELLOW);
    } else {
      this.log('\nAll CLI client functionality verified!', GREEN);
      // Clean up log file on success
      try {
        await unlink(LOG_FILE);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run the tests
const tester = new CLITester();
tester.runAllTests().catch(error => {
  console.error(`${RED}Unexpected error: ${error.message}${RESET}`);
  process.exit(1);
});