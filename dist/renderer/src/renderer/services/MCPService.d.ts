interface MCPTool {
    name: string;
    description?: string;
    inputSchema: any;
}
interface MCPServer {
    name: string;
    protocol: string;
    capabilities?: {
        tools?: boolean;
        prompts?: boolean;
        resources?: boolean;
    };
}
interface MCPMessage {
    type: 'request' | 'response' | 'error' | 'notification';
    content: any;
    timestamp: number;
}
export declare class MCPService {
    private static instance;
    private logs;
    private listeners;
    private constructor();
    static getInstance(): MCPService;
    private setupIPCListeners;
    private addLog;
    getAvailableServers(): Promise<MCPServer[]>;
    getServerTools(serverName: string): Promise<MCPTool[]>;
    callTool(serverName: string, toolName: string, args: any): Promise<any>;
    startServer(serverName: string): Promise<boolean>;
    stopServer(serverName: string): Promise<boolean>;
    restartServer(serverName: string): Promise<boolean>;
    sendMessage(content: string): Promise<any>;
    getLogs(): MCPMessage[];
    clearLogs(): void;
    onLogAdded(callback: (log: MCPMessage) => void): () => void;
    getMCPConfig(): Promise<any>;
    updateMCPConfig(config: any): Promise<boolean>;
    openMCPConfig(): Promise<void>;
    enableMcpServer(serverId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    disableMcpServer(serverId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    getManualMCPCommand(): Promise<string>;
    addMCPToAllProjects(): Promise<{
        success: boolean;
        error?: string;
        projectsUpdated?: number;
    }>;
    getAllProjectsWithMCPStatus(): Promise<{
        success: boolean;
        projects?: Array<{
            path: string;
            hasPrincipleMD: boolean;
            mcpServers: Record<string, any>;
        }>;
        error?: string;
    }>;
    toggleMCPForProject(projectPath: string, enable: boolean): Promise<{
        success: boolean;
        error?: string;
    }>;
    getGeminiMCPStatus(): Promise<{
        success: boolean;
        hasPrincipleMD?: boolean;
        mcpServers?: Record<string, any>;
        error?: string;
    }>;
    toggleGeminiMCP(enable: boolean): Promise<{
        success: boolean;
        error?: string;
    }>;
}
export declare const mcpService: MCPService;
export {};
//# sourceMappingURL=MCPService.d.ts.map