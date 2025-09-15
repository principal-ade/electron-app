import { ipcMain } from 'electron';
import { AgentAutoUpdateService } from './AgentAutoUpdateService';
import { SupportedAgent } from "@principal-ai/agent-monitoring";

export enum AgentAutoUpdateEvents {
  CHECK_ALL_UPDATES = 'agent-auto-update:check-all',
  CHECK_UPDATE = 'agent-auto-update:check',
  GET_UPDATE_PREFERENCES = 'agent-auto-update:get-preferences',
  SAVE_UPDATE_PREFERENCES = 'agent-auto-update:save-preferences',
  GET_STORED_UPDATE_INFO = 'agent-auto-update:get-stored-info',
  CLEAR_STORED_UPDATE_INFO = 'agent-auto-update:clear-stored-info',
}

export function registerAgentAutoUpdateHandlers() {
  const autoUpdateService = AgentAutoUpdateService.getInstance();

  // Check all agents for updates
  ipcMain.handle(AgentAutoUpdateEvents.CHECK_ALL_UPDATES, async () => {
    console.log('[AgentAutoUpdate IPC] Checking all agents for updates...');
    return await autoUpdateService.checkAllForUpdates();
  });

  // Check specific agent for updates
  ipcMain.handle(AgentAutoUpdateEvents.CHECK_UPDATE, async (_, agentType: SupportedAgent) => {
    console.log(`[AgentAutoUpdate IPC] Checking ${agentType} for updates...`);
    return await autoUpdateService.checkForUpdate(agentType);
  });

  // Get update preferences
  ipcMain.handle(AgentAutoUpdateEvents.GET_UPDATE_PREFERENCES, async () => {
    return await autoUpdateService.getUpdatePreferences();
  });

  // Save update preferences
  ipcMain.handle(AgentAutoUpdateEvents.SAVE_UPDATE_PREFERENCES, async (_, preferences) => {
    console.log('[AgentAutoUpdate IPC] Saving update preferences:', preferences);
    await autoUpdateService.saveUpdatePreferences(preferences);
  });

  // Get stored update info for an agent
  ipcMain.handle(AgentAutoUpdateEvents.GET_STORED_UPDATE_INFO, async (_, agentType: SupportedAgent) => {
    return await autoUpdateService.getStoredUpdateInfo(agentType);
  });

  // Clear stored update info for an agent
  ipcMain.handle(AgentAutoUpdateEvents.CLEAR_STORED_UPDATE_INFO, async (_, agentType: SupportedAgent) => {
    await autoUpdateService.clearStoredUpdateInfo(agentType);
  });
}