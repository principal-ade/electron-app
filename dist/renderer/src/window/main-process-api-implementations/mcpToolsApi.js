import { ipcRenderer } from 'electron';
export var McpToolsEvent;
(function (McpToolsEvent) {
    McpToolsEvent["GET_APP_INFO"] = "mcp-tool:get-app-info";
    McpToolsEvent["DISPLAY_MARKDOWN_SLIDES"] = "mcp-tool:display-markdown-slides";
    // MCP Server Management
    McpToolsEvent["GET_SERVERS"] = "mcp:get-servers";
    McpToolsEvent["GET_TOOLS"] = "mcp:get-tools";
    McpToolsEvent["CALL_TOOL"] = "mcp:call-tool";
    McpToolsEvent["START_SERVER"] = "mcp:start-server";
    McpToolsEvent["STOP_SERVER"] = "mcp:stop-server";
    McpToolsEvent["SEND_MESSAGE"] = "mcp:send-message";
    // MCP Configuration
    McpToolsEvent["GET_CONFIG"] = "mcp:get-config";
    McpToolsEvent["UPDATE_CONFIG"] = "mcp:update-config";
    McpToolsEvent["OPEN_CONFIG"] = "mcp:open-config";
    McpToolsEvent["CHECK_CLAUDE_CLI"] = "mcp:check-claude-cli";
    McpToolsEvent["GET_RESOLVED_SCRIPT_PATH"] = "mcp:get-resolved-script-path";
    // MCP Events (from main to renderer)
    McpToolsEvent["ON_LOG"] = "mcp:log";
    McpToolsEvent["ON_SERVERS_DISCOVERED"] = "mcp:servers-discovered";
    McpToolsEvent["ON_SERVER_STARTED"] = "mcp:server-started";
    McpToolsEvent["ON_SERVER_STOPPED"] = "mcp:server-stopped";
})(McpToolsEvent || (McpToolsEvent = {}));
// This object is intended for use in the preload script
export const mcpToolsAPI = {
    getAppInfo: (params) => ipcRenderer.invoke(McpToolsEvent.GET_APP_INFO, params),
    onDisplayMarkdownSlides: (callback) => {
        ipcRenderer.on(McpToolsEvent.DISPLAY_MARKDOWN_SLIDES, (event, data) => {
            callback(data);
        });
    },
    // MCP Server Management
    getServers: () => ipcRenderer.invoke(McpToolsEvent.GET_SERVERS),
    getTools: (serverName) => ipcRenderer.invoke(McpToolsEvent.GET_TOOLS, serverName),
    callTool: (params) => ipcRenderer.invoke(McpToolsEvent.CALL_TOOL, params),
    startServer: (serverName) => ipcRenderer.invoke(McpToolsEvent.START_SERVER, serverName),
    stopServer: (serverName) => ipcRenderer.invoke(McpToolsEvent.STOP_SERVER, serverName),
    restartServer: async (serverName) => {
        await ipcRenderer.invoke(McpToolsEvent.STOP_SERVER, serverName);
        await new Promise(resolve => setTimeout(resolve, 500));
        await ipcRenderer.invoke(McpToolsEvent.START_SERVER, serverName);
    },
    sendMessage: (params) => ipcRenderer.invoke(McpToolsEvent.SEND_MESSAGE, params),
    // MCP Configuration
    getConfig: () => ipcRenderer.invoke(McpToolsEvent.GET_CONFIG),
    updateConfig: (config) => ipcRenderer.invoke(McpToolsEvent.UPDATE_CONFIG, config),
    openConfig: () => ipcRenderer.invoke(McpToolsEvent.OPEN_CONFIG),
    checkClaudeCli: () => ipcRenderer.invoke(McpToolsEvent.CHECK_CLAUDE_CLI),
    getResolvedMcpScriptPath: () => ipcRenderer.invoke(McpToolsEvent.GET_RESOLVED_SCRIPT_PATH),
    // MCP Events
    onLog: (callback) => {
        const subscription = (_event, log) => callback(log);
        ipcRenderer.on(McpToolsEvent.ON_LOG, subscription);
        return () => ipcRenderer.removeListener(McpToolsEvent.ON_LOG, subscription);
    },
    onServersDiscovered: (callback) => {
        const subscription = (_event, servers) => callback(servers);
        ipcRenderer.on(McpToolsEvent.ON_SERVERS_DISCOVERED, subscription);
        return () => ipcRenderer.removeListener(McpToolsEvent.ON_SERVERS_DISCOVERED, subscription);
    },
    onServerStarted: (callback) => {
        const subscription = (_event, serverInfo) => callback(serverInfo);
        ipcRenderer.on(McpToolsEvent.ON_SERVER_STARTED, subscription);
        return () => ipcRenderer.removeListener(McpToolsEvent.ON_SERVER_STARTED, subscription);
    },
    onServerStopped: (callback) => {
        const subscription = (_event, serverName) => callback(serverName);
        ipcRenderer.on(McpToolsEvent.ON_SERVER_STOPPED, subscription);
        return () => ipcRenderer.removeListener(McpToolsEvent.ON_SERVER_STOPPED, subscription);
    },
};
