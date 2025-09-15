/**
 * @deprecated This file is deprecated. Use McpToolsService from src/renderer/main-process-api/McpToolsService.ts instead.
 *
 * This file provides a compatibility layer during migration.
 * All functionality has been moved to the structured MainProcessAPI pattern.
 */
export declare const mcp: {
    getServers: () => Promise<any>;
    getTools: (serverName: string) => Promise<any>;
    callTool: (params: {
        serverName: string;
        toolName: string;
        args: any;
    }) => Promise<any>;
    startServer: (serverName: string) => Promise<void>;
    stopServer: (serverName: string) => Promise<void>;
    restartServer: (serverName: string) => Promise<void>;
    sendMessage: (params: {
        content: string;
    }) => Promise<any>;
    getConfig: () => Promise<any>;
    updateConfig: (config: any) => Promise<void>;
    openConfig: () => Promise<void>;
    checkClaudeCli: () => Promise<{
        installed: boolean;
        error?: string;
    }>;
    onLog: (callback: (log: any) => void) => (() => void);
    onServersDiscovered: (callback: (servers: any) => void) => (() => void);
    onServerStarted: (callback: (serverInfo: any) => void) => (() => void);
    onServerStopped: (callback: (serverName: string) => void) => (() => void);
};
//# sourceMappingURL=mcp.d.ts.map