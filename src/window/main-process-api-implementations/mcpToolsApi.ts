import { ipcRenderer } from 'electron';
import { McpToolsAPI } from '../../shared/main-process-api-interfaces/McpToolsAPI';

export enum McpToolsEvent {
  GET_APP_INFO = 'mcp-tool:get-app-info',
  DISPLAY_MARKDOWN_SLIDES = 'mcp-tool:display-markdown-slides',
  
  // MCP Server Management
  GET_SERVERS = 'mcp:get-servers',
  GET_TOOLS = 'mcp:get-tools',
  CALL_TOOL = 'mcp:call-tool',
  START_SERVER = 'mcp:start-server',
  STOP_SERVER = 'mcp:stop-server',
  SEND_MESSAGE = 'mcp:send-message',
  
  // MCP Configuration
  GET_CONFIG = 'mcp:get-config',
  UPDATE_CONFIG = 'mcp:update-config',
  OPEN_CONFIG = 'mcp:open-config',
  CHECK_CLAUDE_CLI = 'mcp:check-claude-cli',
  GET_RESOLVED_SCRIPT_PATH = 'mcp:get-resolved-script-path',
  
  // MCP Events (from main to renderer)
  ON_LOG = 'mcp:log',
  ON_SERVERS_DISCOVERED = 'mcp:servers-discovered',
  ON_SERVER_STARTED = 'mcp:server-started',
  ON_SERVER_STOPPED = 'mcp:server-stopped',
}

// This object is intended for use in the preload script
export const mcpToolsAPI: McpToolsAPI = {
  getAppInfo: (params?: { detailed?: boolean }) =>
    ipcRenderer.invoke(McpToolsEvent.GET_APP_INFO, params),
  onDisplayMarkdownSlides: (callback: (data: { presentationTitle: string; markdown: string }) => void) => {
    ipcRenderer.on(McpToolsEvent.DISPLAY_MARKDOWN_SLIDES, (event, data) => {
      callback(data);
    });
  },
  
  // MCP Server Management
  getServers: () => ipcRenderer.invoke(McpToolsEvent.GET_SERVERS),
  getTools: (serverName: string) => ipcRenderer.invoke(McpToolsEvent.GET_TOOLS, serverName),
  callTool: (params) => ipcRenderer.invoke(McpToolsEvent.CALL_TOOL, params),
  startServer: (serverName: string) => ipcRenderer.invoke(McpToolsEvent.START_SERVER, serverName),
  stopServer: (serverName: string) => ipcRenderer.invoke(McpToolsEvent.STOP_SERVER, serverName),
  restartServer: async (serverName: string) => {
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
  onLog: (callback: (log: any) => void) => {
    const subscription = (_event: any, log: any) => callback(log);
    ipcRenderer.on(McpToolsEvent.ON_LOG, subscription);
    return () => ipcRenderer.removeListener(McpToolsEvent.ON_LOG, subscription);
  },
  onServersDiscovered: (callback: (servers: any[]) => void) => {
    const subscription = (_event: any, servers: any[]) => callback(servers);
    ipcRenderer.on(McpToolsEvent.ON_SERVERS_DISCOVERED, subscription);
    return () => ipcRenderer.removeListener(McpToolsEvent.ON_SERVERS_DISCOVERED, subscription);
  },
  onServerStarted: (callback: (serverInfo: any) => void) => {
    const subscription = (_event: any, serverInfo: any) => callback(serverInfo);
    ipcRenderer.on(McpToolsEvent.ON_SERVER_STARTED, subscription);
    return () => ipcRenderer.removeListener(McpToolsEvent.ON_SERVER_STARTED, subscription);
  },
  onServerStopped: (callback: (serverName: string) => void) => {
    const subscription = (_event: any, serverName: string) => callback(serverName);
    ipcRenderer.on(McpToolsEvent.ON_SERVER_STOPPED, subscription);
    return () => ipcRenderer.removeListener(McpToolsEvent.ON_SERVER_STOPPED, subscription);
  },
};
