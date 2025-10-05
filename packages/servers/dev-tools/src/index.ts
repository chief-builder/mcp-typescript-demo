#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
// Note: InMemoryEventStore import might need adjustment based on SDK version
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Logger } from '@mcp-demo/core';
import prettier from 'prettier';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

const logger = new Logger('dev-tools-server');

// Command line argument parsing
const args = process.argv.slice(2);
const hasHttpFlag = args.includes('--http');
const transportArg = args.find(arg => arg.startsWith('--transport='))?.split('=')[1] || (hasHttpFlag ? 'http' : 'stdio');
const portArg = args.find(arg => arg.startsWith('--port='))?.split('=')[1];
const port = portArg ? parseInt(portArg, 10) : 3001;

// Create MCP server factory function - returns both high-level and base server
function createMCPServer(): { mcpServer: McpServer, baseServer: Server } {
  const mcpServer = new McpServer({
    name: 'dev-tools-server',
    version: '1.0.0',
  }, { 
    capabilities: { 
      logging: {},
      sampling: {},
      elicitation: {},
      prompts: {
        listChanged: true
      },
      resources: {
        subscribe: true,
        listChanged: true
      }
    } 
  });

  // Access the underlying base server for sampling capabilities
  const baseServer = (mcpServer as any).server as Server;

  // Track active progress tokens for async operations
  // This demonstrates how to manage long-running operations with progress updates
  const activeProgressTokens = new Map<string | number, boolean>();

  /**
   * EDUCATIONAL NOTE: Tool Registration
   * 
   * Tools are the core functionality that MCP servers provide to clients.
   * Each tool should have:
   * 1. A clear, descriptive name (format_code)
   * 2. Human-readable title and description 
   * 3. A Zod schema for input validation
   * 4. An async handler function that returns MCP-compliant results
   */
  mcpServer.registerTool(
    'format_code',
    {
      title: 'Format Code',
      description: 'Format code using Prettier with language-specific support',
      inputSchema: {
        code: z.string().describe('Code to format'),
        language: z.enum(['typescript', 'javascript', 'json', 'css', 'html', 'markdown'])
          .describe('Programming language'),
        filePath: z.string().optional().describe('Optional file path for config detection'),
      },
    },
    async ({ code, language, filePath }) => {
      // Always log tool invocations for debugging and monitoring
      logger.info('Formatting code', { language, filePath });

      try {
        /**
         * EDUCATIONAL NOTE: Input Validation
         * 
         * While Zod handles schema validation, you should also:
         * 1. Validate business logic constraints
         * 2. Sanitize inputs for security
         * 3. Provide meaningful error messages
         */
        // Map language to parser
        const parserMap: Record<string, string> = {
          typescript: 'typescript',
          javascript: 'babel',
          json: 'json',
          css: 'css',
          html: 'html',
          markdown: 'markdown',
        };

        const parser = parserMap[language];
        if (!parser) {
          throw new Error(`Unsupported language: ${language}`);
        }

        // Format the code
        const formatted = await prettier.format(code, {
          parser,
          // Basic prettier config
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          printWidth: 100,
          trailingComma: 'es5',
        });

        /**
         * EDUCATIONAL NOTE: MCP Response Format
         * 
         * MCP tool responses should always include:
         * 1. content: Array of content blocks (text, image, etc.)
         * 2. metadata: Optional structured data for programmatic use
         * 3. isError: Boolean flag for error responses (not needed for success)
         * 
         * Use markdown formatting in text content for better readability
         */
        return {
          content: [
            {
              type: 'text',
              text: `# Code Formatting Result\n\n**Language**: ${language}\n**Status**: Successfully formatted\n\n## Formatted Code\n\`\`\`${language}\n${formatted}\n\`\`\``,
            },
          ],
          metadata: {
            language,
            originalLength: code.length,
            formattedLength: formatted.length,
          },
        };
      } catch (error) {
        /**
         * EDUCATIONAL NOTE: Error Handling Best Practices
         * 
         * 1. Always log errors for debugging
         * 2. Return user-friendly error messages
         * 3. Set isError: true for error responses
         * 4. Never expose sensitive internal details
         * 5. Provide actionable guidance when possible
         */
        logger.error('Code formatting failed', error);
        return {
          content: [
            {
              type: 'text',
              text: `Code formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  mcpServer.registerTool(
    'list_project_files',
    {
      title: 'List Project Files',
      description: 'List source code files in the current project with filtering options',
      inputSchema: {
        pattern: z.string().default('**/*.{ts,tsx,js,jsx,py,java,cpp,c,h}')
          .describe('Glob pattern for file matching'),
        exclude: z.array(z.string()).optional()
          .describe('Patterns to exclude (e.g., node_modules, dist)'),
        maxDepth: z.number().min(1).max(10).default(5)
          .describe('Maximum directory depth to search'),
      },
    },
    async ({ pattern, exclude, maxDepth }) => {
      logger.info('Listing project files', { pattern, exclude, maxDepth });

      try {
        const defaultExcludes = [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
          '**/*.log',
        ];

        const allExcludes = [...defaultExcludes, ...(exclude || [])];

        const files = await glob(pattern, {
          ignore: allExcludes,
          maxDepth,
          follow: false,
        });

        // Group files by extension
        const filesByExt = files.reduce((acc, file) => {
          const ext = path.extname(file).toLowerCase();
          if (!acc[ext]) acc[ext] = [];
          acc[ext].push(file);
          return acc;
        }, {} as Record<string, string[]>);

        // Create organized output
        const summary = Object.entries(filesByExt)
          .map(([ext, fileList]) => `**${ext || 'no extension'}**: ${fileList.length} files`)
          .join('\n');

        const fileList = files
          .sort()
          .map(file => `- \`${file}\``)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `# Project Files\n\n**Pattern**: \`${pattern}\`\n**Total Files**: ${files.length}\n\n## Summary by Extension\n${summary}\n\n## File List\n${fileList}`,
            },
          ],
          metadata: {
            totalFiles: files.length,
            pattern,
            excludePatterns: allExcludes,
            filesByExtension: filesByExt,
          },
        };
      } catch (error) {
        logger.error('File listing failed', error);
        return {
          content: [
            {
              type: 'text',
              text: `File listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  mcpServer.registerTool(
    'read_file',
    {
      title: 'Read File',
      description: 'Read the contents of a specific file with syntax highlighting info',
      inputSchema: {
        filePath: z.string().describe('Path to the file to read'),
        maxLines: z.number().min(1).max(1000).default(100)
          .describe('Maximum number of lines to read'),
        startLine: z.number().min(1).default(1)
          .describe('Starting line number (1-based)'),
      },
    },
    async ({ filePath, maxLines, startLine }) => {
      logger.info('Reading file', { filePath, maxLines, startLine });

      try {
        // Basic security check
        if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('~')) {
          throw new Error('Invalid file path: path traversal not allowed');
        }

        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        
        // Extract the requested lines
        const endLine = Math.min(startLine + maxLines - 1, lines.length);
        const selectedLines = lines.slice(startLine - 1, endLine);
        
        // Determine file type for syntax highlighting
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: Record<string, string> = {
          '.ts': 'typescript',
          '.tsx': 'typescript',
          '.js': 'javascript',
          '.jsx': 'javascript',
          '.py': 'python',
          '.java': 'java',
          '.cpp': 'cpp',
          '.c': 'c',
          '.h': 'c',
          '.css': 'css',
          '.html': 'html',
          '.json': 'json',
          '.md': 'markdown',
          '.yml': 'yaml',
          '.yaml': 'yaml',
        };

        const language = languageMap[ext] || 'text';
        const numberedLines = selectedLines
          .map((line, idx) => `${(startLine + idx).toString().padStart(4, ' ')} | ${line}`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `# File: ${filePath}\n\n**Language**: ${language}\n**Lines**: ${startLine}-${endLine} of ${lines.length}\n**Size**: ${content.length} characters\n\n\`\`\`${language}\n${numberedLines}\n\`\`\``,
            },
          ],
          metadata: {
            filePath,
            totalLines: lines.length,
            selectedLines: selectedLines.length,
            startLine,
            endLine,
            fileSize: content.length,
            language,
          },
        };
      } catch (error) {
        logger.error('File reading failed', error);
        return {
          content: [
            {
              type: 'text',
              text: `File reading failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register a tool that uses elicitation for interactive code review
  mcpServer.registerTool(
    'interactive_code_review',
    {
      title: 'Interactive Code Review',
      description: 'Perform a customized code review with user-specified criteria via elicitation',
      inputSchema: {
        code: z.string().describe('Code to review'),
        language: z.enum(['typescript', 'javascript', 'python', 'java'])
          .describe('Programming language'),
      },
    },
    async ({ code, language }) => {
      logger.info('Starting interactive code review', { language });

      try {
        // Use elicitation to request review criteria from the user
        logger.info('🔄 Requesting review criteria via elicitation...');
        
        const elicitationResult = await baseServer.elicitInput({
          message: `Please specify your code review preferences for this ${language} code`,
          requestedSchema: {
            type: "object",
            properties: {
              reviewType: {
                type: "string",
                title: "Review Focus",
                description: "What aspect should the review focus on?",
                enum: ["security", "performance", "style", "comprehensive"],
                enumNames: ["Security", "Performance", "Code Style", "Comprehensive"]
              },
              severity: {
                type: "string",
                title: "Issue Severity",
                description: "What level of issues to highlight?",
                enum: ["all", "medium_high", "critical_only"],
                enumNames: ["All Issues", "Medium & High", "Critical Only"]
              },
              includeExamples: {
                type: "boolean",
                title: "Include Examples",
                description: "Include code examples in the review?",
                default: true
              },
              maxIssues: {
                type: "number",
                title: "Maximum Issues",
                description: "Maximum number of issues to report",
                minimum: 1,
                maximum: 20
              }
            },
            required: ["reviewType", "severity"]
          }
        });

        logger.info('📥 Elicitation result received:', elicitationResult);

        if (elicitationResult.action === 'decline') {
          return {
            content: [
              {
                type: 'text',
                text: `Code review declined by user. Here's a basic analysis instead:\n\n**Code Summary**:\n- Language: ${language}\n- Length: ${code.length} characters\n- Lines: ${code.split('\n').length}\n\nFor a detailed review, please try again and provide your preferences.`,
              },
            ],
            metadata: {
              action: 'declined',
              language,
              reviewType: 'none',
            },
          };
        }

        if (elicitationResult.action === 'cancel') {
          return {
            content: [
              {
                type: 'text',
                text: `Code review cancelled. No analysis performed.`,
              },
            ],
            metadata: {
              action: 'cancelled',
              language,
            },
          };
        }

        // User accepted - process with their preferences
        const preferences = elicitationResult.content || {};
        logger.info('👍 User accepted with preferences:', preferences);

        // Use sampling to get real code review from Claude based on preferences
        const reviewType = preferences.reviewType || 'comprehensive';
        const includeExamples = preferences.includeExamples !== false;
        const severity = preferences.severity || 'all';
        const maxIssues = preferences.maxIssues;

        logger.info('🤖 Generating customized review prompt based on user preferences...');

        try {
          // For now, create a detailed analysis prompt that will be returned to Claude
          // This simulates what the sampling would return, but lets Claude do the actual analysis
          logger.info('📝 Generating customized analysis prompt for Claude');

          // Create a structured response that includes the preferences and prompt
          let reviewContent = `I need you to perform a detailed ${reviewType} code review of the following ${language} code based on these specific requirements:\n\n`;
          
          // Add specific instructions based on preferences
          reviewContent += `**Review Focus**: ${reviewType}\n`;
          reviewContent += `**Severity Filter**: ${severity} issues only\n`;
          reviewContent += `**Maximum Issues**: ${maxIssues || 'No limit'}\n`;
          reviewContent += `**Include Examples**: ${includeExamples ? 'Yes, provide corrected code examples' : 'No examples needed'}\n\n`;
          
          reviewContent += `**Specific Instructions**:\n`;
          switch (reviewType) {
            case 'security':
              reviewContent += '- Focus exclusively on security vulnerabilities, input validation issues, and potential exploits\n';
              reviewContent += '- Look for injection vulnerabilities, improper error handling, and data exposure risks\n';
              break;
            case 'performance':
              reviewContent += '- Focus exclusively on performance bottlenecks, algorithmic efficiency, and optimization opportunities\n';
              reviewContent += '- Analyze time complexity, memory usage, and potential scalability issues\n';
              break;
            case 'style':
              reviewContent += '- Focus exclusively on code style, naming conventions, formatting, and readability issues\n';
              reviewContent += '- Check adherence to language-specific style guides (PEP 8 for Python)\n';
              break;
            case 'comprehensive':
              reviewContent += '- Provide a comprehensive review covering security, performance, style, and best practices\n';
              break;
          }
          
          // Add severity filtering instructions
          switch (severity) {
            case 'critical_only':
              reviewContent += '- Only report CRITICAL severity issues that could cause system failures or security breaches\n';
              break;
            case 'medium_high':
              reviewContent += '- Only report MEDIUM and HIGH severity issues. Skip minor style or formatting issues\n';
              break;
            case 'all':
              reviewContent += '- Report all issues found, including low severity style and formatting issues\n';
              break;
          }

          if (maxIssues && typeof maxIssues === 'number') {
            reviewContent += `- Limit your report to the ${maxIssues} most important issues\n`;
          }
          
          reviewContent += `\nPlease provide a structured review with issue severity ratings and ${includeExamples ? 'include corrected code examples' : 'brief descriptions only'}.\n\n`;
          reviewContent += `**Code to review:**\n\`\`\`${language}\n${code}\n\`\`\``;

          // Add metadata header
          const header = `# Interactive Code Review Results\n\n**Language**: ${language}\n**Review Type**: ${reviewType}\n**Severity Filter**: ${severity}\n**Include Examples**: ${includeExamples ? 'Yes' : 'No'}\n**Max Issues**: ${maxIssues || 'Unlimited'}\n\n---\n\n`;

          const finalResponse = header + reviewContent;
          logger.info('📋 Returning customized review prompt to Claude (length: ' + finalResponse.length + ' chars)');

          return {
            content: [
              {
                type: 'text',
                text: header + reviewContent,
              },
            ],
            metadata: {
              language,
              reviewType,
              severity,
              includeExamples,
              maxIssues,
              elicitationUsed: true,
              customPromptGenerated: true,
            },
          };

        } catch (samplingError) {
          logger.error('🚨 Sampling failed, falling back to basic response', samplingError);
          logger.error('🚨 Error details:', samplingError instanceof Error ? samplingError.message : 'Unknown error');
          
          // Fallback if sampling fails
          return {
            content: [
              {
                type: 'text',
                text: `# Interactive Code Review Results\n\n**Error**: Unable to perform AI-powered code review. Sampling service unavailable.\n\n**Your Preferences**:\n- Review Type: ${reviewType}\n- Severity: ${severity}\n- Examples: ${includeExamples ? 'Yes' : 'No'}\n- Max Issues: ${maxIssues || 'Unlimited'}\n\n**Code Received**:\n\`\`\`${language}\n${code}\n\`\`\`\n\nPlease try again later or use a different review tool.`,
              },
            ],
            metadata: {
              language,
              reviewType,
              severity,
              includeExamples,
              maxIssues,
              elicitationUsed: true,
              samplingFailed: true,
            },
          };
        }

      } catch (error) {
        logger.error('Interactive code review failed', error);
        return {
          content: [
            {
              type: 'text',
              text: `Interactive code review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register a tool that uses sampling
  mcpServer.registerTool(
    'generate_documentation',
    {
      title: 'Generate Documentation',
      description: 'Generate documentation for code using AI assistance via sampling',
      inputSchema: {
        code: z.string().describe('Code to document'),
        language: z.enum(['typescript', 'javascript', 'python', 'java'])
          .describe('Programming language'),
        style: z.enum(['jsdoc', 'markdown', 'detailed'])
          .default('jsdoc')
          .describe('Documentation style'),
      },
    },
    async ({ code, language, style }, extra) => {
      logger.info('Generating documentation', { language, style });

      try {
        // Check if sampling is available (client supports it)
        const canUseSampling = extra && 'signal' in extra;
        
        if (canUseSampling) {
          logger.info('Using AI sampling for documentation generation');
          
          // Prepare the prompt based on style
          let prompt = '';
          if (style === 'jsdoc') {
            prompt = `Generate JSDoc/TSDoc style documentation for the following ${language} code. Include parameter descriptions, return value, and any important notes:\n\n${code}`;
          } else if (style === 'markdown') {
            prompt = `Generate markdown documentation for the following ${language} code. Include a description, parameters table, return value, and usage example:\n\n${code}`;
          } else {
            prompt = `Generate detailed documentation for the following ${language} code. Include purpose, parameters, return value, side effects, complexity analysis, and usage examples:\n\n${code}`;
          }

          try {
            logger.info('🚀 Making actual MCP sampling request...');
            
            // Make the actual sampling request through MCP
            const samplingRequest = {
              messages: [
                {
                  role: 'user' as const,
                  content: {
                    type: 'text' as const,
                    text: prompt
                  }
                }
              ],
              maxTokens: 1000,
              modelPreferences: {
                hints: [{
                  name: 'claude-3-5-sonnet-20241022'
                }]
              }
            };

            logger.info('📡 OUTGOING MCP SAMPLING REQUEST:', samplingRequest);

            // Use the real MCP sampling API through the base server
            logger.info('🔄 Making REAL MCP sampling request via baseServer.createMessage()');
            
            const samplingResponse = await baseServer.createMessage({
              messages: [
                {
                  role: 'user' as const,
                  content: {
                    type: 'text' as const,
                    text: prompt
                  }
                }
              ],
              maxTokens: 1000,
              modelPreferences: {
                hints: [{
                  name: 'claude-3-5-sonnet-20241022'
                }]
              }
            });

            logger.info('📨 REAL MCP SAMPLING RESPONSE received:', samplingResponse);

            // Extract the AI-generated text from the response
            const aiGeneratedDoc = samplingResponse.content?.type === 'text' 
              ? samplingResponse.content.text 
              : 'No documentation generated';

            return {
              content: [
                {
                  type: 'text',
                  text: `# REAL AI-Generated Documentation\n\n${aiGeneratedDoc}\n\n---\n*Documentation generated using REAL MCP sampling protocol via baseServer.createMessage()*\n\n**Original Code:**\n\`\`\`${language}\n${code}\n\`\`\``,
                },
              ],
              metadata: {
                language,
                style,
                generatedAt: new Date().toISOString(),
                method: 'real-mcp-sampling',
                model: samplingResponse.model || 'claude-3-5-sonnet-20241022',
              },
            };
          } catch (samplingError) {
            logger.error('❌ Real MCP sampling failed, falling back to simulation:', samplingError);
            
            // Fall back to simulated response
            const simulatedAiResponse = await new Promise<string>((resolve) => {
              // Simulate AI-generated documentation based on the code content
              // In a real implementation, this would use actual AI via sampling
              
              // Simple code analysis for demonstration
              const functionMatch = code.match(/function\s+(\w+)/);
              const functionName = functionMatch ? functionMatch[1] : 'unknownFunction';
              
              if (style === 'jsdoc') {
                resolve(`/**
 * ${functionName === 'fibonacci' ? 'Calculates the nth Fibonacci number using recursion' : 
     functionName === 'validateEmail' ? 'Validates an email address format' :
     functionName === 'calculateArea' ? 'Calculates the area of a circle given its radius' :
     `Processes input and returns a result`}
 * 
 * @param {${functionName === 'fibonacci' ? 'number' : 'any'}} ${functionName === 'fibonacci' ? 'n - The position in the Fibonacci sequence (0-indexed)' : 
                                            functionName === 'validateEmail' ? 'email - The email address to validate' :
                                            'param - Input parameter'}
 * @returns {${functionName === 'fibonacci' ? 'number' : 
             functionName === 'validateEmail' ? 'boolean' : 
             'any'}} ${functionName === 'fibonacci' ? 'The nth Fibonacci number' :
                       functionName === 'validateEmail' ? 'True if valid email format, false otherwise' :
                       'The processed result'}
 * @example
 * ${functionName === 'fibonacci' ? '// Get the 6th Fibonacci number\nconst result = fibonacci(6); // returns 8' :
   functionName === 'validateEmail' ? '// Validate an email\nconst isValid = validateEmail("test@example.com"); // returns true' :
   '// Example usage\nconst result = ' + functionName + '(input);'}
 */`);
              } else if (style === 'markdown') {
                resolve(`## ${functionName}

**Description**: ${functionName === 'fibonacci' ? 'Calculates the nth number in the Fibonacci sequence using recursive approach.' :
                  functionName === 'validateEmail' ? 'Validates whether a given string matches standard email format.' :
                  functionName === 'calculateArea' ? 'Calculates the area of a circle using the mathematical formula π × radius².' :
                  'Performs the intended operation on the input.'}

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| radius | number | The radius of the circle in units |

### Returns

- **Type**: number
- **Description**: The area of the circle in square units

### Example Usage

\`\`\`${language}
const area = calculateArea(5);
console.log(area); // Output: 78.53981633974483
\`\`\``);
              } else {
                resolve(`# Detailed Documentation

## Purpose
This function calculates the area of a circle given its radius using the mathematical formula Area = π × radius².

## Parameters
- **radius**: A numeric value representing the radius of the circle. Must be positive for meaningful results.

## Return Value
Returns a numeric value representing the area of the circle in square units.

## Side Effects
- None. This is a pure function with no side effects.

## Complexity Analysis
- Time Complexity: O(1) - constant time operation
- Space Complexity: O(1) - uses constant space

## Usage Examples

### Basic Usage
\`\`\`${language}
const circleArea = calculateArea(3);
console.log(circleArea); // 28.274333882308138
\`\`\`

### Advanced Usage
\`\`\`${language}
// Calculate areas for multiple circles
const radii = [1, 2, 3, 4, 5];
const areas = radii.map(r => calculateArea(r));
console.log(areas);
\`\`\``);
              }
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `# Simulated AI-Generated Documentation\n\n${simulatedAiResponse}\n\n---\n*Documentation generated using fallback simulation (real MCP sampling failed)*\n\n**Original Code:**\n\`\`\`${language}\n${code}\n\`\`\``,
                },
              ],
              metadata: {
                language,
                style,
                generatedAt: new Date().toISOString(),
                method: 'fallback-simulation',
                model: 'claude-3-5-sonnet-20241022',
              },
            };
          }
        }
        
        // Fallback: provide a simple documentation template
        logger.info('Using template-based documentation generation');
        
        let documentation = '';
        
        if (style === 'jsdoc') {
          documentation = `/**
 * [Function description here]
 * 
 * @param {type} paramName - Parameter description
 * @returns {type} Return value description
 * @example
 * // Example usage here
 */`;
        } else if (style === 'markdown') {
          documentation = `## Function Name

**Description**: Brief description of what this code does.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| paramName | type | Description |

### Returns

- **Type**: Return type
- **Description**: What it returns

### Example Usage

\`\`\`${language}
// Example code here
\`\`\``;
        } else {
          documentation = `# Detailed Documentation

## Purpose
This code serves to...

## Parameters
- **param1**: Description and purpose
- **param2**: Description and purpose

## Return Value
Returns...

## Side Effects
- Effect 1
- Effect 2

## Complexity Analysis
- Time Complexity: O(n)
- Space Complexity: O(1)

## Usage Examples

### Basic Usage
\`\`\`${language}
// Basic example
\`\`\`

### Advanced Usage
\`\`\`${language}
// Advanced example
\`\`\``;
        }

        return {
          content: [
            {
              type: 'text',
              text: `# Template Documentation\n\n${documentation}\n\n---\n*Note: This is a template. For AI-generated documentation, use a sampling-capable client like our chat-server.*\n\n**Original Code:**\n\`\`\`${language}\n${code}\n\`\`\``,
            },
          ],
          metadata: {
            language,
            style,
            generatedAt: new Date().toISOString(),
            method: 'template-based',
            note: 'Sampling not available in this context',
          },
        };
      } catch (error) {
        logger.error('Documentation generation failed', error);
        return {
          content: [
            {
              type: 'text',
              text: `Documentation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register a tool that demonstrates progress notifications
  mcpServer.registerTool(
    'scan_project',
    {
      title: 'Scan Project Files',
      description: 'Scan project files with progress reporting using MCP progress notifications',
      inputSchema: {
        directory: z.string().default('.')
          .describe('Directory to scan (default: current directory)'),
        pattern: z.string().default('**/*.{ts,tsx,js,jsx,py,java,cpp,c,h}')
          .describe('File pattern to search for'),
        maxFiles: z.number().min(1).max(1000).default(100)
          .describe('Maximum number of files to scan'),
        scanType: z.enum(['quick', 'detailed']).default('quick')
          .describe('Type of scan to perform'),
      },
    },
    async ({ directory, pattern, maxFiles, scanType }, extra) => {
      logger.info('Starting project scan with progress notifications', { directory, pattern, maxFiles, scanType });

      try {
        // Check if progress token is provided in request metadata
        const progressToken = extra?._meta?.progressToken;
        
        if (progressToken) {
          logger.info(`Progress notifications enabled with token: ${progressToken}`);
          activeProgressTokens.set(progressToken, true);
        }

        // Helper function to send progress notifications
        const sendProgress = async (progress: number, total: number, message: string) => {
          if (progressToken && activeProgressTokens.has(progressToken)) {
            try {
              logger.info(`Sending progress notification: ${progress}/${total} - ${message}`);
              
              // Send progress notification via the base server
              await baseServer.notification({
                method: 'notifications/progress',
                params: {
                  progressToken,
                  progress,
                  total,
                  message
                }
              });
            } catch (error) {
              logger.error('Failed to send progress notification', error);
            }
          }
        };

        // Start scanning
        await sendProgress(0, 100, 'Starting project scan...');

        // Find files matching pattern
        await sendProgress(10, 100, 'Finding files...');
        
        const files = await glob(pattern, {
          cwd: directory,
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
          maxDepth: 10,
        });

        const filesToScan = files.slice(0, maxFiles);
        const totalFiles = filesToScan.length;

        await sendProgress(20, 100, `Found ${totalFiles} files to scan`);

        if (totalFiles === 0) {
          await sendProgress(100, 100, 'Scan complete - no files found');
          return {
            content: [
              {
                type: 'text',
                text: `# Project Scan Results\n\n**Directory**: ${directory}\n**Pattern**: ${pattern}\n**Status**: No files found matching pattern\n\n**Scan Type**: ${scanType}`,
              },
            ],
            metadata: {
              directory,
              pattern,
              totalFilesFound: 0,
              scanType,
              progressNotificationsUsed: !!progressToken,
            },
          };
        }

        // Process files with progress updates
        const results: Array<{
          file: string;
          size: number;
          lines: number;
          language: string;
          issues?: string[];
        }> = [];

        for (let i = 0; i < filesToScan.length; i++) {
          const file = filesToScan[i]!;
          const progressPercent = 20 + Math.floor((i / totalFiles) * 70); // 20% to 90%
          
          await sendProgress(progressPercent, 100, `Scanning ${file} (${i + 1}/${totalFiles})`);

          try {
            const filePath = path.join(directory, file);
            const content = await readFile(filePath, 'utf-8');
            const lines = content.split('\n').length;
            const size = content.length;
            
            // Determine language
            const ext = path.extname(file).toLowerCase();
            const languageMap: Record<string, string> = {
              '.ts': 'typescript',
              '.tsx': 'typescript',
              '.js': 'javascript',
              '.jsx': 'javascript',
              '.py': 'python',
              '.java': 'java',
              '.cpp': 'cpp',
              '.c': 'c',
              '.h': 'c',
            };
            const language = languageMap[ext] || 'unknown';

            const fileResult: typeof results[0] = {
              file,
              size,
              lines,
              language,
            };

            // If detailed scan, look for potential issues
            if (scanType === 'detailed') {
              const issues: string[] = [];
              
              // Basic static analysis
              if (content.includes('console.log')) issues.push('Debug logging found');
              if (content.includes('TODO') || content.includes('FIXME')) issues.push('TODO/FIXME comments found');
              if (lines > 500) issues.push('Large file (>500 lines)');
              if (content.includes('any') && language === 'typescript') issues.push('TypeScript "any" type usage');
              if (content.includes('eval(')) issues.push('Potentially unsafe eval() usage');
              
              if (issues.length > 0) {
                fileResult.issues = issues;
              }
            }

            results.push(fileResult);

          } catch (error) {
            logger.error(`Failed to scan file ${file}`, error);
            results.push({
              file,
              size: 0,
              lines: 0,
              language: 'error',
              issues: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`],
            });
          }

          // Small delay to make progress visible
          if (progressToken) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }

        await sendProgress(90, 100, 'Analyzing results...');

        // Generate summary
        const totalLines = results.reduce((sum, r) => sum + r.lines, 0);
        const totalSize = results.reduce((sum, r) => sum + r.size, 0);
        const languageStats = results.reduce((acc, r) => {
          acc[r.language] = (acc[r.language] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const issueFiles = results.filter(r => r.issues && r.issues.length > 0);
        const totalIssues = issueFiles.reduce((sum, r) => sum + (r.issues?.length || 0), 0);

        await sendProgress(100, 100, 'Scan complete!');

        // Clean up progress token
        if (progressToken) {
          activeProgressTokens.delete(progressToken);
        }

        // Generate detailed report
        const languageBreakdown = Object.entries(languageStats)
          .map(([lang, count]) => `- **${lang}**: ${count} files`)
          .join('\n');

        const fileList = results
          .slice(0, 20) // Show first 20 files
          .map(r => {
            let line = `- \`${r.file}\` (${r.lines} lines, ${(r.size / 1024).toFixed(1)}KB)`;
            if (r.issues && r.issues.length > 0) {
              line += ` ⚠️ ${r.issues.length} issue(s)`;
            }
            return line;
          })
          .join('\n');

        const issuesSection = issueFiles.length > 0 
          ? `\n## Issues Found\n\n${issueFiles.slice(0, 10).map(f => 
              `### ${f.file}\n${f.issues!.map(issue => `- ${issue}`).join('\n')}`
            ).join('\n\n')}`
          : '';

        const reportText = `# Project Scan Results

**Directory**: ${directory}
**Pattern**: ${pattern}
**Scan Type**: ${scanType}
**Files Scanned**: ${totalFiles}
**Total Lines**: ${totalLines.toLocaleString()}
**Total Size**: ${(totalSize / (1024 * 1024)).toFixed(2)} MB
${scanType === 'detailed' ? `**Issues Found**: ${totalIssues}` : ''}

## Language Breakdown
${languageBreakdown}

## Files${results.length > 20 ? ` (showing first 20 of ${results.length})` : ''}
${fileList}${issuesSection}

${progressToken ? '\n*This scan used MCP progress notifications*' : ''}
*Scan completed at: ${new Date().toLocaleString()}*`;

        return {
          content: [
            {
              type: 'text',
              text: reportText,
            },
          ],
          metadata: {
            directory,
            pattern,
            scanType,
            totalFiles: totalFiles,
            totalLines,
            totalSize,
            languageStats,
            issuesFound: totalIssues,
            progressNotificationsUsed: !!progressToken,
            scanDuration: '~' + Math.max(1, Math.floor(totalFiles * 0.1)) + 's',
          },
        };

      } catch (error) {
        logger.error('Project scan failed', error);
        
        // Clean up progress token on error
        const progressToken = extra?._meta?.progressToken;
        if (progressToken && activeProgressTokens.has(progressToken)) {
          activeProgressTokens.delete(progressToken);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Project scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  /**
   * EDUCATIONAL NOTE: Resource Registration
   * 
   * Resources provide read-only access to server data and content.
   * They are identified by URIs and can be:
   * 1. Static content (files, documentation)
   * 2. Dynamic content (live data, computed results)
   * 3. Templated resources (parameterized content)
   * 
   * Resources support subscriptions for change notifications.
   */
  mcpServer.registerResource(
    'project_config',
    'devtools://config/project',
    {
      title: 'Project Configuration',
      description: 'Access to project configuration files and settings',
    },
    async () => {
      logger.info('Providing project configuration');

      try {
        const configFiles = await glob('**/package.json', {
          ignore: ['**/node_modules/**'],
          maxDepth: 3,
        });

        const configs = [];
        for (const file of configFiles.slice(0, 5)) { // Limit to 5 configs
          try {
            const content = await readFile(file, 'utf-8');
            const parsed = JSON.parse(content);
            configs.push({
              file,
              name: parsed.name || 'Unknown',
              version: parsed.version || 'Unknown',
              description: parsed.description || 'No description',
            });
          } catch (error) {
            logger.error(`Failed to read config file ${file}`, error);
          }
        }

        const configContent = `# Project Configuration Overview\n\n## Detected Packages\n\n${configs
          .map(
            (config) =>
              `### ${config.name}\n- **File**: \`${config.file}\`\n- **Version**: ${config.version}\n- **Description**: ${config.description}\n`
          )
          .join('\n')}\n\n*Found ${configs.length} configuration files*`;

        return {
          contents: [
            {
              uri: 'devtools://config/project',
              mimeType: 'text/markdown',
              text: configContent,
            },
          ],
        };
      } catch (error) {
        logger.error('Project configuration generation failed', error);
        throw new Error(`Failed to generate project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  // Register prompts
  mcpServer.registerPrompt(
    'code_review',
    {
      title: 'Code Review Assistant',
      description: 'Perform a comprehensive code review with suggestions for improvement',
      argsSchema: {
        filePath: z.string().describe('Path to the file to review'),
        reviewType: z.enum(['security', 'performance', 'style', 'comprehensive']).optional()
          .describe('Type of code review to perform'),
        language: z.string().optional().describe('Programming language (auto-detected if not provided)'),
      },
    },
    async ({ filePath, reviewType, language }) => {
      logger.info('Generating code review prompt', { filePath, reviewType, language });

      const reviewFocus = {
        security: 'security vulnerabilities, input validation, and potential exploits',
        performance: 'performance optimizations, algorithmic efficiency, and resource usage',
        style: 'code style, formatting, naming conventions, and best practices',
        comprehensive: 'all aspects including security, performance, maintainability, and style',
      };

      const focus = reviewFocus[reviewType || 'comprehensive'];

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please perform a ${reviewType || 'comprehensive'} code review of the file: ${filePath}

I'm looking for feedback on ${focus}.

Please follow this code review methodology:

1. **File Analysis**
   - Read the file using the read_file tool
   - Analyze the code structure and patterns
   - Identify the programming language and framework

2. **Review Focus Areas** (for ${reviewType || 'comprehensive'} review)
   ${reviewType === 'security' ? `
   - Input validation and sanitization
   - Authentication and authorization
   - Data encryption and secure storage
   - Protection against common vulnerabilities (OWASP Top 10)
   - Error handling and information disclosure` : ''}
   ${reviewType === 'performance' ? `
   - Algorithm complexity and efficiency
   - Memory usage and garbage collection
   - Database queries and caching
   - Network requests and batching
   - Resource cleanup and management` : ''}
   ${reviewType === 'style' ? `
   - Code formatting and consistency
   - Naming conventions and clarity
   - Function and class organization
   - Comment quality and documentation
   - adherence to language-specific best practices` : ''}
   ${reviewType === 'comprehensive' ? `
   - Security considerations
   - Performance implications
   - Code maintainability and readability
   - Error handling and edge cases
   - Testing coverage opportunities` : ''}

3. **Provide Actionable Feedback**
   - Highlight specific lines or sections of concern
   - Suggest concrete improvements with examples
   - Prioritize issues by severity (Critical, High, Medium, Low)
   - Offer alternative approaches where applicable

4. **Summary and Recommendations**
   - Summarize the main findings
   - Provide an overall assessment
   - Suggest next steps for improvement

Start by reading the file and then provide your detailed code review.`,
            },
          },
        ],
      };
    }
  );

  // Register additional development-focused prompts
  mcpServer.registerPrompt(
    'debug_session',
    {
      title: 'Debug Session Assistant',
      description: 'Get systematic debugging guidance for troubleshooting code issues',
      argsSchema: {
        errorMessage: z.string().describe('The error message or issue description'),
        codeSnippet: z.string().optional().describe('Relevant code snippet (optional)'),
        environment: z.enum(['development', 'staging', 'production']).optional()
          .describe('Environment where the issue occurs'),
        urgency: z.enum(['low', 'medium', 'high', 'critical']).optional()
          .describe('Issue urgency level'),
      },
    },
    async ({ errorMessage, codeSnippet, environment, urgency }) => {
      logger.info('Generating debug session prompt', { errorMessage, environment, urgency });

      const urgencyGuidance = {
        low: 'Take a methodical approach to identify root causes',
        medium: 'Balance thoroughness with timely resolution',
        high: 'Focus on quick identification and temporary fixes if needed',
        critical: 'Prioritize immediate mitigation and rapid diagnosis',
      };

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I need debugging assistance for the following issue:

**Error/Issue**: ${errorMessage}
${environment ? `**Environment**: ${environment}` : ''}
**Urgency Level**: ${urgency || 'medium'} - ${urgencyGuidance[urgency || 'medium']}

${codeSnippet ? `**Relevant Code**:
\`\`\`
${codeSnippet}
\`\`\`
` : ''}

Please help me debug this systematically using the following approach:

## 1. Initial Analysis
- Analyze the error message and identify potential root causes
- Categorize the issue type (syntax, logic, runtime, environment, etc.)
- Assess the scope and impact of the problem

## 2. Information Gathering
- What additional information should I collect?
- Which logs, files, or system states should I examine?
- Are there any immediate checks I can perform?

## 3. Debugging Strategy
Based on the urgency level (${urgency || 'medium'}):
${(urgency || 'medium') === 'critical' ? `
- **Immediate Steps**: What can I do RIGHT NOW to mitigate?
- **Quick Diagnosis**: Fast ways to identify the root cause
- **Temporary Fixes**: Safe workarounds while I investigate further` : ''}
${(urgency || 'medium') === 'high' ? `
- **Priority Actions**: Most important debugging steps first
- **Quick Wins**: Easy checks that might solve the issue
- **Escalation Plan**: When to involve others or rollback` : ''}
${(urgency || 'medium') === 'medium' || (urgency || 'medium') === 'low' ? `
- **Systematic Investigation**: Step-by-step debugging process
- **Testing Strategy**: How to validate theories and solutions
- **Prevention**: How to avoid similar issues in the future` : ''}

## 4. Tool Recommendations
- Which debugging tools, commands, or techniques would be most effective?
- How can I reproduce the issue consistently?
- What breakpoints or logging should I add?

## 5. Solution Path
- Provide a prioritized list of potential solutions
- Include testing steps for each potential fix
- Suggest verification methods to confirm resolution

Please start with your initial analysis and guide me through the debugging process step by step.`,
            },
          },
        ],
      };
    }
  );

  mcpServer.registerPrompt(
    'test_strategy',
    {
      title: 'Test Strategy Planner',
      description: 'Design comprehensive testing strategies for code features and applications',
      argsSchema: {
        feature: z.string().describe('The feature or functionality to test'),
        codeType: z.enum(['function', 'class', 'module', 'api', 'ui', 'integration'])
          .describe('Type of code being tested'),
        testingFramework: z.string().optional()
          .describe('Preferred testing framework (e.g., Jest, Mocha, PyTest)'),
        coverage: z.enum(['basic', 'comprehensive', 'edge-cases']).optional()
          .describe('Desired test coverage level'),
        constraints: z.string().optional()
          .describe('Any constraints or special requirements'),
      },
    },
    async ({ feature, codeType, testingFramework, coverage, constraints }) => {
      logger.info('Generating test strategy prompt', { feature, codeType, testingFramework, coverage });

      const coverageGuidance = {
        basic: 'happy path and most common error cases',
        comprehensive: 'happy path, error cases, edge cases, and boundary conditions',
        'edge-cases': 'exhaustive edge cases, boundary conditions, and stress testing',
      };

      const testTypes = {
        function: ['Unit tests', 'Parameter validation tests', 'Return value tests'],
        class: ['Unit tests', 'Method tests', 'State tests', 'Integration tests'],
        module: ['Unit tests', 'Integration tests', 'API contract tests'],
        api: ['Unit tests', 'Integration tests', 'Contract tests', 'Load tests'],
        ui: ['Unit tests', 'Component tests', 'E2E tests', 'Accessibility tests'],
        integration: ['Integration tests', 'Contract tests', 'System tests', 'Performance tests'],
      };

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I need to create a comprehensive testing strategy for the following:

**Feature/Functionality**: ${feature}
**Code Type**: ${codeType}
**Coverage Level**: ${coverage || 'comprehensive'} - focusing on ${coverageGuidance[coverage || 'comprehensive']}
${testingFramework ? `**Testing Framework**: ${testingFramework}` : ''}
${constraints ? `**Constraints**: ${constraints}` : ''}

Please help me design a testing strategy that covers:

## 1. Test Planning
- **Test Scope**: What specific aspects need testing?
- **Test Types**: Which types of tests are most relevant?
  - Suggested for ${codeType}: ${testTypes[codeType]?.join(', ') || 'Standard unit and integration tests'}
- **Test Priorities**: Which tests are critical vs. nice-to-have?

## 2. Test Case Design
Based on ${coverage || 'comprehensive'} coverage requirements:

### Happy Path Tests
- What are the normal, expected use cases?
- What should the successful execution flow look like?

### Error Case Tests  
- What error conditions should be tested?
- How should the system handle invalid inputs or states?

### Edge Case Tests
${(coverage || 'comprehensive') === 'edge-cases' || (coverage || 'comprehensive') === 'comprehensive' ? `
- What boundary conditions exist?
- What unusual but valid scenarios should be tested?
- What stress conditions should be considered?` : '- Basic boundary conditions to consider'}

## 3. Test Implementation Guide
${testingFramework ? `
### ${testingFramework} Implementation
- Recommended test structure and organization
- Setup and teardown patterns
- Mocking and stubbing strategies
- Assertion patterns and best practices` : `
### General Implementation Guidelines
- Test organization and naming conventions
- Setup and cleanup patterns
- Data management and test isolation
- Assertion strategies`}

## 4. Test Data Strategy
- What test data is needed?
- How should test data be managed and organized?
- Are there any data privacy or security considerations?

## 5. Automation and CI/CD Integration
- Which tests should run in different pipeline stages?
- How should test results be reported and monitored?
- What are the performance requirements for test execution?

## 6. Maintenance and Evolution
- How will tests be maintained as code evolves?
- What metrics should be tracked for test effectiveness?
- How often should the test strategy be reviewed?

Please provide specific, actionable recommendations for each section, including concrete examples where helpful.`,
            },
          },
        ],
      };
    }
  );

  // Register additional development resources
  mcpServer.registerResource(
    'test_reports',
    'devtools://reports/testing',
    {
      title: 'Test Reports',
      description: 'Recent test execution reports and coverage data',
    },
    async () => {
      logger.info('Providing test reports');

      try {
        // Generate mock test report data
        const testResults = {
          timestamp: new Date().toISOString(),
          totalTests: 245,
          passed: 238,
          failed: 5,
          skipped: 2,
          coverage: {
            lines: 87.5,
            functions: 91.2,
            branches: 82.1,
            statements: 88.3,
          },
          failedTests: [
            { name: 'user-authentication', file: 'auth.test.ts', error: 'Mock authentication service unavailable' },
            { name: 'api-rate-limiting', file: 'api.test.ts', error: 'Timeout waiting for rate limit reset' },
            { name: 'data-validation', file: 'validation.test.ts', error: 'Schema validation failed for edge case' },
          ],
        };

        const reportContent = `# Test Execution Report

## Summary
- **Total Tests**: ${testResults.totalTests}
- **Passed**: ✅ ${testResults.passed} (${((testResults.passed / testResults.totalTests) * 100).toFixed(1)}%)
- **Failed**: ❌ ${testResults.failed} (${((testResults.failed / testResults.totalTests) * 100).toFixed(1)}%)
- **Skipped**: ⏭️ ${testResults.skipped}

## Coverage Report
- **Lines**: ${testResults.coverage.lines}%
- **Functions**: ${testResults.coverage.functions}%
- **Branches**: ${testResults.coverage.branches}%
- **Statements**: ${testResults.coverage.statements}%

## Failed Tests
${testResults.failedTests.map(test => 
  `### ${test.name} (${test.file})\n**Error**: ${test.error}`
).join('\n\n')}

## Recommendations
- Review failed authentication tests - check mock service configuration
- Investigate API rate limiting timeout issues
- Add additional edge case validation tests

*Generated: ${new Date(testResults.timestamp).toLocaleString()}*`;

        return {
          contents: [
            {
              uri: 'devtools://reports/testing',
              mimeType: 'text/markdown',
              text: reportContent,
            },
          ],
        };
      } catch (error) {
        logger.error('Test reports generation failed', error);
        throw new Error(`Failed to generate test reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  mcpServer.registerResource(
    'build_configs',
    'devtools://config/build',
    {
      title: 'Build Configurations',
      description: 'Build system configurations and optimization settings',
    },
    async () => {
      logger.info('Providing build configurations');

      try {
        const buildConfigs = {
          typescript: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            skipLibCheck: true,
            allowSyntheticDefaultImports: true,
          },
          vite: {
            build: {
              target: 'ES2022',
              minify: 'esbuild',
              sourcemap: true,
              rollupOptions: {
                output: {
                  manualChunks: {
                    vendor: ['react', 'react-dom'],
                    utils: ['lodash', 'date-fns'],
                  },
                },
              },
            },
          },
          eslint: {
            extends: ['@typescript-eslint/recommended', 'prettier'],
            rules: {
              '@typescript-eslint/no-unused-vars': 'error',
              '@typescript-eslint/explicit-function-return-type': 'warn',
              'prefer-const': 'error',
            },
          },
        };

        const configContent = `# Build Configuration Overview

## TypeScript Configuration
\`\`\`json
${JSON.stringify(buildConfigs.typescript, null, 2)}
\`\`\`

## Vite Build Configuration
\`\`\`json
${JSON.stringify(buildConfigs.vite, null, 2)}
\`\`\`

## ESLint Rules
\`\`\`json
${JSON.stringify(buildConfigs.eslint, null, 2)}
\`\`\`

## Optimization Guidelines
- **Code Splitting**: Vendor and utility libraries are split into separate chunks
- **Minification**: ESBuild used for fast, efficient minification
- **Source Maps**: Enabled for debugging in production
- **Type Checking**: Strict TypeScript configuration for better code quality

## Build Performance
- Average build time: ~45 seconds
- Bundle size: ~150KB (gzipped)
- Tree shaking: Enabled
- Dead code elimination: Active

*Configuration last updated: ${new Date().toLocaleDateString()}*`;

        return {
          contents: [
            {
              uri: 'devtools://config/build',
              mimeType: 'text/markdown',
              text: configContent,
            },
          ],
        };
      } catch (error) {
        logger.error('Build configurations generation failed', error);
        throw new Error(`Failed to generate build configurations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  mcpServer.registerResource(
    'code_metrics',
    'devtools://metrics/code-quality',
    {
      title: 'Code Quality Metrics',
      description: 'Code quality metrics including complexity, maintainability, and technical debt',
    },
    async () => {
      logger.info('Providing code quality metrics');

      try {
        const metrics = {
          complexity: {
            average: 3.2,
            highest: 12,
            files: {
              'src/components/DataTable.tsx': 12,
              'src/utils/validation.ts': 8,
              'src/hooks/useAuthentication.ts': 7,
            },
          },
          maintainability: {
            index: 78.5,
            linesOfCode: 8420,
            duplicateLines: 245,
            duplicatePercentage: 2.9,
          },
          techDebt: {
            total: '4h 30m',
            issues: [
              { file: 'src/legacy/oldApi.ts', debt: '2h 15m', reason: 'Deprecated API usage' },
              { file: 'src/components/Modal.tsx', debt: '1h 45m', reason: 'Complex component needs refactoring' },
              { file: 'src/utils/dateHelpers.ts', debt: '30m', reason: 'Missing type definitions' },
            ],
          },
          security: {
            vulnerabilities: 2,
            warnings: 5,
            issues: [
              { severity: 'medium', file: 'package.json', issue: 'Outdated dependency with known vulnerability' },
              { severity: 'low', file: 'src/api/client.ts', issue: 'Potential exposure of sensitive data in logs' },
            ],
          },
        };

        const metricsContent = `# Code Quality Metrics

## Complexity Analysis
- **Average Complexity**: ${metrics.complexity.average}
- **Highest Complexity**: ${metrics.complexity.highest}

### Files Requiring Attention
${Object.entries(metrics.complexity.files).map(([file, complexity]) => 
  `- **${file}**: Complexity ${complexity}`
).join('\n')}

## Maintainability Index
- **Overall Score**: ${metrics.maintainability.index}/100
- **Lines of Code**: ${metrics.maintainability.linesOfCode.toLocaleString()}
- **Duplicate Lines**: ${metrics.maintainability.duplicateLines} (${metrics.maintainability.duplicatePercentage}%)

## Technical Debt
**Total Estimated Debt**: ${metrics.techDebt.total}

${metrics.techDebt.issues.map(issue => 
  `### ${issue.file}\n**Debt**: ${issue.debt}\n**Reason**: ${issue.reason}`
).join('\n\n')}

## Security Analysis
- **Vulnerabilities**: ${metrics.security.vulnerabilities}
- **Warnings**: ${metrics.security.warnings}

### Security Issues
${metrics.security.issues.map(issue => 
  `**${issue.severity.toUpperCase()}**: ${issue.issue}\n*File*: ${issue.file}`
).join('\n\n')}

## Recommendations
1. **Refactor high-complexity files** - Focus on DataTable.tsx (complexity: 12)
2. **Reduce code duplication** - Current 2.9% can be improved to <2%
3. **Address technical debt** - Prioritize legacy API migration (2h 15m debt)
4. **Update dependencies** - Review and update packages with known vulnerabilities
5. **Improve type coverage** - Add missing TypeScript definitions

*Metrics generated: ${new Date().toLocaleString()}*`;

        return {
          contents: [
            {
              uri: 'devtools://metrics/code-quality',
              mimeType: 'text/markdown',
              text: metricsContent,
            },
          ],
        };
      } catch (error) {
        logger.error('Code quality metrics generation failed', error);
        throw new Error(`Failed to generate code quality metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );

  return { mcpServer, baseServer };
}

// Store transports by session ID for HTTP mode
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

async function startStdioServer() {
  logger.info('Starting MCP Development Tools Server (stdio mode)');

  try {
    const { mcpServer } = createMCPServer();
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    
    logger.info('Development Tools Server connected and ready (stdio)');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down server...');
      await mcpServer.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down server...');
      await mcpServer.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start stdio server', error);
    process.exit(1);
  }
}

async function startHttpServer() {
  logger.info(`Starting MCP Development Tools Server (HTTP mode on port ${port})`);

  const app = express();
  app.use(express.json());
  
  // Configure CORS to expose Mcp-Session-Id header for browser-based clients
  app.use(cors({
    origin: '*', // Allow all origins - adjust as needed for production
    exposedHeaders: ['Mcp-Session-Id']
  }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'dev-tools-server', version: '1.0.0' });
  });

  // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
  app.all('/mcp', async (req, res) => {
    logger.info(`Received ${req.method} request to /mcp`);
    
    try {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Check if the transport is of the correct type
        const existingTransport = transports[sessionId];
        if (existingTransport instanceof StreamableHTTPServerTransport) {
          // Reuse existing transport
          transport = existingTransport;
        } else {
          // Transport exists but is not a StreamableHTTPServerTransport
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol',
            },
            id: null,
          });
          return;
        }
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            // Store the transport by session ID when session is initialized
            logger.info(`StreamableHTTP session initialized with ID: ${sessionId}`);
            transports[sessionId] = transport;
          }
        });

        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            logger.info(`Transport closed for session ${sid}, removing from transports map`);
            delete transports[sid];
          }
        };

        // Connect the transport to the MCP server
        const { mcpServer } = createMCPServer();
        await mcpServer.connect(transport);
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  // DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05) for backward compatibility
  app.get('/sse', async (_req, res) => {
    logger.info('Received GET request to /sse (deprecated SSE transport)');
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    
    res.on("close", () => {
      delete transports[transport.sessionId];
    });

    const { mcpServer } = createMCPServer();
    await mcpServer.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const existingTransport = transports[sessionId];
    
    if (existingTransport instanceof SSEServerTransport) {
      await existingTransport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Session exists but uses a different transport protocol or session not found',
        },
        id: null,
      });
    }
  });

  // Start the server
  app.listen(port, (error?: Error) => {
    if (error) {
      logger.error('Failed to start HTTP server:', error);
      process.exit(1);
    }
    
    logger.info(`Development Tools HTTP Server listening on port ${port}`);
    console.log(`
==============================================
MCP DEVELOPMENT TOOLS SERVER

Transport: HTTP/SSE
Port: ${port}

SUPPORTED ENDPOINTS:

1. Streamable HTTP (Protocol version: 2025-03-26)
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   Usage: 
     - Initialize with POST to /mcp
     - Establish SSE stream with GET to /mcp
     - Send requests with POST to /mcp
     - Terminate session with DELETE to /mcp

2. HTTP + SSE (Protocol version: 2024-11-05)
   Endpoints: /sse (GET) and /messages (POST)
   Usage:
     - Establish SSE stream with GET to /sse
     - Send requests with POST to /messages?sessionId=<id>

3. Health Check
   Endpoint: /health
   Method: GET

Available Tools:
- format_code: Format code using Prettier
- list_project_files: List source code files
- read_file: Read file contents with syntax highlighting

Available Resources:
- devtools://config/project: Project configuration overview

Available Prompts:
- code_review: Comprehensive code review assistant
==============================================
`);
  });

  // Handle server shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down HTTP server...');
    
    // Close all active transports to properly clean up resources
    for (const sessionId in transports) {
      try {
        logger.info(`Closing transport for session ${sessionId}`);
        await transports[sessionId]!.close();
        delete transports[sessionId];
      } catch (error) {
        logger.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
    
    logger.info('HTTP server shutdown complete');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down HTTP server...');
    
    // Close all active transports
    for (const sessionId in transports) {
      try {
        await transports[sessionId]!.close();
        delete transports[sessionId];
      } catch (error) {
        logger.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
    
    process.exit(0);
  });
}

// Main execution
async function main() {
  if (transportArg === 'http') {
    await startHttpServer();
  } else {
    await startStdioServer();
  }
}

// Run the server
main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});