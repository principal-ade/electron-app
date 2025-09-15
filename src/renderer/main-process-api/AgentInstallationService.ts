import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentInstallProgress, AgentInstallStatus, AgentUpdateStatus, AgentVersion } from "../../shared/main-process-api-interfaces/AgentInstallationAPI";



export class AgentInstallationService {
  static onInstallProgress(agentType: SupportedAgent, callback: (progress: AgentInstallProgress) => void): () => void {
    return window.mainProcess.agentInstallation.onInstallProgress(agentType, callback);
  }
  static onInstallComplete(agentType: SupportedAgent, callback: (status: any) => void): () => void {
    return window.mainProcess.agentInstallation.onInstallComplete(agentType, callback);
  }
  static onInstallError(agentType: SupportedAgent, callback: (error: string) => void): () => void {
    return window.mainProcess.agentInstallation.onInstallError(agentType, callback);
  }
  static checkInstallation(agentType: SupportedAgent): Promise<AgentInstallStatus> {
    return window.mainProcess.agentInstallation.checkInstallation(agentType);
  }
  static install(agentType: SupportedAgent, version?: string): Promise<void> {
    return window.mainProcess.agentInstallation.install(agentType, version);
  }
  static onUninstallComplete(agentType: SupportedAgent, callback: () => void): () => void {
    return window.mainProcess.agentInstallation.onUninstallComplete(agentType, callback);
  }
  static uninstall(agentType: SupportedAgent): Promise<void> {
    return window.mainProcess.agentInstallation.uninstall(agentType);
  }
  static checkForUpdates(agentType: SupportedAgent): Promise<AgentUpdateStatus> {
    return window.mainProcess.agentInstallation.checkForUpdates(agentType);
  }
  static getAvailableVersions(agentType: SupportedAgent): Promise<AgentVersion[]> {
    return window.mainProcess.agentInstallation.getAvailableVersions(agentType);
  }
  static getLatestVersion(agentType: SupportedAgent): Promise<AgentVersion> {
    return window.mainProcess.agentInstallation.getLatestVersion(agentType);
  }
  static update(agentType: SupportedAgent): Promise<void> {
    return window.mainProcess.agentInstallation.update(agentType);
  }
}