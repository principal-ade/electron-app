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
      console.log('[AgentSessionSDKService] No calls recorded yet.');
      return;
    }

    console.group('[AgentSessionSDKService] Call statistics');
    entries.forEach(([method, count]) => {
      console.log(`${method}: ${count}`);
    });
    console.groupEnd();
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
   * Returns an unsubscribe function
   */
  static onProcessedEvent(
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ): () => void {
    this.recordCall('onProcessedEvent');
    console.log(
      '[AgentSessionSDKService] Setting up onProcessedEvent subscription',
    );
    const unsubscribe = window.mainProcess.agentSessionSDK.onProcessedEvent(
      (event) => {
        console.log(
          '[AgentSessionSDKService] Event received from IPC:',
          event.eventType,
        );
        callback(event);
      },
    );
    console.log(
      '[AgentSessionSDKService] Subscription set up, unsubscribe function created',
    );
    return unsubscribe;
  }
}
