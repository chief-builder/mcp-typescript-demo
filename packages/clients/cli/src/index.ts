#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface ServerConfig {
  name: string;
  command: string;
  description?: string;
}

// Default server configurations
const DEFAULT_SERVERS: Record<string, ServerConfig> = {
  'dev-tools': {
    name: 'Development Tools',
    command: 'node ../../../packages/servers/dev-tools/dist/index.js',
    description: 'Code formatting, file management, and development utilities',
  },
  'analytics': {
    name: 'Data Analytics',
    command: 'node ../../../packages/servers/analytics/dist/index.js',
    description: 'Data analysis, statistics, and sample data generation',
  },
  'cloud-ops': {
    name: 'Cloud Operations',
    command: 'node ../../../packages/servers/cloud-ops/dist/index.js',
    description: 'Infrastructure monitoring and deployment management',
  },
  'knowledge': {
    name: 'Knowledge Base',
    command: 'node ../../../packages/servers/knowledge/dist/index.js',
    description: 'Document storage, search, and knowledge management',
  },
};

class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private serverProcess: any = null;
  private currentServer: string | null = null;

  async connect(serverKey: string): Promise<void> {
    const serverConfig = DEFAULT_SERVERS[serverKey];
    if (!serverConfig) {
      throw new Error(`Unknown server: ${serverKey}`);
    }

    const spinner = ora(`Connecting to ${serverConfig.name}...`).start();

    try {
      // Parse command and arguments
      const [command, ...args] = serverConfig.command.split(' ');
      if (!command) {
        throw new Error('Invalid server command');
      }
      
      // Create transport
      this.transport = new StdioClientTransport({
        command,
        args,
      });

      // Create client
      this.client = new Client({
        name: 'mcp-cli',
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      // Connect
      await this.client.connect(this.transport);
      this.currentServer = serverKey;

      spinner.succeed(`Connected to ${serverConfig.name}`);
    } catch (error) {
      spinner.fail(`Failed to connect to ${serverConfig.name}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      this.transport = null;
    }
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.currentServer = null;
  }

  async listTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora('Fetching tools...').start();

    try {
      const response = await this.client.listTools();
      spinner.stop();

      if (!response.tools || response.tools.length === 0) {
        console.log(chalk.yellow('No tools available on this server.'));
        return;
      }

      console.log(chalk.blue.bold('\\nAvailable Tools:'));
      
      const tableData = [
        ['Name', 'Description'],
        ...response.tools.map(tool => [
          chalk.green(tool.name),
          tool.description || 'No description',
        ]),
      ];

      console.log(table(tableData));
    } catch (error) {
      spinner.fail('Failed to fetch tools');
      throw error;
    }
  }

  async listResources(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora('Fetching resources...').start();

    try {
      const response = await this.client.listResources();
      spinner.stop();

      if (!response.resources || response.resources.length === 0) {
        console.log(chalk.yellow('No resources available on this server.'));
        return;
      }

      console.log(chalk.blue.bold('\\nAvailable Resources:'));
      
      const tableData = [
        ['Name', 'URI', 'Description'],
        ...response.resources.map(resource => [
          chalk.green(resource.name || 'Unnamed'),
          chalk.cyan(resource.uri),
          resource.description || 'No description',
        ]),
      ];

      console.log(table(tableData));
    } catch (error) {
      spinner.fail('Failed to fetch resources');
      throw error;
    }
  }

  async listPrompts(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora('Fetching prompts...').start();

    try {
      const response = await this.client.listPrompts();
      spinner.stop();

      if (!response.prompts || response.prompts.length === 0) {
        console.log(chalk.yellow('No prompts available on this server.'));
        return;
      }

      console.log(chalk.blue.bold('\\nAvailable Prompts:'));
      
      const tableData = [
        ['Name', 'Description'],
        ...response.prompts.map(prompt => [
          chalk.green(prompt.name),
          prompt.description || 'No description',
        ]),
      ];

      console.log(table(tableData));
    } catch (error) {
      spinner.fail('Failed to fetch prompts');
      throw error;
    }
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora(`Calling tool: ${toolName}...`).start();

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      spinner.stop();

      console.log(chalk.blue.bold(`\\nTool Result: ${toolName}`));
      
      if (response.content && Array.isArray(response.content)) {
        for (const item of response.content) {
          if (item.type === 'text') {
            console.log(item.text);
          }
        }
      }

      if (response.isError) {
        console.log(chalk.red('⚠️  Tool execution resulted in an error'));
      }
    } catch (error) {
      spinner.fail(`Failed to call tool: ${toolName}`);
      throw error;
    }
  }

  async readResource(uri: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora(`Reading resource: ${uri}...`).start();

    try {
      const response = await this.client.readResource({ uri });
      spinner.stop();

      console.log(chalk.blue.bold(`\\nResource: ${uri}`));
      
      if (response.contents) {
        for (const content of response.contents) {
          console.log('\\n' + '='.repeat(50));
          if (content.text) {
            console.log(content.text);
          } else if (content.blob) {
            console.log(chalk.gray('Binary content (blob)'));
          }
        }
      }
    } catch (error) {
      spinner.fail(`Failed to read resource: ${uri}`);
      throw error;
    }
  }

  async getPrompt(promptName: string, args: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to any server');
    }

    const spinner = ora(`Getting prompt: ${promptName}...`).start();

    try {
      const response = await this.client.getPrompt({
        name: promptName,
        arguments: args,
      });

      spinner.stop();

      console.log(chalk.blue.bold(`\\nPrompt: ${promptName}`));
      
      if (response.messages) {
        for (const message of response.messages) {
          console.log('\\n' + '='.repeat(50));
          console.log(chalk.magenta.bold(`Role: ${message.role}`));
          if (message.content.type === 'text') {
            console.log(message.content.text);
          }
        }
      }
    } catch (error) {
      spinner.fail(`Failed to get prompt: ${promptName}`);
      throw error;
    }
  }

  getCurrentServer(): string | null {
    return this.currentServer;
  }
}

const mcpClient = new MCPClient();

// Interactive mode
async function interactiveMode(): Promise<void> {
  console.log(chalk.blue.bold('MCP CLI - Interactive Mode'));
  console.log(chalk.gray('Type "help" for available commands or "exit" to quit.\\n'));

  while (true) {
    try {
      const currentServer = mcpClient.getCurrentServer();
      const serverStatus = currentServer 
        ? chalk.green(`[${DEFAULT_SERVERS[currentServer]?.name || 'Unknown'}]`)
        : chalk.red('[Not Connected]');

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: `${serverStatus} What would you like to do?`,
          choices: [
            { name: 'Connect to Server', value: 'connect' },
            { name: 'List Tools', value: 'tools', disabled: !mcpClient.getCurrentServer() },
            { name: 'List Resources', value: 'resources', disabled: !mcpClient.getCurrentServer() },
            { name: 'List Prompts', value: 'prompts', disabled: !mcpClient.getCurrentServer() },
            { name: 'Call Tool', value: 'call-tool', disabled: !mcpClient.getCurrentServer() },
            { name: 'Read Resource', value: 'read-resource', disabled: !mcpClient.getCurrentServer() },
            { name: 'Get Prompt', value: 'get-prompt', disabled: !mcpClient.getCurrentServer() },
            { name: 'Disconnect', value: 'disconnect', disabled: !mcpClient.getCurrentServer() },
            { name: 'Exit', value: 'exit' },
          ],
        },
      ]);

      switch (action) {
        case 'connect':
          await handleConnect();
          break;
        case 'tools':
          await mcpClient.listTools();
          break;
        case 'resources':
          await mcpClient.listResources();
          break;
        case 'prompts':
          await mcpClient.listPrompts();
          break;
        case 'call-tool':
          await handleCallTool();
          break;
        case 'read-resource':
          await handleReadResource();
          break;
        case 'get-prompt':
          await handleGetPrompt();
          break;
        case 'disconnect':
          await mcpClient.disconnect();
          console.log(chalk.green('Disconnected from server'));
          break;
        case 'exit':
          await mcpClient.disconnect();
          console.log(chalk.blue('Goodbye!'));
          process.exit(0);
      }

      console.log(''); // Add spacing
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      console.log(''); // Add spacing
    }
  }
}

async function handleConnect(): Promise<void> {
  const { server } = await inquirer.prompt([
    {
      type: 'list',
      name: 'server',
      message: 'Select a server to connect to:',
      choices: Object.entries(DEFAULT_SERVERS).map(([key, config]) => ({
        name: `${config.name} - ${config.description}`,
        value: key,
      })),
    },
  ]);

  await mcpClient.connect(server);
}

async function handleCallTool(): Promise<void> {
  if (!mcpClient['client']) {
    console.log(chalk.yellow('Not connected to any server'));
    return;
  }
  
  const toolsResponse = await mcpClient['client'].listTools();
  
  if (!toolsResponse.tools || toolsResponse.tools.length === 0) {
    console.log(chalk.yellow('No tools available'));
    return;
  }

  const { toolName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'toolName',
      message: 'Select a tool to call:',
      choices: toolsResponse.tools.map(tool => ({
        name: `${tool.name} - ${tool.description || 'No description'}`,
        value: tool.name,
      })),
    },
  ]);

  const { argsJson } = await inquirer.prompt([
    {
      type: 'input',
      name: 'argsJson',
      message: 'Enter tool arguments (JSON format, or press Enter for empty):',
      default: '{}',
    },
  ]);

  try {
    const args = JSON.parse(argsJson);
    await mcpClient.callTool(toolName, args);
  } catch (error) {
    console.error(chalk.red('Invalid JSON arguments:'), error);
  }
}

async function handleReadResource(): Promise<void> {
  if (!mcpClient['client']) {
    console.log(chalk.yellow('Not connected to any server'));
    return;
  }
  
  const resourcesResponse = await mcpClient['client'].listResources();
  
  if (!resourcesResponse.resources || resourcesResponse.resources.length === 0) {
    console.log(chalk.yellow('No resources available'));
    return;
  }

  const { uri } = await inquirer.prompt([
    {
      type: 'list',
      name: 'uri',
      message: 'Select a resource to read:',
      choices: resourcesResponse.resources.map(resource => ({
        name: `${resource.name || 'Unnamed'} (${resource.uri})`,
        value: resource.uri,
      })),
    },
  ]);

  await mcpClient.readResource(uri);
}

async function handleGetPrompt(): Promise<void> {
  if (!mcpClient['client']) {
    console.log(chalk.yellow('Not connected to any server'));
    return;
  }
  
  const promptsResponse = await mcpClient['client'].listPrompts();
  
  if (!promptsResponse.prompts || promptsResponse.prompts.length === 0) {
    console.log(chalk.yellow('No prompts available'));
    return;
  }

  const { promptName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'promptName',
      message: 'Select a prompt to get:',
      choices: promptsResponse.prompts.map(prompt => ({
        name: `${prompt.name} - ${prompt.description || 'No description'}`,
        value: prompt.name,
      })),
    },
  ]);

  const { argsJson } = await inquirer.prompt([
    {
      type: 'input',
      name: 'argsJson',
      message: 'Enter prompt arguments (JSON format, or press Enter for empty):',
      default: '{}',
    },
  ]);

  try {
    const args = JSON.parse(argsJson);
    await mcpClient.getPrompt(promptName, args);
  } catch (error) {
    console.error(chalk.red('Invalid JSON arguments:'), error);
  }
}

// CLI Program
const program = new Command();

program
  .name('mcp-cli')
  .description('Command-line client for Model Context Protocol servers')
  .version('1.0.0');

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(interactiveMode);

program
  .command('connect <server>')
  .description('Connect to a specific server')
  .action(async (server: string) => {
    try {
      await mcpClient.connect(server);
      console.log(chalk.green(`Connected to ${DEFAULT_SERVERS[server]?.name || server}`));
    } catch (error) {
      console.error(chalk.red('Connection failed:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('list-servers')
  .description('List available servers')
  .action(() => {
    console.log(chalk.blue.bold('Available Servers:'));
    
    const tableData = [
      ['Key', 'Name', 'Description'],
      ...Object.entries(DEFAULT_SERVERS).map(([key, config]) => [
        chalk.green(key),
        config.name,
        config.description || 'No description',
      ]),
    ];

    console.log(table(tableData));
  });

program
  .command('tools [server]')
  .description('List tools from a server')
  .action(async (server?: string) => {
    try {
      if (server) {
        await mcpClient.connect(server);
      }
      await mcpClient.listTools();
      if (server) {
        await mcpClient.disconnect();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('call <server> <tool> [args]')
  .description('Call a tool on a server')
  .action(async (server: string, tool: string, args: string = '{}') => {
    try {
      await mcpClient.connect(server);
      const parsedArgs = JSON.parse(args);
      await mcpClient.callTool(tool, parsedArgs);
      await mcpClient.disconnect();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Default to interactive mode if no command provided
if (process.argv.length === 2) {
  interactiveMode().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
} else {
  program.parse();
}