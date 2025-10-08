import * as vscode from 'vscode';
import { MCPServerManager } from '../utils/serverManager';
import { MCPServerConfig } from '../config/servers';

type CapabilityItem = ServerItem | CategoryItem | ToolItem | ResourceItem | PromptItem;

export class MCPCapabilitiesTreeProvider implements vscode.TreeDataProvider<CapabilityItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CapabilityItem | undefined | null | void> = new vscode.EventEmitter<CapabilityItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CapabilityItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private serverManager: MCPServerManager) {
        serverManager.onServerChange(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CapabilityItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CapabilityItem): Promise<CapabilityItem[]> {
        if (!element) {
            // Root level - show server names for connected servers
            const servers = this.serverManager.getAllServers().filter(s => s.connected);
            
            if (servers.length === 0) {
                return [];
            }

            // Show each connected server as a collapsible item
            return servers.map(server => new ServerItem(server));
        }
        
        if (element instanceof ServerItem) {
            // Show categories for a specific server
            const categories: CapabilityItem[] = [];
            const serverId = element.server.id;

            // Add tools category
            const tools = await this.serverManager.getServerTools(serverId);
            if (tools.length > 0) {
                categories.push(new CategoryItem('Tools', 'tools', serverId, tools.length));
            }

            // Add resources category
            const resources = await this.serverManager.getServerResources(serverId);
            if (resources.length > 0) {
                categories.push(new CategoryItem('Resources', 'files', serverId, resources.length));
            }

            // Add prompts category
            const prompts = await this.serverManager.getServerPrompts(serverId);
            if (prompts.length > 0) {
                categories.push(new CategoryItem('Prompts', 'comment', serverId, prompts.length));
            }

            return categories;
        }

        if (element instanceof CategoryItem) {
            switch (element.type) {
                case 'Tools':
                    const tools = await this.serverManager.getServerTools(element.serverId);
                    return tools.map(tool => new ToolItem(tool, element.serverId));
                
                case 'Resources':
                    const resources = await this.serverManager.getServerResources(element.serverId);
                    return resources.map(resource => new ResourceItem(resource, element.serverId));
                
                case 'Prompts':
                    const prompts = await this.serverManager.getServerPrompts(element.serverId);
                    return prompts.map(prompt => new PromptItem(prompt, element.serverId));
            }
        }

        return [];
    }
}

class ServerItem extends vscode.TreeItem {
    constructor(
        public readonly server: MCPServerConfig
    ) {
        super(server.name, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('server');
        this.contextValue = 'connectedServer';
        this.description = server.description;
    }
}

class CategoryItem extends vscode.TreeItem {
    constructor(
        public readonly type: 'Tools' | 'Resources' | 'Prompts',
        public readonly icon: string,
        public readonly serverId: string,
        public readonly count: number
    ) {
        super(`${type} (${count})`, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.contextValue = 'category';
    }
}

class ToolItem extends vscode.TreeItem {
    constructor(
        public readonly tool: any,
        public readonly serverId: string
    ) {
        super(tool.name, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = new vscode.MarkdownString(`**${tool.name}**\n\n${tool.description || 'No description'}`);
        
        if (tool.inputSchema) {
            this.tooltip.appendMarkdown('\n\n**Parameters:**\n');
            this.tooltip.appendCodeblock(JSON.stringify(tool.inputSchema, null, 2), 'json');
        }

        this.description = tool.description?.substring(0, 50) + (tool.description?.length > 50 ? '...' : '');
        this.iconPath = new vscode.ThemeIcon('tools');
        this.contextValue = 'tool';
        
        this.command = {
            command: 'mcp-demo.executeTool',
            title: 'Execute Tool',
            arguments: [tool]
        };
    }
}

class ResourceItem extends vscode.TreeItem {
    constructor(
        public readonly resource: any,
        public readonly serverId: string
    ) {
        super(resource.name, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = new vscode.MarkdownString(`**${resource.name}**\n\n${resource.description || 'No description'}`);
        
        if (resource.uri) {
            this.tooltip.appendMarkdown(`\n\n**URI:** ${resource.uri}`);
        }

        this.description = resource.uri || resource.description?.substring(0, 50);
        this.iconPath = new vscode.ThemeIcon('file');
        this.contextValue = 'resource';
    }
}

class PromptItem extends vscode.TreeItem {
    constructor(
        public readonly prompt: any,
        public readonly serverId: string
    ) {
        super(prompt.name, vscode.TreeItemCollapsibleState.None);
        
        this.tooltip = new vscode.MarkdownString(`**${prompt.name}**\n\n${prompt.description || 'No description'}`);
        
        if (prompt.arguments) {
            this.tooltip.appendMarkdown('\n\n**Arguments:**\n');
            this.tooltip.appendCodeblock(JSON.stringify(prompt.arguments, null, 2), 'json');
        }

        this.description = prompt.description?.substring(0, 50) + (prompt.description?.length > 50 ? '...' : '');
        this.iconPath = new vscode.ThemeIcon('comment-discussion');
        this.contextValue = 'prompt';
    }
}