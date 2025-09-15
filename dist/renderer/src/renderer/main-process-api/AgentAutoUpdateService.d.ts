import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentUpdatePreferences, UpdateCheckResult } from '../../shared/main-process-api-interfaces/AgentUpdateAPI';
export type { AgentUpdatePreferences, UpdateCheckResult };
/**
 * Service layer for agent auto-update functionality
 * ALL window.mainProcess.agentUpdate calls MUST be encapsulated here
 */
export declare class AgentAutoUpdateService {
    /**
     * Check all agents for updates
     */
    static checkAllForUpdates(): Promise<UpdateCheckResult[]>;
    /**
     * Check a specific agent for updates
     */
    static checkForUpdate(agentType: SupportedAgent): Promise<UpdateCheckResult | null>;
    /**
     * Get update preferences
     */
    static getUpdatePreferences(): Promise<AgentUpdatePreferences>;
    /**
     * Save update preferences
     */
    static saveUpdatePreferences(preferences: Partial<AgentUpdatePreferences>): Promise<void>;
    /**
     * Get stored update info for an agent
     */
    static getStoredUpdateInfo(agentType: SupportedAgent): Promise<UpdateCheckResult | null>;
    /**
     * Clear stored update info for an agent
     */
    static clearStoredUpdateInfo(agentType: SupportedAgent): Promise<void>;
    /**
     * Listen for update available events
     */
    static onUpdateAvailable(callback: (update: UpdateCheckResult) => void): () => void;
}
//# sourceMappingURL=AgentAutoUpdateService.d.ts.map