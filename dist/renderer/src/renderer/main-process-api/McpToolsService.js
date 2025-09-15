/**
 * Service layer for MCP Tools functionality
 * ALL window.mainProcess.mcpTools calls MUST be encapsulated here
 *
 * This service provides a clean interface for MCP server management,
 * tool discovery and execution, and configuration management.
 */
export class McpToolsService {
    /**
     * Get application information
     */
    static async getAppInfo(params) {
        return window.mainProcess.mcpTools.getAppInfo(params);
    }
    /**
     * Get list of available MCP servers
     */
    static async getServers() {
        return window.mainProcess.mcpTools.getServers();
    }
    /**
     * Get tools available from a specific server
     */
    static async getTools(serverName) {
        return window.mainProcess.mcpTools.getTools(serverName);
    }
    /**
     * Call a tool on a specific server
     */
    static async callTool(params) {
        return window.mainProcess.mcpTools.callTool(params);
    }
    /**
     * Start an MCP server
     */
    static async startServer(serverName) {
        return window.mainProcess.mcpTools.startServer(serverName);
    }
    /**
     * Stop an MCP server
     */
    static async stopServer(serverName) {
        return window.mainProcess.mcpTools.stopServer(serverName);
    }
    /**
     * Restart an MCP server
     */
    static async restartServer(serverName) {
        return window.mainProcess.mcpTools.restartServer(serverName);
    }
    /**
     * Send a message to the MCP system
     */
    static async sendMessage(params) {
        return window.mainProcess.mcpTools.sendMessage(params);
    }
    /**
     * Get MCP configuration
     */
    static async getConfig() {
        return window.mainProcess.mcpTools.getConfig();
    }
    /**
     * Update MCP configuration
     */
    static async updateConfig(config) {
        return window.mainProcess.mcpTools.updateConfig(config);
    }
    /**
     * Open MCP configuration file in default editor
     */
    static async openConfig() {
        return window.mainProcess.mcpTools.openConfig();
    }
    /**
     * Check if Claude CLI is installed
     */
    static async checkClaudeCli() {
        return window.mainProcess.mcpTools.checkClaudeCli();
    }
    /**
     * Get the resolved path to the MCP server script
     */
    static async getResolvedMcpScriptPath() {
        return window.mainProcess.mcpTools.getResolvedMcpScriptPath();
    }
    /**
     * Subscribe to MCP log events
     * @returns Unsubscribe function
     */
    static onLog(callback) {
        return window.mainProcess.mcpTools.onLog(callback);
    }
    /**
     * Subscribe to server discovery events
     * @returns Unsubscribe function
     */
    static onServersDiscovered(callback) {
        return window.mainProcess.mcpTools.onServersDiscovered(callback);
    }
    /**
     * Subscribe to server started events
     * @returns Unsubscribe function
     */
    static onServerStarted(callback) {
        return window.mainProcess.mcpTools.onServerStarted(callback);
    }
    /**
     * Subscribe to server stopped events
     * @returns Unsubscribe function
     */
    static onServerStopped(callback) {
        return window.mainProcess.mcpTools.onServerStopped(callback);
    }
    /**
     * Subscribe to markdown slide display events
     * @returns void (no unsubscribe needed for this legacy event)
     */
    static onDisplayMarkdownSlides(callback) {
        return window.mainProcess.mcpTools.onDisplayMarkdownSlides(callback);
    }
}
