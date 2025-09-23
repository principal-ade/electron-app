/**
 * AgentSessionSDKService - New service using SDK types directly
 *
 * This service replaces AgentSessionService and uses the new SDK event format
 * (RepoNormalizedUniversalAgentSessionEvent) instead of the legacy format.
 */

import type {
  RepoNormalizedUniversalAgentSessionEvent,
} from '@principal-ai/agent-monitoring';
import type { SessionState } from '../../shared/event-processing/SessionEventProcessor';
import {
  ProjectSessions,
  SessionSummary,
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';

/**
 * Track which methods are actually called
 */
const CALL_TRACKER: Record<string, number> = {};

function trackCall(methodName: string, ...args: any[]): void {
  CALL_TRACKER[methodName] = (CALL_TRACKER[methodName] || 0) + 1;
  console.log(`[SDK Service] ${methodName} called:`, {
    count: CALL_TRACKER[methodName],
    args: args.length > 0 ? args : undefined,
    stack: new Error().stack?.split('\n').slice(2, 4).join('\n'),
  });
}

/**
 * Print call statistics
 */
export function printCallStats(): void {
  console.log('[SDK Service] Call Statistics:', CALL_TRACKER);
}

/**
 * SDK-based Session Service
 */
export class AgentSessionSDKService {
  /**
   * Get active sessions grouped by project/repository
   * Replaces: getActiveSessions() returning DirectorySessions[]
   */
  static async getActiveSessionsByProject(): Promise<ProjectSessions[]> {
    trackCall('getActiveSessionsByProject');
    return window.mainProcess.agentSessionSDK.getActiveSessionsByProject();
  }

  /**
   * Get a specific session by ID
   * Now returns SDK session format
   */
  static async getSDKSession(
    sessionId: string,
    repository: string,
  ): Promise<SessionState | null> {
    trackCall('getSDKSession', sessionId, repository);
    return window.mainProcess.agentSessionSDK.getSDKSession(sessionId, repository);
  }

  /**
   * Get events for a session in SDK format
   * Returns: RepoNormalizedUniversalAgentSessionEvent[]
   */
  static async getSDKSessionEvents(
    sessionId: string,
  ): Promise<RepoNormalizedUniversalAgentSessionEvent[] | null> {
    trackCall('getSDKSessionEvents', sessionId);
    return window.mainProcess.agentSessionSDK.getSDKSessionEvents(sessionId);
  }

  /**
   * Update session metadata (e.g., custom name)
   */
  static async updateSessionMetadata(
    sessionId: string,
    repository: string,
    metadata: { customName?: string },
  ): Promise<boolean> {
    trackCall('updateSessionMetadata', sessionId, repository, metadata);

    // STUB: Always return success
    return true;
  }

  /**
   * Delete from active storage only (preserve archive)
   */
  static async deleteFromActive(sessionId: string): Promise<boolean> {
    trackCall('deleteFromActive', sessionId);

    // STUB: Always return success
    return true;
  }

  /**
   * Reprocess events for a session
   */
  static async reprocessSession(
    sessionId: string,
  ): Promise<{ success: boolean; processedCount?: number; error?: string }> {
    trackCall('reprocessSession', sessionId);

    // STUB: Return mock success
    return {
      success: true,
      processedCount: 42,
    };
  }

  /**
   * Get raw session events (for debug view)
   */
  static async getRawSessionEvents(sessionId: string): Promise<any[] | null> {
    trackCall('getRawSessionEvents', sessionId);

    // STUB: Return mock raw events
    return [
      {
        type: 'raw-event',
        sessionId,
        timestamp: Date.now(),
        data: { mock: true },
      },
    ];
  }

  /**
   * Subscribe to session updates
   */
  static onSessionUpdated(
    callback: (data: { sessionId: string; repository: string }) => void,
  ): () => void {
    trackCall('onSessionUpdated');

    // STUB: Return a no-op unsubscribe function
    // In real implementation, this would connect to IPC events
    console.log('[SDK Service] Session update listener registered');
    return () => {
      console.log('[SDK Service] Session update listener unregistered');
    };
  }

  /**
   * Subscribe to CLI provider events
   */
  static onCliProviderEvent(
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ): () => void {
    trackCall('onCliProviderEvent');

    // STUB: Return a no-op unsubscribe function
    console.log('[SDK Service] CLI provider event listener registered');
    return () => {
      console.log('[SDK Service] CLI provider event listener unregistered');
    };
  }

  /**
   * Subscribe to processed events
   */
  static onProcessedEvent(
    callback: (event: RepoNormalizedUniversalAgentSessionEvent) => void,
  ): () => void {
    trackCall('onProcessedEvent');

    // STUB: Return a no-op unsubscribe function
    console.log('[SDK Service] Processed event listener registered');
    return () => {
      console.log('[SDK Service] Processed event listener unregistered');
    };
  }

  /**
   * Helper: Map directory to repository root
   * This is needed because UI still thinks in directories
   */
  static async mapDirectoryToRepository(directory: string): Promise<string> {
    trackCall('mapDirectoryToRepository', directory);

    // STUB: For now, just return the directory as-is
    // Real implementation would find the git root
    return directory;
  }

  /**
   * Helper: Convert legacy directory-based query to repository
   * Used by components still using directory concept
   */
  static async getActiveSessionsForDirectory(
    directory: string,
  ): Promise<ProjectSessions | null> {
    trackCall('getActiveSessionsForDirectory', directory);
    return window.mainProcess.agentSessionSDK.getActiveSessionsForDirectory(directory);
  }
}

// Export a function to check what's been called
if (typeof window !== 'undefined') {
  (window as any).sdkServiceStats = printCallStats;
}