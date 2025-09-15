/**
 * MCP Server
 * Main server class that manages tools and resources
 */
import { McpServerConfig, McpTool, McpResource } from '../types';
export declare class McpServer {
    private server;
    private config;
    private tools;
    private resources;
    private messageQueue;
    constructor(config: McpServerConfig);
    private setupDefaultTools;
    private setupDefaultResources;
    private registerHandlers;
    addTool<TParams, TResult>(tool: McpTool<TParams, TResult>): void;
    addResource(resource: McpResource): void;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=McpServer.d.ts.map