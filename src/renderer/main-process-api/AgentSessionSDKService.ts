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
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';

/**
 * SDK-based Session Service
 */
export class AgentSessionSDKService {
  /**
   * Get active sessions grouped by project/repository
   * Replaces: getActiveSessions() returning DirectorySessions[]
   */
  static async getActiveSessionsByProject(): Promise<ProjectSessions[]> {
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
    return window.mainProcess.agentSessionSDK.getSDKSessionEvents(sessionId);
  }

  /**
   * Compatibility helper: Get sessions for a directory
   * Maps directory to repository root
   */
  static async getActiveSessionsForDirectory(
    directory: string,
  ): Promise<ProjectSessions | null> {
    return window.mainProcess.agentSessionSDK.getActiveSessionsForDirectory(
      directory,
    );
  }
}