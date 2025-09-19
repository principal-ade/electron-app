export interface AppInfo {
  name: string;
  version: string;
  adapterWindowId: number;
  status: string;
  detailed: boolean;
}

export interface GetAppInfoError {
  success: false;
  error: string;
}

export type GetAppInfoResult = (AppInfo & { success: true }) | GetAppInfoError;

// MCP Server types
export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status?: 'running' | 'stopped' | 'error';
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema?: any;
  serverName: string;
}

export interface McpToolCallParams {
  serverName: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface McpToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface McpMessage {
  content: string;
  role?: 'user' | 'assistant' | 'system';
}

export interface McpConfig {
  servers?: Record<string, McpServer>;
  settings?: Record<string, any>;
}

export interface ClaudeCliStatus {
  installed: boolean;
  error?: string;
}

export interface McpToolsAPI {
  getAppInfo: (params?: {
    detailed?: boolean;
  }) => Promise<AppInfo | GetAppInfoError>;
  onDisplayMarkdownSlides: (
    callback: (data: { presentationTitle: string; markdown: string }) => void,
  ) => void;

  // MCP Server Management
  getServers: () => Promise<McpServer[]>;
  getTools: (serverName: string) => Promise<McpTool[]>;
  callTool: (params: McpToolCallParams) => Promise<McpToolResult>;
  startServer: (serverName: string) => Promise<void>;
  stopServer: (serverName: string) => Promise<void>;
  restartServer: (serverName: string) => Promise<void>;
  sendMessage: (params: McpMessage) => Promise<any>;

  // MCP Configuration
  getConfig: () => Promise<McpConfig>;
  updateConfig: (config: McpConfig) => Promise<void>;
  openConfig: () => Promise<void>;
  checkClaudeCli: () => Promise<ClaudeCliStatus>;
  getResolvedMcpScriptPath: () => Promise<string>;

  // MCP Events
  onLog: (callback: (log: any) => void) => () => void;
  onServersDiscovered: (callback: (servers: McpServer[]) => void) => () => void;
  onServerStarted: (callback: (serverInfo: any) => void) => () => void;
  onServerStopped: (callback: (serverName: string) => void) => () => void;
}
