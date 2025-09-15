import { ipcRenderer } from 'electron';
import { AgentConfigAPIEvent } from '../../shared/main-process-api-interfaces/AgentConfigAPI';
import { APP_BRANDING } from '../../shared/config/appBranding';
export const agentConfigAPI = {
    getAgentSetupStatus: (agentType) => ipcRenderer.invoke(AgentConfigAPIEvent.GET_AGENT_SETUP_STATUS, agentType),
    getAgentHooksFilePath: (agentType) => ipcRenderer.invoke(AgentConfigAPIEvent.GET_AGENT_HOOKS_FILE_PATH, agentType),
    getAgentMCPFilePath: (agentType) => ipcRenderer.invoke(AgentConfigAPIEvent.GET_AGENT_MCP_FILE_PATH, agentType),
    addHooksToAgent: (agentType) => ipcRenderer.invoke(AgentConfigAPIEvent.ADD_HOOKS_TO_AGENT, agentType),
    removeHooksFromAgent: (agentType) => ipcRenderer.invoke(AgentConfigAPIEvent.REMOVE_HOOKS_FROM_AGENT, agentType),
    readAgentSettings: (agentType) => ipcRenderer.invoke(AgentConfigAPIEvent.READ_AGENT_SETTINGS, agentType),
    updateAgentSettings: (agentType, settings) => ipcRenderer.invoke(AgentConfigAPIEvent.UPDATE_AGENT_SETTINGS, agentType, settings),
    // MCP Configuration Methods
    addMCPToAgent: (agentType, serverName) => ipcRenderer.invoke(AgentConfigAPIEvent.ADD_MCP_TO_AGENT, agentType, serverName || APP_BRANDING.MCP_SERVER_CONFIG_KEY),
    removeMCPFromAgent: (agentType, serverName) => ipcRenderer.invoke(AgentConfigAPIEvent.REMOVE_MCP_FROM_AGENT, agentType, serverName || APP_BRANDING.MCP_SERVER_CONFIG_KEY),
    getAgentMCPStatus: (agentType, serverName) => ipcRenderer.invoke(AgentConfigAPIEvent.GET_AGENT_MCP_STATUS, agentType, serverName || APP_BRANDING.MCP_SERVER_CONFIG_KEY),
};
