import { ipcRenderer } from 'electron';
import { SupportedAgent } from '@principal-ai/agent-monitoring';
import type { AgentSettings } from '../../shared/types/agent-settings.types';
import type {
  AgentSettings,
  SupportedAgent,
} from '@principal-ai/agent-monitoring';
import { APP_BRANDING } from '../../shared/config/appBranding';

export const agentConfigAPI: AgentConfigAPI = {
  getAgentSetupStatus: (agentType: SupportedAgent) =>
    ipcRenderer.invoke(AgentConfigAPIEvent.GET_AGENT_SETUP_STATUS, agentType),

  getAgentHooksFilePath: (agentType: SupportedAgent) =>
    ipcRenderer.invoke(
      AgentConfigAPIEvent.GET_AGENT_HOOKS_FILE_PATH,
      agentType,
    ),

  getAgentMCPFilePath: (agentType: SupportedAgent) =>
    ipcRenderer.invoke(AgentConfigAPIEvent.GET_AGENT_MCP_FILE_PATH, agentType),

  addHooksToAgent: (agentType: SupportedAgent) =>
    ipcRenderer.invoke(AgentConfigAPIEvent.ADD_HOOKS_TO_AGENT, agentType),

  removeHooksFromAgent: (agentType: SupportedAgent) =>
    ipcRenderer.invoke(AgentConfigAPIEvent.REMOVE_HOOKS_FROM_AGENT, agentType),

  readAgentSettings: (agentType: SupportedAgent) =>
    ipcRenderer.invoke(AgentConfigAPIEvent.READ_AGENT_SETTINGS, agentType),

  updateAgentSettings: (agentType: SupportedAgent, settings: AgentSettings) =>
    ipcRenderer.invoke(
      AgentConfigAPIEvent.UPDATE_AGENT_SETTINGS,
      agentType,
      settings,
    ),

  // MCP Configuration Methods
  addMCPToAgent: (agentType: SupportedAgent, serverName?: string) =>
    ipcRenderer.invoke(
      AgentConfigAPIEvent.ADD_MCP_TO_AGENT,
      agentType,
      serverName || APP_BRANDING.MCP_SERVER_CONFIG_KEY,
    ),

  removeMCPFromAgent: (agentType: SupportedAgent, serverName?: string) =>
    ipcRenderer.invoke(
      AgentConfigAPIEvent.REMOVE_MCP_FROM_AGENT,
      agentType,
      serverName || APP_BRANDING.MCP_SERVER_CONFIG_KEY,
    ),

  getAgentMCPStatus: (agentType: SupportedAgent, serverName?: string) =>
    ipcRenderer.invoke(
      AgentConfigAPIEvent.GET_AGENT_MCP_STATUS,
      agentType,
      serverName || APP_BRANDING.MCP_SERVER_CONFIG_KEY,
    ),
};
