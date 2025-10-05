#!/usr/bin/env node

/**
 * MCP CLI Client Automated Testing Script
 * This version properly handles the working directory issue
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

// Test configuration - run from the CLI package directory
const CLI_DIR = path.join(__dirname, '..', 'packages', 'clients', 'cli');
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
      this.log('Starting CLI client from correct directory...', YELLOW);
      
      // Run pnpm start from the CLI directory - this matches manual execution
      this.cli = spawn('pnpm', ['start'], {
        cwd: CLI_DIR,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
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
        // Don't treat server startup messages as errors
        if (!text.includes('timestamp') && !text.includes('logger')) {
          console.error(`${RED}Error: ${text}${RESET}`);
        }
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

  async sendInput(input, description = '') {
    if (description) {
      this.logStream.write(`[ACTION] ${description}\n`);
    }
    this.logStream.write(`[INPUT] ${input}\n`);
    this.output = ''; // Clear output buffer for next check
    
    this.cli.stdin.write(input);
    await this.delay(100);
  }

  async waitForText(expectedText, timeout = 15000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.output.includes(expectedText)) {
        return true;
      }
      await this.delay(100);
    }
    
    this.log(`Timeout waiting for: "${expectedText}"`, RED);
    this.log(`Recent output: ${this.output.slice(-300)}`, YELLOW);
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
      await this.delay(2000); // Let the menu fully render

      // Test 1: Connect to server
      await this.runTest('Test 1: Connect to Development Tools server', async () => {
        // Select "Connect to Server" (already highlighted, just press Enter)
        await this.sendInput('\n', 'Pressing Enter to select "Connect to Server"');
        await this.delay(2000);
        
        if (!await this.waitForText('Select a server to connect to:')) {
          throw new Error('Server selection prompt not shown');
        }
        
        // Select first server (Development Tools) - already highlighted
        await this.sendInput('\n', 'Pressing Enter to select Development Tools');
        await this.delay(3000);
        
        if (!await this.waitForText('Connected to Development Tools')) {
          throw new Error('Failed to connect to server');
        }
        
        // Wait for the connected menu to appear
        if (!await this.waitForText('[Development Tools] What would you like to do?')) {
          throw new Error('Connected menu did not appear');
        }
        
        await this.delay(1000);
      });

      // Test 2: List Tools  
      await this.runTest('Test 2: List available tools', async () => {
        // "List Tools" is the first option when connected
        await this.sendInput('\n', 'Pressing Enter to select "List Tools"');
        await this.delay(2000);
        
        if (!await this.waitForText('Available Tools:') || !await this.waitForText('format_code')) {
          throw new Error('Tools not listed correctly');
        }
        
        await this.delay(1000);
      });

      // Test 3: List Resources
      await this.runTest('Test 3: List available resources', async () => {
        // Navigate down to "List Resources"
        await this.sendInput('\x1B[B', 'Down arrow to List Resources');
        await this.delay(500);
        await this.sendInput('\n', 'Enter to select');
        await this.delay(2000);
        
        if (!await this.waitForText('Available Resources:') || !await this.waitForText('project_config')) {
          throw new Error('Resources not listed correctly');
        }
        
        await this.delay(1000);
      });

      // Test 4: List Prompts
      await this.runTest('Test 4: List available prompts', async () => {
        // Navigate down twice to "List Prompts"
        await this.sendInput('\x1B[B', 'Down arrow');
        await this.delay(200);
        await this.sendInput('\x1B[B', 'Down arrow to List Prompts');
        await this.delay(200);
        await this.sendInput('\n', 'Enter to select');
        await this.delay(2000);
        
        if (!await this.waitForText('Available Prompts:') || !await this.waitForText('code_review')) {
          throw new Error('Prompts not listed correctly');
        }
        
        await this.delay(1000);
      });

      // Test 5: Call Tool
      await this.runTest('Test 5: Call format_code tool', async () => {
        // Navigate down 3 times to "Call Tool"
        for (let i = 0; i < 3; i++) {
          await this.sendInput('\x1B[B', 'Down arrow');
          await this.delay(200);
        }
        await this.sendInput('\n', 'Enter to select Call Tool');
        await this.delay(2000);
        
        if (!await this.waitForText('Select a tool to call:')) {
          throw new Error('Tool selection prompt not shown');
        }
        
        // Select first tool (format_code)
        await this.sendInput('\n', 'Enter to select format_code');
        await this.delay(1000);
        
        if (!await this.waitForText('Enter tool arguments')) {
          throw new Error('Arguments prompt not shown');
        }
        
        // Enter tool arguments
        const args = '{"code": "function test(){console.log(\'hello\')}", "language": "javascript"}';
        await this.sendInput(args + '\n', 'Entering tool arguments');
        await this.delay(3000);
        
        if (!await this.waitForText('Successfully formatted')) {
          throw new Error('Tool execution failed');
        }
        
        await this.delay(1000);
      });

      // Test 6: Disconnect
      await this.runTest('Test 6: Disconnect from server', async () => {
        // Navigate down 6 times to "Disconnect"
        for (let i = 0; i < 6; i++) {
          await this.sendInput('\x1B[B', 'Down arrow');
          await this.delay(200);
        }
        await this.sendInput('\n', 'Enter to select Disconnect');
        await this.delay(2000);
        
        if (!await this.waitForText('Disconnected from server')) {
          throw new Error('Failed to disconnect');
        }
        
        await this.delay(1000);
      });

      // Test 7: Exit
      await this.runTest('Test 7: Exit CLI gracefully', async () => {
        // After disconnect, we're back at main menu
        // Navigate down to "Exit"
        await this.sendInput('\x1B[B', 'Down arrow to Exit');
        await this.delay(500);
        await this.sendInput('\n', 'Enter to exit');
        await this.delay(1000);
        
        if (!await this.waitForText('Goodbye!')) {
          throw new Error('Failed to exit gracefully');
        }
      });

      // Wait for process to exit
      await new Promise(resolve => {
        this.cli.on('exit', resolve);
        setTimeout(resolve, 3000);
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