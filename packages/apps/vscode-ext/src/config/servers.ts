export interface MCPServerConfig {
    id: string;
    name: string;
    description: string;
    transport: 'stdio' | 'http';
    port?: number;
    httpPath?: string;
    stdioBinary: string;
    version: string;
    connected?: boolean;
    capabilities?: any;
}