import { ipcRenderer } from 'electron';
import {
  AgentUpdateAPI,
  UpdateCheckResult,
  AgentUpdatePreferences,
} from '../../shared/main-process-api-interfaces/AgentUpdateAPI';
import { SupportedAgent } from '@principal-ai/agent-monitoring';

export const agentUpdateAPI: AgentUpdateAPI = {
  checkAllForUpdates: () => ipcRenderer.invoke('agent-auto-update:check-all'),

  checkForUpdate: (agentType: SupportedAgent) =>
    ipcRenderer.invoke('agent-auto-update:check', agentType),

  getUpdatePreferences: () =>
    ipcRenderer.invoke('agent-auto-update:get-preferences'),

  saveUpdatePreferences: (preferences: Partial<AgentUpdatePreferences>) =>
    ipcRenderer.invoke('agent-auto-update:save-preferences', preferences),

  getStoredUpdateInfo: (agentType: SupportedAgent) =>
    ipcRenderer.invoke('agent-auto-update:get-stored-info', agentType),

  clearStoredUpdateInfo: (agentType: SupportedAgent) =>
    ipcRenderer.invoke('agent-auto-update:clear-stored-info', agentType),

  onUpdateAvailable: (callback: (update: UpdateCheckResult) => void) => {
    const handler = (_event: any, update: UpdateCheckResult) =>
      callback(update);
    ipcRenderer.on('agent-update-available', handler);
    return () => ipcRenderer.removeListener('agent-update-available', handler);
  },
};
