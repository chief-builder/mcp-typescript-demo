import * as vscode from 'vscode';
import { MCPServersTreeProvider } from './views/serversTreeView';
import { MCPCapabilitiesTreeProvider } from './views/capabilitiesTreeView';
import { MCPServerManager } from './utils/serverManager';

let serverManager: MCPServerManager;
let serversTreeProvider: MCPServersTreeProvider;
let capabilitiesTreeProvider: MCPCapabilitiesTreeProvider;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('MCP Demo Extension is now active!');
    
    try {
        // Create output channel for logging
        console.log('Creating output channel...');
        outputChannel = vscode.window.createOutputChannel('MCP Demo Extension');
        console.log('Output channel created');
        outputChannel.appendLine('MCP Demo Extension activated');
        outputChannel.show();
        console.log('Output channel shown');
    } catch (error) {
        console.error('Failed to create output channel:', error);
        vscode.window.showErrorMessage(`Failed to create output channel: ${error}`);
    }

    // Initialize server manager
    try {
        console.log('Creating MCPServerManager...');
        if (outputChannel) {
            outputChannel.appendLine('Creating MCPServerManager...');
        }
        serverManager = new MCPServerManager(outputChannel);
        console.log('MCPServerManager created successfully');
        if (outputChannel) {
            outputChannel.appendLine('MCPServerManager created successfully');
        }
    } catch (error) {
        console.error('Failed to create MCPServerManager:', error);
        if (outputChannel) {
            outputChannel.appendLine(`Failed to create MCPServerManager: ${error}`);
        }
        vscode.window.showErrorMessage(`Failed to create MCPServerManager: ${error}`);
        return; // Don't continue if server manager fails
    }

    // Initialize tree view providers
    serversTreeProvider = new MCPServersTreeProvider(serverManager);
    capabilitiesTreeProvider = new MCPCapabilitiesTreeProvider(serverManager);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('mcp-demo.servers', serversTreeProvider);
    vscode.window.registerTreeDataProvider('mcp-demo.capabilities', capabilitiesTreeProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-demo.connectServer', async (serverId?: string) => {
            if (!serverId) {
                // Show quick pick to select server
                const servers = serverManager.getAllServers();
                const items = servers
                    .filter(s => !s.connected)
                    .map(s => ({
                        label: s.name,
                        description: s.description,
                        detail: `Transport: ${s.transport} | Port: ${s.port || 'N/A'}`,
                        serverId: s.id
                    }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select an MCP server to connect to'
                });

                if (!selected) return;
                serverId = selected.serverId;
            }

            try {
                console.log('Extension: Attempting to connect to server:', serverId);
                outputChannel.appendLine(`Attempting to connect to server: ${serverId}`);
                
                await serverManager.connectServer(serverId);
                
                outputChannel.appendLine(`Successfully connected to: ${serverId}`);
                vscode.window.showInformationMessage(`Connected to MCP server: ${serverId}`);
                serversTreeProvider.refresh();
                capabilitiesTreeProvider.refresh();
                vscode.commands.executeCommand('setContext', 'mcp-demo.hasActiveServer', true);
            } catch (error) {
                console.error('Extension: Connection error:', error);
                outputChannel.appendLine(`Connection error: ${error}`);
                outputChannel.appendLine(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
                vscode.window.showErrorMessage(`Failed to connect: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-demo.disconnectServer', async (serverId?: string) => {
            if (!serverId) {
                const servers = serverManager.getAllServers();
                const items = servers
                    .filter(s => s.connected)
                    .map(s => ({
                        label: s.name,
                        description: 'Connected',
                        serverId: s.id
                    }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select an MCP server to disconnect from'
                });

                if (!selected) return;
                serverId = selected.serverId;
            }

            try {
                await serverManager.disconnectServer(serverId);
                vscode.window.showInformationMessage(`Disconnected from MCP server: ${serverId}`);
                serversTreeProvider.refresh();
                capabilitiesTreeProvider.refresh();
                
                // Check if any servers are still connected
                const hasActiveServer = serverManager.getAllServers().some(s => s.connected);
                vscode.commands.executeCommand('setContext', 'mcp-demo.hasActiveServer', hasActiveServer);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to disconnect: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-demo.showServerCapabilities', async (serverId?: string) => {
            if (!serverId) {
                const servers = serverManager.getAllServers();
                const items = servers
                    .filter(s => s.connected)
                    .map(s => ({
                        label: s.name,
                        description: 'Connected',
                        serverId: s.id
                    }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select an MCP server to view capabilities'
                });

                if (!selected) return;
                serverId = selected.serverId;
            }

            const capabilities = await serverManager.getServerCapabilities(serverId);
            if (capabilities) {
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(capabilities, null, 2),
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-demo.executeTool', async (tool?: any) => {
            if (!tool) {
                // Show tool selection UI
                const servers = serverManager.getAllServers().filter(s => s.connected);
                if (servers.length === 0) {
                    vscode.window.showWarningMessage('No MCP servers connected');
                    return;
                }

                // For simplicity, use the first connected server
                const server = servers[0];
                const tools = await serverManager.getServerTools(server.id);
                
                if (!tools || tools.length === 0) {
                    vscode.window.showInformationMessage('No tools available');
                    return;
                }

                const items = tools.map(t => ({
                    label: t.name,
                    description: t.description,
                    tool: t
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a tool to execute'
                });

                if (!selected) return;
                tool = selected.tool;
            }

            // Simple tool execution implementation
            try {
                let args: any = {};
                
                // If tool has input schema, ask for parameters
                if (tool.inputSchema && tool.inputSchema.properties) {
                    const properties = tool.inputSchema.properties;
                    
                    for (const [key, schema] of Object.entries(properties)) {
                        const schemaObj = schema as any;
                        const isRequired = tool.inputSchema.required?.includes(key);
                        
                        const input = await vscode.window.showInputBox({
                            prompt: `Enter value for ${key}${isRequired ? ' (required)' : ''}`,
                            placeHolder: schemaObj.description || `${schemaObj.type} value`,
                            validateInput: (value) => {
                                if (isRequired && !value) {
                                    return `${key} is required`;
                                }
                                return undefined;
                            }
                        });
                        
                        if (input === undefined) {
                            // User cancelled
                            return;
                        }
                        
                        if (input) {
                            // Parse JSON arrays/objects, otherwise use as string
                            if (schemaObj.type === 'array' || schemaObj.type === 'object') {
                                try {
                                    args[key] = JSON.parse(input);
                                } catch {
                                    args[key] = input;
                                }
                            } else if (schemaObj.type === 'number') {
                                args[key] = Number(input);
                            } else if (schemaObj.type === 'boolean') {
                                args[key] = input.toLowerCase() === 'true';
                            } else {
                                args[key] = input;
                            }
                        }
                    }
                }
                
                // Find which server has this tool
                let targetServerId: string | undefined;
                for (const server of serverManager.getAllServers()) {
                    if (server.connected) {
                        const tools = await serverManager.getServerTools(server.id);
                        if (tools.some(t => t.name === tool.name)) {
                            targetServerId = server.id;
                            break;
                        }
                    }
                }
                
                if (!targetServerId) {
                    vscode.window.showErrorMessage('Could not find server for this tool');
                    return;
                }
                
                outputChannel.appendLine(`Executing tool ${tool.name} with args: ${JSON.stringify(args, null, 2)}`);
                outputChannel.show();
                
                const result = await serverManager.executeTool(targetServerId, tool.name, args);
                
                // Display result in a new document
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(result, null, 2),
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
                
                outputChannel.appendLine(`Tool ${tool.name} executed successfully`);
            } catch (error) {
                outputChannel.appendLine(`Error executing tool ${tool.name}: ${error}`);
                vscode.window.showErrorMessage(`Failed to execute tool: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-demo.viewResources', async (serverId?: string) => {
            if (!serverId) {
                const servers = serverManager.getAllServers();
                const items = servers
                    .filter(s => s.connected)
                    .map(s => ({
                        label: s.name,
                        description: 'Connected',
                        serverId: s.id
                    }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select an MCP server to view resources'
                });

                if (!selected) return;
                serverId = selected.serverId;
            }

            const resources = await serverManager.getServerResources(serverId);
            if (resources && resources.length > 0) {
                const doc = await vscode.workspace.openTextDocument({
                    content: JSON.stringify(resources, null, 2),
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc);
            } else {
                vscode.window.showInformationMessage('No resources available');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('mcp-demo.refreshServers', () => {
            serverManager.discoverServers();
            serversTreeProvider.refresh();
            vscode.window.showInformationMessage('MCP servers refreshed');
        })
    );

    // Auto-connect if configured
    const config = vscode.workspace.getConfiguration('mcp-demo');
    if (config.get<boolean>('autoConnect')) {
        serverManager.getAllServers().forEach(server => {
            serverManager.connectServer(server.id).catch(error => {
                console.error(`Failed to auto-connect to ${server.name}:`, error);
            });
        });
    }

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'mcp-demo.showServerCapabilities';
    updateStatusBar(statusBarItem);
    context.subscriptions.push(statusBarItem);

    // Update status bar on server changes
    serverManager.onServerChange(() => {
        updateStatusBar(statusBarItem);
        serversTreeProvider.refresh();
        capabilitiesTreeProvider.refresh();
    });

    statusBarItem.show();

    function updateStatusBar(item: vscode.StatusBarItem) {
        const connectedServers = serverManager.getAllServers().filter(s => s.connected);
        if (connectedServers.length > 0) {
            item.text = `$(server) MCP: ${connectedServers.length} connected`;
            item.tooltip = `Connected to: ${connectedServers.map(s => s.name).join(', ')}`;
        } else {
            item.text = '$(server) MCP: Not connected';
            item.tooltip = 'Click to connect to an MCP server';
        }
    }
}

export function deactivate() {
    // Clean up connections
    if (serverManager) {
        serverManager.dispose();
    }
}