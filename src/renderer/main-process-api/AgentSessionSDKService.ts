/**
 * AgentSessionSDKService - New service using SDK types directly
 *
 * This service replaces AgentSessionService and uses the new SDK event format
 * (RepoNormalizedUniversalAgentSessionEvent) instead of the legacy format.
 */

import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import type { SessionState } from '../../shared/event-processing/SessionEventProcessor';
import { ProjectSessions } from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';

/**
 * SDK-based Session Service
 */
export class AgentSessionSDKService {
  private static callCounts: Record<string, number> = {};

  private static recordCall(method: string): void {
    this.callCounts[method] = (this.callCounts[method] ?? 0) + 1;
  }

  static printCallStats(): void {
    const entries = Object.entries(this.callCounts).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      console.info('[AgentSessionSDKService] No calls recorded yet.');
      return;
    }

    console.info('[AgentSessionSDKService] Call statistics');
    entries.forEach(([method, count]) => {
      console.info(`  ${method}: ${count}`);
    });
  }

  /**
   * Get active sessions grouped by project/repository
   * Replaces: getActiveSessions() returning DirectorySessions[]
   */
  static async getActiveSessionsByProject(): Promise<ProjectSessions[]> {
    this.recordCall('getActiveSessionsByProject');
    return window.mainProcess.agentSessionSDK.getActiveSessionsByProject();
  }

  /**
   * Get specific session by ID
   * Replaces: getSession() with enhanced typing
   */
  static async getSDKSession(
    sessionId: string,
    repository: string,
  ): Promise<SessionState | null> {
    this.recordCall('getSDKSession');
    return window.mainProcess.agentSessionSDK.getSDKSession(
      sessionId,
      repository,
    );
  }

  /**
   * Get session events in SDK format
   * Replaces: getSessionEvents() returning legacy format
   */
  static async getSDKSessionEvents(
    sessionId: string,
  ): Promise<RepoNormalizedUniversalAgentSessionEvent[] | null> {
    this.recordCall('getSDKSessionEvents');
    return window.mainProcess.agentSessionSDK.getSDKSessionEvents(sessionId);
  }

  /**
   * Compatibility helper: Get sessions for a directory
   * Maps directory to repository root
   */
  static async getActiveSessionsForDirectory(
    directory: string,
  ): Promise<ProjectSessions | null> {
    this.recordCall('getActiveSessionsForDirectory');
    return window.mainProcess.agentSessionSDK.getActiveSessionsForDirectory(
      directory,
    );
  }

  /**
   * Check event server health
   */
  static async checkEventServerHealth(): Promise<{
    isRunning: boolean;
    port?: number;
    healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
    error?: string;
  }> {
    this.recordCall('checkEventServerHealth');
    return window.mainProcess.agentSessionSDK.checkEventServerHealth();
  }

  /**
   * Subscribe to processed events
   * @deprecated Use registerEventPort instead for direct MessagePort communication
   */
  static onProcessedEvent(
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ): () => void {
    this.recordCall('onProcessedEvent');
    return window.mainProcess.agentSessionSDK.onProcessedEvent(callback);
  }

  /**
   * Register for events from a specific repository via direct MessagePort
   * This bypasses the main process for event delivery
   */
  static async registerEventPort(repository: string): Promise<boolean> {
    this.recordCall('registerEventPort');
    return window.mainProcess.agentSessionSDK.registerEventPort(repository);
  }

  /**
   * Unregister from events for a repository
   */
  static async unregisterEventPort(repository: string): Promise<void> {
    this.recordCall('unregisterEventPort');
    console.info(
      `[AgentSessionSDKService] Unregistering event port for: ${repository}`,
    );
    return window.mainProcess.agentSessionSDK.unregisterEventPort(repository);
  }

  /**
   * Callback for when a MessagePort is ready for use
   */
  static onEventPortReady(
    callback: (data: { repository: string }) => void,
  ): () => void {
    this.recordCall('onEventPortReady');
    return window.mainProcess.agentSessionSDK.onEventPortReady(callback);
  }

  /**
   * Subscribe to events for a specific repository
   * Call this after registerEventPort succeeds
   */
  static subscribeToRepositoryEvents(
    repository: string,
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ): () => void {
    this.recordCall('subscribeToRepositoryEvents');
    return window.mainProcess.agentSessionSDK.subscribeToRepositoryEvents(
      repository,
      callback,
    );
  }
}
