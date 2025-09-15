import { McpToolsAPI } from '../../shared/main-process-api-interfaces/McpToolsAPI';
export declare enum McpToolsEvent {
    GET_APP_INFO = "mcp-tool:get-app-info",
    DISPLAY_MARKDOWN_SLIDES = "mcp-tool:display-markdown-slides",
    GET_SERVERS = "mcp:get-servers",
    GET_TOOLS = "mcp:get-tools",
    CALL_TOOL = "mcp:call-tool",
    START_SERVER = "mcp:start-server",
    STOP_SERVER = "mcp:stop-server",
    SEND_MESSAGE = "mcp:send-message",
    GET_CONFIG = "mcp:get-config",
    UPDATE_CONFIG = "mcp:update-config",
    OPEN_CONFIG = "mcp:open-config",
    CHECK_CLAUDE_CLI = "mcp:check-claude-cli",
    GET_RESOLVED_SCRIPT_PATH = "mcp:get-resolved-script-path",
    ON_LOG = "mcp:log",
    ON_SERVERS_DISCOVERED = "mcp:servers-discovered",
    ON_SERVER_STARTED = "mcp:server-started",
    ON_SERVER_STOPPED = "mcp:server-stopped"
}
export declare const mcpToolsAPI: McpToolsAPI;
//# sourceMappingURL=mcpToolsApi.d.ts.map