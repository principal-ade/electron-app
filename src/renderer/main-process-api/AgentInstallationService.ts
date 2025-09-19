/**
 * Stub for AgentInstallationService
 * Since agent installation is no longer supported, this provides compatibility
 * for existing UI components while showing download links instead
 */

import { SupportedAgent, getAgentInfo } from '@principal-ai/agent-monitoring';

export interface InstallProgress {
  message: string;
  progress?: number;
}

export interface InstallationStatus {
  installed: boolean;
  version?: string;
  path?: string;
}

/**
 * Stub implementation that always returns installed: true to avoid blocking
 * and opens download links instead of installing
 */
export class AgentInstallationService {
  /**
   * Always returns installed: true to avoid blocking UI flows
   */
  static async checkInstallation(
    agentType: SupportedAgent,
  ): Promise<InstallationStatus> {
    return {
      installed: true, // Always return true to avoid blocking
      version: 'unknown',
      path: 'N/A',
    };
  }

  /**
   * Opens the download link for the agent instead of installing
   */
  static async install(agentType: SupportedAgent): Promise<void> {
    const agentInfo = getAgentInfo(agentType);
    if (agentInfo?.ui?.downloadUrl) {
      window.open(agentInfo.ui.downloadUrl, '_blank');
    }
    // Simulate completion after a short delay
    setTimeout(() => {
      // Trigger any completion callbacks
    }, 1000);
  }

  /**
   * No-op uninstall
   */
  static async uninstall(agentType: SupportedAgent): Promise<void> {
    console.log(`Uninstall not supported for ${agentType}`);
  }

  /**
   * Progress listener - returns no-op unsubscribe function
   */
  static onInstallProgress(
    agentType: SupportedAgent,
    callback: (progress: InstallProgress | string) => void,
  ): () => void {
    // Immediately show a message
    setTimeout(() => {
      callback({ message: 'Opening download page...' });
    }, 100);

    // Return no-op unsubscribe
    return () => {};
  }

  /**
   * Completion listener - triggers immediately
   */
  static onInstallComplete(
    agentType: SupportedAgent,
    callback: () => void,
  ): () => void {
    // Trigger completion after a short delay
    const timeout = setTimeout(() => {
      callback();
    }, 1500);

    // Return unsubscribe that clears timeout
    return () => clearTimeout(timeout);
  }

  /**
   * Error listener - never triggers
   */
  static onInstallError(
    agentType: SupportedAgent,
    callback: (error: string) => void,
  ): () => void {
    // Never trigger errors in stub
    return () => {};
  }

  /**
   * Uninstall completion listener - triggers immediately
   */
  static onUninstallComplete(
    agentType: SupportedAgent,
    callback: () => void,
  ): () => void {
    // Trigger immediately
    setTimeout(callback, 100);
    return () => {};
  }
}
