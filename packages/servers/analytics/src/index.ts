#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Logger, createErrorResponse } from '@mcp-demo/core';
import { writeFile } from 'fs/promises';
import * as d3 from 'd3';

const logger = new Logger('analytics-server');

// Command line argument parsing
const args = process.argv.slice(2);
const hasHttpFlag = args.includes('--http');
const transportArg = args.find(arg => arg.startsWith('--transport='))?.split('=')[1] || (hasHttpFlag ? 'http' : 'stdio');
const portArg = args.find(arg => arg.startsWith('--port='))?.split('=')[1];
const port = portArg ? parseInt(portArg, 10) : 3002;

// Create MCP server factory function
function createMCPServer(): { mcpServer: McpServer, baseServer: any } {
  const server = new McpServer({
    name: 'analytics-server',
    version: '1.0.0',
  }, { 
    capabilities: { 
      logging: {},
      elicitation: {},
      completion: {},
      prompts: {
        listChanged: true
      },
      resources: {
        subscribe: true,
        listChanged: true
      },
      sampling: {}
    } 
  });
  
  // Access the underlying base server for elicitation capabilities
  const baseServer = (server as any).server;

  // Store active progress tokens
  const activeProgressTokens = new Map<string | number, boolean>();

// Sample data generator for testing
function generateSampleData(count: number = 100): Array<Record<string, any>> {
  const data = [];
  const categories = ['A', 'B', 'C', 'D', 'E'];
  const regions = ['North', 'South', 'East', 'West', 'Central'];
  
  for (let i = 0; i < count; i++) {
    data.push({
      id: i + 1,
      value: Math.floor(Math.random() * 1000) + 1,
      category: categories[Math.floor(Math.random() * categories.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      date: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      score: Math.random() * 100,
    });
  }
  
  return data;
}

// Register tools
server.registerTool(
  'analyze_csv',
  {
    title: 'Analyze CSV Data',
    description: 'Analyze CSV file and provide statistical insights',
    inputSchema: {
      filePath: z.string().describe('Path to the CSV file'),
      columns: z.array(z.string()).optional().describe('Specific columns to analyze (optional)'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async ({ filePath, columns }) => {
    logger.info('Analyzing CSV data', { filePath, columns });

    try {
      // Basic security check
      if (filePath.includes('..')) {
        throw new Error('Path traversal not allowed');
      }

      // In a full implementation, you would parse the actual CSV file
      return {
        content: [
          {
            type: 'text',
            text: `# CSV Analysis Report\n\nFile: ${filePath}\n\nNote: This is a demo implementation. In a real scenario, this would parse and analyze the actual CSV file.\n\nTo fully implement CSV analysis:\n1. Install csv-parser dependency\n2. Parse the CSV file\n3. Generate statistical insights\n4. Return formatted analysis`,
          },
        ],
        metadata: {
          filePath,
          demoMode: true,
        },
      };
      
      /*
      // Full CSV parsing implementation (commented out due to dependency issues)
      return new Promise((resolve) => {
        createReadStream(filePath)
          .pipe(csvParse())
          .on('data', (row: any) => data.push(row))
          .on('end', () => {
            try {
              const analysis = analyzeDataset(data, columns);
              
              resolve({
                content: [
                  {
                    type: 'text',
                    text: `# CSV Analysis Report\n\n${formatAnalysisReport(analysis)}`,
                  },
                ],
                metadata: {
                  filePath,
                  recordCount: data.length,
                  columnCount: Object.keys(data[0] || {}).length,
                },
              });
            } catch (error) {
              resolve({
                content: [
                  {
                    type: 'text',
                    text: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  },
                ],
                isError: true,
              });
            }
          })
          .on('error', (error) => {
            resolve({
              content: [
                {
                  type: 'text',
                  text: `CSV parsing failed: ${error.message}`,
                },
              ],
              isError: true,
            });
          });
      });
      */
    } catch (error) {
      logger.error('CSV analysis failed', error);
      return createErrorResponse(error, 'CSV analysis failed');
    }
  }
);

server.registerTool(
  'generate_sample_data',
  {
    title: 'Generate Sample Data',
    description: 'Generate sample dataset for testing analytics',
    inputSchema: {
      format: z.enum(['json', 'csv']).describe('Output format'),
      recordCount: z.number().min(1).max(10000).default(100).describe('Number of records to generate'),
      outputPath: z.string().optional().describe('Optional file path to save the data'),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  async ({ format, recordCount, outputPath }) => {
    logger.info('Generating sample data', { format, recordCount, outputPath });

    try {
      const data = generateSampleData(recordCount);
      let output: string;
      
      if (format === 'json') {
        output = JSON.stringify(data, null, 2);
      } else {
        // Simple CSV conversion for demo
        if (data.length > 0) {
          const firstRow = data[0];
          if (firstRow) {
            const headers = Object.keys(firstRow);
            const csvRows = [headers.join(',')];
            data.forEach(row => {
              const values = headers.map(header => JSON.stringify(row[header] || ''));
              csvRows.push(values.join(','));
            });
            output = csvRows.join('\n');
          } else {
            output = '';
          }
        } else {
          output = '';
        }
      }

      if (outputPath) {
        await writeFile(outputPath, output, 'utf-8');
      }

      return {
        content: [
          {
            type: 'text',
            text: outputPath 
              ? `Sample data generated and saved to ${outputPath}\n\nFirst 3 records:\n\`\`\`${format}\n${format === 'json' ? JSON.stringify(data.slice(0, 3), null, 2) : output.split('\n').slice(0, 4).join('\n')}\n\`\`\``
              : `Sample data generated:\n\n\`\`\`${format}\n${output}\n\`\`\``,
          },
        ],
        metadata: {
          recordCount: data.length,
          format,
          outputPath,
        },
      };
    } catch (error) {
      logger.error('Sample data generation failed', error);
      return createErrorResponse(error, 'Sample data generation failed');
    }
  }
);

server.registerTool(
  'calculate_statistics',
  {
    title: 'Calculate Statistics',
    description: 'Calculate statistical measures for numeric data',
    inputSchema: {
      data: z.array(z.number()).describe('Array of numeric values'),
      measures: z.array(z.enum(['mean', 'median', 'mode', 'std', 'min', 'max', 'quartiles']))
        .default(['mean', 'median', 'std', 'min', 'max'])
        .describe('Statistical measures to calculate'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async ({ data, measures }) => {
    logger.info('Calculating statistics', { dataLength: data.length, measures });

    try {
      const stats: Record<string, any> = {};
      
      if (measures.includes('mean')) {
        stats.mean = d3.mean(data);
      }
      
      if (measures.includes('median')) {
        stats.median = d3.median(data);
      }
      
      if (measures.includes('min')) {
        stats.min = d3.min(data);
      }
      
      if (measures.includes('max')) {
        stats.max = d3.max(data);
      }
      
      if (measures.includes('std')) {
        stats.standardDeviation = d3.deviation(data);
      }
      
      if (measures.includes('quartiles')) {
        const sorted = data.sort((a, b) => a - b);
        stats.quartiles = {
          q1: d3.quantile(sorted, 0.25),
          q2: d3.quantile(sorted, 0.5), // median
          q3: d3.quantile(sorted, 0.75),
        };
      }
      
      if (measures.includes('mode')) {
        const frequency = d3.rollup(data, v => v.length, d => d);
        const maxFreq = d3.max(frequency.values());
        stats.mode = Array.from(frequency.entries())
          .filter(([, freq]: [number, number]) => freq === maxFreq)
          .map(([value]: [number, number]) => value);
      }

      const report = Object.entries(stats)
        .map(([key, value]) => {
          if (key === 'quartiles') {
            return `**${key}**: Q1=${value.q1}, Q2=${value.q2}, Q3=${value.q3}`;
          } else if (key === 'mode') {
            return `**${key}**: ${Array.isArray(value) ? value.join(', ') : value}`;
          } else {
            return `**${key}**: ${typeof value === 'number' ? value.toFixed(4) : value}`;
          }
        })
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `# Statistical Analysis\n\n${report}\n\n**Sample size**: ${data.length}`,
          },
        ],
        metadata: {
          sampleSize: data.length,
          measures,
          statistics: stats,
        },
      };
    } catch (error) {
      logger.error('Statistics calculation failed', error);
      return createErrorResponse(error, 'Statistics calculation failed');
    }
  }
);

server.registerTool(
  'interactive_data_analysis',
  {
    title: 'Interactive Data Analysis',
    description: 'Interactive tool for comprehensive data analysis with user-guided parameter selection',
    inputSchema: {
      dataPath: z.string().describe('Path to data file or dataset identifier'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async ({ dataPath }) => {
    logger.info('Starting interactive data analysis', { dataPath });

    try {
      // First, get analysis preferences from the user
      const analysisPrefs = await baseServer.elicitInput({
        message: `Starting data analysis for: ${dataPath}\n\nPlease configure your analysis preferences:`,
        requestedSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          properties: {
            analysisType: {
              type: 'string',
              enum: ['exploratory', 'statistical', 'comparative', 'trend'],
              enumNames: ['Exploratory Data Analysis', 'Statistical Analysis', 'Comparative Analysis', 'Trend Analysis'],
              title: 'Analysis Type',
              description: 'Select the type of analysis to perform'
            },
            includeVisualizations: {
              type: 'boolean',
              title: 'Include Visualizations',
              description: 'Generate visualization recommendations',
              default: true
            },
            focusColumns: {
              type: 'string',
              title: 'Focus Columns',
              description: 'Comma-separated list of specific columns to focus on (optional)'
            },
            statisticalMeasures: {
              type: 'string',
              enum: ['basic', 'comprehensive', 'custom'],
              enumNames: ['Basic (mean, median, std)', 'Comprehensive (all measures)', 'Custom Selection'],
              title: 'Statistical Detail Level',
              description: 'Level of statistical analysis to perform'
            }
          },
          required: ['analysisType', 'statisticalMeasures']
        }
      });

      if (analysisPrefs.action !== 'accept') {
        return {
          content: [
            {
              type: 'text',
              text: `Analysis ${analysisPrefs.action}ed by user.`,
            },
          ],
        };
      }

      const prefs = analysisPrefs.content;

      // Generate sample data for demonstration
      const sampleData = generateSampleData(100);
      const numericColumns = ['value', 'score'];
      
      // Perform analysis based on user preferences
      let analysisResults = `# Interactive Data Analysis Report\n\n`;
      analysisResults += `**Dataset**: ${dataPath}\n`;
      analysisResults += `**Analysis Type**: ${prefs.analysisType}\n`;
      analysisResults += `**Records Analyzed**: ${sampleData.length}\n\n`;

      // Statistical analysis based on user preference
      if (prefs.statisticalMeasures === 'basic' || prefs.statisticalMeasures === 'comprehensive') {
        analysisResults += `## Statistical Summary\n\n`;
        
        for (const column of numericColumns) {
          const values = sampleData.map(row => row[column as keyof typeof row] as number);
          
          analysisResults += `### ${column}\n`;
          analysisResults += `- **Mean**: ${d3.mean(values)?.toFixed(4)}\n`;
          analysisResults += `- **Median**: ${d3.median(values)?.toFixed(4)}\n`;
          analysisResults += `- **Min**: ${d3.min(values)}\n`;
          analysisResults += `- **Max**: ${d3.max(values)}\n`;
          
          if (prefs.statisticalMeasures === 'comprehensive') {
            analysisResults += `- **Standard Deviation**: ${d3.deviation(values)?.toFixed(4)}\n`;
            const sorted = values.sort((a, b) => a - b);
            analysisResults += `- **Q1**: ${d3.quantile(sorted, 0.25)?.toFixed(4)}\n`;
            analysisResults += `- **Q3**: ${d3.quantile(sorted, 0.75)?.toFixed(4)}\n`;
          }
          analysisResults += `\n`;
        }
      }

      // Analysis type specific insights
      switch (prefs.analysisType) {
        case 'exploratory':
          analysisResults += `## Exploratory Insights\n\n`;
          analysisResults += `- **Categories Distribution**: ${Array.from(new Set(sampleData.map(r => r.category))).length} unique categories\n`;
          analysisResults += `- **Regional Spread**: Data covers ${Array.from(new Set(sampleData.map(r => r.region))).length} regions\n`;
          analysisResults += `- **Date Range**: Data spans multiple months in 2024\n`;
          break;
        case 'comparative':
          analysisResults += `## Comparative Analysis\n\n`;
          const categoryStats = d3.rollup(sampleData, 
            v => ({ 
              count: v.length, 
              avgValue: d3.mean(v, d => d.value)?.toFixed(2) 
            }), 
            d => d.category
          );
          analysisResults += `**By Category:**\n`;
          categoryStats.forEach((stats, category) => {
            analysisResults += `- **${category}**: ${stats.count} records, avg value: ${stats.avgValue}\n`;
          });
          break;
      }

      // Visualization recommendations
      if (prefs.includeVisualizations) {
        analysisResults += `\n## Recommended Visualizations\n\n`;
        analysisResults += `Based on your analysis type (${prefs.analysisType}), consider these visualizations:\n`;
        
        switch (prefs.analysisType) {
          case 'exploratory':
            analysisResults += `- Histograms for numeric distributions\n`;
            analysisResults += `- Bar charts for categorical frequencies\n`;
            analysisResults += `- Scatter plots for correlation analysis\n`;
            break;
          case 'comparative':
            analysisResults += `- Box plots for group comparisons\n`;
            analysisResults += `- Grouped bar charts for category analysis\n`;
            analysisResults += `- Side-by-side violin plots\n`;
            break;
          case 'trend':
            analysisResults += `- Time series line charts\n`;
            analysisResults += `- Moving average overlays\n`;
            analysisResults += `- Seasonal decomposition plots\n`;
            break;
          case 'statistical':
            analysisResults += `- Q-Q plots for normality testing\n`;
            analysisResults += `- Correlation heatmaps\n`;
            analysisResults += `- Distribution fitting plots\n`;
            break;
        }
      }

      analysisResults += `\n## Next Steps\n\n`;
      analysisResults += `- Consider deeper analysis of identified patterns\n`;
      analysisResults += `- Validate findings with domain expertise\n`;
      analysisResults += `- Prepare visualizations for stakeholder presentation\n`;

      return {
        content: [
          {
            type: 'text',
            text: analysisResults,
          },
        ],
        metadata: {
          dataPath,
          analysisType: prefs.analysisType,
          recordsAnalyzed: sampleData.length,
          userPreferences: prefs,
        },
      };
    } catch (error) {
      logger.error('Interactive data analysis failed', error);
      return createErrorResponse(error, 'Interactive data analysis failed');
    }
  }
);

server.registerTool(
  'export_data',
  {
    title: 'Export Data',
    description: 'Export analyzed data in various formats (JSON, CSV)',
    inputSchema: {
      data: z.array(z.record(z.any())).describe('Data array to export'),
      format: z.enum(['json', 'csv']).describe('Export format'),
      filename: z.string().optional().describe('Optional filename for the export'),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
    },
  },
  async ({ data, format, filename }) => {
    logger.info('Exporting data', { format, recordCount: data.length, filename });

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultFilename = `analytics_export_${timestamp}`;
      const exportFilename = filename || defaultFilename;

      let exportContent: string;
      let mimeType: string;

      if (format === 'json') {
        exportContent = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
      } else {
        // CSV format
        if (data.length === 0) {
          exportContent = '';
        } else {
          const headers = Object.keys(data[0]!);
          const csvRows = [
            headers.join(','),
            ...data.map(row => 
              headers.map(header => {
                const value = row[header];
                // Escape quotes and wrap in quotes if contains comma or quote
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                  return `"${value.replace(/"/g, '""')}"`;
                }
                return String(value);
              }).join(',')
            )
          ];
          exportContent = csvRows.join('\n');
        }
        mimeType = 'text/csv';
      }

      return {
        content: [
          {
            type: 'text',
            text: `# Data Export Complete\n\n**Format**: ${format.toUpperCase()}\n**Records**: ${data.length}\n**Filename**: ${exportFilename}.${format}\n**Size**: ${(exportContent.length / 1024).toFixed(2)} KB\n\n## Export Preview\n\`\`\`${format}\n${exportContent.substring(0, 500)}${exportContent.length > 500 ? '...\n[truncated]' : ''}\n\`\`\``,
          },
        ],
        metadata: {
          format,
          filename: `${exportFilename}.${format}`,
          recordCount: data.length,
          size: exportContent.length,
          mimeType,
          exportTimestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Data export failed', error);
      return createErrorResponse(error, 'Data export failed');
    }
  }
);

// Register a tool that demonstrates progress notifications
server.registerTool(
  'process_large_dataset',
  {
    title: 'Process Large Dataset',
    description: 'Process a large dataset with progress reporting using MCP progress notifications',
    inputSchema: {
      operation: z.enum(['aggregate', 'transform', 'filter', 'sort', 'analyze'])
        .describe('Type of processing operation to perform'),
      recordCount: z.number().min(100).max(50000).default(1000)
        .describe('Number of records to process'),
      batchSize: z.number().min(10).max(1000).default(100)
        .describe('Processing batch size'),
      includeValidation: z.boolean().default(true)
        .describe('Include data validation step'),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      destructiveHint: false,
    },
  },
  async ({ operation, recordCount, batchSize, includeValidation }, extra) => {
    logger.info('Starting large dataset processing with progress notifications', { 
      operation, recordCount, batchSize, includeValidation 
    });

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

      // Start processing
      await sendProgress(0, 100, `Starting ${operation} operation...`);

      // Step 1: Generate large dataset
      await sendProgress(5, 100, `Generating ${recordCount} sample records...`);
      const dataset = generateSampleData(recordCount);
      
      await sendProgress(15, 100, `Dataset generated with ${dataset.length} records`);

      // Step 2: Data validation (if enabled)
      if (includeValidation) {
        await sendProgress(20, 100, 'Validating data integrity...');
        
        let validRecords = 0;
        let invalidRecords = 0;
        
        for (let i = 0; i < dataset.length; i++) {
          const record = dataset[i];
          if (record && record.id && record.value && record.category) {
            validRecords++;
          } else {
            invalidRecords++;
          }
          
          // Update progress for validation
          if (i % Math.max(1, Math.floor(dataset.length / 10)) === 0) {
            const validationProgress = 20 + Math.floor((i / dataset.length) * 10);
            await sendProgress(validationProgress, 100, `Validating records... ${i}/${dataset.length}`);
          }
        }
        
        await sendProgress(30, 100, `Validation complete: ${validRecords} valid, ${invalidRecords} invalid`);
      } else {
        await sendProgress(30, 100, 'Skipping validation step');
      }

      // Step 3: Process data in batches
      await sendProgress(35, 100, `Starting ${operation} processing in batches...`);
      
      const results: any[] = [];
      const batches = Math.ceil(dataset.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, dataset.length);
        const batch = dataset.slice(batchStart, batchEnd);
        
        const batchProgress = 35 + Math.floor((batchIndex / batches) * 50);
        await sendProgress(batchProgress, 100, `Processing batch ${batchIndex + 1}/${batches} (${batch.length} records)`);
        
        // Simulate processing with different operations
        let batchResult;
        switch (operation) {
          case 'aggregate':
            batchResult = {
              batchIndex: batchIndex + 1,
              recordCount: batch.length,
              totalValue: batch.reduce((sum, r) => sum + (r.value || 0), 0),
              avgScore: batch.reduce((sum, r) => sum + (r.score || 0), 0) / batch.length,
              categories: [...new Set(batch.map(r => r.category))],
            };
            break;
            
          case 'transform':
            batchResult = {
              batchIndex: batchIndex + 1,
              transformedRecords: batch.map(r => ({
                ...r,
                normalizedValue: (r.value || 0) / 1000,
                scoreGrade: (r.score || 0) >= 80 ? 'A' : (r.score || 0) >= 60 ? 'B' : 'C',
              })),
            };
            break;
            
          case 'filter':
            const filtered = batch.filter(r => (r.score || 0) > 50);
            batchResult = {
              batchIndex: batchIndex + 1,
              originalCount: batch.length,
              filteredCount: filtered.length,
              filteredRecords: filtered.slice(0, 5), // Sample
            };
            break;
            
          case 'sort':
            const sorted = [...batch].sort((a, b) => (b.value || 0) - (a.value || 0));
            batchResult = {
              batchIndex: batchIndex + 1,
              recordCount: sorted.length,
              topRecords: sorted.slice(0, 3),
              bottomRecords: sorted.slice(-3),
            };
            break;
            
          case 'analyze':
            batchResult = {
              batchIndex: batchIndex + 1,
              statistics: {
                count: batch.length,
                avgValue: batch.reduce((sum, r) => sum + (r.value || 0), 0) / batch.length,
                avgScore: batch.reduce((sum, r) => sum + (r.score || 0), 0) / batch.length,
                valueRange: {
                  min: Math.min(...batch.map(r => r.value || 0)),
                  max: Math.max(...batch.map(r => r.value || 0)),
                },
                regionDistribution: batch.reduce((acc, r) => {
                  acc[r.region || 'unknown'] = (acc[r.region || 'unknown'] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
              },
            };
            break;
        }
        
        results.push(batchResult);
        
        // Small delay to make progress visible
        if (progressToken) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      await sendProgress(85, 100, 'Processing complete, generating report...');

      // Step 4: Generate final summary
      const processingTime = Math.max(1, Math.floor(recordCount * 0.001)); // Simulated time

      await sendProgress(95, 100, 'Finalizing results...');

      // Clean up progress token
      if (progressToken) {
        activeProgressTokens.delete(progressToken);
      }

      await sendProgress(100, 100, 'Processing complete!');

      // Generate detailed report
      const reportText = `# Large Dataset Processing Results

**Operation**: ${operation}
**Records Processed**: ${recordCount.toLocaleString()}
**Batch Size**: ${batchSize}
**Total Batches**: ${batches}
**Validation**: ${includeValidation ? 'Enabled' : 'Disabled'}
**Processing Time**: ~${processingTime}s

## Operation Summary
${operation === 'aggregate' ? `
**Total Value Sum**: ${results.reduce((sum, b) => sum + (b.totalValue || 0), 0).toLocaleString()}
**Average Score**: ${(results.reduce((sum, b) => sum + (b.avgScore || 0), 0) / results.length).toFixed(2)}
**Unique Categories**: ${[...new Set(results.flatMap(b => b.categories || []))].join(', ')}
` : ''}
${operation === 'filter' ? `
**Original Records**: ${results.reduce((sum, b) => sum + (b.originalCount || 0), 0)}
**Filtered Records**: ${results.reduce((sum, b) => sum + (b.filteredCount || 0), 0)}
**Filter Rate**: ${((results.reduce((sum, b) => sum + (b.filteredCount || 0), 0) / recordCount) * 100).toFixed(1)}%
` : ''}
${operation === 'analyze' ? `
**Overall Statistics**:
- Average Value: ${(results.reduce((sum, b) => sum + (b.statistics?.avgValue || 0), 0) / results.length).toFixed(2)}
- Average Score: ${(results.reduce((sum, b) => sum + (b.statistics?.avgScore || 0), 0) / results.length).toFixed(2)}
` : ''}

## Batch Results (First 3)
${results.slice(0, 3).map((batch, i) => 
  `### Batch ${i + 1}\n${JSON.stringify(batch, null, 2)}`
).join('\n\n')}

${progressToken ? '\n*This processing used MCP progress notifications*' : ''}
*Processing completed at: ${new Date().toLocaleString()}*`;

      return {
        content: [
          {
            type: 'text',
            text: reportText,
          },
        ],
        metadata: {
          operation,
          recordsProcessed: recordCount,
          batchesProcessed: batches,
          batchSize,
          validationIncluded: includeValidation,
          processingDuration: `${processingTime}s`,
          progressNotificationsUsed: !!progressToken,
          resultsGenerated: results.length,
        },
      };

    } catch (error) {
      logger.error('Large dataset processing failed', error);
      
      // Clean up progress token on error
      const progressToken = extra?._meta?.progressToken;
      if (progressToken && activeProgressTokens.has(progressToken)) {
        activeProgressTokens.delete(progressToken);
      }
      
      return createErrorResponse(error, 'Large dataset processing failed');
    }
  }
);

// Register resources
server.registerResource(
  'sample_datasets',
  'analytics://datasets/samples',
  {
    title: 'Sample Datasets',
    description: 'Access to pre-generated sample datasets for testing',
  },
  async () => {
    logger.info('Providing sample datasets');

    try {
      const salesData = generateSampleData(50).map(item => ({
        ...item,
        type: 'sales',
        revenue: item.value * 10,
      }));

      const userMetrics = generateSampleData(30).map(item => ({
        userId: item.id,
        sessions: Math.floor(Math.random() * 20) + 1,
        pageViews: Math.floor(Math.random() * 100) + 10,
        bounceRate: Math.random(),
        conversionRate: Math.random() * 0.1,
        date: item.date,
      }));

      const content = `# Sample Datasets

## Sales Data (50 records)
\`\`\`json
${JSON.stringify(salesData.slice(0, 3), null, 2)}
\`\`\`

## User Metrics (30 records)  
\`\`\`json
${JSON.stringify(userMetrics.slice(0, 3), null, 2)}
\`\`\`

Use the generate_sample_data tool to create custom datasets with specific parameters.`;

      return {
        contents: [
          {
            uri: 'analytics://datasets/samples',
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      };
    } catch (error) {
      logger.error('Sample datasets generation failed', error);
      throw new Error(`Failed to generate sample datasets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// Register resources
server.registerResource(
  'datasets_catalog',
  'analytics://datasets/catalog',
  {
    title: 'Datasets Catalog',
    description: 'Catalog of available datasets for analysis',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching datasets catalog');
    
    const catalog = {
      timestamp: new Date().toISOString(),
      totalDatasets: 8,
      categories: ['sales', 'marketing', 'finance', 'operations'],
      datasets: [
        {
          id: 'sales-2024-q1',
          name: 'Sales Data Q1 2024',
          category: 'sales',
          size: '2.3MB',
          records: 15420,
          columns: ['date', 'product_id', 'customer_id', 'amount', 'region'],
          lastUpdated: '2024-03-31T23:59:59Z',
          format: 'CSV',
          description: 'Comprehensive sales transactions for Q1 2024'
        },
        {
          id: 'marketing-campaigns-2024',
          name: 'Marketing Campaigns 2024',
          category: 'marketing',
          size: '1.8MB',
          records: 8340,
          columns: ['campaign_id', 'start_date', 'end_date', 'budget', 'impressions', 'clicks', 'conversions'],
          lastUpdated: '2024-09-15T12:00:00Z',
          format: 'JSON',
          description: 'Marketing campaign performance metrics'
        },
        {
          id: 'financial-statements-2024',
          name: 'Financial Statements 2024',
          category: 'finance',
          size: '945KB',
          records: 2840,
          columns: ['date', 'account', 'debit', 'credit', 'balance', 'department'],
          lastUpdated: '2024-09-01T09:00:00Z',
          format: 'CSV',
          description: 'Monthly financial statements and account balances'
        },
        {
          id: 'operations-metrics-2024',
          name: 'Operations Metrics 2024',
          category: 'operations',
          size: '3.1MB',
          records: 22150,
          columns: ['timestamp', 'service', 'response_time', 'status_code', 'user_count'],
          lastUpdated: '2024-09-27T06:00:00Z',
          format: 'CSV',
          description: 'Real-time operations and performance metrics'
        }
      ]
    };

    return {
      contents: [
        {
          uri: 'analytics://datasets/catalog',
          mimeType: 'application/json',
          text: JSON.stringify(catalog, null, 2)
        }
      ]
    };
  }
);

server.registerResource(
  'recent_reports',
  'analytics://reports/recent',
  {
    title: 'Recent Reports',
    description: 'Recently generated analysis reports and insights',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching recent analysis reports');
    
    const reports = {
      timestamp: new Date().toISOString(),
      totalReports: 12,
      reports: [
        {
          id: 'rpt-001',
          title: 'Q3 Sales Performance Analysis',
          type: 'sales_analysis',
          generatedAt: '2024-09-26T14:30:00Z',
          dataset: 'sales-2024-q3',
          summary: {
            totalRevenue: 2840000,
            growthRate: 12.5,
            topRegion: 'North America',
            trendsIdentified: ['Seasonal uptick in October', 'Product A showing strong growth']
          },
          insights: [
            'Revenue increased 12.5% compared to Q2',
            'North America leads with 45% of total sales',
            'Mobile sales channel grew 28% quarter-over-quarter'
          ],
          recommendations: [
            'Increase inventory for high-performing products',
            'Expand marketing efforts in Asia-Pacific region',
            'Optimize mobile user experience'
          ]
        },
        {
          id: 'rpt-002',
          title: 'Marketing Campaign ROI Analysis',
          type: 'marketing_analysis',
          generatedAt: '2024-09-25T10:15:00Z',
          dataset: 'marketing-campaigns-2024',
          summary: {
            totalSpend: 450000,
            totalRevenue: 1280000,
            overallROI: 2.84,
            bestPerformingCampaign: 'Summer Sale 2024'
          },
          insights: [
            'Email campaigns show highest ROI at 4.2x',
            'Social media campaigns have best engagement rates',
            'Retargeting campaigns convert 3x better than cold outreach'
          ]
        },
        {
          id: 'rpt-003',
          title: 'Operational Efficiency Metrics',
          type: 'operations_analysis',
          generatedAt: '2024-09-24T16:45:00Z',
          dataset: 'operations-metrics-2024',
          summary: {
            avgResponseTime: 245,
            uptime: 99.7,
            peakUsers: 12400,
            issuesResolved: 156
          },
          insights: [
            'Response times improved 15% over last month',
            'Peak usage occurs between 2-4 PM EST',
            'Database optimization reduced query times by 30%'
          ]
        }
      ]
    };

    return {
      contents: [
        {
          uri: 'analytics://reports/recent',
          mimeType: 'application/json',
          text: JSON.stringify(reports, null, 2)
        }
      ]
    };
  }
);

server.registerResource(
  'saved_dashboards',
  'analytics://dashboards/saved',
  {
    title: 'Saved Dashboards',
    description: 'Saved analytics dashboards and visualizations',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching saved dashboards');
    
    const dashboards = {
      timestamp: new Date().toISOString(),
      totalDashboards: 6,
      dashboards: [
        {
          id: 'dash-executive-overview',
          name: 'Executive Overview',
          category: 'executive',
          createdAt: '2024-08-15T09:00:00Z',
          lastViewedAt: '2024-09-27T08:30:00Z',
          widgets: [
            {
              type: 'kpi_card',
              title: 'Total Revenue',
              value: '$8.4M',
              change: '+12.5%',
              period: 'vs last quarter'
            },
            {
              type: 'line_chart',
              title: 'Revenue Trend',
              timeframe: 'last_12_months',
              dataPoints: 12
            },
            {
              type: 'pie_chart',
              title: 'Revenue by Region',
              segments: ['North America', 'Europe', 'Asia-Pacific', 'Other']
            },
            {
              type: 'bar_chart',
              title: 'Top Products',
              categories: 5,
              metric: 'revenue'
            }
          ],
          sharing: {
            isPublic: false,
            sharedWith: ['executives', 'finance_team'],
            permissions: ['view']
          }
        },
        {
          id: 'dash-marketing-performance',
          name: 'Marketing Performance',
          category: 'marketing',
          createdAt: '2024-09-01T14:20:00Z',
          lastViewedAt: '2024-09-26T16:45:00Z',
          widgets: [
            {
              type: 'funnel_chart',
              title: 'Conversion Funnel',
              stages: ['Impressions', 'Clicks', 'Leads', 'Customers'],
              conversionRates: [100, 3.2, 15.8, 23.4]
            },
            {
              type: 'heatmap',
              title: 'Campaign Performance Matrix',
              dimensions: ['Channel', 'Audience Segment'],
              metric: 'ROI'
            },
            {
              type: 'gauge_chart',
              title: 'Customer Acquisition Cost',
              value: 142,
              target: 120,
              unit: 'USD'
            }
          ]
        },
        {
          id: 'dash-operations-monitoring',
          name: 'Operations Monitoring',
          category: 'operations',
          createdAt: '2024-07-10T11:30:00Z',
          lastViewedAt: '2024-09-27T07:15:00Z',
          widgets: [
            {
              type: 'time_series',
              title: 'System Response Times',
              timeframe: 'last_24_hours',
              refreshRate: '5_minutes'
            },
            {
              type: 'status_grid',
              title: 'Service Health',
              services: ['API Gateway', 'Database', 'Cache', 'CDN'],
              statuses: ['healthy', 'healthy', 'warning', 'healthy']
            },
            {
              type: 'number_tile',
              title: 'Active Users',
              value: 8420,
              change: '+5.2%',
              changeType: 'increase'
            }
          ]
        }
      ]
    };

    return {
      contents: [
        {
          uri: 'analytics://dashboards/saved',
          mimeType: 'application/json',
          text: JSON.stringify(dashboards, null, 2)
        }
      ]
    };
  }
);

// Register prompts
server.registerPrompt(
  'data_analysis_workflow',
  {
    title: 'Data Analysis Workflow',
    description: 'Guide through comprehensive data analysis process',
    argsSchema: {
      dataSource: z.string().describe('Path to data file or description of data'),
      analysisType: z.enum(['exploratory', 'statistical', 'trend', 'comparative'])
        .describe('Type of analysis to perform'),
      questions: z.string().optional().describe('Specific questions to investigate'),
    },
  },
  async ({ dataSource, analysisType, questions }: { dataSource: string, analysisType: string, questions?: string }) => {
    logger.info('Generating data analysis workflow', { dataSource, analysisType, questions });

    const workflows = {
      exploratory: 'data exploration and summary statistics',
      statistical: 'hypothesis testing and statistical inference',
      trend: 'time series analysis and trend identification',
      comparative: 'comparative analysis between groups or periods',
    };

    const workflow = workflows[analysisType as keyof typeof workflows];
    const additionalQuestions = questions ? `\n\nSpecific questions to investigate:\n${questions}` : '';

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please perform a comprehensive ${workflow} on the data from ${dataSource}.${additionalQuestions}

Please follow this structured approach:

1. **Data Loading & Validation**
   - Load the data using appropriate tools
   - Check data quality and completeness
   - Identify any missing values or anomalies

2. **Exploratory Data Analysis**
   - Generate summary statistics for key variables
   - Identify data types and distributions
   - Look for patterns and outliers

3. **${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis**
   - Apply relevant analytical techniques
   - Calculate appropriate metrics and tests
   - Generate visualizations if applicable

4. **Insights & Recommendations**
   - Summarize key findings
   - Provide actionable insights
   - Suggest next steps or further analysis

Start by examining the data structure and quality, then proceed with the analysis.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'visualization_request',
  {
    title: 'Visualization Design Assistant',
    description: 'Design effective data visualizations based on data characteristics and audience needs',
    argsSchema: {
      dataDescription: z.string().describe('Description of the data to be visualized'),
      audience: z.enum(['technical', 'business', 'general', 'academic'])
        .describe('Target audience for the visualization'),
      purpose: z.enum(['exploration', 'presentation', 'dashboard', 'report'])
        .describe('Purpose of the visualization'),
      dataSize: z.enum(['small', 'medium', 'large']).optional()
        .describe('Approximate size of the dataset'),
      constraints: z.string().optional()
        .describe('Any constraints or requirements (e.g., tools, colors, format)'),
    },
  },
  async ({ dataDescription, audience, purpose, dataSize, constraints }) => {
    logger.info('Generating visualization request prompt', { dataDescription, audience, purpose });

    const audienceGuidance = {
      technical: 'detailed, precise, and can include complex statistical visualizations',
      business: 'clear, actionable insights with executive-friendly charts',
      general: 'simple, intuitive visualizations that are easy to understand',
      academic: 'rigorous, publication-quality with appropriate statistical representations',
    };

    const purposeGuidance = {
      exploration: 'interactive charts that allow drilling down and discovering patterns',
      presentation: 'clear, compelling visuals that tell a story effectively',
      dashboard: 'real-time, at-a-glance metrics with key performance indicators',
      report: 'comprehensive, professional charts suitable for documentation',
    };

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I need help designing effective data visualizations for the following scenario:

**Data Description**: ${dataDescription}
**Target Audience**: ${audience} - ${audienceGuidance[audience]}
**Purpose**: ${purpose} - ${purposeGuidance[purpose]}
${dataSize ? `**Data Size**: ${dataSize}` : ''}
${constraints ? `**Constraints**: ${constraints}` : ''}

Please help me design appropriate visualizations by addressing these key areas:

## 1. Data Analysis & Understanding
- What are the key characteristics of this data?
- What types of variables are we dealing with (categorical, numerical, temporal)?
- What relationships or patterns should we highlight?
- Are there any data quality considerations for visualization?

## 2. Visualization Strategy
Based on the ${purpose} purpose and ${audience} audience:

### Primary Visualization Recommendations
- What are the 2-3 most effective chart types for this data?
- Why are these chart types optimal for this scenario?
- What specific insights will each visualization reveal?

### Visual Design Considerations
- Color schemes appropriate for ${audience} audience
- Layout and composition suggestions
- Typography and labeling guidelines
- Interactive elements (if applicable for ${purpose})

## 3. Implementation Guidance
${constraints ? `
**Given your constraints (${constraints}):**
- Recommended tools and technologies
- How to work within the specified limitations
- Alternative approaches if needed` : `
**Tool Recommendations:**
- Suggested visualization libraries or tools
- Implementation approach (code-based vs. GUI tools)
- Platform considerations (web, print, mobile)`}

## 4. Best Practices for ${audience.charAt(0).toUpperCase() + audience.slice(1)} Audience
- Specific design principles for this audience
- Common pitfalls to avoid
- How to ensure accessibility and clarity
- Appropriate level of detail and complexity

## 5. Quality Assurance
- How to validate the visualization effectiveness?
- What questions should the visualization answer?
- How to test with the target audience?
- Iteration and improvement strategies

## 6. Delivery & Presentation
For ${purpose} purposes:
- Optimal format and resolution
- Distribution methods
- Supporting documentation needed
- Maintenance and update procedures

Please provide specific, actionable recommendations including examples where helpful.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'performance_review',
  {
    title: 'Analytics Performance Review',
    description: 'Comprehensive review of analytics performance, data quality, and system efficiency',
    argsSchema: {
      systemType: z.enum(['dashboard', 'reports', 'etl', 'database', 'api'])
        .describe('Type of analytics system to review'),
      timeframe: z.enum(['daily', 'weekly', 'monthly', 'quarterly'])
        .describe('Performance review timeframe'),
      primaryConcerns: z.string().optional()
        .describe('Specific performance concerns or issues'),
      stakeholders: z.enum(['technical', 'business', 'mixed'])
        .describe('Primary stakeholders for this review'),
    },
  },
  async ({ systemType, timeframe, primaryConcerns, stakeholders }) => {
    logger.info('Generating performance review prompt', { systemType, timeframe, stakeholders });

    const systemFocus = {
      dashboard: 'user experience, load times, data freshness, and interactive performance',
      reports: 'generation time, accuracy, delivery reliability, and resource consumption',
      etl: 'data pipeline efficiency, error rates, processing times, and data quality',
      database: 'query performance, storage efficiency, backup/recovery, and scalability',
      api: 'response times, throughput, error rates, and availability metrics',
    };

    const stakeholderFocus = {
      technical: 'detailed technical metrics, root cause analysis, and optimization recommendations',
      business: 'business impact assessment, SLA compliance, and cost-benefit analysis',
      mixed: 'balanced technical details with business context and actionable insights',
    };

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please conduct a comprehensive ${timeframe} performance review for our ${systemType} analytics system.

**Review Scope**: ${systemType} - focusing on ${systemFocus[systemType]}
**Timeframe**: ${timeframe} review period
**Stakeholder Focus**: ${stakeholders} - ${stakeholderFocus[stakeholders]}
${primaryConcerns ? `**Primary Concerns**: ${primaryConcerns}` : ''}

Please structure your performance review to cover the following areas:

## 1. Executive Summary
- Overall system health and performance status
- Key achievements and improvements this ${timeframe}
- Critical issues requiring immediate attention
- High-level recommendations

## 2. Performance Metrics Analysis
### Core Performance Indicators
${systemType === 'dashboard' ? `
- Average page load times and response rates
- User engagement metrics and session duration
- Data refresh rates and real-time performance
- Concurrent user capacity and peak usage handling` : ''}
${systemType === 'reports' ? `
- Report generation times and success rates
- Data accuracy and completeness metrics
- Delivery reliability and schedule adherence
- Resource utilization during report processing` : ''}
${systemType === 'etl' ? `
- Data processing throughput and batch completion times
- Error rates and data quality metrics
- Resource consumption and cost efficiency
- Pipeline reliability and failure recovery` : ''}
${systemType === 'database' ? `
- Query response times and throughput metrics
- Storage utilization and growth trends
- Index performance and optimization status
- Backup and recovery performance` : ''}
${systemType === 'api' ? `
- Response time percentiles (P50, P95, P99)
- Request volume and throughput metrics
- Error rates and availability statistics
- Rate limiting and throttling effectiveness` : ''}

### Trend Analysis
- Performance trends over the ${timeframe} period
- Comparison with previous periods
- Seasonal or cyclical patterns identified
- Capacity planning implications

## 3. Data Quality Assessment
- Data accuracy and consistency metrics
- Missing or incomplete data analysis
- Data freshness and timeliness evaluation
- Data lineage and validation checks

## 4. System Reliability & Availability
- Uptime and availability statistics
- Incident analysis and resolution times
- System resilience and failure handling
- Disaster recovery and business continuity status

## 5. Resource Utilization & Costs
- Compute and storage resource consumption
- Cost analysis and optimization opportunities
- Scalability assessment and capacity planning
- Infrastructure efficiency metrics

## 6. User Experience & Adoption
${stakeholders === 'business' || stakeholders === 'mixed' ? `
- User satisfaction and feedback analysis
- Adoption rates and usage patterns
- Training needs and support requirements
- Feature utilization and enhancement requests` : `
- System usability and technical user feedback
- API usage patterns and integration health
- Developer experience and documentation quality
- Technical debt and maintenance burden`}

## 7. Security & Compliance
- Access control and permission management
- Data security and privacy compliance
- Audit trail completeness and accuracy
- Vulnerability assessment and mitigation status

## 8. Recommendations & Action Plan
### Immediate Actions (Next 30 days)
- Critical issues requiring urgent attention
- Quick wins and low-effort improvements
- Resource allocation recommendations

### Medium-term Improvements (1-3 months)
- Performance optimization initiatives
- System upgrades and enhancements
- Process improvements and automation

### Long-term Strategic Initiatives (3+ months)
- Architecture improvements and modernization
- Capacity expansion and scaling strategies
- Technology refresh and migration planning

## 9. Success Metrics & KPIs
- Key performance indicators to monitor
- Success criteria for improvement initiatives
- Reporting schedule and review frequency
- Escalation procedures for critical issues

${primaryConcerns ? `
## 10. Specific Concern Analysis
**Addressing: ${primaryConcerns}**
- Root cause analysis
- Impact assessment
- Remediation plan
- Prevention strategies` : ''}

Please provide specific, data-driven insights and actionable recommendations for each section.`,
          },
        },
      ],
    };
  }
);

// Helper functions (commented out for demo)
/*
function analyzeDataset(data: Array<Record<string, any>>, columns?: string[]): any {
  if (data.length === 0) {
    throw new Error('Dataset is empty');
  }

  const allColumns = Object.keys(data[0] || {});
  const targetColumns = columns || allColumns;
  
  const analysis: any = {
    overview: {
      totalRecords: data.length,
      totalColumns: allColumns.length,
      analyzedColumns: targetColumns.length,
    },
    columns: {},
  };

  for (const column of targetColumns) {
    if (!allColumns.includes(column)) {
      continue;
    }

    const values = data.map(row => row[column]).filter(v => v != null);
    const nonNullCount = values.length;
    const nullCount = data.length - nonNullCount;
    
    const columnAnalysis: any = {
      nullCount,
      nonNullCount,
      nullPercentage: (nullCount / data.length) * 100,
    };

    // Check if column is numeric
    const numericValues = values.filter(v => !isNaN(Number(v))).map(Number);
    
    if (numericValues.length > 0 && numericValues.length === values.length) {
      // Numeric column
      columnAnalysis.type = 'numeric';
      columnAnalysis.min = d3.min(numericValues);
      columnAnalysis.max = d3.max(numericValues);
      columnAnalysis.mean = d3.mean(numericValues);
      columnAnalysis.median = d3.median(numericValues);
      columnAnalysis.standardDeviation = d3.deviation(numericValues);
    } else {
      // Categorical column
      columnAnalysis.type = 'categorical';
      const frequency = d3.rollup(values, v => v.length, d => d);
      columnAnalysis.uniqueValues = frequency.size;
      columnAnalysis.topValues = Array.from(frequency.entries())
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([value, count]) => ({ value, count, percentage: ((count as number) / nonNullCount) * 100 }));
    }

    analysis.columns[column] = columnAnalysis;
  }

  return analysis;
}

}

function formatAnalysisReport(analysis: any): string {
  let report = `## Dataset Overview
- **Total Records**: ${analysis.overview.totalRecords}
- **Total Columns**: ${analysis.overview.totalColumns}
- **Analyzed Columns**: ${analysis.overview.analyzedColumns}

## Column Analysis

`;

  for (const [columnName, columnData] of Object.entries(analysis.columns) as Array<[string, any]>) {
    report += `### ${columnName} (${columnData.type})\n`;
    report += `- **Non-null values**: ${columnData.nonNullCount} (${(100 - columnData.nullPercentage).toFixed(1)}%)\n`;
    
    if (columnData.nullCount > 0) {
      report += `- **Null values**: ${columnData.nullCount} (${columnData.nullPercentage.toFixed(1)}%)\n`;
    }

    if (columnData.type === 'numeric') {
      report += `- **Min**: ${columnData.min}\n`;
      report += `- **Max**: ${columnData.max}\n`;
      report += `- **Mean**: ${columnData.mean?.toFixed(4)}\n`;
      report += `- **Median**: ${columnData.median}\n`;
      report += `- **Std Dev**: ${columnData.standardDeviation?.toFixed(4)}\n`;
    } else {
      report += `- **Unique values**: ${columnData.uniqueValues}\n`;
      if (columnData.topValues?.length > 0) {
        report += `- **Top values**:\n`;
        for (const item of columnData.topValues) {
          report += `  - ${item.value}: ${item.count} (${item.percentage.toFixed(1)}%)\n`;
        }
      }
    }
    
    report += '\n';
  }

  return report;
}
*/

  /**
   * Register completion handler for tool arguments
   * 
   * NOTE: Commented out temporarily as custom request handlers require proper
   * schema definitions. In production, you would define a proper Zod schema
   * for the completion request.
   */
  /*
  (baseServer as any).setRequestHandler(
    'completion/complete',
    async (request: any) => {
      const { ref } = request.params;
      logger.info('Handling completion request', { ref });

      // Handle tool argument completions
      if (ref.type === 'ref/tool') {
        const toolName = ref.name;
        const argumentName = request.params.argument?.name;
        
        logger.info(`Providing completion for tool: ${toolName}, argument: ${argumentName}`);

        switch (toolName) {
          case 'analyze_csv':
            if (argumentName === 'analysisType') {
              return {
                completion: {
                  values: [
                    { value: 'summary', description: 'Basic statistical summary' },
                    { value: 'correlation', description: 'Correlation analysis' },
                    { value: 'distribution', description: 'Distribution analysis' },
                    { value: 'trends', description: 'Trend analysis' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;

          case 'generate_sample_data':
            if (argumentName === 'dataType') {
              return {
                completion: {
                  values: [
                    { value: 'sales', description: 'Sales transaction data' },
                    { value: 'timeseries', description: 'Time series data' },
                    { value: 'survey', description: 'Survey response data' },
                    { value: 'financial', description: 'Financial metrics data' },
                    { value: 'demographic', description: 'Demographic data' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;

          case 'calculate_statistics':
            if (argumentName === 'operation') {
              return {
                completion: {
                  values: [
                    { value: 'mean', description: 'Calculate mean/average' },
                    { value: 'median', description: 'Calculate median' },
                    { value: 'mode', description: 'Calculate mode' },
                    { value: 'std', description: 'Calculate standard deviation' },
                    { value: 'var', description: 'Calculate variance' },
                    { value: 'min', description: 'Find minimum value' },
                    { value: 'max', description: 'Find maximum value' },
                    { value: 'sum', description: 'Calculate sum' },
                    { value: 'count', description: 'Count values' },
                    { value: 'percentile', description: 'Calculate percentile' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;

          case 'export_data':
            if (argumentName === 'format') {
              return {
                completion: {
                  values: [
                    { value: 'csv', description: 'Comma-separated values' },
                    { value: 'json', description: 'JavaScript Object Notation' },
                    { value: 'excel', description: 'Microsoft Excel format' },
                    { value: 'parquet', description: 'Apache Parquet format' },
                    { value: 'html', description: 'HTML table format' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;

          case 'process_large_dataset':
            if (argumentName === 'operation') {
              return {
                completion: {
                  values: [
                    { value: 'aggregate', description: 'Aggregate data by groups' },
                    { value: 'filter', description: 'Filter data by conditions' },
                    { value: 'transform', description: 'Transform columns' },
                    { value: 'join', description: 'Join with other datasets' },
                    { value: 'pivot', description: 'Pivot table operations' },
                    { value: 'sample', description: 'Sample dataset' },
                  ],
                  hasMore: false,
                },
              };
            }
            break;
        }
      }

      // Default empty completion if no specific suggestions
      return {
        completion: {
          values: [],
          hasMore: false,
        },
      };
    }
  );
  */

  return { mcpServer: server, baseServer };
}

// Store transports by session ID for HTTP mode
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

async function startStdioServer() {
  logger.info('Starting MCP Analytics Server (stdio mode)');

  try {
    const { mcpServer } = createMCPServer();
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    
    logger.info('Analytics Server connected and ready (stdio)');
    
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
  logger.info(`Starting MCP Analytics Server (HTTP mode on port ${port})`);

  const app = express();
  app.use(express.json());
  
  // Configure CORS
  app.use(cors({
    origin: '*',
    exposedHeaders: ['Mcp-Session-Id']
  }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'analytics-server', version: '1.0.0' });
  });

  // Server info endpoint
  app.get('/', (_req, res) => {
    res.json({
      server: 'analytics-server',
      version: '1.0.0',
      description: 'MCP Analytics Server',
      endpoints: ['/health', '/mcp', '/sse'],
      protocol: 'MCP 2025-03-26',
      capabilities: ['tools', 'resources', 'prompts', 'sampling', 'elicitation']
    });
  });

  // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-03-26)
  app.all('/mcp', async (req, res) => {
    logger.info(`Received ${req.method} request to /mcp`);
    
    try {
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        const existingTransport = transports[sessionId];
        if (existingTransport instanceof StreamableHTTPServerTransport) {
          transport = existingTransport;
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: Session exists but uses a different transport protocol' },
            id: null,
          });
          return;
        }
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            logger.info(`StreamableHTTP session initialized with ID: ${sessionId}`);
            transports[sessionId] = transport;
          }
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            logger.info(`Transport closed for session ${sid}, removing from transports map`);
            delete transports[sid];
          }
        };

        const { mcpServer } = createMCPServer();
        await mcpServer.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // Start the server
  app.listen(port, (error?: Error) => {
    if (error) {
      logger.error('Failed to start HTTP server:', error);
      process.exit(1);
    }
    
    logger.info(`Analytics HTTP Server listening on port ${port}`);
    console.log(`
==============================================
MCP ANALYTICS SERVER

Transport: HTTP/SSE
Port: ${port}

Available Tools:
- analyze_csv: Analyze CSV file and provide insights
- generate_sample_data: Generate sample dataset
- calculate_statistics: Calculate statistical measures

Available Resources:
- analytics://datasets/samples: Sample datasets

Available Prompts:
- data_analysis_workflow: Data analysis workflow guide
==============================================
`);
  });

  // Handle server shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down HTTP server...');
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