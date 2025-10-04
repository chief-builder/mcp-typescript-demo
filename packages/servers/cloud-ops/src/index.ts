#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Logger } from '@mcp-demo/core';
import * as cron from 'node-cron';

const logger = new Logger('cloud-ops-server');

// Command line argument parsing
const args = process.argv.slice(2);
const transportArg = args.find(arg => arg.startsWith('--transport='))?.split('=')[1] || 'stdio';
const portArg = args.find(arg => arg.startsWith('--port='))?.split('=')[1];
const port = portArg ? parseInt(portArg, 10) : 3003;

// Create MCP server factory function
// Mock infrastructure data - moved outside function for global access
interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  cpu: number;
  memory: number;
  lastCheck: string;
}

interface DeploymentInfo {
  service: string;
  version: string;
  environment: 'dev' | 'staging' | 'prod';
  status: 'deploying' | 'deployed' | 'failed' | 'rolling-back';
  timestamp: string;
}

// Mock data storage
let mockServices: ServiceStatus[] = [
  { name: 'api-gateway', status: 'healthy', uptime: 99.9, cpu: 45, memory: 62, lastCheck: new Date().toISOString() },
  { name: 'user-service', status: 'healthy', uptime: 99.5, cpu: 32, memory: 48, lastCheck: new Date().toISOString() },
  { name: 'payment-service', status: 'warning', uptime: 98.1, cpu: 78, memory: 85, lastCheck: new Date().toISOString() },
  { name: 'notification-service', status: 'healthy', uptime: 99.8, cpu: 25, memory: 41, lastCheck: new Date().toISOString() },
  { name: 'analytics-service', status: 'critical', uptime: 95.2, cpu: 95, memory: 92, lastCheck: new Date().toISOString() },
];

let mockDeployments: DeploymentInfo[] = [
  { service: 'user-service', version: '2.1.4', environment: 'prod', status: 'deployed', timestamp: new Date(Date.now() - 3600000).toISOString() },
  { service: 'api-gateway', version: '1.8.2', environment: 'staging', status: 'deploying', timestamp: new Date().toISOString() },
];

function createMCPServer(): { mcpServer: McpServer, baseServer: any } {
  const server = new McpServer({
    name: 'cloud-ops-server',
    version: '1.0.0',
  }, {
    capabilities: { 
      logging: {},
      elicitation: {},
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

// Register tools
server.registerTool(
  'check_service_health',
  {
    title: 'Check Service Health',
    description: 'Check the health status of cloud services',
    inputSchema: {
      serviceName: z.string().optional().describe('Specific service to check (optional)'),
      environment: z.enum(['dev', 'staging', 'prod']).optional().describe('Environment to check'),
    },
  },
  async ({ serviceName, environment }: { serviceName?: string, environment?: string }) => {
    logger.info('Checking service health', { serviceName, environment });

    try {
      let services = mockServices;
      
      if (serviceName) {
        services = services.filter(s => s.name.toLowerCase().includes(serviceName.toLowerCase()));
      }

      if (services.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: serviceName ? `Service "${serviceName}" not found` : 'No services found',
            },
          ],
          isError: true,
        };
      }

      const healthReport = services.map(service => {
        const statusEmoji = {
          healthy: '✅',
          warning: '⚠️',
          critical: '🔴',
        }[service.status];

        return `${statusEmoji} **${service.name}**
- Status: ${service.status.toUpperCase()}
- Uptime: ${service.uptime}%
- CPU: ${service.cpu}%
- Memory: ${service.memory}%
- Last Check: ${new Date(service.lastCheck).toLocaleString()}`;
      }).join('\n\n');

      const summary = {
        total: services.length,
        healthy: services.filter(s => s.status === 'healthy').length,
        warning: services.filter(s => s.status === 'warning').length,
        critical: services.filter(s => s.status === 'critical').length,
      };

      return {
        content: [
          {
            type: 'text',
            text: `# Service Health Report\n\n## Summary\n- Total Services: ${summary.total}\n- Healthy: ${summary.healthy}\n- Warning: ${summary.warning}\n- Critical: ${summary.critical}\n\n## Details\n\n${healthReport}`,
          },
        ],
        metadata: {
          summary,
          environment: environment || 'all',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Service health check failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'deploy_service',
  {
    title: 'Deploy Service',
    description: 'Deploy a service to specified environment',
    inputSchema: {
      serviceName: z.string().describe('Name of the service to deploy'),
      version: z.string().describe('Version to deploy'),
      environment: z.enum(['dev', 'staging', 'prod']).describe('Target environment'),
      dryRun: z.boolean().default(false).describe('Perform a dry run without actual deployment'),
    },
  },
  async ({ serviceName, version, environment, dryRun }: { serviceName: string, version: string, environment: string, dryRun: boolean }) => {
    logger.info('Deploying service', { serviceName, version, environment, dryRun });

    try {
      if (dryRun) {
        return {
          content: [
            {
              type: 'text',
              text: `# Dry Run: Deploy ${serviceName} v${version} to ${environment}\n\n✅ Pre-deployment checks passed\n✅ Configuration validated\n✅ Resources available\n\n**This was a dry run - no actual deployment occurred.**`,
            },
          ],
          metadata: {
            serviceName,
            version,
            environment,
            dryRun: true,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Simulate deployment process
      const deployment: DeploymentInfo = {
        service: serviceName,
        version,
        environment: environment as 'dev' | 'staging' | 'prod',
        status: 'deploying',
        timestamp: new Date().toISOString(),
      };

      // Add to mock deployments
      mockDeployments.unshift(deployment);

      // Simulate deployment steps
      const steps = [
        'Validating configuration...',
        'Building deployment package...',
        'Uploading artifacts...',
        'Starting deployment...',
        'Health checks in progress...',
      ];

      const deploymentLog = steps.join('\n✅ ');

      // Update deployment status after simulation
      setTimeout(() => {
        deployment.status = Math.random() > 0.1 ? 'deployed' : 'failed';
      }, 1000);

      return {
        content: [
          {
            type: 'text',
            text: `# Deployment Started: ${serviceName} v${version}\n\n**Environment**: ${environment}\n**Status**: Deploying\n\n## Deployment Log\n✅ ${deploymentLog}\n\n🚀 Deployment initiated successfully!`,
          },
        ],
        metadata: {
          deploymentId: `deploy-${Date.now()}`,
          serviceName,
          version,
          environment,
          timestamp: deployment.timestamp,
        },
      };
    } catch (error) {
      logger.error('Deployment failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'get_system_metrics',
  {
    title: 'Get System Metrics',
    description: 'Retrieve system performance metrics',
    inputSchema: {
      timeRange: z.enum(['5m', '1h', '6h', '24h', '7d']).default('1h').describe('Time range for metrics'),
      metrics: z.array(z.enum(['cpu', 'memory', 'network', 'disk'])).default(['cpu', 'memory']).describe('Metrics to retrieve'),
    },
  },
  async ({ timeRange, metrics }: { timeRange: string, metrics: string[] }) => {
    logger.info('Getting system metrics', { timeRange, metrics });

    try {
      // Generate mock metrics data
      const now = Date.now();
      const intervals = {
        '5m': { count: 5, interval: 60000 },
        '1h': { count: 12, interval: 300000 },
        '6h': { count: 24, interval: 900000 },
        '24h': { count: 24, interval: 3600000 },
        '7d': { count: 7, interval: 86400000 },
      };

      const config = intervals[timeRange as keyof typeof intervals];
      const metricsData: Record<string, Array<{ timestamp: string; value: number }>> = {};

      for (const metric of metrics) {
        metricsData[metric] = [];
        
        for (let i = config.count - 1; i >= 0; i--) {
          const timestamp = new Date(now - (i * config.interval)).toISOString();
          let value: number;
          
          switch (metric) {
            case 'cpu':
              value = Math.random() * 100;
              break;
            case 'memory':
              value = 60 + (Math.random() * 30);
              break;
            case 'network':
              value = Math.random() * 1000;
              break;
            case 'disk':
              value = 40 + (Math.random() * 20);
              break;
            default:
              value = Math.random() * 100;
          }
          
          metricsData[metric].push({ timestamp, value: Math.round(value * 100) / 100 });
        }
      }

      // Format metrics report
      let report = `# System Metrics Report\n\n**Time Range**: ${timeRange}\n**Generated**: ${new Date().toLocaleString()}\n\n`;
      
      for (const [metricName, data] of Object.entries(metricsData)) {
        const latest = data[data.length - 1];
        if (!latest) continue;
        const avg = data.reduce((sum, point) => sum + point.value, 0) / data.length;
        const max = Math.max(...data.map(point => point.value));
        const min = Math.min(...data.map(point => point.value));
        
        report += `## ${metricName.toUpperCase()}\n`;
        report += `- **Current**: ${latest.value}${metricName === 'network' ? ' MB/s' : '%'}\n`;
        report += `- **Average**: ${avg.toFixed(2)}${metricName === 'network' ? ' MB/s' : '%'}\n`;
        report += `- **Peak**: ${max}${metricName === 'network' ? ' MB/s' : '%'}\n`;
        report += `- **Minimum**: ${min}${metricName === 'network' ? ' MB/s' : '%'}\n\n`;
      }

      return {
        content: [
          {
            type: 'text',
            text: report,
          },
        ],
        metadata: {
          timeRange,
          metrics,
          dataPoints: config.count,
          metricsData,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('System metrics retrieval failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Metrics retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'interactive_deployment_planner',
  {
    title: 'Interactive Deployment Planner',
    description: 'Interactive tool for planning and executing deployments with user-guided risk assessment',
    inputSchema: {
      serviceName: z.string().describe('Name of the service to deploy'),
      currentVersion: z.string().optional().describe('Current version of the service'),
    },
  },
  async ({ serviceName, currentVersion }) => {
    logger.info('Starting interactive deployment planning', { serviceName, currentVersion });

    try {
      // First, get deployment configuration from the user
      const deploymentConfig = await baseServer.elicitInput({
        message: `Planning deployment for service: ${serviceName}${currentVersion ? ` (current: ${currentVersion})` : ''}\n\nPlease configure your deployment strategy:`,
        requestedSchema: {
          type: 'object',
          properties: {
            targetVersion: {
              type: 'string',
              title: 'Target Version',
              description: 'Version to deploy (e.g., 2.1.5)'
            },
            targetEnvironment: {
              type: 'string',
              enum: ['dev', 'staging', 'prod'],
              enumNames: ['Development', 'Staging', 'Production'],
              title: 'Target Environment',
              description: 'Environment to deploy to'
            },
            deploymentStrategy: {
              type: 'string',
              enum: ['rolling', 'blue-green', 'canary', 'immediate'],
              enumNames: ['Rolling Update', 'Blue-Green', 'Canary Release', 'Immediate Replacement'],
              title: 'Deployment Strategy',
              description: 'Strategy for rolling out the deployment'
            },
            riskTolerance: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              enumNames: ['Low Risk (extensive validation)', 'Medium Risk (standard validation)', 'High Risk (minimal validation)'],
              title: 'Risk Tolerance',
              description: 'Acceptable risk level for this deployment'
            },
            performDryRun: {
              type: 'boolean',
              title: 'Perform Dry Run First',
              description: 'Execute a dry run before actual deployment',
              default: true
            }
          },
          required: ['targetVersion', 'targetEnvironment', 'deploymentStrategy', 'riskTolerance']
        }
      });

      if (deploymentConfig.action !== 'accept') {
        return {
          content: [
            {
              type: 'text',
              text: `Deployment planning ${deploymentConfig.action}ed by user.`,
            },
          ],
        };
      }

      const config = deploymentConfig.content;

      // Generate deployment plan based on user configuration
      let deploymentPlan = `# Deployment Plan: ${serviceName}\n\n`;
      deploymentPlan += `**Service**: ${serviceName}\n`;
      deploymentPlan += `**Current Version**: ${currentVersion || 'Unknown'}\n`;
      deploymentPlan += `**Target Version**: ${config.targetVersion}\n`;
      deploymentPlan += `**Environment**: ${config.targetEnvironment}\n`;
      deploymentPlan += `**Strategy**: ${config.deploymentStrategy}\n`;
      deploymentPlan += `**Risk Level**: ${config.riskTolerance}\n\n`;

      // Add strategy-specific details
      deploymentPlan += `## Deployment Strategy Details\n\n`;
      switch (config.deploymentStrategy) {
        case 'rolling':
          deploymentPlan += `- **Rolling Update**: Gradually replace instances with new version\n`;
          deploymentPlan += `- **Benefits**: Zero downtime, gradual rollout\n`;
          deploymentPlan += `- **Considerations**: Slower deployment, mixed versions during rollout\n`;
          break;
        case 'blue-green':
          deploymentPlan += `- **Blue-Green**: Deploy to parallel environment, then switch traffic\n`;
          deploymentPlan += `- **Benefits**: Instant rollback, full testing before switch\n`;
          deploymentPlan += `- **Considerations**: Requires double resources, data synchronization\n`;
          break;
        case 'canary':
          deploymentPlan += `- **Canary Release**: Deploy to small subset of instances first\n`;
          deploymentPlan += `- **Benefits**: Early issue detection, gradual traffic increase\n`;
          deploymentPlan += `- **Considerations**: Complex monitoring setup, longer rollout time\n`;
          break;
        case 'immediate':
          deploymentPlan += `- **Immediate Replacement**: Replace all instances at once\n`;
          deploymentPlan += `- **Benefits**: Fast deployment, simple process\n`;
          deploymentPlan += `- **Considerations**: Potential downtime, higher risk\n`;
          break;
      }

      // Risk assessment based on user tolerance
      deploymentPlan += `\n## Risk Assessment\n\n`;
      switch (config.riskTolerance) {
        case 'low':
          deploymentPlan += `- **Pre-deployment Testing**: Full integration tests, performance tests\n`;
          deploymentPlan += `- **Validation Steps**: Database migration testing, dependency checks\n`;
          deploymentPlan += `- **Monitoring**: Enhanced monitoring for 24 hours post-deployment\n`;
          deploymentPlan += `- **Rollback Plan**: Automated rollback triggers configured\n`;
          break;
        case 'medium':
          deploymentPlan += `- **Pre-deployment Testing**: Standard integration tests\n`;
          deploymentPlan += `- **Validation Steps**: Basic health checks, configuration validation\n`;
          deploymentPlan += `- **Monitoring**: Standard monitoring for 8 hours post-deployment\n`;
          deploymentPlan += `- **Rollback Plan**: Manual rollback procedures documented\n`;
          break;
        case 'high':
          deploymentPlan += `- **Pre-deployment Testing**: Smoke tests only\n`;
          deploymentPlan += `- **Validation Steps**: Basic connectivity checks\n`;
          deploymentPlan += `- **Monitoring**: Standard monitoring for 2 hours post-deployment\n`;
          deploymentPlan += `- **Rollback Plan**: Emergency rollback procedures available\n`;
          break;
      }

      // Environment-specific considerations
      deploymentPlan += `\n## Environment Considerations (${config.targetEnvironment})\n\n`;
      switch (config.targetEnvironment) {
        case 'prod':
          deploymentPlan += `- **Maintenance Window**: Consider scheduling during low-traffic period\n`;
          deploymentPlan += `- **Stakeholder Notification**: Notify operations team and stakeholders\n`;
          deploymentPlan += `- **Database Migrations**: Review and test all schema changes\n`;
          deploymentPlan += `- **Monitoring**: Full observability stack activation\n`;
          break;
        case 'staging':
          deploymentPlan += `- **Data Sync**: Ensure staging data is recent and representative\n`;
          deploymentPlan += `- **Test Coverage**: Run full integration test suite\n`;
          deploymentPlan += `- **Performance Testing**: Validate performance under load\n`;
          break;
        case 'dev':
          deploymentPlan += `- **Quick Iteration**: Focus on rapid feedback and testing\n`;
          deploymentPlan += `- **Feature Flags**: Use feature toggles for incomplete features\n`;
          deploymentPlan += `- **Development Tools**: Ensure debugging capabilities are enabled\n`;
          break;
      }

      // Generate action plan
      deploymentPlan += `\n## Action Plan\n\n`;
      deploymentPlan += `1. **Pre-deployment Checks**\n`;
      deploymentPlan += `   - Verify service health status\n`;
      deploymentPlan += `   - Check system resource availability\n`;
      deploymentPlan += `   - Review recent system metrics\n\n`;
      
      if (config.performDryRun) {
        deploymentPlan += `2. **Dry Run Execution**\n`;
        deploymentPlan += `   - Execute deployment dry run\n`;
        deploymentPlan += `   - Validate configuration and resources\n`;
        deploymentPlan += `   - Review dry run results\n\n`;
        deploymentPlan += `3. **Production Deployment**\n`;
      } else {
        deploymentPlan += `2. **Production Deployment**\n`;
      }
      
      deploymentPlan += `   - Execute deployment using ${config.deploymentStrategy} strategy\n`;
      deploymentPlan += `   - Monitor deployment progress\n`;
      deploymentPlan += `   - Validate service health post-deployment\n\n`;
      deploymentPlan += `${config.performDryRun ? '4' : '3'}. **Post-deployment Monitoring**\n`;
      deploymentPlan += `   - Monitor service metrics and logs\n`;
      deploymentPlan += `   - Validate business functionality\n`;
      deploymentPlan += `   - Document deployment results\n`;

      deploymentPlan += `\n## Estimated Timeline\n\n`;
      const baseTime = config.performDryRun ? 45 : 30;
      const strategyMultiplier = {
        'immediate': 1,
        'rolling': 1.5,
        'canary': 2,
        'blue-green': 1.8
      };
      const riskMultiplier = {
        'high': 1,
        'medium': 1.3,
        'low': 1.8
      };
      
      const totalTime = Math.round(baseTime * 
        strategyMultiplier[config.deploymentStrategy as keyof typeof strategyMultiplier] * 
        riskMultiplier[config.riskTolerance as keyof typeof riskMultiplier]
      );
      
      deploymentPlan += `**Estimated Total Time**: ${totalTime} minutes\n`;
      deploymentPlan += `- Includes pre-deployment checks, deployment execution, and initial monitoring\n`;
      deploymentPlan += `- Additional time may be needed for thorough validation\n`;

      return {
        content: [
          {
            type: 'text',
            text: deploymentPlan,
          },
        ],
        metadata: {
          serviceName,
          currentVersion,
          deploymentConfig: config,
          estimatedTimeMinutes: totalTime,
          riskLevel: config.riskTolerance,
          strategy: config.deploymentStrategy,
        },
      };
    } catch (error) {
      logger.error('Interactive deployment planning failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Deployment planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'scale_service',
  {
    title: 'Scale Service',
    description: 'Scale a service up or down based on demand',
    inputSchema: {
      serviceName: z.string().describe('Name of the service to scale'),
      targetInstances: z.number().min(0).describe('Target number of instances'),
      scaleType: z.enum(['horizontal', 'vertical']).optional().describe('Type of scaling'),
      autoScaleConfig: z.object({
        enabled: z.boolean(),
        minInstances: z.number().min(0).optional(),
        maxInstances: z.number().min(1).optional(),
        targetCPU: z.number().min(0).max(100).optional()
      }).optional().describe('Auto-scaling configuration')
    },
  },
  async ({ serviceName, targetInstances, scaleType = 'horizontal', autoScaleConfig }) => {
    logger.info('Scaling service', { serviceName, targetInstances, scaleType });

    try {
      // Find the service
      const service = mockServices.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
      if (!service) {
        return {
          content: [
            {
              type: 'text',
              text: `Service '${serviceName}' not found`,
            },
          ],
          isError: true,
        };
      }

      // Simulate scaling operation
      const currentInstances = Math.floor(Math.random() * 10) + 1;
      const scalingDirection = targetInstances > currentInstances ? 'up' : 'down';
      const instanceDiff = Math.abs(targetInstances - currentInstances);

      let scaleResult = `# Service Scaling Report\n\n`;
      scaleResult += `**Service**: ${serviceName}\n`;
      scaleResult += `**Scale Type**: ${scaleType}\n`;
      scaleResult += `**Current Instances**: ${currentInstances}\n`;
      scaleResult += `**Target Instances**: ${targetInstances}\n`;
      scaleResult += `**Action**: Scaling ${scalingDirection} by ${instanceDiff} instances\n\n`;

      if (scaleType === 'horizontal') {
        scaleResult += `## Horizontal Scaling Details\n\n`;
        scaleResult += `- Adding/removing instances across availability zones\n`;
        scaleResult += `- Load balancer configuration will be updated\n`;
        scaleResult += `- DNS records will be automatically updated\n`;
        scaleResult += `- Estimated time: ${instanceDiff * 2} minutes\n\n`;
      } else {
        scaleResult += `## Vertical Scaling Details\n\n`;
        scaleResult += `- Upgrading instance types for better performance\n`;
        scaleResult += `- Brief downtime expected during instance resize\n`;
        scaleResult += `- Data persistence will be maintained\n`;
        scaleResult += `- Estimated time: ${instanceDiff * 5} minutes\n\n`;
      }

      if (autoScaleConfig?.enabled) {
        scaleResult += `## Auto-Scaling Configuration\n\n`;
        scaleResult += `- **Status**: Enabled\n`;
        scaleResult += `- **Min Instances**: ${autoScaleConfig.minInstances || 1}\n`;
        scaleResult += `- **Max Instances**: ${autoScaleConfig.maxInstances || 10}\n`;
        scaleResult += `- **Target CPU**: ${autoScaleConfig.targetCPU || 70}%\n`;
        scaleResult += `- **Scale-up Threshold**: CPU > ${(autoScaleConfig.targetCPU || 70) + 10}%\n`;
        scaleResult += `- **Scale-down Threshold**: CPU < ${(autoScaleConfig.targetCPU || 70) - 10}%\n\n`;
      }

      scaleResult += `## Scaling Progress\n\n`;
      scaleResult += `- ✅ Pre-scaling health checks completed\n`;
      scaleResult += `- ✅ Resource allocation verified\n`;
      scaleResult += `- 🔄 Scaling operation in progress...\n`;
      scaleResult += `- ⏳ Waiting for instances to become healthy\n`;
      scaleResult += `- ⏳ Load balancer reconfiguration pending\n\n`;

      scaleResult += `## Estimated Costs\n\n`;
      const hourlyCost = scaleType === 'horizontal' ? targetInstances * 0.10 : targetInstances * 0.15;
      scaleResult += `- **Hourly Cost**: $${hourlyCost.toFixed(2)}\n`;
      scaleResult += `- **Monthly Estimate**: $${(hourlyCost * 24 * 30).toFixed(2)}\n`;
      scaleResult += `- **Cost Change**: ${scalingDirection === 'up' ? 'Increase' : 'Decrease'} of $${(instanceDiff * 0.10 * 24 * 30).toFixed(2)}/month\n`;

      return {
        content: [
          {
            type: 'text',
            text: scaleResult,
          },
        ],
        metadata: {
          serviceName,
          currentInstances,
          targetInstances,
          scalingDirection,
          scaleType,
          autoScaleEnabled: autoScaleConfig?.enabled || false,
          estimatedTimeMinutes: instanceDiff * (scaleType === 'horizontal' ? 2 : 5),
        },
      };
    } catch (error) {
      logger.error('Service scaling failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Service scaling failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  'manage_alerts',
  {
    title: 'Manage Alerts',
    description: 'Configure and manage monitoring alerts for services',
    inputSchema: {
      action: z.enum(['create', 'list', 'update', 'delete']).describe('Alert management action'),
      alertConfig: z.object({
        name: z.string().optional(),
        service: z.string().optional(),
        metric: z.enum(['cpu', 'memory', 'latency', 'error_rate', 'custom']).optional(),
        threshold: z.number().optional(),
        condition: z.enum(['greater_than', 'less_than', 'equals']).optional(),
        severity: z.enum(['info', 'warning', 'critical']).optional(),
        notificationChannels: z.array(z.string()).optional()
      }).optional().describe('Alert configuration')
    },
  },
  async ({ action, alertConfig }) => {
    logger.info('Managing alerts', { action, alertConfig });

    try {
      let result = `# Alert Management\n\n`;
      
      switch (action) {
        case 'create':
          if (!alertConfig?.name || !alertConfig?.service || !alertConfig?.metric) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Missing required alert configuration: name, service, and metric are required',
                },
              ],
              isError: true,
            };
          }

          result += `## Creating New Alert\n\n`;
          result += `**Alert Name**: ${alertConfig.name}\n`;
          result += `**Service**: ${alertConfig.service}\n`;
          result += `**Metric**: ${alertConfig.metric}\n`;
          result += `**Threshold**: ${alertConfig.threshold || 80}\n`;
          result += `**Condition**: ${alertConfig.condition || 'greater_than'}\n`;
          result += `**Severity**: ${alertConfig.severity || 'warning'}\n`;
          result += `**Notification Channels**: ${alertConfig.notificationChannels?.join(', ') || 'email, slack'}\n\n`;
          result += `✅ Alert created successfully\n`;
          result += `🔔 Alert is now active and monitoring\n`;
          break;

        case 'list':
          result += `## Active Alerts\n\n`;
          result += `### Service: api-gateway\n`;
          result += `- **High CPU Usage** (cpu > 80%, severity: warning)\n`;
          result += `- **Response Time** (latency > 500ms, severity: info)\n\n`;
          result += `### Service: payment-service\n`;
          result += `- **Memory Usage** (memory > 85%, severity: critical)\n`;
          result += `- **Error Rate** (error_rate > 5%, severity: critical)\n\n`;
          result += `### Service: analytics-service\n`;
          result += `- **Low CPU** (cpu < 10%, severity: info) - Scale down candidate\n\n`;
          result += `Total Active Alerts: 5\n`;
          break;

        case 'update':
          if (!alertConfig?.name) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Alert name is required for update',
                },
              ],
              isError: true,
            };
          }
          
          result += `## Updating Alert\n\n`;
          result += `**Alert**: ${alertConfig.name}\n`;
          result += `**Changes Applied**:\n`;
          if (alertConfig.threshold) result += `- Threshold updated to ${alertConfig.threshold}\n`;
          if (alertConfig.severity) result += `- Severity updated to ${alertConfig.severity}\n`;
          if (alertConfig.notificationChannels) result += `- Notification channels updated to ${alertConfig.notificationChannels.join(', ')}\n`;
          result += `\n✅ Alert updated successfully\n`;
          break;

        case 'delete':
          if (!alertConfig?.name) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Alert name is required for deletion',
                },
              ],
              isError: true,
            };
          }
          
          result += `## Deleting Alert\n\n`;
          result += `**Alert**: ${alertConfig.name}\n`;
          result += `⚠️ This alert will no longer monitor the associated metric\n`;
          result += `✅ Alert deleted successfully\n`;
          break;
      }

      result += `\n## Alert Statistics\n\n`;
      result += `- **Total Alerts Triggered Today**: 12\n`;
      result += `- **Critical Alerts**: 2\n`;
      result += `- **Warning Alerts**: 5\n`;
      result += `- **Info Alerts**: 5\n`;
      result += `- **Average Response Time**: 3.5 minutes\n`;

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
        metadata: {
          action,
          alertConfig,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error('Alert management failed', error);
      return {
        content: [
          {
            type: 'text',
            text: `Alert management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register a tool that demonstrates progress notifications
server.registerTool(
  'deploy_multi_service',
  {
    title: 'Deploy Multiple Services',
    description: 'Deploy multiple services to cloud infrastructure with progress reporting using MCP progress notifications',
    inputSchema: {
      services: z.array(z.string()).min(1).max(10)
        .describe('List of services to deploy'),
      environment: z.enum(['dev', 'staging', 'prod']).default('staging')
        .describe('Target deployment environment'),
      strategy: z.enum(['rolling', 'blue-green', 'canary']).default('rolling')
        .describe('Deployment strategy'),
      enableHealthChecks: z.boolean().default(true)
        .describe('Enable health checks during deployment'),
      timeout: z.number().min(30).max(1800).default(300)
        .describe('Deployment timeout in seconds'),
    },
  },
  async ({ services, environment, strategy, enableHealthChecks, timeout }, extra) => {
    logger.info('Starting multi-service deployment with progress notifications', { 
      services, environment, strategy, enableHealthChecks, timeout 
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

      // Start deployment
      await sendProgress(0, 100, `Starting ${strategy} deployment for ${services.length} services...`);

      // Step 1: Pre-deployment validation
      await sendProgress(5, 100, 'Validating deployment configuration...');
      
      const invalidServices: string[] = [];
      const validServices: string[] = [];
      
      for (const service of services) {
        // Simulate validation
        if (service.length < 3 || service.includes(' ')) {
          invalidServices.push(service);
        } else {
          validServices.push(service);
        }
      }

      if (invalidServices.length > 0) {
        await sendProgress(100, 100, `Validation failed for services: ${invalidServices.join(', ')}`);
        
        // Clean up progress token
        if (progressToken) {
          activeProgressTokens.delete(progressToken);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `# Multi-Service Deployment Failed\n\n**Error**: Invalid service names detected\n**Invalid Services**: ${invalidServices.join(', ')}\n\n**Requirements**:\n- Service names must be at least 3 characters\n- No spaces allowed in service names`,
            },
          ],
          isError: true,
        };
      }

      await sendProgress(10, 100, `Validation complete. ${validServices.length} services ready for deployment`);

      // Step 2: Infrastructure preparation
      await sendProgress(15, 100, 'Preparing infrastructure...');
      
      const infraTasks = [
        'Checking resource capacity',
        'Verifying network configuration',
        'Validating security groups',
        'Ensuring load balancer availability'
      ];

      for (let i = 0; i < infraTasks.length; i++) {
        const taskProgress = 15 + Math.floor((i / infraTasks.length) * 10);
        await sendProgress(taskProgress, 100, infraTasks[i]!);
        // Small delay to simulate work
        if (progressToken) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      await sendProgress(25, 100, 'Infrastructure preparation complete');

      // Step 3: Deploy services one by one
      const deploymentResults: Array<{
        service: string;
        version: string;
        status: 'success' | 'failed' | 'rolled-back';
        duration: number;
        healthCheck?: 'passed' | 'failed';
      }> = [];

      for (let i = 0; i < validServices.length; i++) {
        const service = validServices[i]!;
        const serviceProgress = 25 + Math.floor((i / validServices.length) * 60); // 25% to 85%
        
        await sendProgress(serviceProgress, 100, `Deploying ${service} (${i + 1}/${validServices.length})`);

        // Simulate deployment phases
        const phases = [
          'Building container image',
          'Pushing to registry',
          'Updating service configuration',
          'Rolling out to instances',
          enableHealthChecks ? 'Running health checks' : null
        ].filter(Boolean) as string[];

        let deploymentSuccess = true;
        let healthCheckResult: 'passed' | 'failed' | undefined;
        
        for (let j = 0; j < phases.length; j++) {
          const phaseProgress = serviceProgress + Math.floor((j / phases.length) * (60 / validServices.length));
          await sendProgress(phaseProgress, 100, `${service}: ${phases[j]}`);
          
          // Simulate some deployments failing (10% chance)
          if (Math.random() < 0.1 && phases[j]!.includes('Rolling out')) {
            deploymentSuccess = false;
            await sendProgress(phaseProgress + 1, 100, `${service}: Deployment failed, initiating rollback`);
            break;
          }
          
          // Simulate health check results
          if (phases[j]!.includes('health checks')) {
            healthCheckResult = Math.random() < 0.9 ? 'passed' : 'failed';
            if (healthCheckResult === 'failed') {
              deploymentSuccess = false;
              await sendProgress(phaseProgress + 1, 100, `${service}: Health checks failed, rolling back`);
            }
          }
          
          // Small delay for realistic progress
          if (progressToken) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        const deploymentTime = Math.floor(Math.random() * 120) + 30; // 30-150 seconds
        const version = `${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
        
        deploymentResults.push({
          service,
          version,
          status: deploymentSuccess ? 'success' : (Math.random() < 0.5 ? 'failed' : 'rolled-back'),
          duration: deploymentTime,
          healthCheck: healthCheckResult,
        });

        const endServiceProgress = 25 + Math.floor(((i + 1) / validServices.length) * 60);
        const statusEmoji = deploymentSuccess ? '✅' : '❌';
        await sendProgress(endServiceProgress, 100, `${statusEmoji} ${service} deployment ${deploymentSuccess ? 'completed' : 'failed'}`);
      }

      await sendProgress(85, 100, 'All service deployments completed, running final checks...');

      // Step 4: Post-deployment verification
      await sendProgress(90, 100, 'Running post-deployment verification...');
      
      const successCount = deploymentResults.filter(r => r.status === 'success').length;
      const failedCount = deploymentResults.filter(r => r.status === 'failed').length;
      const rolledBackCount = deploymentResults.filter(r => r.status === 'rolled-back').length;

      await sendProgress(95, 100, 'Generating deployment report...');

      // Clean up progress token
      if (progressToken) {
        activeProgressTokens.delete(progressToken);
      }

      await sendProgress(100, 100, 'Multi-service deployment complete!');

      // Generate detailed report
      const totalTime = Math.max(...deploymentResults.map(r => r.duration));
      const avgTime = deploymentResults.reduce((sum, r) => sum + r.duration, 0) / deploymentResults.length;

      const reportText = `# Multi-Service Deployment Results

**Environment**: ${environment}
**Strategy**: ${strategy}
**Services Deployed**: ${validServices.length}
**Total Duration**: ${totalTime}s
**Average Service Duration**: ${Math.round(avgTime)}s
**Health Checks**: ${enableHealthChecks ? 'Enabled' : 'Disabled'}
**Timeout**: ${timeout}s

## Deployment Summary
- ✅ **Successful**: ${successCount} services
- ❌ **Failed**: ${failedCount} services
- 🔄 **Rolled Back**: ${rolledBackCount} services

## Service Details
${deploymentResults.map(result => {
  const statusEmoji = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '🔄';
  const healthText = result.healthCheck ? ` (Health: ${result.healthCheck === 'passed' ? '✅' : '❌'})` : '';
  return `### ${result.service} v${result.version}
${statusEmoji} Status: ${result.status}
⏱️ Duration: ${result.duration}s${healthText}`;
}).join('\n\n')}

## Infrastructure Impact
- **Load Balancer**: ${strategy === 'blue-green' ? 'Traffic switched to new version' : 'Gradual traffic shift'}
- **Auto-scaling**: ${successCount > 0 ? 'Triggered for successful deployments' : 'No scaling required'}
- **Monitoring**: ${successCount > 0 ? 'New alerting rules deployed' : 'Monitoring unchanged'}

## Next Steps
${failedCount > 0 ? `- **Investigate Failures**: Review logs for ${deploymentResults.filter(r => r.status === 'failed').map(r => r.service).join(', ')}` : ''}
${rolledBackCount > 0 ? `- **Address Rollbacks**: Check rollback reasons for ${deploymentResults.filter(r => r.status === 'rolled-back').map(r => r.service).join(', ')}` : ''}
${successCount > 0 ? `- **Monitor Performance**: Watch metrics for newly deployed services` : ''}
- **Update Documentation**: Record deployment changes and lessons learned

${progressToken ? '\n*This deployment used MCP progress notifications*' : ''}
*Deployment completed at: ${new Date().toLocaleString()}*`;

      return {
        content: [
          {
            type: 'text',
            text: reportText,
          },
        ],
        metadata: {
          environment,
          strategy,
          servicesDeployed: validServices.length,
          successfulDeployments: successCount,
          failedDeployments: failedCount,
          rolledBackDeployments: rolledBackCount,
          totalDuration: totalTime,
          averageDuration: Math.round(avgTime),
          healthChecksEnabled: enableHealthChecks,
          progressNotificationsUsed: !!progressToken,
          deploymentResults,
        },
      };

    } catch (error) {
      logger.error('Multi-service deployment failed', error);
      
      // Clean up progress token on error
      const progressToken = extra?._meta?.progressToken;
      if (progressToken && activeProgressTokens.has(progressToken)) {
        activeProgressTokens.delete(progressToken);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Multi-service deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register resources
server.registerResource(
  'infrastructure_status',
  'cloudops://status/infrastructure',
  {
    title: 'Infrastructure Status',
    description: 'Real-time infrastructure status dashboard',
  },
  async () => {
    logger.info('Providing infrastructure status');

    try {
      const healthyCount = mockServices.filter(s => s.status === 'healthy').length;
      const warningCount = mockServices.filter(s => s.status === 'warning').length;
      const criticalCount = mockServices.filter(s => s.status === 'critical').length;
      
      const recentDeployments = mockDeployments.slice(0, 3);
      
      const statusContent = `# Infrastructure Status Dashboard

## Service Health Overview
- 🟢 **Healthy**: ${healthyCount} services
- 🟡 **Warning**: ${warningCount} services  
- 🔴 **Critical**: ${criticalCount} services

## Recent Deployments
${recentDeployments.map(d => 
  `- **${d.service}** v${d.version} → ${d.environment} (${d.status})`
).join('\n')}

## Quick Actions
- Use \`check_service_health\` tool for detailed health checks
- Use \`deploy_service\` tool for new deployments
- Use \`get_system_metrics\` tool for performance data

*Last updated: ${new Date().toLocaleString()}*`;

      return {
        contents: [
          {
            uri: 'cloudops://status/infrastructure',
            mimeType: 'text/markdown',
            text: statusContent,
          },
        ],
      };
    } catch (error) {
      logger.error('Infrastructure status generation failed', error);
      throw new Error(`Failed to generate infrastructure status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// Register resources
server.registerResource(
  'infrastructure_state',
  'cloudops://infrastructure/state',
  {
    title: 'Infrastructure State',
    description: 'Current infrastructure state and resource allocation',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching infrastructure state');
    
    const infrastructureState = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
      overview: {
        totalServices: 12,
        healthyServices: 10,
        warningServices: 1,
        criticalServices: 1,
        totalInstances: 48,
        runningInstances: 45,
        stoppedInstances: 3
      },
      services: [
        {
          name: 'api-gateway',
          type: 'load_balancer',
          status: 'healthy',
          region: 'us-east-1',
          instances: 3,
          cpu: 45,
          memory: 62,
          network: 'high',
          lastDeployment: '2024-09-20T14:30:00Z',
          version: '2.1.4',
          uptime: 99.9
        },
        {
          name: 'user-service',
          type: 'microservice',
          status: 'healthy',
          region: 'us-east-1',
          instances: 6,
          cpu: 32,
          memory: 48,
          network: 'medium',
          lastDeployment: '2024-09-25T09:15:00Z',
          version: '1.8.2',
          uptime: 99.5
        },
        {
          name: 'payment-service',
          type: 'microservice',
          status: 'warning',
          region: 'us-west-2',
          instances: 4,
          cpu: 78,
          memory: 85,
          network: 'high',
          lastDeployment: '2024-09-15T16:45:00Z',
          version: '3.2.1',
          uptime: 98.1,
          alerts: ['High memory usage', 'Elevated response times']
        },
        {
          name: 'analytics-service',
          type: 'data_processor',
          status: 'critical',
          region: 'eu-west-1',
          instances: 2,
          cpu: 95,
          memory: 92,
          network: 'critical',
          lastDeployment: '2024-09-10T11:20:00Z',
          version: '2.5.0',
          uptime: 95.2,
          alerts: ['High CPU usage', 'Memory leak detected', 'Connection timeouts']
        }
      ],
      infrastructure: {
        databases: [
          {
            name: 'primary-db',
            type: 'postgresql',
            version: '14.9',
            status: 'healthy',
            connections: 45,
            maxConnections: 100,
            diskUsage: 67,
            replicationLag: 0.2
          },
          {
            name: 'cache-cluster',
            type: 'redis',
            version: '7.0',
            status: 'healthy',
            memoryUsage: 34,
            hitRate: 96.8,
            operations: 1240
          }
        ],
        storage: [
          {
            name: 'user-data-bucket',
            type: 's3',
            size: '2.4TB',
            objects: 8420000,
            costMonthly: 245.80
          },
          {
            name: 'backup-storage',
            type: 's3',
            size: '1.8TB',
            objects: 124000,
            costMonthly: 187.50
          }
        ]
      }
    };

    return {
      contents: [
        {
          uri: 'cloudops://infrastructure/state',
          mimeType: 'application/json',
          text: JSON.stringify(infrastructureState, null, 2)
        }
      ]
    };
  }
);

server.registerResource(
  'deployment_history',
  'cloudops://deployments/history',
  {
    title: 'Deployment History',
    description: 'Recent deployment history and release information',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching deployment history');
    
    const deploymentHistory = {
      timestamp: new Date().toISOString(),
      totalDeployments: 156,
      recentDeployments: [
        {
          id: 'deploy-2024092701',
          service: 'user-service',
          version: '1.8.2',
          environment: 'production',
          status: 'completed',
          startTime: '2024-09-27T06:00:00Z',
          endTime: '2024-09-27T06:12:30Z',
          duration: '12m 30s',
          deployedBy: 'alice@company.com',
          strategy: 'blue-green',
          artifacts: [
            'user-service:1.8.2',
            'user-service-db-migrations:1.8.2'
          ],
          rollbackPlan: {
            available: true,
            previousVersion: '1.8.1',
            estimatedTime: '5 minutes'
          },
          healthChecks: {
            passed: 12,
            failed: 0,
            duration: '3m 45s'
          }
        },
        {
          id: 'deploy-2024092602',
          service: 'api-gateway',
          version: '2.1.5',
          environment: 'staging',
          status: 'in_progress',
          startTime: '2024-09-26T18:30:00Z',
          endTime: null,
          duration: '15m (ongoing)',
          deployedBy: 'bob@company.com',
          strategy: 'rolling',
          artifacts: [
            'api-gateway:2.1.5',
            'nginx-config:2.1.5'
          ],
          progress: {
            phase: 'health_checks',
            percentage: 75,
            currentStep: 'Validating response times'
          }
        },
        {
          id: 'deploy-2024092501',
          service: 'payment-service',
          version: '3.2.2',
          environment: 'production',
          status: 'failed',
          startTime: '2024-09-25T14:15:00Z',
          endTime: '2024-09-25T14:28:15Z',
          duration: '13m 15s',
          deployedBy: 'charlie@company.com',
          strategy: 'canary',
          artifacts: [
            'payment-service:3.2.2'
          ],
          error: {
            type: 'health_check_failure',
            message: 'Service failed health checks after deployment',
            details: 'HTTP 500 errors from /health endpoint',
            resolution: 'Automatically rolled back to version 3.2.1'
          },
          rollback: {
            triggered: true,
            completedAt: '2024-09-25T14:35:00Z',
            rollbackVersion: '3.2.1'
          }
        }
      ],
      statistics: {
        successRate: 94.2,
        avgDeploymentTime: '8m 45s',
        totalRollbacks: 9,
        deploymentsThisWeek: 12,
        deploymentsThisMonth: 47
      }
    };

    return {
      contents: [
        {
          uri: 'cloudops://deployments/history',
          mimeType: 'application/json',
          text: JSON.stringify(deploymentHistory, null, 2)
        }
      ]
    };
  }
);

server.registerResource(
  'service_metrics',
  'cloudops://metrics/services',
  {
    title: 'Service Metrics',
    description: 'Real-time service performance metrics and monitoring data',
    mimeType: 'application/json'
  },
  async () => {
    logger.info('Fetching service metrics');
    
    const serviceMetrics = {
      timestamp: new Date().toISOString(),
      timeRange: 'last_24_hours',
      refreshRate: '5_minutes',
      services: [
        {
          name: 'api-gateway',
          metrics: {
            requestsPerSecond: 342.5,
            avgResponseTime: 89,
            p95ResponseTime: 245,
            p99ResponseTime: 580,
            errorRate: 0.12,
            uptime: 99.98,
            throughput: '1.2M requests/day',
            alerts: []
          },
          resources: {
            cpu: { current: 45, avg: 42, max: 67 },
            memory: { current: 62, avg: 58, max: 78 },
            network: { incoming: '45 Mbps', outgoing: '78 Mbps' },
            storage: { used: '12 GB', available: '38 GB' }
          }
        },
        {
          name: 'user-service',
          metrics: {
            requestsPerSecond: 156.8,
            avgResponseTime: 134,
            p95ResponseTime: 320,
            p99ResponseTime: 750,
            errorRate: 0.08,
            uptime: 99.95,
            throughput: '675K requests/day',
            alerts: []
          },
          resources: {
            cpu: { current: 32, avg: 35, max: 58 },
            memory: { current: 48, avg: 45, max: 65 },
            network: { incoming: '28 Mbps', outgoing: '42 Mbps' },
            storage: { used: '8 GB', available: '22 GB' }
          }
        },
        {
          name: 'payment-service',
          metrics: {
            requestsPerSecond: 89.2,
            avgResponseTime: 245,
            p95ResponseTime: 680,
            p99ResponseTime: 1240,
            errorRate: 0.35,
            uptime: 98.12,
            throughput: '385K requests/day',
            alerts: [
              {
                level: 'warning',
                message: 'Response time above threshold',
                since: '2024-09-27T04:30:00Z'
              },
              {
                level: 'warning',
                message: 'Error rate elevated',
                since: '2024-09-27T05:15:00Z'
              }
            ]
          },
          resources: {
            cpu: { current: 78, avg: 72, max: 89 },
            memory: { current: 85, avg: 79, max: 93 },
            network: { incoming: '34 Mbps', outgoing: '56 Mbps' },
            storage: { used: '18 GB', available: '12 GB' }
          }
        }
      ],
      infrastructure: {
        overall: {
          totalRequests: 8240000,
          totalErrors: 12450,
          overallErrorRate: 0.15,
          avgSystemLoad: 52,
          networkUtilization: 67
        },
        costs: {
          daily: 245.80,
          monthly: 7374.00,
          projectedMonthly: 7125.50,
          savings: 248.50
        }
      }
    };

    return {
      contents: [
        {
          uri: 'cloudops://metrics/services',
          mimeType: 'application/json',
          text: JSON.stringify(serviceMetrics, null, 2)
        }
      ]
    };
  }
);

// Register prompts
server.registerPrompt(
  'incident_response',
  {
    title: 'Incident Response',
    description: 'Guide through incident response and troubleshooting',
    argsSchema: {
      severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Incident severity level'),
      serviceName: z.string().optional().describe('Affected service name'),
      symptoms: z.string().describe('Description of observed symptoms'),
    },
  },
  async ({ severity, serviceName, symptoms }: { severity: string, serviceName?: string, symptoms: string }) => {
    logger.info('Generating incident response workflow', { severity, serviceName, symptoms });

    const urgencyLevel = {
      low: 'standard business hours response',
      medium: 'escalate within 2 hours',
      high: 'immediate attention required',
      critical: 'all-hands emergency response',
    };

    const responseLevel = urgencyLevel[severity as keyof typeof urgencyLevel];
    const serviceContext = serviceName ? ` affecting ${serviceName}` : '';

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `We have a ${severity} severity incident${serviceContext} with the following symptoms:

${symptoms}

Please help me respond to this incident following our standard operating procedures. This requires ${responseLevel}.

Please follow this incident response workflow:

1. **Initial Assessment**
   - Check service health using the check_service_health tool
   - Get current system metrics to understand system state
   - Identify scope and impact of the incident

2. **Investigation**
   - Review recent deployments that might be related
   - Analyze system metrics for anomalies
   - Check infrastructure status for related issues

3. **Immediate Actions**
   - Document findings and timeline
   - Implement immediate mitigation if possible
   - Consider rollback if recent deployment is suspected

4. **Communication**
   - Prepare status update for stakeholders
   - Document actions taken and results
   - Plan follow-up monitoring

5. **Resolution & Follow-up**
   - Monitor for stability after actions
   - Schedule post-incident review
   - Update runbooks with lessons learned

Start by assessing the current system state and identifying the root cause.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'deployment_plan',
  {
    title: 'Deployment Strategy Planner',
    description: 'Create comprehensive deployment plans with risk assessment and best practices',
    argsSchema: {
      serviceName: z.string().describe('Name of the service to deploy'),
      targetEnvironment: z.enum(['dev', 'staging', 'prod']).describe('Target deployment environment'),
      currentVersion: z.string().optional().describe('Current version of the service'),
      deploymentType: z.enum(['feature', 'hotfix', 'major', 'rollback']).describe('Type of deployment'),
      urgency: z.enum(['low', 'medium', 'high', 'emergency']).optional().describe('Deployment urgency level'),
    },
  },
  async ({ serviceName, targetEnvironment, currentVersion, deploymentType, urgency }) => {
    logger.info('Generating deployment plan prompt', { serviceName, targetEnvironment, deploymentType, urgency });

    const environmentGuidance = {
      dev: 'flexible development environment with rapid iteration capabilities',
      staging: 'production-like environment for thorough testing and validation',
      prod: 'critical production environment requiring maximum stability and safety',
    };

    const urgencyGuidance = {
      low: 'standard planning timeline with comprehensive testing',
      medium: 'balanced approach with standard safety measures',
      high: 'accelerated timeline while maintaining critical safety checks',
      emergency: 'immediate deployment with minimal viable safety measures',
    };

    const deploymentTypeGuidance = {
      feature: 'new functionality rollout with comprehensive testing',
      hotfix: 'critical bug fix requiring careful validation',
      major: 'significant version upgrade with extensive planning',
      rollback: 'reverting to previous version due to issues',
    };

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `I need to create a comprehensive deployment plan for the following scenario:

**Service**: ${serviceName}
**Target Environment**: ${targetEnvironment} - ${environmentGuidance[targetEnvironment]}
**Deployment Type**: ${deploymentType} - ${deploymentTypeGuidance[deploymentType]}
**Urgency Level**: ${urgency || 'medium'} - ${urgencyGuidance[urgency || 'medium']}
${currentVersion ? `**Current Version**: ${currentVersion}` : ''}

Please help me create a detailed deployment plan that covers:

## 1. Pre-Deployment Assessment
- **Service Health Check**: Current status validation using check_service_health
- **Resource Availability**: System capacity and resource requirements
- **Dependency Analysis**: Service dependencies and integration points
- **Risk Assessment**: Potential risks specific to ${deploymentType} deployments

## 2. Deployment Strategy Selection
Based on ${targetEnvironment} environment and ${urgency || 'medium'} urgency:

### Recommended Strategy
- Which deployment strategy (rolling, blue-green, canary, immediate) is optimal?
- Why is this strategy appropriate for this scenario?
- What are the trade-offs and considerations?

### Timeline & Scheduling
${(urgency || 'medium') === 'emergency' ? `
- **Emergency Procedures**: Immediate deployment considerations
- **Critical Path**: Minimum viable deployment steps
- **Risk Mitigation**: Essential safety measures despite urgency` : ''}
${(urgency || 'medium') === 'high' ? `
- **Accelerated Timeline**: Compressed but safe deployment schedule
- **Priority Testing**: Critical tests that cannot be skipped
- **Monitoring Focus**: Key metrics to watch during rapid deployment` : ''}
${(urgency || 'medium') === 'medium' || (urgency || 'medium') === 'low' ? `
- **Standard Timeline**: Comprehensive deployment schedule
- **Testing Phases**: Full testing and validation pipeline
- **Quality Gates**: All necessary approval and validation steps` : ''}

## 3. Environment-Specific Considerations
For ${targetEnvironment} deployment:

${targetEnvironment === 'prod' ? `
### Production Deployment Requirements
- **Maintenance Windows**: Optimal deployment timing
- **Stakeholder Communication**: Notification and approval processes
- **Data Migrations**: Database and storage considerations
- **Rollback Preparation**: Complete rollback strategy and triggers
- **Monitoring & Alerting**: Full observability setup
- **Performance Validation**: Load testing and performance benchmarks` : ''}

${targetEnvironment === 'staging' ? `
### Staging Deployment Requirements
- **Environment Parity**: Ensuring production-like conditions
- **Test Data Management**: Representative data setup
- **Integration Testing**: Full end-to-end test execution
- **Performance Testing**: Load and stress testing procedures
- **User Acceptance Testing**: Stakeholder validation process` : ''}

${targetEnvironment === 'dev' ? `
### Development Deployment Requirements
- **Feature Flags**: Development-specific feature toggles
- **Debug Configuration**: Development tools and logging
- **Rapid Iteration**: Quick feedback and testing cycles
- **Developer Environment**: Local development considerations` : ''}

## 4. Technical Implementation Plan
### Pre-Deployment Steps
1. **System Validation**:
   - Run system health checks and metrics review
   - Verify infrastructure capacity and dependencies
   - Validate configuration and environment variables

2. **Testing & Validation**:
${deploymentType === 'hotfix' ? `
   - **Hotfix Validation**: Focused testing on bug fix areas
   - **Regression Testing**: Critical path functionality verification
   - **Security Review**: Security implications of the fix` : ''}
${deploymentType === 'feature' ? `
   - **Feature Testing**: Comprehensive feature functionality testing
   - **Integration Testing**: Cross-service integration validation
   - **Performance Testing**: Feature performance impact assessment` : ''}
${deploymentType === 'major' ? `
   - **Migration Testing**: Data and schema migration validation
   - **Compatibility Testing**: Backward/forward compatibility checks
   - **Full Regression Testing**: Comprehensive system testing` : ''}
${deploymentType === 'rollback' ? `
   - **Rollback Validation**: Ensuring rollback safety and completeness
   - **Data Consistency**: Verifying data integrity during rollback
   - **Service Dependencies**: Managing dependent services during rollback` : ''}

### Deployment Execution
3. **Deployment Process**:
   - Execute deployment using recommended strategy
   - Monitor deployment progress and key metrics
   - Validate service health and functionality

4. **Post-Deployment Validation**:
   - Service health verification and performance validation
   - Integration testing with dependent services
   - User acceptance testing (if applicable)

## 5. Risk Management & Contingency
### Risk Mitigation Strategies
- **Automated Rollback**: Conditions and procedures for automatic rollback
- **Manual Intervention**: Escalation procedures and manual override capabilities
- **Communication Plan**: Status updates and stakeholder notification
- **Incident Response**: Procedures for handling deployment issues

### Success Criteria & Monitoring
- **Key Performance Indicators**: Metrics to validate successful deployment
- **Health Checks**: Automated and manual validation procedures
- **Monitoring Duration**: How long to monitor post-deployment
- **Sign-off Process**: Approval and completion verification

## 6. Documentation & Follow-up
- **Deployment Documentation**: Record of changes and procedures
- **Lessons Learned**: Capture insights for future deployments
- **Runbook Updates**: Update operational procedures if needed
- **Post-Deployment Review**: Schedule review meeting if needed

Please provide a detailed, actionable deployment plan based on this framework.`,
          },
        },
      ],
    };
  }
);

server.registerPrompt(
  'infrastructure_audit',
  {
    title: 'Infrastructure Audit Assistant',
    description: 'Comprehensive infrastructure audit covering security, performance, and compliance',
    argsSchema: {
      auditScope: z.enum(['security', 'performance', 'compliance', 'comprehensive'])
        .describe('Primary focus area for the audit'),
      environment: z.enum(['dev', 'staging', 'prod', 'all']).describe('Environment(s) to audit'),
      timeframe: z.enum(['weekly', 'monthly', 'quarterly', 'annual']).describe('Audit timeframe'),
      complianceFramework: z.string().optional()
        .describe('Specific compliance framework (e.g., SOC2, ISO27001, PCI-DSS)'),
    },
  },
  async ({ auditScope, environment, timeframe, complianceFramework }) => {
    logger.info('Generating infrastructure audit prompt', { auditScope, environment, timeframe });

    const scopeGuidance = {
      security: 'security posture, vulnerabilities, access controls, and threat protection',
      performance: 'system performance, resource utilization, scalability, and optimization opportunities',
      compliance: 'regulatory compliance, policy adherence, and audit trail completeness',
      comprehensive: 'all aspects including security, performance, compliance, and operational excellence',
    };

    const environmentGuidance = {
      dev: 'development environment with focus on security practices and resource efficiency',
      staging: 'staging environment ensuring production readiness and testing capabilities',
      prod: 'production environment with emphasis on security, performance, and compliance',
      all: 'all environments with environment-specific considerations and consistency checks',
    };

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please conduct a comprehensive ${timeframe} infrastructure audit focusing on ${scopeGuidance[auditScope]}.

**Audit Scope**: ${auditScope}
**Environment(s)**: ${environment} - ${environmentGuidance[environment]}
**Timeframe**: ${timeframe} review
${complianceFramework ? `**Compliance Framework**: ${complianceFramework}` : ''}

Please structure your audit to cover the following areas systematically:

## 1. Infrastructure Health Assessment

### Current State Analysis
- **Service Health Review**: Use check_service_health to assess all critical services
- **System Metrics Analysis**: Review system performance using get_system_metrics
- **Infrastructure Status**: Evaluate overall infrastructure status and dependencies
- **Resource Utilization**: Analyze compute, storage, and network resource usage

### Environment-Specific Evaluation
${environment === 'all' ? `
**Cross-Environment Analysis**:
- **Environment Consistency**: Configuration and setup consistency across environments
- **Environment Isolation**: Proper separation and access controls between environments
- **Data Flow Security**: Secure data flow and replication between environments
- **Environment-Specific Configurations**: Appropriate settings for each environment type` : `
**${environment.toUpperCase()} Environment Focus**:
${environment === 'prod' ? `
- **Production Readiness**: High availability, disaster recovery, and business continuity
- **Performance Optimization**: Production workload handling and response times
- **Security Hardening**: Production-grade security measures and monitoring
- **Compliance Requirements**: Production-specific regulatory and policy compliance` : ''}
${environment === 'staging' ? `
- **Production Parity**: Similarity to production environment for accurate testing
- **Testing Infrastructure**: Comprehensive testing capabilities and data management
- **Integration Points**: External service integrations and API testing capabilities
- **Performance Testing**: Load testing and performance validation infrastructure` : ''}
${environment === 'dev' ? `
- **Development Efficiency**: Tools and processes supporting developer productivity
- **Security in Development**: Secure coding practices and vulnerability prevention
- **Resource Management**: Efficient use of development resources and cost optimization
- **Development Standards**: Code quality, testing, and deployment standards` : ''}`}

## 2. Security Audit
${auditScope === 'security' || auditScope === 'comprehensive' ? `

### Access Control & Identity Management
- **User Access Review**: Current user permissions and access patterns
- **Service Account Audit**: Service-to-service authentication and authorization
- **Privileged Access Management**: Administrative and elevated access controls
- **Multi-Factor Authentication**: MFA implementation and coverage

### Network Security
- **Network Segmentation**: Proper isolation and micro-segmentation
- **Firewall Configuration**: Ingress and egress rules review
- **VPN and Remote Access**: Secure remote connectivity assessment
- **Network Monitoring**: Traffic analysis and anomaly detection

### Data Security
- **Data Encryption**: At-rest and in-transit encryption implementation
- **Data Classification**: Proper data handling and protection measures
- **Backup Security**: Backup encryption and access controls
- **Data Retention**: Compliance with data retention policies

### Vulnerability Management
- **Security Patching**: Current patch levels and update procedures
- **Vulnerability Scanning**: Regular security assessment practices
- **Penetration Testing**: External security testing and remediation
- **Security Monitoring**: SIEM, logging, and incident detection capabilities` : `
**Security Overview**: Basic security posture assessment including access controls, encryption, and monitoring capabilities.`}

## 3. Performance & Capacity Audit
${auditScope === 'performance' || auditScope === 'comprehensive' ? `

### Performance Metrics Analysis
- **Response Time Analysis**: Application and service response times
- **Throughput Assessment**: System capacity and load handling
- **Resource Utilization**: CPU, memory, storage, and network utilization
- **Database Performance**: Query performance and optimization opportunities

### Scalability Assessment
- **Auto-scaling Configuration**: Current scaling policies and triggers
- **Capacity Planning**: Future growth projections and resource requirements
- **Load Balancing**: Traffic distribution and failover capabilities
- **Bottleneck Identification**: Performance constraints and optimization targets

### Infrastructure Optimization
- **Cost Optimization**: Resource rightsizing and cost efficiency opportunities
- **Architecture Review**: Infrastructure design and modernization opportunities
- **Technology Stack Assessment**: Current technologies and upgrade recommendations
- **Performance Monitoring**: Observability and performance tracking capabilities` : `
**Performance Overview**: Basic performance metrics assessment including response times, resource utilization, and capacity planning.`}

## 4. Compliance & Governance Audit
${auditScope === 'compliance' || auditScope === 'comprehensive' ? `

### Regulatory Compliance
${complianceFramework ? `
**${complianceFramework} Compliance Assessment**:
- **Framework Requirements**: Specific ${complianceFramework} control implementation
- **Evidence Collection**: Documentation and proof of compliance measures
- **Gap Analysis**: Areas requiring attention for full compliance
- **Remediation Planning**: Action plan for addressing compliance gaps` : `
**General Compliance Assessment**:
- **Industry Standards**: Relevant regulatory requirements for your industry
- **Data Protection**: GDPR, CCPA, and other data privacy regulation compliance
- **Security Standards**: ISO 27001, SOC 2, and other security framework alignment
- **Audit Trail**: Comprehensive logging and audit trail capabilities`}

### Policy & Procedure Compliance
- **Corporate Policies**: Adherence to internal IT and security policies
- **Change Management**: Proper change control and approval processes
- **Documentation Standards**: Current documentation and maintenance practices
- **Training & Awareness**: Security and compliance training programs

### Risk Management
- **Risk Assessment**: Current risk identification and mitigation strategies
- **Business Continuity**: Disaster recovery and business continuity planning
- **Insurance Coverage**: Cyber insurance and risk transfer mechanisms
- **Third-Party Risk**: Vendor and partner risk assessment and management` : `
**Compliance Overview**: Basic compliance posture assessment including policy adherence, audit trails, and risk management practices.`}

## 5. Operational Excellence Review

### Monitoring & Alerting
- **Monitoring Coverage**: Comprehensive monitoring of all critical systems
- **Alert Configuration**: Appropriate alerting thresholds and escalation procedures
- **Dashboard Effectiveness**: Operational dashboards and reporting capabilities
- **Incident Response**: Current incident response procedures and effectiveness

### Automation & Efficiency
- **Deployment Automation**: CI/CD pipeline effectiveness and automation level
- **Infrastructure as Code**: IaC implementation and configuration management
- **Operational Automation**: Routine task automation and efficiency improvements
- **Documentation Quality**: Runbooks, procedures, and knowledge management

### Backup & Recovery
- **Backup Strategies**: Current backup coverage and retention policies
- **Recovery Testing**: Regular disaster recovery testing and validation
- **RTO/RPO Compliance**: Meeting recovery time and point objectives
- **Business Continuity**: Overall business continuity planning and testing

## 6. Recommendations & Action Plan

### Immediate Actions (Next 30 days)
- **Critical Issues**: High-priority security or performance issues requiring immediate attention
- **Quick Wins**: Low-effort, high-impact improvements
- **Risk Mitigation**: Urgent risk remediation activities

### Short-term Improvements (1-3 months)
- **Security Enhancements**: Planned security improvements and implementations
- **Performance Optimizations**: System performance improvements and optimizations
- **Compliance Gaps**: Addressing identified compliance deficiencies

### Long-term Strategic Initiatives (3+ months)
- **Architecture Modernization**: Infrastructure modernization and technology upgrades
- **Capacity Expansion**: Planned capacity increases and scaling improvements
- **Process Improvements**: Operational process enhancements and automation

### Success Metrics & Monitoring
- **Key Performance Indicators**: Metrics to track improvement progress
- **Regular Review Schedule**: Ongoing monitoring and review procedures
- **Compliance Monitoring**: Continuous compliance assessment and reporting

Please provide a comprehensive audit assessment with specific findings, recommendations, and actionable next steps for each area.`,
          },
        },
      ],
    };
  }
);

  return { mcpServer: server, baseServer };
}

// Store transports by session ID for HTTP mode
const transports: Record<string, StreamableHTTPServerTransport> = {};

async function startStdioServer() {
  logger.info('Starting MCP Cloud Operations Server (stdio mode)');

  try {
    const { mcpServer } = createMCPServer();
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    
    logger.info('Cloud Operations Server connected and ready (stdio)');
    
    // Start background monitoring (mock)
    cron.schedule('*/30 * * * * *', () => {
      // Simulate service status updates
      mockServices.forEach((service: ServiceStatus) => {
        service.lastCheck = new Date().toISOString();
        // Randomly update metrics
        service.cpu = Math.max(0, Math.min(100, service.cpu + (Math.random() - 0.5) * 10));
        service.memory = Math.max(0, Math.min(100, service.memory + (Math.random() - 0.5) * 5));
        
        // Occasional status changes
        if (Math.random() > 0.95) {
          const statuses: Array<'healthy' | 'warning' | 'critical'> = ['healthy', 'warning', 'critical'];
          const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
          if (newStatus) {
            service.status = newStatus;
          }
        }
      });
    });
    
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
  logger.info(`Starting MCP Cloud Operations Server (HTTP mode on port ${port})`);

  const app = express();
  app.use(express.json());
  
  // Configure CORS
  app.use(cors({
    origin: '*',
    exposedHeaders: ['Mcp-Session-Id']
  }));

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'cloud-ops-server', version: '1.0.0' });
  });

  // STREAMABLE HTTP TRANSPORT (PROTOCOL VERSION 2025-06-18)
  app.all('/mcp', async (req, res) => {
    logger.info(`Received ${req.method} request to /mcp`);
    
    try {
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
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
    
    logger.info(`Cloud Operations HTTP Server listening on port ${port}`);
    console.log(`
==============================================
MCP CLOUD OPERATIONS SERVER

Transport: HTTP
Port: ${port}

Available Tools:
- check_service_health: Monitor service health and metrics
- deploy_service: Deploy application services
- scale_service: Scale service instances
- get_system_metrics: Retrieve system performance metrics

Available Resources:
- cloud://infrastructure/status: Infrastructure overview
- cloud://deployments/history: Deployment history

Available Prompts:
- deployment_plan: Create deployment strategy
- incident_response: Guide incident response procedures
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