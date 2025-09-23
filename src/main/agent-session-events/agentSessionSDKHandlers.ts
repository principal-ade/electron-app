/**
 * SDK-based Agent Session Handlers for Main Process
 *
 * IMPORTANT: These handlers ONLY use EventServerManager and ObservabilityIntegration
 * They do NOT read from existing storage (StaticNamespaces.AGENT_SESSIONS)
 * All data comes from live events or the SDK
 */

import { ipcMain } from 'electron';
import {
  AgentSessionSDKAPIEvents,
  ProjectSessions,
  SessionSummary
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';
import { getEventServerManager } from './EventServerManager';
import { getObservabilityIntegration } from '../observability/ObservabilityIntegration';
import type {
  RepoNormalizedUniversalAgentSessionEvent
} from '@principal-ai/agent-monitoring';
import { SessionState } from '../../shared/event-processing/SessionEventProcessor';
import { SupportedAgent } from '@principal-ai/agent-monitoring';

/**
 * Extended session state that includes provider and repository
 */
interface SDKSessionState extends SessionState {
  provider: SupportedAgent;
  repository: string;
  startTime: number;
  lastUpdateTime: number;
}

/**
 * In-memory cache of active sessions from events
 * This replaces reading from storage
 */
class SessionCache {
  private sessions: Map<string, SDKSessionState> = new Map();
  private eventsBySession: Map<string, RepoNormalizedUniversalAgentSessionEvent[]> = new Map();

  constructor() {
    // Subscribe to events from EventServerManager
    this.setupEventListeners();
  }

  private setupEventListeners() {
    const eventManager = getEventServerManager();

    // Listen for processed events emitted by EventServerManager
    eventManager.on('processed-event', (event: RepoNormalizedUniversalAgentSessionEvent) => {
      this.handleNewEvent(event);
    });
  }

  private handleNewEvent(event: RepoNormalizedUniversalAgentSessionEvent) {
    const sessionId = event.sessionId;

    // Add to events list
    if (!this.eventsBySession.has(sessionId)) {
      this.eventsBySession.set(sessionId, []);
    }
    this.eventsBySession.get(sessionId)!.push(event);

    // Update or create session state
    if (!this.sessions.has(sessionId)) {
      // Create new session
      this.sessions.set(sessionId, {
        sessionId,
        provider: event.provider,
        repository: event.repository?.root || event.workingDirectory || '',
        workingDirectory: event.repository?.root || event.workingDirectory || '',
        startTime: event.timestamp,
        lastUpdateTime: event.timestamp,
        firstAccess: event.timestamp,
        lastActivity: event.timestamp,
        isActive: true,
        eventCount: 1,
        fileAccessCount: 0,
        fileWriteCount: 0,
        fileAccesses: {},
        fileWrites: {},
        filesRead: [],
        filesWritten: [],
        toolCallCount: 0,
        webAccessCount: 0,
        metadata: {},
      });
    } else {
      // Update existing session
      const session = this.sessions.get(sessionId)!;
      session.lastUpdateTime = event.timestamp;
      session.lastActivity = event.timestamp;
      session.eventCount++;

      // Check if session should be marked as inactive (e.g., stop event)
      if (event.eventType === 'stop') {
        session.isActive = false;
      }
    }
  }

  getSessionsByProject(): ProjectSessions[] {
    const projectMap = new Map<string, ProjectSessions>();

    for (const [sessionId, session] of this.sessions) {
      const repository = session.repository || 'unknown';

      if (!projectMap.has(repository)) {
        projectMap.set(repository, {
          repository,
          summaries: []
        });
      }

      const project = projectMap.get(repository)!;
      project.summaries.push({
        sessionId: session.sessionId,
        repository: session.repository,
        agentCLI: session.provider,
        startTime: session.startTime,
        lastActivity: session.lastUpdateTime,
        active: session.isActive,
        eventCount: session.eventCount,
        customName: session.customName,
        fileAccessCount: session.fileAccessCount,
        fileWriteCount: session.fileWriteCount,
      });
    }

    return Array.from(projectMap.values());
  }

  getSession(sessionId: string): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Return SessionState without SDK-specific fields
    const { provider, repository, startTime, lastUpdateTime, ...sessionState } = session;
    return sessionState;
  }

  getSessionEvents(sessionId: string): RepoNormalizedUniversalAgentSessionEvent[] | null {
    return this.eventsBySession.get(sessionId) || null;
  }

  deleteFromActive(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    this.eventsBySession.delete(sessionId);
    return deleted;
  }

  updateSessionMetadata(sessionId: string, metadata: { customName?: string }): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.metadata = { ...session.metadata, ...metadata };
    return true;
  }
}

// Create singleton cache
const sessionCache = new SessionCache();

/**
 * Check if ObservabilityIntegration is configured and can provide data
 */
async function tryGetFromSDK(): Promise<boolean> {
  try {
    const observability = getObservabilityIntegration();
    const stats = observability.getStats();
    return stats.isInitialized;
  } catch {
    return false;
  }
}

/**
 * Register all SDK API handlers
 */
export function registerAgentSessionSDKHandlers(): void {
  console.log('[SDK Handlers] Registering agent session SDK handlers...');

  // Get active sessions by project
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_ACTIVE_SESSIONS_BY_PROJECT,
    async () => {
      try {
        // Check if we can use the SDK
        const sdkAvailable = await tryGetFromSDK();

        if (sdkAvailable) {
          // TODO: Once SDK supports querying sessions, use it here
          // For now, fall back to cache
          console.log('[SDK Handlers] SDK available but session query not yet implemented');
        }

        // Use in-memory cache populated from live events
        const sessions = sessionCache.getSessionsByProject();
        console.log(`[SDK Handlers] Returning ${sessions.length} projects from cache`);
        return sessions;

      } catch (error) {
        console.error('[SDK Handlers] Error getting active sessions:', error);
        return [];
      }
    }
  );

  // Get sessions for a specific directory
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSIONS_FOR_DIRECTORY,
    async (_event, directory: string) => {
      try {
        // Map directory to repository (in real implementation, find git root)
        // For now, use directory as-is
        const allProjects = sessionCache.getSessionsByProject();
        const project = allProjects.find(p =>
          p.repository === directory
        );

        console.log(`[SDK Handlers] Found project for directory ${directory}:`, !!project);
        return project || null;

      } catch (error) {
        console.error('[SDK Handlers] Error getting sessions for directory:', error);
        return null;
      }
    }
  );

  // Get specific session
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSION,
    async (_event, sessionId: string, repository: string) => {
      try {
        const session = sessionCache.getSession(sessionId);
        console.log(`[SDK Handlers] Found session ${sessionId}:`, !!session);
        return session;

      } catch (error) {
        console.error('[SDK Handlers] Error getting session:', error);
        return null;
      }
    }
  );

  // Get session events
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSION_EVENTS,
    async (_event, sessionId: string) => {
      try {
        const events = sessionCache.getSessionEvents(sessionId);
        console.log(`[SDK Handlers] Found ${events?.length || 0} events for session ${sessionId}`);
        return events;

      } catch (error) {
        console.error('[SDK Handlers] Error getting session events:', error);
        return null;
      }
    }
  );

  // Update session metadata
  ipcMain.handle(
    AgentSessionSDKAPIEvents.UPDATE_SESSION_METADATA,
    async (_event, sessionId: string, repository: string, metadata: { customName?: string }) => {
      try {
        const updated = sessionCache.updateSessionMetadata(sessionId, metadata);
        console.log(`[SDK Handlers] Updated metadata for session ${sessionId}:`, updated);
        return updated;

      } catch (error) {
        console.error('[SDK Handlers] Error updating session metadata:', error);
        return false;
      }
    }
  );

  // Delete from active
  ipcMain.handle(
    AgentSessionSDKAPIEvents.DELETE_FROM_ACTIVE,
    async (_event, sessionId: string) => {
      try {
        const deleted = sessionCache.deleteFromActive(sessionId);
        console.log(`[SDK Handlers] Deleted session ${sessionId}:`, deleted);
        return deleted;

      } catch (error) {
        console.error('[SDK Handlers] Error deleting session:', error);
        return false;
      }
    }
  );

  // Reprocess session
  ipcMain.handle(
    AgentSessionSDKAPIEvents.REPROCESS_SESSION,
    async (_event, sessionId: string) => {
      try {
        // In the new architecture, reprocessing means re-reading from SDK
        // For now, return success
        console.log(`[SDK Handlers] Reprocess requested for session ${sessionId}`);
        return {
          success: true,
          processedCount: 0,
        };

      } catch (error) {
        console.error('[SDK Handlers] Error reprocessing session:', error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }
  );

  // Get raw session events (for debugging)
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_RAW_SESSION_EVENTS,
    async (_event, sessionId: string) => {
      try {
        // Return the same as regular events for now
        const events = sessionCache.getSessionEvents(sessionId);
        console.log(`[SDK Handlers] Returning raw events for session ${sessionId}`);
        return events;

      } catch (error) {
        console.error('[SDK Handlers] Error getting raw events:', error);
        return null;
      }
    }
  );

  console.log('[SDK Handlers] Agent session SDK handlers registered');
}

/**
 * Unregister all SDK API handlers
 */
export function unregisterAgentSessionSDKHandlers(): void {
  const events = Object.values(AgentSessionSDKAPIEvents);
  events.forEach(event => {
    ipcMain.removeHandler(event);
  });
  console.log('[SDK Handlers] Agent session SDK handlers unregistered');
}