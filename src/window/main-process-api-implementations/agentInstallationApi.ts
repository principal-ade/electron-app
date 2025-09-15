import { ipcRenderer, IpcRendererEvent } from 'electron';

import { SupportedAgent } from "@principal-ai/agent-monitoring";

import {
  AgentInstallationAPI,
  AgentInstallationEvents,
  AgentInstallProgress,
  AgentInstallStatus,
  AgentUpdateStatus,
  type AgentVersion,
} from '../../shared/main-process-api-interfaces/AgentInstallationAPI';

export const agentInstallationAPI: AgentInstallationAPI = {
  onInstallProgress: (
    agentType: SupportedAgent,
    callback: (progress: AgentInstallProgress) => void): () => void => {
    const subscription = (_event: IpcRendererEvent, data: AgentInstallProgress) => {
      if (data.agentType !== agentType) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on(AgentInstallationEvents.INSTALL_PROGRESS, subscription);
    return () => {
      ipcRenderer.removeListener(AgentInstallationEvents.INSTALL_PROGRESS, subscription);
    };
  },
  onInstallComplete: (agentType: SupportedAgent, callback: (status: any) => void) => {
    const subscription = (_event: IpcRendererEvent, data: AgentInstallStatus) => {
      if (data.agentType !== agentType) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on(AgentInstallationEvents.INSTALL_COMPLETE, subscription);
    return () => {
      ipcRenderer.removeListener(AgentInstallationEvents.INSTALL_COMPLETE, subscription);
    };
  },
  onInstallError: (agentType: SupportedAgent, callback: (error: string) => void) => {
    const subscription = (_event: IpcRendererEvent, data: { agentType: SupportedAgent; error: string }) => {
      if (data.agentType !== agentType) {
        return;
      }
      callback(data.error);
    };
    ipcRenderer.on(AgentInstallationEvents.INSTALL_ERROR, subscription);
    return () => {
      ipcRenderer.removeListener(AgentInstallationEvents.INSTALL_ERROR, subscription);
    };
  },
  checkInstallation: (agentType: SupportedAgent): Promise<AgentInstallStatus> => {
    return ipcRenderer.invoke(AgentInstallationEvents.CHECK_INSTALLATION, agentType);
  },
  install: (agentType: SupportedAgent): Promise<void> => {
    return ipcRenderer.invoke(AgentInstallationEvents.INSTALL, agentType);
  },
  onUninstallComplete: (agentType: SupportedAgent, callback: () => void) => {
    const subscription = (_event: IpcRendererEvent, data: AgentInstallStatus) => {
      if (data.agentType !== agentType) {
        return;
      }
      callback();
    };
    ipcRenderer.on(AgentInstallationEvents.UNINSTALL_COMPLETE, subscription);
    return () => {
      ipcRenderer.removeListener(AgentInstallationEvents.UNINSTALL_COMPLETE, subscription);
    };
  },
  uninstall: (agentType: SupportedAgent): Promise<void> => {
    return ipcRenderer.invoke(AgentInstallationEvents.UNINSTALL, agentType);
  },
  checkForUpdates: (agentType: SupportedAgent): Promise<AgentUpdateStatus> => {
    return ipcRenderer.invoke(AgentInstallationEvents.CHECK_FOR_UPDATES, agentType);
  },
  getAvailableVersions: (agentType: SupportedAgent): Promise<AgentVersion[]> => {
    return ipcRenderer.invoke(AgentInstallationEvents.GET_AVAILABLE_VERSIONS, agentType);
  },
  getLatestVersion: (agentType: SupportedAgent): Promise<AgentVersion> => {
    return ipcRenderer.invoke(AgentInstallationEvents.GET_LATEST_VERSION, agentType);
  },
  update: (agentType: SupportedAgent): Promise<void> => {
    return ipcRenderer.invoke(AgentInstallationEvents.UPDATE, agentType);
  },
};  