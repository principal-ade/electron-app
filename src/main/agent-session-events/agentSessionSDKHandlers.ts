/**
 * SDK-based Agent Session Handlers for Main Process
 *
 * NOTE: SessionCache has been removed for performance reasons.
 * The cache was processing every agent event synchronously in the main process,
 * blocking the UI. Events now flow directly to renderers via MessagePort.
 *
 * TODO: Re-implement session caching in a performant way (batched updates,
 * utility process, or lazy loading) when session history queries are needed.
 */

import { ipcMain } from 'electron';
import {
  AgentSessionSDKAPIEvents,
} from '../../shared/main-process-api-interfaces/AgentSessionSDKAPI';
import { AgentSessionAPIEvents } from '../../shared/main-process-api-interfaces/AgentSessionAPI';
import { getEventServerManager } from './EventServerManager';

/**
 * Register all SDK API handlers
 */
export function registerAgentSessionSDKHandlers(): void {
  console.log('[SDK Handlers] Registering agent session SDK handlers...');

  // Get active sessions by project - returns empty (cache disabled)
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_ACTIVE_SESSIONS_BY_PROJECT,
    async () => {
      // SessionCache disabled for performance - return empty
      return [];
    },
  );

  // Get sessions for a specific directory - returns null (cache disabled)
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSIONS_FOR_DIRECTORY,
    async (_event, _directory: string) => {
      // SessionCache disabled for performance - return null
      return null;
    },
  );

  // Get specific session - returns null (cache disabled)
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSION,
    async (_event, _sessionId: string, _repository: string) => {
      // SessionCache disabled for performance - return null
      return null;
    },
  );

  // Get session events - returns null (cache disabled)
  ipcMain.handle(
    AgentSessionSDKAPIEvents.GET_SESSION_EVENTS,
    async (_event, _sessionId: string) => {
      // SessionCache disabled for performance - return null
      return null;
    },
  );

  // Check event server health - still functional
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

  // Delete session handler - no-op (cache disabled)
  ipcMain.handle(
    AgentSessionAPIEvents.DELETE_SESSION,
    async (_event, _sessionId: string, _directory: string) => {
      // SessionCache disabled for performance - no-op
      return false;
    },
  );

  // Update session metadata handler - no-op (cache disabled)
  ipcMain.handle(
    AgentSessionAPIEvents.UPDATE_SESSION_METADATA,
    async (
      _event,
      _sessionId: string,
      _directory: string,
      _metadata: { customName?: string },
    ) => {
      // SessionCache disabled for performance - no-op
      return false;
    },
  );

  // Clear directory sessions handler - no-op (cache disabled)
  ipcMain.handle(
    AgentSessionAPIEvents.CLEAR_DIRECTORY_SESSIONS,
    async (_event, _directory: string) => {
      // SessionCache disabled for performance - no-op
      return false;
    },
  );

  // Get active sessions handler - returns empty (cache disabled)
  ipcMain.handle(AgentSessionAPIEvents.GET_ACTIVE_SESSIONS, async () => {
    // SessionCache disabled for performance - return empty
    return [];
  });

  // Get session handler - returns null (cache disabled)
  ipcMain.handle(
    AgentSessionAPIEvents.GET_SESSION,
    async (_event, _sessionId: string, _directory: string) => {
      // SessionCache disabled for performance - return null
      return null;
    },
  );

  // Get session events handler - returns null (cache disabled)
  ipcMain.handle(
    AgentSessionAPIEvents.GET_SESSION_EVENTS,
    async (_event, _sessionId: string) => {
      // SessionCache disabled for performance - return null
      return null;
    },
  );

  console.log('[SDK Handlers] Agent session SDK handlers registered (cache disabled)');
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
