import { McpServer, McpTool, McpToolCallParams, McpToolResult, McpMessage, McpConfig, ClaudeCliStatus, AppInfo, GetAppInfoError } from '../../shared/main-process-api-interfaces/McpToolsAPI';
/**
 * Service layer for MCP Tools functionality
 * ALL window.mainProcess.mcpTools calls MUST be encapsulated here
 *
 * This service provides a clean interface for MCP server management,
 * tool discovery and execution, and configuration management.
 */
export declare class McpToolsService {
    /**
     * Get application information
     */
    static getAppInfo(params?: {
        detailed?: boolean;
    }): Promise<AppInfo | GetAppInfoError>;
    /**
     * Get list of available MCP servers
     */
    static getServers(): Promise<McpServer[]>;
    /**
     * Get tools available from a specific server
     */
    static getTools(serverName: string): Promise<McpTool[]>;
    /**
     * Call a tool on a specific server
     */
    static callTool(params: McpToolCallParams): Promise<McpToolResult>;
    /**
     * Start an MCP server
     */
    static startServer(serverName: string): Promise<void>;
    /**
     * Stop an MCP server
     */
    static stopServer(serverName: string): Promise<void>;
    /**
     * Restart an MCP server
     */
    static restartServer(serverName: string): Promise<void>;
    /**
     * Send a message to the MCP system
     */
    static sendMessage(params: McpMessage): Promise<any>;
    /**
     * Get MCP configuration
     */
    static getConfig(): Promise<McpConfig>;
    /**
     * Update MCP configuration
     */
    static updateConfig(config: McpConfig): Promise<void>;
    /**
     * Open MCP configuration file in default editor
     */
    static openConfig(): Promise<void>;
    /**
     * Check if Claude CLI is installed
     */
    static checkClaudeCli(): Promise<ClaudeCliStatus>;
    /**
     * Get the resolved path to the MCP server script
     */
    static getResolvedMcpScriptPath(): Promise<string>;
    /**
     * Subscribe to MCP log events
     * @returns Unsubscribe function
     */
    static onLog(callback: (log: any) => void): () => void;
    /**
     * Subscribe to server discovery events
     * @returns Unsubscribe function
     */
    static onServersDiscovered(callback: (servers: McpServer[]) => void): () => void;
    /**
     * Subscribe to server started events
     * @returns Unsubscribe function
     */
    static onServerStarted(callback: (serverInfo: any) => void): () => void;
    /**
     * Subscribe to server stopped events
     * @returns Unsubscribe function
     */
    static onServerStopped(callback: (serverName: string) => void): () => void;
    /**
     * Subscribe to markdown slide display events
     * @returns void (no unsubscribe needed for this legacy event)
     */
    static onDisplayMarkdownSlides(callback: (data: {
        presentationTitle: string;
        markdown: string;
    }) => void): void;
}
//# sourceMappingURL=McpToolsService.d.ts.map