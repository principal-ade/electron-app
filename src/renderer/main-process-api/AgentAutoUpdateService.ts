import { SupportedAgent } from "@principal-ai/agent-monitoring";
import { AgentUpdatePreferences, UpdateCheckResult } from '../../shared/main-process-api-interfaces/AgentUpdateAPI';

// Re-export types for backward compatibility
export type { AgentUpdatePreferences, UpdateCheckResult };

/**
 * Service layer for agent auto-update functionality
 * ALL window.mainProcess.agentUpdate calls MUST be encapsulated here
 */
export class AgentAutoUpdateService {
  /**
   * Check all agents for updates
   */
  static async checkAllForUpdates(): Promise<UpdateCheckResult[]> {
    return window.mainProcess.agentUpdate.checkAllForUpdates();
  }

  /**
   * Check a specific agent for updates
   */
  static async checkForUpdate(agentType: SupportedAgent): Promise<UpdateCheckResult | null> {
    return window.mainProcess.agentUpdate.checkForUpdate(agentType);
  }

  /**
   * Get update preferences
   */
  static async getUpdatePreferences(): Promise<AgentUpdatePreferences> {
    return window.mainProcess.agentUpdate.getUpdatePreferences();
  }

  /**
   * Save update preferences
   */
  static async saveUpdatePreferences(preferences: Partial<AgentUpdatePreferences>): Promise<void> {
    return window.mainProcess.agentUpdate.saveUpdatePreferences(preferences);
  }

  /**
   * Get stored update info for an agent
   */
  static async getStoredUpdateInfo(agentType: SupportedAgent): Promise<UpdateCheckResult | null> {
    return window.mainProcess.agentUpdate.getStoredUpdateInfo(agentType);
  }

  /**
   * Clear stored update info for an agent
   */
  static async clearStoredUpdateInfo(agentType: SupportedAgent): Promise<void> {
    return window.mainProcess.agentUpdate.clearStoredUpdateInfo(agentType);
  }

  /**
   * Listen for update available events
   */
  static onUpdateAvailable(callback: (update: UpdateCheckResult) => void): () => void {
    return window.mainProcess.agentUpdate.onUpdateAvailable(callback);
  }
}