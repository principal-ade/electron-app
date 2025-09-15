export var AgentConfigAPIEvent;
(function (AgentConfigAPIEvent) {
    AgentConfigAPIEvent["GET_AGENT_SETUP_STATUS"] = "agent-config:get-agent-hook-status";
    AgentConfigAPIEvent["GET_AGENT_HOOKS_FILE_PATH"] = "agent-config:get-agent-hooks-file-path";
    AgentConfigAPIEvent["ADD_HOOKS_TO_AGENT"] = "agent-config:add-hooks-to-agent";
    AgentConfigAPIEvent["REMOVE_HOOKS_FROM_AGENT"] = "agent-config:remove-hooks-from-agent";
    AgentConfigAPIEvent["READ_AGENT_SETTINGS"] = "agent-config:read-agent-settings";
    AgentConfigAPIEvent["UPDATE_AGENT_SETTINGS"] = "agent-config:update-agent-settings";
    // MCP Configuration
    AgentConfigAPIEvent["ADD_MCP_TO_AGENT"] = "agent-config:add-mcp-to-agent";
    AgentConfigAPIEvent["REMOVE_MCP_FROM_AGENT"] = "agent-config:remove-mcp-from-agent";
    AgentConfigAPIEvent["GET_AGENT_MCP_STATUS"] = "agent-config:get-agent-mcp-status";
    AgentConfigAPIEvent["GET_AGENT_MCP_FILE_PATH"] = "agent-config:get-agent-mcp-file-path";
})(AgentConfigAPIEvent || (AgentConfigAPIEvent = {}));
