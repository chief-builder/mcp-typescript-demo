#!/usr/bin/env node

/**
 * MCP Inspector Test Runner - Main Entry Point
 * Automated testing for MCP Inspector functionality across all servers
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import { MCPInspectorTestRunner } from './src/core/MCPInspectorTestRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_CONFIG_PATH = join(__dirname, 'src/configs/servers.json');

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    headless: process.env.HEADLESS === 'true',
    server: null,
    configPath: DEFAULT_CONFIG_PATH,
    timeout: 30000,
    retries: 2,
    screenshotOnFailure: true,
    outputDir: join(__dirname, 'reports'),
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
        
      case '--headless':
        options.headless = true;
        break;
        
      case '--gui':
        options.headless = false;
        break;
        
      case '--server':
      case '-s':
        if (i + 1 < args.length) {
          options.server = args[++i];
        }
        break;
        
      case '--config':
      case '-c':
        if (i + 1 < args.length) {
          options.configPath = args[++i];
        }
        break;
        
      case '--timeout':
      case '-t':
        if (i + 1 < args.length) {
          options.timeout = parseInt(args[++i], 10);
        }
        break;
        
      case '--retries':
      case '-r':
        if (i + 1 < args.length) {
          options.retries = parseInt(args[++i], 10);
        }
        break;
        
      case '--output':
      case '-o':
        if (i + 1 < args.length) {
          options.outputDir = args[++i];
        }
        break;
        
      case '--no-screenshots':
        options.screenshotOnFailure = false;
        break;
        
      default:
        if (arg.startsWith('--server=')) {
          options.server = arg.split('=')[1];
        } else if (arg.startsWith('--config=')) {
          options.configPath = arg.split('=')[1];
        } else if (arg.startsWith('--timeout=')) {
          options.timeout = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--retries=')) {
          options.retries = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--output=')) {
          options.outputDir = arg.split('=')[1];
        }
        break;
    }
  }

  return options;
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
🔍 MCP Inspector Test Runner

USAGE:
  node run-inspector-tests.js [OPTIONS]

OPTIONS:
  --help, -h              Show this help message
  --headless              Run in headless mode (no GUI)
  --gui                   Run with GUI (default)
  --server, -s <name>     Test specific server only
  --config, -c <path>     Use custom config file
  --timeout, -t <ms>      Set timeout in milliseconds (default: 30000)
  --retries, -r <count>   Number of retries for failed tests (default: 2)
  --output, -o <dir>      Output directory for reports (default: ./reports)
  --no-screenshots        Disable screenshot capture on failures

EXAMPLES:
  # Run all tests with GUI
  node run-inspector-tests.js --gui

  # Run all tests in headless mode
  node run-inspector-tests.js --headless

  # Test only the knowledge server
  node run-inspector-tests.js --server knowledge

  # Test with custom timeout and output directory
  node run-inspector-tests.js --timeout 60000 --output ./test-results

  # Quick headless test for CI
  HEADLESS=true node run-inspector-tests.js --no-screenshots

ENVIRONMENT VARIABLES:
  HEADLESS=true          Same as --headless flag
  
AVAILABLE SERVERS:
  knowledge             Knowledge management server
  dev-tools             Development tools server  
  analytics             Analytics processing server
  cloud-ops             Cloud operations server

REPORT OUTPUT:
  Reports are generated in JSON and HTML formats in the output directory.
  Screenshots are captured automatically on test failures (unless disabled).
`);
}

/**
 * Load test configuration
 */
async function loadConfig(configPath) {
  try {
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    console.log(`📋 Loaded configuration from: ${configPath}`);
    console.log(`📊 Found ${Object.keys(config.servers).length} server configurations`);
    
    return config;
  } catch (error) {
    console.error(`❌ Failed to load configuration from ${configPath}:`, error.message);
    throw error;
  }
}

/**
 * Validate configuration
 */
function validateConfig(config, serverFilter = null) {
  if (!config.servers || typeof config.servers !== 'object') {
    throw new Error('Configuration must contain servers object');
  }

  const availableServers = Object.keys(config.servers);
  
  if (serverFilter) {
    if (!availableServers.includes(serverFilter)) {
      throw new Error(`Server '${serverFilter}' not found. Available servers: ${availableServers.join(', ')}`);
    }
  }

  console.log(`✅ Configuration validated`);
  return true;
}

/**
 * Filter servers based on command line options
 */
function filterServers(config, serverFilter) {
  if (!serverFilter) {
    return config.servers;
  }

  if (!config.servers[serverFilter]) {
    throw new Error(`Server '${serverFilter}' not found in configuration`);
  }

  return { [serverFilter]: config.servers[serverFilter] };
}

/**
 * Main test runner function
 */
async function runTests() {
  const startTime = Date.now();
  
  console.log('🚀 Starting MCP Inspector Test Suite');
  console.log('=' + '='.repeat(50));
  
  try {
    // Parse arguments
    const options = parseArguments();
    
    if (options.help) {
      showHelp();
      return;
    }

    // Load and validate configuration
    const config = await loadConfig(options.configPath);
    validateConfig(config, options.server);
    
    // Filter servers if specified
    const serversToTest = filterServers(config, options.server);
    const serverCount = Object.keys(serversToTest).length;
    
    console.log(`🎯 Testing ${serverCount} server${serverCount > 1 ? 's' : ''}: ${Object.keys(serversToTest).join(', ')}`);
    console.log(`⚙️  Configuration: ${options.headless ? 'Headless' : 'GUI'} mode, ${options.timeout}ms timeout, ${options.retries} retries`);
    console.log('');

    // Initialize test runner
    const testRunner = new MCPInspectorTestRunner({
      ...options,
      testingConfig: config.testingConfig
    });

    // Initialize test environment
    await testRunner.initialize();

    // Start MCP Inspector
    const inspectorUrl = await testRunner.startInspector();
    console.log(`🔗 MCP Inspector available at: ${inspectorUrl}`);

    // Run tests for each server
    const allResults = [];
    let serverIndex = 0;
    
    for (const [serverId, serverConfig] of Object.entries(serversToTest)) {
      serverIndex++;
      console.log(`\n🔧 [${serverIndex}/${serverCount}] Testing ${serverConfig.name}...`);
      
      try {
        const serverResult = await testRunner.testServer(serverConfig);
        allResults.push(serverResult);
        
        const status = serverResult.status === 'completed' ? '✅' : '❌';
        console.log(`${status} ${serverConfig.name}: ${serverResult.status}`);
      } catch (error) {
        console.error(`❌ Failed to test ${serverConfig.name}:`, error.message);
        allResults.push({
          serverName: serverConfig.name,
          status: 'failed',
          errors: [{ type: 'test_execution', message: error.message, timestamp: new Date().toISOString() }]
        });
      }
    }

    // Generate comprehensive report
    console.log('\n📊 Generating test report...');
    const reportPaths = await testRunner.generateReport();
    
    // Calculate summary statistics
    const summary = {
      totalServers: allResults.length,
      successfulServers: allResults.filter(r => r.status === 'completed').length,
      failedServers: allResults.filter(r => r.status === 'failed').length,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    };

    allResults.forEach(server => {
      if (server.capabilities) {
        ['tools', 'resources', 'prompts'].forEach(capability => {
          if (server.capabilities[capability]?.tests) {
            summary.totalTests += server.capabilities[capability].tests.length;
            summary.passedTests += server.capabilities[capability].tests.filter(t => t.status === 'success').length;
            summary.failedTests += server.capabilities[capability].tests.filter(t => t.status === 'failed').length;
          }
        });
      }
    });

    summary.successRate = summary.totalTests > 0 ? Math.round((summary.passedTests / summary.totalTests) * 100) : 0;

    // Display final results
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Test Suite Completed!');
    console.log('');
    console.log('📊 Final Results:');
    console.log(`   • Duration: ${duration}s`);
    console.log(`   • Servers: ${summary.successfulServers}/${summary.totalServers} successful`);
    console.log(`   • Tests: ${summary.passedTests}/${summary.totalTests} passed (${summary.successRate}%)`);
    console.log(`   • Failed: ${summary.failedTests} tests, ${summary.failedServers} servers`);
    console.log('');
    
    if (reportPaths && reportPaths.length > 0) {
      console.log('📄 Reports generated:');
      reportPaths.forEach(report => {
        console.log(`   • ${report.type.toUpperCase()}: ${report.path}`);
      });
      console.log('');
    }

    // Cleanup
    await testRunner.cleanup();
    
    // Exit with appropriate code
    const hasFailures = summary.failedServers > 0 || summary.failedTests > 0;
    if (hasFailures) {
      console.log('⚠️  Some tests failed. Check the reports for details.');
      process.exit(1);
    } else {
      console.log('✅ All tests passed successfully!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.stack && process.env.DEBUG) {
      console.error('\n📍 Stack trace:');
      console.error(error.stack);
    }
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   • Ensure MCP servers are built: npm run build');
    console.log('   • Check if MCP Inspector is available: npx @modelcontextprotocol/inspector');
    console.log('   • Install browser dependencies: npm run install-browsers');
    console.log('   • Run with DEBUG=true for detailed error info');
    
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT. Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM. Gracefully shutting down...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}