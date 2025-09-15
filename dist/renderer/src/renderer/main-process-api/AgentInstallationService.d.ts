import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentInstallProgress, AgentInstallStatus, AgentUpdateStatus, AgentVersion } from "../../shared/main-process-api-interfaces/AgentInstallationAPI";
export declare class AgentInstallationService {
    static onInstallProgress(agentType: SupportedAgent, callback: (progress: AgentInstallProgress) => void): () => void;
    static onInstallComplete(agentType: SupportedAgent, callback: (status: any) => void): () => void;
    static onInstallError(agentType: SupportedAgent, callback: (error: string) => void): () => void;
    static checkInstallation(agentType: SupportedAgent): Promise<AgentInstallStatus>;
    static install(agentType: SupportedAgent, version?: string): Promise<void>;
    static onUninstallComplete(agentType: SupportedAgent, callback: () => void): () => void;
    static uninstall(agentType: SupportedAgent): Promise<void>;
    static checkForUpdates(agentType: SupportedAgent): Promise<AgentUpdateStatus>;
    static getAvailableVersions(agentType: SupportedAgent): Promise<AgentVersion[]>;
    static getLatestVersion(agentType: SupportedAgent): Promise<AgentVersion>;
    static update(agentType: SupportedAgent): Promise<void>;
}
//# sourceMappingURL=AgentInstallationService.d.ts.map