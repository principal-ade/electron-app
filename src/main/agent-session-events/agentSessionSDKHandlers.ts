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
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';
import { AgentSessionAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionAPI';
import { getEventServerManager } from './EventServerManager';
import { getObservabilityIntegration } from '../observability/ObservabilityIntegration';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
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
  private eventsBySession: Map<
    string,
    RepoNormalizedUniversalAgentSessionEvent[]
  > = new Map();

  constructor() {
    // Subscribe to events from EventServerManager
    this.setupEventListeners();
  }

  private setupEventListeners() {
    const eventManager = getEventServerManager();

    // Listen for processed events emitted by EventServerManager
    eventManager.on(
      'processed-event',
      (event: RepoNormalizedUniversalAgentSessionEvent) => {
        this.handleNewEvent(event);
      },
    );
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
        workingDirectory:
          event.repository?.root || event.workingDirectory || '',
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

    for (const [_sessionId, session] of this.sessions) {
      const repository = session.repository || 'unknown';

      if (!projectMap.has(repository)) {
        projectMap.set(repository, {
          repository,
          summaries: [],
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
    const {
      provider: _provider,
      repository: _repository,
      startTime: _startTime,
      lastUpdateTime: _lastUpdateTime,
      ...sessionState
    } = session;
    return sessionState;
  }

  getSessionEvents(
    sessionId: string,
  ): RepoNormalizedUniversalAgentSessionEvent[] | null {
    return this.eventsBySession.get(sessionId) || null;
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    this.eventsBySession.delete(sessionId);
    return deleted;
  }

  updateSessionMetadata(
    sessionId: string,
    metadata: { customName?: string },
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (metadata.customName !== undefined) {
      session.customName = metadata.customName;
    }

    return true;
  }

  clearSessionsForDirectory(directory: string): boolean {
    let deletedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (
        session.workingDirectory === directory ||
        session.repository === directory
      ) {
        this.sessions.delete(sessionId);
        this.eventsBySession.delete(sessionId);
        deletedCount++;
      }
    }

    return deletedCount > 0;
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
          console.log(
            '[SDK Handlers] SDK available but session query not yet implemented',
          );
        }

        // Use in-memory cache populated from live events
        const sessions = sessionCache.getSessionsByProject();
        console.log(
          `[SDK Handlers] Returning ${sessions.length} projects from cache`,
        );
        return sessions;
      } catch (error) {
        console.error('[SDK Handlers] Error getting active sessions:', error);
        return [];
      }
    },
  );

  // Get sessions for a specific directory
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSIONS_FOR_DIRECTORY,
    async (_event, directory: string) => {
      try {
        // Map directory to repository (in real implementation, find git root)
        // For now, use directory as-is
        const allProjects = sessionCache.getSessionsByProject();
        const project = allProjects.find((p) => p.repository === directory);

        console.log(
          `[SDK Handlers] Found project for directory ${directory}:`,
          !!project,
        );
        return project || null;
      } catch (error) {
        console.error(
          '[SDK Handlers] Error getting sessions for directory:',
          error,
        );
        return null;
      }
    },
  );

  // Get specific session
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSION,
    async (_event, sessionId: string, _repository: string) => {
      try {
        const session = sessionCache.getSession(sessionId);
        console.log(`[SDK Handlers] Found session ${sessionId}:`, !!session);
        return session;
      } catch (error) {
        console.error('[SDK Handlers] Error getting session:', error);
        return null;
      }
    },
  );

  // Get session events
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSION_EVENTS,
    async (_event, sessionId: string) => {
      try {
        const events = sessionCache.getSessionEvents(sessionId);
        console.log(
          `[SDK Handlers] Found ${events?.length || 0} events for session ${sessionId}`,
        );
        return events;
      } catch (error) {
        console.error('[SDK Handlers] Error getting session events:', error);
        return null;
      }
    },
  );

  // Check event server health
  ipcMain.handle(
    AgentSessionSDKAPIEvents.CHECK_EVENT_SERVER_HEALTH,
    async () => {
      try {
        const eventManager = getEventServerManager();
        const status = eventManager.getStatus();

        if (!status.isRunning) {
          return {
            isRunning: false,
            healthStatus: 'unhealthy' as const,
            error: 'Event server is not running',
          };
        }

        // Try to fetch health from HTTP endpoint
        try {
          const http = require('http');
          const response = await new Promise<{ status: number; data: unknown }>(
            (resolve, reject) => {
              const req = http.get(
                `http://localhost:${status.port}/health`,
                (res: {
                  statusCode?: number;
                  on: (
                    event: string,
                    callback: (data: unknown) => void,
                  ) => void;
                }) => {
                  let data = '';
                  res.on('data', (chunk: unknown) => (data += String(chunk)));
                  res.on('end', () => {
                    try {
                      const parsed = JSON.parse(data);
                      resolve({ status: res.statusCode || 200, data: parsed });
                    } catch (_e) {
                      resolve({
                        status: res.statusCode || 200,
                        data: { status: 'ok' },
                      });
                    }
                  });
                },
              );
              req.on('error', reject);
              req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Health check timeout'));
              });
            },
          );

          if (response.status === 200) {
            return {
              isRunning: true,
              port: status.port,
              healthStatus: 'healthy' as const,
            };
          } else {
            return {
              isRunning: true,
              port: status.port,
              healthStatus: 'unhealthy' as const,
              error: `HTTP ${response.status}`,
            };
          }
        } catch (httpError) {
          return {
            isRunning: true,
            port: status.port,
            healthStatus: 'unhealthy' as const,
            error: `Health check failed: ${httpError instanceof Error ? httpError.message : String(httpError)}`,
          };
        }
      } catch (error) {
        console.error(
          '[SDK Handlers] Error checking event server health:',
          error,
        );
        return {
          isRunning: false,
          healthStatus: 'unknown' as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  // Delete session handler (AgentSessionAPI)
  ipcMain.handle(
    AgentSessionAPIEvents.DELETE_SESSION,
    async (_event, sessionId: string, _directory: string) => {
      try {
        const deleted = sessionCache.deleteSession(sessionId);
        console.log(`[SDK Handlers] Deleted session ${sessionId}:`, deleted);
        return deleted;
      } catch (error) {
        console.error('[SDK Handlers] Error deleting session:', error);
        return false;
      }
    },
  );

  // Update session metadata handler (AgentSessionAPI)
  ipcMain.handle(
    AgentSessionAPIEvents.UPDATE_SESSION_METADATA,
    async (
      _event,
      sessionId: string,
      _directory: string,
      metadata: { customName?: string },
    ) => {
      try {
        const updated = sessionCache.updateSessionMetadata(sessionId, metadata);
        console.log(
          `[SDK Handlers] Updated metadata for session ${sessionId}:`,
          updated,
        );
        return updated;
      } catch (error) {
        console.error('[SDK Handlers] Error updating session metadata:', error);
        return false;
      }
    },
  );

  // Clear directory sessions handler (AgentSessionAPI)
  ipcMain.handle(
    AgentSessionAPIEvents.CLEAR_DIRECTORY_SESSIONS,
    async (_event, directory: string) => {
      try {
        const cleared = sessionCache.clearSessionsForDirectory(directory);
        console.log(
          `[SDK Handlers] Cleared sessions for directory ${directory}:`,
          cleared,
        );
        return cleared;
      } catch (error) {
        console.error(
          '[SDK Handlers] Error clearing directory sessions:',
          error,
        );
        return false;
      }
    },
  );

  // Get active sessions handler (AgentSessionAPI - aliased from SDK)
  ipcMain.handle(AgentSessionAPIEvents.GET_ACTIVE_SESSIONS, async () => {
    try {
      // Use the same implementation as SDK but convert format
      const projects = sessionCache.getSessionsByProject();

      // Convert ProjectSessions[] to DirectorySessions[]
      const directorySessions = projects.map((project) => ({
        directory: project.repository,
        summaries: project.summaries.map((s) => ({
          sessionId: s.sessionId,
          directory: s.repository,
          agentCLI: s.agentCLI,
          startTime: s.startTime,
          lastActivity: s.lastActivity,
          active: s.active,
          eventCount: s.eventCount,
          fileAccessCount: s.fileAccessCount,
          fileWriteCount: s.fileWriteCount,
          customName: s.customName,
        })),
      }));

      console.log(
        `[SDK Handlers] Returning ${directorySessions.length} directories from cache`,
      );
      return directorySessions;
    } catch (error) {
      console.error('[SDK Handlers] Error getting active sessions:', error);
      return [];
    }
  });

  // Get session handler (AgentSessionAPI - aliased from SDK)
  ipcMain.handle(
    AgentSessionAPIEvents.GET_SESSION,
    async (_event, sessionId: string, _directory: string) => {
      try {
        const session = sessionCache.getSession(sessionId);
        console.log(`[SDK Handlers] Found session ${sessionId}:`, !!session);
        return session;
      } catch (error) {
        console.error('[SDK Handlers] Error getting session:', error);
        return null;
      }
    },
  );

  // Get session events handler (AgentSessionAPI - aliased from SDK)
  ipcMain.handle(
    AgentSessionAPIEvents.GET_SESSION_EVENTS,
    async (_event, sessionId: string) => {
      try {
        const events = sessionCache.getSessionEvents(sessionId);
        console.log(
          `[SDK Handlers] Found ${events?.length || 0} events for session ${sessionId}`,
        );
        return events;
      } catch (error) {
        console.error('[SDK Handlers] Error getting session events:', error);
        return null;
      }
    },
  );

  console.log('[SDK Handlers] Agent session SDK handlers registered');
}

/**
 * Unregister all SDK API handlers
 */
export function unregisterAgentSessionSDKHandlers(): void {
  const events = Object.values(AgentSessionSDKAPIEvents);
  events.forEach((event) => {
    ipcMain.removeHandler(event);
  });
  console.log('[SDK Handlers] Agent session SDK handlers unregistered');
}
