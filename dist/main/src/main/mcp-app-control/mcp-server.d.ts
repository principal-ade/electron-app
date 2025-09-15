export declare class ElectronMCPServer {
    private server;
    private messageQueue;
    private pendingResponsePromises;
    constructor();
    private setupIPCHandlers;
    private setupTools;
    private setupResources;
    private waitForMessage;
    start(): Promise<void>;
}
//# sourceMappingURL=mcp-server.d.ts.map