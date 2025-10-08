import * as vscode from 'vscode';
import { MCPServerConfig } from '../config/servers';
import * as path from 'path';

interface MCPRequest {
    jsonrpc: '2.0';
    method: string;
    params?: any;
    id: number;
}

interface MCPResponse {
    jsonrpc: '2.0';
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
    id: number;
}

export class MCPServerManager {
    private servers: Map<string, MCPServerConfig> = new Map();
    private connections: Map<string, { baseUrl: string; sessionId?: string }> = new Map();
    private changeEmitter = new vscode.EventEmitter<void>();
    private requestId = 0;
    private outputChannel?: vscode.OutputChannel;
    
    public readonly onServerChange = this.changeEmitter.event;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.log('ServerManager initialized');
        this.discoverServers();
    }
    
    private log(message: string) {
        const logMessage = `[ServerManager] ${message}`;
        console.log(logMessage);
        if (this.outputChannel) {
            this.outputChannel.appendLine(logMessage);
        } else {
            console.warn('[ServerManager] No output channel available');
        }
    }

    discoverServers() {
        // Define our known servers
        const serverConfigs: MCPServerConfig[] = [
            {
                id: 'dev-tools',
                name: 'Development Tools Server',
                description: 'Code formatting, file operations, and project scanning',
                transport: 'http',
                port: 3001,
                httpPath: '/mcp',
                stdioBinary: this.resolveServerPath('dev-tools'),
                version: '1.0.0'
            },
            {
                id: 'analytics',
                name: 'Data Analytics Server',
                description: 'Data analysis, statistics, and visualization tools',
                transport: 'http',
                port: 3002,
                httpPath: '/mcp',
                stdioBinary: this.resolveServerPath('analytics'),
                version: '1.0.0'
            },
            {
                id: 'cloud-ops',
                name: 'Cloud Operations Server',
                description: 'Infrastructure management and monitoring',
                transport: 'http',
                port: 3003,
                httpPath: '/mcp',
                stdioBinary: this.resolveServerPath('cloud-ops'),
                version: '1.0.0'
            },
            {
                id: 'knowledge',
                name: 'Knowledge Base Server',
                description: 'Documentation and knowledge management',
                transport: 'http',
                port: 3004,
                httpPath: '/mcp',
                stdioBinary: this.resolveServerPath('knowledge'),
                version: '1.0.0'
            }
        ];

        this.servers.clear();
        serverConfigs.forEach(config => {
            this.servers.set(config.id, config);
        });

        this.changeEmitter.fire();
    }

    private resolveServerPath(serverName: string): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return path.join(__dirname, `../../../../servers/${serverName}/dist/index.js`);
        }
        
        return path.join(workspaceFolder.uri.fsPath, 'packages', 'servers', serverName, 'dist', 'index.js');
    }

    getAllServers(): MCPServerConfig[] {
        return Array.from(this.servers.values());
    }

    async connectServer(serverId: string): Promise<void> {
        this.log(`connectServer called for: ${serverId}`);
        
        const server = this.servers.get(serverId);
        if (!server) {
            this.log(`Server ${serverId} not found in servers map`);
            throw new Error(`Server ${serverId} not found`);
        }
        
        this.log(`Found server config: ${JSON.stringify(server)}`);

        if (this.connections.has(serverId)) {
            throw new Error(`Already connected to ${server.name}`);
        }

        try {
            // For now, only support HTTP transport
            if (server.port) {
                const baseUrl = `http://localhost:${server.port}${server.httpPath || '/mcp'}`;
                
                this.log(`Connecting to: ${baseUrl}`);
                
                // Send initialize request directly - the server will create a session
                const initRequest: MCPRequest = {
                    jsonrpc: '2.0',
                    method: 'initialize',
                    params: {
                        protocolVersion: '2025-06-18',
                        capabilities: {
                            tools: {},
                            prompts: {},
                            resources: {
                                subscribe: true
                            }
                        },
                        clientInfo: {
                            name: 'mcp-vscode-extension',
                            version: '1.0.0'
                        }
                    },
                    id: ++this.requestId
                };

                const headers: any = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream'
                };
                
                this.log(`Sending initialize request: ${JSON.stringify(initRequest)}`);

                const response = await fetch(baseUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(initRequest)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                // Check for session ID in response headers
                let sessionId = response.headers.get('mcp-session-id');
                this.log(`Session ID from header: ${sessionId}`);

                // Parse SSE response
                const responseText = await response.text();
                this.log(`Initialize response: ${responseText}`);
                
                let result: any = {};
                
                const lines = responseText.trim().split('\n');
                for (const line of lines) {
                    if (line.startsWith('event: session')) {
                        // Session event might be in SSE
                        const nextLineIndex = lines.indexOf(line) + 1;
                        if (nextLineIndex < lines.length && lines[nextLineIndex].startsWith('data: ')) {
                            sessionId = lines[nextLineIndex].substring(6).trim();
                        }
                    } else if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.result) {
                                result = parsed.result;
                            }
                        } catch (e) {
                            this.log(`Failed to parse data: ${data}`);
                        }
                    }
                }
                
                if (!sessionId) {
                    throw new Error('Server did not return a session ID in header or response');
                }
                
                this.log(`Got session ID: ${sessionId}`);
                this.connections.set(serverId, { baseUrl, sessionId });
                server.connected = true;
                server.capabilities = result.capabilities;
                
                this.changeEmitter.fire();
                this.log(`Successfully connected to ${serverId}`);
            } else {
                throw new Error('Only HTTP transport is currently supported');
            }
        } catch (error) {
            this.log(`Caught error in connectServer: ${error}`);
            throw new Error(`Connection failed: ${error}`);
        }
    }

    async disconnectServer(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        
        if (this.connections.has(serverId)) {
            // Note: In a real implementation, we might send a proper
            // disconnect notification or close the transport connection.
            // The 'notifications/cancelled' is specifically for cancelling
            // individual requests, not for closing connections.
            
            this.connections.delete(serverId);
        }

        if (server) {
            server.connected = false;
            server.capabilities = undefined;
        }

        this.changeEmitter.fire();
    }

    async getServerCapabilities(serverId: string): Promise<any> {
        const server = this.servers.get(serverId);
        return server?.capabilities;
    }

    async getServerTools(serverId: string): Promise<any[]> {
        const conn = this.connections.get(serverId);
        if (!conn) return [];

        try {
            const response = await this.sendRequest(conn.baseUrl, 'tools/list', {}, conn.sessionId);
            return response.result?.tools || [];
        } catch (error) {
            this.log(`Failed to get tools for ${serverId}: ${error}`);
            return [];
        }
    }

    async getServerResources(serverId: string): Promise<any[]> {
        const conn = this.connections.get(serverId);
        if (!conn) return [];

        try {
            const response = await this.sendRequest(conn.baseUrl, 'resources/list', {}, conn.sessionId);
            return response.result?.resources || [];
        } catch (error) {
            this.log(`Failed to get resources for ${serverId}: ${error}`);
            return [];
        }
    }

    async getServerPrompts(serverId: string): Promise<any[]> {
        const conn = this.connections.get(serverId);
        if (!conn) return [];

        try {
            const response = await this.sendRequest(conn.baseUrl, 'prompts/list', {}, conn.sessionId);
            return response.result?.prompts || [];
        } catch (error) {
            this.log(`Failed to get prompts for ${serverId}: ${error}`);
            return [];
        }
    }
    
    async executeTool(serverId: string, toolName: string, args: any): Promise<any> {
        const conn = this.connections.get(serverId);
        if (!conn) {
            throw new Error(`Not connected to server ${serverId}`);
        }

        try {
            const response = await this.sendRequest(conn.baseUrl, 'tools/call', {
                name: toolName,
                arguments: args
            }, conn.sessionId);
            
            if (response.error) {
                throw new Error(response.error.message);
            }
            
            this.log(`Tool execution response: ${JSON.stringify(response.result)}`);
            return response.result;
        } catch (error) {
            this.log(`Failed to execute tool ${toolName}: ${error}`);
            throw error;
        }
    }


    private async sendRequest(baseUrl: string, method: string, params?: any, sessionId?: string): Promise<MCPResponse> {
        const mcpRequest: MCPRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id: ++this.requestId
        };

        const headers: any = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
        };

        // Add session ID if available
        if (sessionId) {
            headers['mcp-session-id'] = sessionId;
        }
        
        this.log(`Sending request to ${baseUrl}: ${JSON.stringify(mcpRequest)}`);

        try {
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(mcpRequest)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // Parse response based on content type
            const contentType = response.headers.get('content-type');
            const responseText = await response.text();
            
            let parsedResponse: MCPResponse;
            
            if (contentType?.includes('text/event-stream')) {
                // Parse SSE response
                const lines = responseText.trim().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        try {
                            parsedResponse = JSON.parse(data) as MCPResponse;
                            this.log(`Response from server: ${JSON.stringify(parsedResponse)}`);
                            return parsedResponse;
                        } catch (e) {
                            this.log(`Failed to parse SSE data: ${data}`);
                        }
                    }
                }
                throw new Error('No valid data found in SSE response');
            } else {
                // Regular JSON response
                parsedResponse = JSON.parse(responseText) as MCPResponse;
                this.log(`Response from server: ${JSON.stringify(parsedResponse)}`);
                return parsedResponse;
            }
        } catch (error) {
            this.log(`Request failed: ${error}`);
            throw error;
        }
    }

    private async sendNotification(baseUrl: string, method: string, params?: any): Promise<void> {
        const notification = {
            jsonrpc: '2.0' as const,
            method,
            params
        };

        await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(notification)
        });
    }

    dispose() {
        // Disconnect all servers
        for (const serverId of this.connections.keys()) {
            this.disconnectServer(serverId);
        }
    }
}