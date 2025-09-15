import { SupportedAgent } from "@principal-ai/agent-monitoring";

/**
 * Preferences for agent auto-update functionality
 */
export interface AgentUpdatePreferences {
  enabled: boolean;
  checkInterval: number; // in hours
  autoInstall: boolean;
  lastCheckTime?: number;
  notifyOnly: boolean;
}

/**
 * Result of an update check for an agent
 */
export interface UpdateCheckResult {
  agentType: SupportedAgent;
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion: string;
}

/**
 * API for managing agent auto-updates
 */
export interface AgentUpdateAPI {
  /**
   * Check all agents for available updates
   */
  checkAllForUpdates(): Promise<UpdateCheckResult[]>;
  
  /**
   * Check a specific agent for updates
   */
  checkForUpdate(agentType: SupportedAgent): Promise<UpdateCheckResult | null>;
  
  /**
   * Get update preferences
   */
  getUpdatePreferences(): Promise<AgentUpdatePreferences>;
  
  /**
   * Save update preferences
   */
  saveUpdatePreferences(preferences: Partial<AgentUpdatePreferences>): Promise<void>;
  
  /**
   * Get stored update info for an agent
   */
  getStoredUpdateInfo(agentType: SupportedAgent): Promise<UpdateCheckResult | null>;
  
  /**
   * Clear stored update info for an agent
   */
  clearStoredUpdateInfo(agentType: SupportedAgent): Promise<void>;
  
  /**
   * Listen for update available events
   * @returns Unsubscribe function
   */
  onUpdateAvailable(callback: (update: UpdateCheckResult) => void): () => void;
}