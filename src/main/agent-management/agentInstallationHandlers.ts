import { ipcMain } from 'electron';
import { AgentInstallProgress, AgentInstallationEvents } from '../../shared/main-process-api-interfaces/AgentInstallationAPI';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { OpenCodeInstallationService } from './OpenCodeInstallationService';
import { ClineInstallationService } from './ClineInstallationService';
import { BaseAgentInstallationService } from './BaseAgentInstallationService';

export function registerAgentInstallationHandlers() {
  const openCodeService = OpenCodeInstallationService.getInstance();
  const clineService = ClineInstallationService.getInstance();
  const agentServices: Record<SupportedAgent, BaseAgentInstallationService | undefined> = {
    [SupportedAgent.OPENCODE]: openCodeService,
    [SupportedAgent.CLAUDE]: undefined,
    [SupportedAgent.CLINE]: clineService,
  };

  ipcMain.handle(AgentInstallationEvents.INSTALL, async (event, agentType: SupportedAgent, version?: string) => {
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }

    const service = agentServices[agentType];
    console.log(`[${agentType} IPC] Starting installation, version:`, version || 'latest');
    service.setProgressCallback((progress: AgentInstallProgress) => {
      console.log(`[${agentType} IPC] Installation progress:`, progress);
      event.sender.send(AgentInstallationEvents.INSTALL_PROGRESS, progress);
    });

    try {
      await service.install(version);
      console.log(`[${agentType} IPC] Installation completed, checking status...`);
      const status = await service.checkInstallation();
      console.log(`[${agentType} IPC] Post-install status:`, status);
      event.sender.send(AgentInstallationEvents.INSTALL_COMPLETE, status);
    } catch (error) {
      console.error(`[${agentType} IPC] Installation error:`, error);
      event.sender.send(
        AgentInstallationEvents.INSTALL_ERROR,
        {
          agentType,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      );
      throw error;
    }
  });


  // Detection handlers
  ipcMain.handle(AgentInstallationEvents.CHECK_INSTALLATION, async (event, agentType: SupportedAgent) => {
    console.log(`[${agentType} IPC] Checking installation status...`);
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    const result = await agentServices[agentType].checkInstallation();
    console.log(`[${agentType} IPC] Installation check result:`, result);
    return result;
  });
  /*
  ipcMain.handle(AgentInstallationEvents.GET_INSTALLED_VERSION, async (_, agentType: SupportedAgent) => {
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    return await agentServices[agentType].getInstalledVersion();
  });

  ipcMain.handle(AgentInstallationEvents.IS_OUR_VERSION, async (_, agentType: SupportedAgent, path: string) => {
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    return await agentServices[agentType].isOurVersion(path);
  });
  */

  // Version management handlers
  ipcMain.handle(AgentInstallationEvents.GET_AVAILABLE_VERSIONS, async (_, agentType: SupportedAgent) => {
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    return await agentServices[agentType].getAvailableVersions();
  });

  ipcMain.handle(AgentInstallationEvents.GET_LATEST_VERSION, async (_, agentType: SupportedAgent) => {
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    return await agentServices[agentType].getLatestVersion();
  });

  ipcMain.handle(AgentInstallationEvents.CHECK_FOR_UPDATES, async (_, agentType: SupportedAgent) => {
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    return await agentServices[agentType].checkForUpdates();
  });

  // Installation handlers
  ipcMain.handle(AgentInstallationEvents.UNINSTALL, async (event, agentType: SupportedAgent) => {
    console.log(`[${agentType} IPC] Starting uninstall...`);
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    try {
      await agentServices[agentType].uninstall();
      console.log(`[${agentType} IPC] Uninstall completed successfully`);
      event.sender.send(AgentInstallationEvents.UNINSTALL_COMPLETE, { agentType });
    } catch (error) {
      console.error(`[${agentType} IPC] Uninstall error:`, error);
      throw error;
    }
  });

  ipcMain.handle(AgentInstallationEvents.UPDATE, async (event, agentType: SupportedAgent) => {
    if (!agentServices[agentType]) {
      throw new Error(`No installation service found for agent type: ${agentType}`);
    }
    agentServices[agentType].setProgressCallback((progress: AgentInstallProgress) => {
      event.sender.send(AgentInstallationEvents.INSTALL_PROGRESS, progress);
    });

    try {
      await agentServices[agentType].update();
      const status = await agentServices[agentType].checkInstallation();
      event.sender.send(AgentInstallationEvents.INSTALL_COMPLETE, status);
    } catch (error) {
      event.sender.send(
        AgentInstallationEvents.INSTALL_ERROR,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  });
}
