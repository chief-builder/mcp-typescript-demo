#!/usr/bin/env node

/**
 * MCP CLI Client Automated Testing Script - Fixed Version
 * Properly handles inquirer menu navigation
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
    this.fullOutput = '';
    this.logStream = null;
    this.testResults = [];
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
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      // Capture all output
      this.cli.stdout.on('data', (data) => {
        const text = data.toString();
        this.output += text;
        this.fullOutput += text;
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

      // Wait for initial prompt
      const checkStartup = setInterval(() => {
        if (this.output.includes('[Not Connected] What would you like to do?')) {
          clearInterval(checkStartup);
          this.log('✓ CLI started successfully', GREEN);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkStartup);
        reject(new Error('CLI did not start properly'));
      }, 10000);
    });
  }

  async sendInput(input) {
    this.logStream.write(`[INPUT] ${input}\n`);
    this.output = ''; // Clear output buffer for next check
    
    this.cli.stdin.write(input);
    await this.delay(100); // Small delay after input
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
      await testFn();
      this.testResults.push({ name: testName, passed: true });
      this.log(`✓ ${testName}`, GREEN);
    } catch (error) {
      this.testResults.push({ name: testName, passed: false, error: error.message });
      this.log(`✗ ${testName}: ${error.message}`, RED);
    }
  }

  async runAllTests() {
    this.log('========================================', BLUE);
    this.log('MCP CLI Client Automated Test', BLUE);
    this.log('========================================', BLUE);
    
    try {
      await this.startCLI();
      await this.delay(1000); // Let the menu fully render

      // Test 1: Connect to server
      await this.runTest('Test 1: Connect to Development Tools server', async () => {
        // The menu starts with "Connect to Server" selected, just press Enter
        await this.sendInput('\n');
        await this.delay(2000);
        
        if (!await this.waitForText('Select a server to connect to:')) {
          throw new Error('Server selection prompt not shown');
        }
        
        // Select first server (Development Tools)
        await this.sendInput('\n');
        await this.delay(3000);
        
        if (!await this.waitForText('Connected to Development Tools')) {
          throw new Error('Failed to connect to server');
        }
        
        await this.delay(1000);
      });

      // Test 2: List Tools  
      await this.runTest('Test 2: List available tools', async () => {
        // When connected, "List Tools" should be the first option
        await this.sendInput('\n');
        await this.delay(2000);
        
        if (!await this.waitForText('Available Tools:') || !await this.waitForText('format_code')) {
          throw new Error('Tools not listed correctly');
        }
        
        await this.delay(1000);
      });

      // Test 3: List Resources
      await this.runTest('Test 3: List available resources', async () => {
        // Navigate down to "List Resources" and select it
        await this.sendInput('\x1B[B\n'); // DOWN + ENTER
        await this.delay(2000);
        
        if (!await this.waitForText('Available Resources:') || !await this.waitForText('project_config')) {
          throw new Error('Resources not listed correctly');
        }
        
        await this.delay(1000);
      });

      // Test 4: List Prompts
      await this.runTest('Test 4: List available prompts', async () => {
        // Navigate down to "List Prompts"
        await this.sendInput('\x1B[B\x1B[B\n'); // DOWN + DOWN + ENTER
        await this.delay(2000);
        
        if (!await this.waitForText('Available Prompts:') || !await this.waitForText('code_review')) {
          throw new Error('Prompts not listed correctly');
        }
        
        await this.delay(1000);
      });

      // Test 5: Call Tool
      await this.runTest('Test 5: Call format_code tool', async () => {
        // Navigate to "Call Tool"
        await this.sendInput('\x1B[B\x1B[B\x1B[B\n'); // 3x DOWN + ENTER
        await this.delay(2000);
        
        if (!await this.waitForText('Select a tool to call:')) {
          throw new Error('Tool selection prompt not shown');
        }
        
        // Select first tool
        await this.sendInput('\n');
        await this.delay(1000);
        
        if (!await this.waitForText('Enter tool arguments')) {
          throw new Error('Arguments prompt not shown');
        }
        
        // Enter tool arguments
        await this.sendInput('{"code": "function test(){console.log(\'hello\')}", "language": "javascript"}\n');
        await this.delay(3000);
        
        if (!await this.waitForText('Successfully formatted')) {
          throw new Error('Tool execution failed');
        }
        
        await this.delay(1000);
      });

      // Test 6: Read Resource
      await this.runTest('Test 6: Read resource', async () => {
        // Navigate to "Read Resource" (4 downs from top)
        await this.sendInput('\x1B[B\x1B[B\x1B[B\x1B[B\n');
        await this.delay(2000);
        
        if (!await this.waitForText('Select a resource to read:')) {
          throw new Error('Resource selection prompt not shown');
        }
        
        // Select first resource
        await this.sendInput('\n');
        await this.delay(2000);
        
        if (!await this.waitForText('Project Configuration Overview')) {
          throw new Error('Resource not read correctly');
        }
        
        await this.delay(1000);
      });

      // Test 7: Get Prompt
      await this.runTest('Test 7: Get prompt', async () => {
        // Navigate to "Get Prompt" (5 downs from top)
        await this.sendInput('\x1B[B\x1B[B\x1B[B\x1B[B\x1B[B\n');
        await this.delay(2000);
        
        if (!await this.waitForText('Select a prompt to get:')) {
          throw new Error('Prompt selection not shown');
        }
        
        // Select first prompt
        await this.sendInput('\n');
        await this.delay(1000);
        
        if (!await this.waitForText('Enter prompt arguments')) {
          throw new Error('Prompt arguments not requested');
        }
        
        // Enter prompt arguments
        await this.sendInput('{"filePath": "test.js"}\n');
        await this.delay(2000);
        
        if (!await this.waitForText('comprehensive code review')) {
          throw new Error('Prompt not retrieved correctly');
        }
        
        await this.delay(1000);
      });

      // Test 8: Disconnect
      await this.runTest('Test 8: Disconnect from server', async () => {
        // Navigate to "Disconnect" (6 downs from top)
        await this.sendInput('\x1B[B\x1B[B\x1B[B\x1B[B\x1B[B\x1B[B\n');
        await this.delay(2000);
        
        if (!await this.waitForText('Disconnected from server')) {
          throw new Error('Failed to disconnect');
        }
        
        await this.delay(1000);
      });

      // Test 9: Exit
      await this.runTest('Test 9: Exit CLI gracefully', async () => {
        // After disconnect, we should be back at main menu
        // Navigate to "Exit" (1 down from "Connect to Server")
        await this.sendInput('\x1B[B\n');
        await this.delay(1000);
        
        if (!await this.waitForText('Goodbye!')) {
          throw new Error('Failed to exit gracefully');
        }
      });

    } catch (error) {
      this.log(`\nFatal error: ${error.message}`, RED);
    } finally {
      // Ensure process is terminated
      if (this.cli && !this.cli.killed) {
        this.cli.kill('SIGTERM');
        await this.delay(500);
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