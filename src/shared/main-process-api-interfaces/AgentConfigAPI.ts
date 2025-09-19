import { SupportedAgent, AgentSettings } from '@principal-ai/agent-monitoring';

export interface AgentSetupStatus {
  isInstalled: boolean;
  hasHooks: boolean;
  hookCount: number;
  configPath: string;
}

export enum AgentConfigAPIEvent {
  GET_AGENT_SETUP_STATUS = 'agent-config:get-agent-hook-status',
  GET_AGENT_HOOKS_FILE_PATH = 'agent-config:get-agent-hooks-file-path',
  ADD_HOOKS_TO_AGENT = 'agent-config:add-hooks-to-agent',
  REMOVE_HOOKS_FROM_AGENT = 'agent-config:remove-hooks-from-agent',
  READ_AGENT_SETTINGS = 'agent-config:read-agent-settings',
  UPDATE_AGENT_SETTINGS = 'agent-config:update-agent-settings',
  // MCP Configuration
  ADD_MCP_TO_AGENT = 'agent-config:add-mcp-to-agent',
  REMOVE_MCP_FROM_AGENT = 'agent-config:remove-mcp-from-agent',
  GET_AGENT_MCP_STATUS = 'agent-config:get-agent-mcp-status',
  GET_AGENT_MCP_FILE_PATH = 'agent-config:get-agent-mcp-file-path',
}

export interface AgentConfigAPI {
  getAgentSetupStatus: (agentType: SupportedAgent) => Promise<{
    success: boolean;
    status?: AgentSetupStatus;
    error?: string;
  }>;

  addHooksToAgent: (
    agentType: SupportedAgent,
  ) => Promise<{ success: boolean; hookCount?: number; error?: string }>;

  removeHooksFromAgent: (
    agentType: SupportedAgent,
  ) => Promise<{ success: boolean; hookCount?: number; error?: string }>;

  readAgentSettings: (agentType: SupportedAgent) => Promise<{
    success: boolean;
    settings?: AgentSettings;
    path?: string;
    error?: string;
  }>;

  updateAgentSettings: (
    agentType: SupportedAgent,
    settings: AgentSettings,
  ) => Promise<{ success: boolean; error?: string }>;

  getAgentHooksFilePath: (agentType: SupportedAgent) => Promise<{
    success: boolean;
    filePath: string;
    error?: string;
  }>;

  getAgentMCPFilePath: (agentType: SupportedAgent) => Promise<{
    success: boolean;
    filePath: string;
    error?: string;
  }>;

  // MCP Configuration Methods
  addMCPToAgent: (
    agentType: SupportedAgent,
    serverName?: string,
  ) => Promise<{
    success: boolean;
    status?: {
      hasMCP: boolean;
      mcpCount: number;
    };
    error?: string;
  }>;

  removeMCPFromAgent: (
    agentType: SupportedAgent,
    serverName?: string,
  ) => Promise<{
    success: boolean;
    status?: {
      hasMCP: boolean;
      mcpCount: number;
    };
    error?: string;
  }>;

  getAgentMCPStatus: (
    agentType: SupportedAgent,
    serverName?: string,
  ) => Promise<{
    success: boolean;
    status?: {
      hasMCP: boolean;
      mcpCount: number;
    };
    error?: string;
  }>;
}
