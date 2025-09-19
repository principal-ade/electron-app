/**
 * Stub for AgentAutoUpdateService
 * Since agent auto-updates are no longer supported, this provides compatibility
 */

import { SupportedAgent } from '@principal-ai/agent-monitoring';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion?: string;
  availableVersion?: string;
}

/**
 * Stub implementation that always returns no updates available
 */
export class AgentAutoUpdateService {
  /**
   * Always returns no updates available
   */
  static async checkForUpdates(
    agentType: SupportedAgent,
  ): Promise<UpdateCheckResult> {
    return {
      hasUpdate: false,
      currentVersion: 'unknown',
      availableVersion: 'unknown',
    };
  }

  /**
   * No-op auto-update toggle
   */
  static async setAutoUpdateEnabled(
    agentType: SupportedAgent,
    enabled: boolean,
  ): Promise<void> {
    console.log(`Auto-update settings not supported for ${agentType}`);
  }

  /**
   * Always returns false
   */
  static async isAutoUpdateEnabled(
    agentType: SupportedAgent,
  ): Promise<boolean> {
    return false;
  }
}
