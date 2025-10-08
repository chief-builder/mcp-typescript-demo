import * as vscode from 'vscode';
import { MCPServerManager } from '../utils/serverManager';
import { MCPServerConfig } from '../config/servers';

export class MCPServersTreeProvider implements vscode.TreeDataProvider<ServerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ServerItem | undefined | null | void> = new vscode.EventEmitter<ServerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ServerItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private serverManager: MCPServerManager) {
        serverManager.onServerChange(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ServerItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ServerItem): Thenable<ServerItem[]> {
        if (!element) {
            // Root level - show all servers
            const servers = this.serverManager.getAllServers();
            return Promise.resolve(
                servers.map(server => new ServerItem(server))
            );
        }
        return Promise.resolve([]);
    }
}

class ServerItem extends vscode.TreeItem {
    constructor(
        public readonly server: MCPServerConfig
    ) {
        super(server.name, vscode.TreeItemCollapsibleState.None);

        this.tooltip = `${server.description}\nTransport: ${server.transport}\nPort: ${server.port || 'N/A'}`;
        this.description = server.connected ? 'Connected' : 'Disconnected';
        
        // Set icon based on connection status
        this.iconPath = new vscode.ThemeIcon(
            server.connected ? 'server' : 'server-environment',
            server.connected 
                ? new vscode.ThemeColor('testing.iconPassed')
                : new vscode.ThemeColor('testing.iconQueued')
        );

        // Set context value for menu commands
        this.contextValue = server.connected ? 'connectedServer' : 'disconnectedServer';

        // Add command to show server details on click
        this.command = {
            command: 'mcp-demo.showServerCapabilities',
            title: 'Show Server Capabilities',
            arguments: [server.id]
        };
    }
}