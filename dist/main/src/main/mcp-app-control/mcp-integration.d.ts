export declare class ElectronMCPIntegration {
    private mcpProcess;
    private healthCheckInterval;
    private restartAttempts;
    private maxRestartAttempts;
    private lastHealthCheck;
    constructor();
    private setupIPCHandlers;
    startMCPServer(): Promise<void>;
    private handleMCPCommand;
    private handleWindowControl;
    private handleStoreMarkdown;
    stopMCPServer(): void;
    getMCPServerInfo(): {
        running: boolean;
        pid: number | null;
    };
    testMessageFlow(): void;
    private startHealthMonitoring;
    private stopHealthMonitoring;
    getMCPServerHealth(): {
        healthy: boolean;
        lastCheck: number;
        uptime: number;
        restartCount: number;
    };
    shutdown(): Promise<void>;
}
//# sourceMappingURL=mcp-integration.d.ts.map