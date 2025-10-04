# Tutorial 2: Building Your First MCP Server

Now that you understand the basics of MCP, let's build a custom server from scratch! In this tutorial, we'll create a "Math Operations Server" that demonstrates core MCP concepts.

## 🎯 What You'll Learn

- How to create a new MCP server package
- Tool registration and input validation
- Resource management and URIs
- Progress notifications for long operations
- Error handling best practices
- Testing your MCP server

## 📁 Step 1: Project Setup

### Create Server Package
```bash
# From the project root
mkdir -p packages/servers/math-ops
cd packages/servers/math-ops
```

### Initialize Package
```bash
# Create package.json
cat > package.json << 'EOF'
{
  "name": "@mcp-demo/math-ops-server",
  "version": "1.0.0",
  "description": "MCP server for mathematical operations",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "*",
    "@mcp-demo/core": "workspace:*",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "vitest": "^3.2.4"
  }
}
EOF

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
EOF
```

### Create Source Directory
```bash
mkdir src
```

## 🏗️ Step 2: Basic Server Structure

Create `src/index.ts`:

```typescript
#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { Logger, createErrorResponse, createSuccessResponse } from '@mcp-demo/core';

const logger = new Logger('math-ops-server');

// Parse command line arguments
const args = process.argv.slice(2);
const useHttp = args.includes('--http');
const port = 3005; // Use a new port for our server

/**
 * Creates and configures our MCP Math Operations Server
 * This demonstrates the basic structure of any MCP server
 */
function createMathOpsServer(): { mcpServer: McpServer, baseServer: Server } {
  // 1. Create the MCP server instance
  const mcpServer = new McpServer({
    name: 'math-ops-server',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: true,           // We'll provide mathematical tools
      resources: true,       // We'll provide calculation history
      prompts: true,         // We'll provide math problem templates
      logging: {},           // Enable logging
    }
  });

  // 2. Access base server for advanced features
  const baseServer = (mcpServer as any).server as Server;

  // 3. Store calculation history (in-memory for demo)
  const calculationHistory: Array<{
    id: string;
    operation: string;
    input: any;
    result: number;
    timestamp: string;
  }> = [];

  return { mcpServer, baseServer };
}

// Export for testing
export { createMathOpsServer };

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const { mcpServer, baseServer } = createMathOpsServer();
  
  if (useHttp) {
    startHttpServer(mcpServer);
  } else {
    startStdioServer(mcpServer);
  }
}
```

## 🔧 Step 3: Adding Tools

Add mathematical tools to your server. Continue in `src/index.ts`:

```typescript
function registerMathTools(mcpServer: McpServer, calculationHistory: any[]) {
  /**
   * EDUCATIONAL NOTE: Tool Registration Pattern
   * 
   * Each tool follows this pattern:
   * 1. Descriptive name and metadata
   * 2. Zod schema for input validation
   * 3. Async handler function
   * 4. Proper error handling
   * 5. Structured response format
   */

  // Basic arithmetic operations
  mcpServer.registerTool(
    'calculate',
    {
      title: 'Basic Calculator',
      description: 'Perform basic arithmetic operations (add, subtract, multiply, divide)',
      inputSchema: {
        operation: z.enum(['add', 'subtract', 'multiply', 'divide'])
          .describe('Mathematical operation to perform'),
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      },
    },
    async ({ operation, a, b }) => {
      logger.info(`Performing ${operation}`, { a, b });

      try {
        let result: number;
        let symbol: string;

        switch (operation) {
          case 'add':
            result = a + b;
            symbol = '+';
            break;
          case 'subtract':
            result = a - b;
            symbol = '-';
            break;
          case 'multiply':
            result = a * b;
            symbol = '×';
            break;
          case 'divide':
            if (b === 0) {
              throw new Error('Division by zero is not allowed');
            }
            result = a / b;
            symbol = '÷';
            break;
        }

        // Store in history
        const calculation = {
          id: `calc_${Date.now()}`,
          operation,
          input: { a, b },
          result,
          timestamp: new Date().toISOString(),
        };
        calculationHistory.push(calculation);

        return {
          content: [
            {
              type: 'text',
              text: `# Calculation Result\n\n**Operation**: ${a} ${symbol} ${b} = **${result}**\n\n*Calculation ID: ${calculation.id}*`,
            },
          ],
          metadata: {
            operation,
            inputs: { a, b },
            result,
            calculationId: calculation.id,
          },
        };
      } catch (error) {
        logger.error('Calculation failed', error);
        return createErrorResponse(error, 'Calculation failed');
      }
    }
  );

  // Advanced mathematical functions
  mcpServer.registerTool(
    'advanced_math',
    {
      title: 'Advanced Math Functions',
      description: 'Perform advanced mathematical operations',
      inputSchema: {
        function: z.enum(['sqrt', 'pow', 'sin', 'cos', 'tan', 'log', 'factorial'])
          .describe('Mathematical function to apply'),
        value: z.number().describe('Input value'),
        exponent: z.number().optional().describe('Exponent for power function'),
      },
    },
    async ({ function: mathFunc, value, exponent }) => {
      logger.info(`Performing ${mathFunc}`, { value, exponent });

      try {
        let result: number;
        let description: string;

        switch (mathFunc) {
          case 'sqrt':
            if (value < 0) {
              throw new Error('Cannot calculate square root of negative number');
            }
            result = Math.sqrt(value);
            description = `√${value}`;
            break;
          case 'pow':
            if (exponent === undefined) {
              throw new Error('Exponent is required for power function');
            }
            result = Math.pow(value, exponent);
            description = `${value}^${exponent}`;
            break;
          case 'sin':
            result = Math.sin(value);
            description = `sin(${value})`;
            break;
          case 'cos':
            result = Math.cos(value);
            description = `cos(${value})`;
            break;
          case 'tan':
            result = Math.tan(value);
            description = `tan(${value})`;
            break;
          case 'log':
            if (value <= 0) {
              throw new Error('Logarithm is only defined for positive numbers');
            }
            result = Math.log(value);
            description = `ln(${value})`;
            break;
          case 'factorial':
            if (value < 0 || !Number.isInteger(value)) {
              throw new Error('Factorial is only defined for non-negative integers');
            }
            result = factorial(value);
            description = `${value}!`;
            break;
          default:
            throw new Error(`Unknown function: ${mathFunc}`);
        }

        // Store in history
        const calculation = {
          id: `adv_${Date.now()}`,
          operation: mathFunc,
          input: { value, exponent },
          result,
          timestamp: new Date().toISOString(),
        };
        calculationHistory.push(calculation);

        return {
          content: [
            {
              type: 'text',
              text: `# Advanced Math Result\n\n**Function**: ${description} = **${result}**\n\n*Calculation ID: ${calculation.id}*`,
            },
          ],
          metadata: {
            function: mathFunc,
            input: { value, exponent },
            result,
            calculationId: calculation.id,
          },
        };
      } catch (error) {
        logger.error('Advanced math calculation failed', error);
        return createErrorResponse(error, 'Advanced math calculation failed');
      }
    }
  );
}

// Helper function for factorial
function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  return n * factorial(n - 1);
}
```

## 📊 Step 4: Adding Resources

Resources provide access to data. Add these to your server:

```typescript
function registerMathResources(mcpServer: McpServer, calculationHistory: any[]) {
  /**
   * EDUCATIONAL NOTE: Resource Registration
   * 
   * Resources are identified by URIs and provide read-only access to data.
   * They can be static or dynamic and support subscriptions for updates.
   */

  // Calculation history resource
  mcpServer.registerResource(
    'calculation_history',
    'math://history/calculations',
    {
      title: 'Calculation History',
      description: 'History of all mathematical operations performed',
      mimeType: 'application/json',
    },
    async () => {
      logger.info('Providing calculation history');

      const historyText = calculationHistory.length > 0
        ? `# Calculation History\n\n${calculationHistory.map(calc => 
            `**${calc.timestamp}**: ${calc.operation} → ${calc.result} (ID: ${calc.id})`
          ).join('\n')}`
        : '# Calculation History\n\nNo calculations performed yet.';

      return {
        contents: [
          {
            uri: 'math://history/calculations',
            mimeType: 'text/markdown',
            text: historyText,
          },
        ],
      };
    }
  );

  // Mathematical constants resource
  mcpServer.registerResource(
    'math_constants',
    'math://reference/constants',
    {
      title: 'Mathematical Constants',
      description: 'Common mathematical constants and their values',
      mimeType: 'text/markdown',
    },
    async () => {
      logger.info('Providing mathematical constants');

      const constants = {
        pi: Math.PI,
        e: Math.E,
        ln2: Math.LN2,
        ln10: Math.LN10,
        log2e: Math.LOG2E,
        log10e: Math.LOG10E,
        sqrt1_2: Math.SQRT1_2,
        sqrt2: Math.SQRT2,
      };

      const constantsText = `# Mathematical Constants

${Object.entries(constants).map(([name, value]) => 
  `**${name}**: ${value}`
).join('\n')}

These constants are available for use in calculations.`;

      return {
        contents: [
          {
            uri: 'math://reference/constants',
            mimeType: 'text/markdown',
            text: constantsText,
          },
        ],
      };
    }
  );
}
```

## 🚀 Step 5: Adding Server Initialization

Complete your server with transport setup:

```typescript
function startStdioServer(mcpServer: McpServer) {
  const transport = new StdioServerTransport();
  
  mcpServer.connect(transport).catch((error) => {
    logger.error('Failed to start stdio server', error);
    process.exit(1);
  });

  logger.info('Math Operations Server started on stdio transport');
}

function startHttpServer(mcpServer: McpServer) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const transport = new StreamableHTTPServerTransport(app);

  mcpServer.connect(transport).catch((error) => {
    logger.error('Failed to connect MCP server to HTTP transport', error);
    process.exit(1);
  });

  app.listen(port, () => {
    logger.info(`Math Operations Server started on http://localhost:${port}`);
  });
}

// Update the main execution section
if (import.meta.url === `file://${process.argv[1]}`) {
  const { mcpServer, baseServer } = createMathOpsServer();
  
  // Initialize calculation history
  const calculationHistory: any[] = [];
  
  // Register tools and resources
  registerMathTools(mcpServer, calculationHistory);
  registerMathResources(mcpServer, calculationHistory);
  
  if (useHttp) {
    startHttpServer(mcpServer);
  } else {
    startStdioServer(mcpServer);
  }
}
```

## 🧪 Step 6: Building and Testing

### Build Your Server
```bash
# Install dependencies
pnpm install

# Build the server
pnpm build
```

### Test Your Server
```bash
# Start in stdio mode
pnpm start

# Or start in HTTP mode
pnpm start -- --http
```

### Connect a Client
In another terminal:
```bash
cd packages/clients/cli
pnpm start
```

Try your new math operations:
1. Select your math-ops server
2. Use the `calculate` tool: `5 + 3`
3. Try `advanced_math` with `sqrt` function: `√16`
4. Read the `calculation_history` resource

## ✅ Step 7: Adding Tests

Create `src/math-ops.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMathOpsServer } from './index.js';

describe('Math Operations Server', () => {
  let mcpServer: any;
  let calculationHistory: any[];

  beforeEach(() => {
    const server = createMathOpsServer();
    mcpServer = server.mcpServer;
    calculationHistory = [];
  });

  describe('Basic Calculator', () => {
    it('should add two numbers correctly', async () => {
      const result = await mcpServer.tools.calculate({ 
        operation: 'add', 
        a: 5, 
        b: 3 
      });
      
      expect(result.metadata.result).toBe(8);
      expect(result.content[0].text).toContain('5 + 3 = **8**');
    });

    it('should handle division by zero', async () => {
      const result = await mcpServer.tools.calculate({ 
        operation: 'divide', 
        a: 5, 
        b: 0 
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Division by zero');
    });
  });

  describe('Advanced Math', () => {
    it('should calculate square root correctly', async () => {
      const result = await mcpServer.tools.advanced_math({ 
        function: 'sqrt', 
        value: 16 
      });
      
      expect(result.metadata.result).toBe(4);
    });

    it('should reject negative square root', async () => {
      const result = await mcpServer.tools.advanced_math({ 
        function: 'sqrt', 
        value: -4 
      });
      
      expect(result.isError).toBe(true);
    });
  });
});
```

Run tests:
```bash
pnpm test
```

## 🎉 Congratulations!

You've successfully built your first MCP server! You've learned:

- ✅ Server project structure and setup
- ✅ Tool registration with input validation
- ✅ Resource management and URIs
- ✅ Error handling best practices
- ✅ Both stdio and HTTP transports
- ✅ Testing MCP servers

## 🚀 Next Steps

- **Tutorial 3**: [Advanced MCP Features](./03-advanced-features.md) - Learn about progress notifications, elicitation, and sampling
- **Tutorial 4**: [Client Development](./04-client-development.md) - Build custom MCP clients
- **Tutorial 5**: [Production Deployment](./05-production-deployment.md) - Deploy MCP servers for real use

## 💡 Extension Ideas

Try extending your math server with:
- Statistics calculations (mean, median, mode)
- Matrix operations
- Graph plotting capabilities
- Equation solving
- Unit conversions

Happy coding! 🎊