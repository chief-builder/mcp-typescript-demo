#!/usr/bin/env node

/**
 * MCP CLI Client Automated Testing Script
 * This script automates the testing of all CLI client functionality
 */

import { spawn } from 'child_process';
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
const TIMEOUT = 5000; // 5 seconds per test
const CLI_PATH = path.join(__dirname, '..', 'packages', 'clients', 'cli', 'dist', 'index.js');

class CLITester {
  constructor() {
    this.cli = null;
    this.output = '';
    this.currentTest = '';
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  log(message, color = RESET) {
    console.log(`${color}${message}${RESET}`);
  }

  async startCLI() {
    return new Promise((resolve, reject) => {
      this.cli = spawn('node', [CLI_PATH], {
        env: { ...process.env, FORCE_COLOR: '0' }
      });

      this.cli.stdout.on('data', (data) => {
        this.output += data.toString();
      });

      this.cli.stderr.on('data', (data) => {
        console.error(`${RED}Error: ${data.toString()}${RESET}`);
      });

      this.cli.on('error', (error) => {
        reject(error);
      });

      // Wait for initial prompt
      setTimeout(() => {
        if (this.output.includes('What would you like to do?')) {
          resolve();
        } else {
          reject(new Error('CLI did not start properly'));
        }
      }, 2000);
    });
  }

  async sendInput(input) {
    this.output = ''; // Clear output buffer
    this.cli.stdin.write(input + '\n');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async waitForOutput(expectedText, timeout = TIMEOUT) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.output.includes(expectedText)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false;
  }

  async runTest(testName, testFn) {
    this.currentTest = testName;
    this.log(`\nTesting: ${testName}`, YELLOW);
    
    try {
      await testFn();
      this.testsPassed++;
      this.log(`✓ ${testName}`, GREEN);
    } catch (error) {
      this.testsFailed++;
      this.log(`✗ ${testName}: ${error.message}`, RED);
      this.log(`Output: ${this.output.slice(-200)}`, RED);
    }
  }

  async runAllTests() {
    this.log('========================================', BLUE);
    this.log('MCP CLI Client Automated Test', BLUE);
    this.log('========================================', BLUE);
    
    try {
      await this.startCLI();
      this.log('\n✓ CLI started successfully', GREEN);

      // Test 1: Connect to server
      await this.runTest('Connect to Development Tools server', async () => {
        // Navigate to "Connect to Server" option (down arrow)
        await this.sendInput('\x1B[B');
        await this.sendInput(''); // Enter
        
        if (!await this.waitForOutput('Select a server to connect to:')) {
          throw new Error('Server selection prompt not shown');
        }
        
        await this.sendInput(''); // Select first server
        
        if (!await this.waitForOutput('Connected to Development Tools')) {
          throw new Error('Failed to connect to server');
        }
      });

      // Test 2: List Tools
      await this.runTest('List available tools', async () => {
        await this.sendInput(''); // Select "List Tools" (first option)
        
        if (!await this.waitForOutput('Available Tools:') || 
            !await this.waitForOutput('format_code')) {
          throw new Error('Tools list not displayed correctly');
        }
      });

      // Test 3: List Resources
      await this.runTest('List available resources', async () => {
        await this.sendInput('\x1B[B'); // Down arrow to "List Resources"
        await this.sendInput(''); // Enter
        
        if (!await this.waitForOutput('Available Resources:') || 
            !await this.waitForOutput('project_config')) {
          throw new Error('Resources list not displayed correctly');
        }
      });

      // Test 4: List Prompts
      await this.runTest('List available prompts', async () => {
        await this.sendInput('\x1B[B\x1B[B'); // Down arrow twice to "List Prompts"
        await this.sendInput(''); // Enter
        
        if (!await this.waitForOutput('Available Prompts:') || 
            !await this.waitForOutput('code_review')) {
          throw new Error('Prompts list not displayed correctly');
        }
      });

      // Test 5: Call Tool
      await this.runTest('Call format_code tool', async () => {
        // Navigate to "Call Tool"
        for (let i = 0; i < 3; i++) {
          await this.sendInput('\x1B[B'); // Down arrow
        }
        await this.sendInput(''); // Enter
        
        if (!await this.waitForOutput('Select a tool to call:')) {
          throw new Error('Tool selection prompt not shown');
        }
        
        await this.sendInput(''); // Select first tool (format_code)
        
        if (!await this.waitForOutput('Enter tool arguments')) {
          throw new Error('Arguments prompt not shown');
        }
        
        await this.sendInput('{"code": "function test(){console.log(\'hello\')}", "language": "javascript"}');
        
        if (!await this.waitForOutput('Successfully formatted')) {
          throw new Error('Tool execution failed');
        }
      });

      // Test 6: Disconnect
      await this.runTest('Disconnect from server', async () => {
        // Navigate to "Disconnect" (6 down arrows)
        for (let i = 0; i < 6; i++) {
          await this.sendInput('\x1B[B');
        }
        await this.sendInput(''); // Enter
        
        if (!await this.waitForOutput('Disconnected from server')) {
          throw new Error('Failed to disconnect');
        }
      });

      // Test 7: Exit
      await this.runTest('Exit CLI', async () => {
        await this.sendInput('\x1B[B'); // Down arrow to "Exit"
        await this.sendInput(''); // Enter
        
        if (!await this.waitForOutput('Goodbye!')) {
          throw new Error('Failed to exit gracefully');
        }
      });

      // Wait for process to exit
      await new Promise(resolve => {
        this.cli.on('exit', resolve);
        setTimeout(resolve, 2000); // Timeout after 2 seconds
      });

    } catch (error) {
      this.log(`\n${RED}Fatal error: ${error.message}${RESET}`, RED);
      if (this.cli) {
        this.cli.kill();
      }
    }

    // Print summary
    this.log('\n========================================', BLUE);
    this.log('Test Summary', BLUE);
    this.log('========================================', BLUE);
    this.log(`Tests passed: ${this.testsPassed}`, GREEN);
    
    if (this.testsFailed > 0) {
      this.log(`Tests failed: ${this.testsFailed}`, RED);
      process.exit(1);
    } else {
      this.log('\nAll CLI client functionality verified!', GREEN);
      process.exit(0);
    }
  }
}

// Run the tests
const tester = new CLITester();
tester.runAllTests().catch(error => {
  console.error(`${RED}Unexpected error: ${error.message}${RESET}`);
  process.exit(1);
});