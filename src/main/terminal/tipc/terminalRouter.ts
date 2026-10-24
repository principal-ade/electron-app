/**
 * TIPC Router for Terminal Operations
 *
 * This provides type-safe RPC for terminal management, matching the
 * terminal-testing-app implementation that is known to work.
 */

import { tipc } from '@egoist/tipc/main';
import { BrowserWindow } from 'electron';
import { SpanStatusCode } from '@opentelemetry/api';
import { getSessionManagerInstance } from '../sessionManagerSingleton';
import { ownershipManager } from '../TerminalOwnershipManager';
import { getTracer } from '../../telemetry';
import { getDaemonStatus, isDaemonRunning, stopDaemon, ensureDaemonRunning } from '../daemonSpawner';
import {
  broadcastTerminalSessionsChanged,
  createTerminalSession,
} from '../terminalSessionService';
import { contextFromTraceparent } from '../../../shared/telemetry/traceparent';

// Tracer for terminal telemetry (main process scope)
const tracer = getTracer('principal-ade-main');

// Get singleton session manager instance
const sessionManager = getSessionManagerInstance();

const t = tipc.create();

export { broadcastTerminalSessionsChanged };

export const terminalRouter = {
  // ============================================
  // Terminal Session Management
  // ============================================

  createTerminalSession: t.procedure
    .input<{ cwd?: string; command?: string; context?: string; metadata?: import('../../../shared/tipc/terminalRouterTypes').TerminalSessionMetadata; traceparent?: string }>()
    .action(async ({ input, context }) => {
      const window = BrowserWindow.fromWebContents(context.sender);
      if (!window) {
        throw new Error('No window found for terminal session');
      }

      // Shared with the HTTP bridge: reuse rules, ownership, telemetry. The
      // renderer's trace context rides along in the input so this span (and
      // everything downstream) stays in the trace the user's click started.
      const parent = contextFromTraceparent(input.traceparent);
      const { sessionId } = await createTerminalSession(
        input,
        window.id,
        'renderer',
        parent,
      );
      return sessionId;
    }),

  destroyTerminalSession: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input }) => {
      const span = tracer.startSpan('terminal.session.destroy');
      span.setAttribute('session.id', input.sessionId);

      try {
        // Event: Manager action - destroy
        span.addEvent('terminal.session.manager_action', {
          action: 'destroy',
          'session.id': input.sessionId,
        });

        // Destroy the session
        await sessionManager.destroySession(input.sessionId);

        // Event: Store updated
        span.addEvent('terminal.session.store_updated', {
          operation: 'delete',
          'session.id': input.sessionId,
          'store.size': sessionManager.getAllSessions().size,
        });

        // Broadcast session list change to all windows
        try {
          const { sessionsCount, windowsCount } = broadcastTerminalSessionsChanged();
          span.addEvent('terminal.sessions.broadcast', {
            'sessions.count': sessionsCount,
            'windows.count': windowsCount,
          });
        } catch (err) {
          console.warn('[Terminal] Failed to broadcast session change:', err);
        }

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }),

  listTerminalSessions: t.procedure.action(async ({ context }) => {
    const span = tracer.startSpan('terminal.session.list');

    try {
      const window = BrowserWindow.fromWebContents(context.sender);
      const windowId = window?.id ?? -1;

      // Event: Router handled list request
      span.addEvent('terminal.session.router_handled', {
        'window.id': windowId,
        action: 'list',
      });

      const sessions = Array.from(sessionManager.getAllSessions().entries()).map(
        ([id, session]) => {
          const owner = ownershipManager.getOwner(id);
          // Convert owner to windowId for backwards compatibility
          const ownerWindowId =
            owner && owner.type === 'local' ? parseInt(owner.id, 10) : undefined;
          return {
            id,
            cwd: session.directory,
            directory: session.directory,
            context: session.context,
            agentSessionId: session.agentSessionId,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            cols: session.cols,
            rows: session.rows,
            status: 'active' as const,
            ownedByWindowId: ownerWindowId,
            metadata: session.metadata,
          };
        },
      );

      // Event: Manager action - list
      span.addEvent('terminal.session.manager_action', {
        action: 'list',
        'sessions.count': sessions.length,
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return sessions;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }),

  resizeTerminal: t.procedure
    .input<{ sessionId: string; cols: number; rows: number; force?: boolean }>()
    .action(async ({ input }) => {
      // Spanned so a reconnect's resize sequence (or its absence) is visible
      // next to the PTY size the daemon reports.
      const span = tracer.startSpan('terminal.resize', {
        attributes: {
          'session.id': input.sessionId,
          'terminal.cols': input.cols,
          'terminal.rows': input.rows,
          'resize.force': input.force ?? false,
        },
      });
      try {
        sessionManager.resizeSession(
          input.sessionId,
          input.cols,
          input.rows,
          input.force ?? false,
        );
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }),

  refreshTerminal: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input }) => {
      // Send Ctrl+L to redraw the terminal
      sessionManager.writeToSession(input.sessionId, '\x0c');
      return { success: true };
    }),

  writeToSession: t.procedure
    .input<{ sessionId: string; data: string }>()
    .action(async ({ input }) => {
      sessionManager.writeToSession(input.sessionId, input.data);
      return { success: true };
    }),

  // ============================================
  // Terminal Ownership Management
  // ============================================

  checkTerminalOwnership: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input, context }) => {
      console.log(
        `[TIPC] checkTerminalOwnership called: sessionId=${input.sessionId}`,
      );

      const window = BrowserWindow.fromWebContents(context.sender);
      if (!window) {
        console.log('[TIPC] checkTerminalOwnership: No window found');
        return {
          exists: false,
          ownedByWindowId: null,
          ownedByThisWindow: false,
          canClaim: false,
          ownerWindowExists: false,
        };
      }

      console.log(`[TIPC] checkTerminalOwnership: windowId=${window.id}`);

      if (!sessionManager.hasSession(input.sessionId)) {
        console.log('[TIPC] checkTerminalOwnership: Session not found');
        return {
          exists: false,
          ownedByWindowId: null,
          ownedByThisWindow: false,
          canClaim: false,
          ownerWindowExists: false,
        };
      }

      const result = ownershipManager.checkOwnership(
        input.sessionId,
        window.id,
      );
      console.log(`[TIPC] checkTerminalOwnership result:`, result);
      return result;
    }),

  claimTerminalOwnership: t.procedure
    .input<{ sessionId: string; force?: boolean }>()
    .action(async ({ input, context }) => {
      console.log(
        `[TIPC] claimTerminalOwnership called: sessionId=${input.sessionId}, force=${input.force}`,
      );

      const window = BrowserWindow.fromWebContents(context.sender);
      if (!window) {
        console.log('[TIPC] claimTerminalOwnership: No window found');
        return { success: false, reason: 'No window found' };
      }

      console.log(`[TIPC] claimTerminalOwnership: windowId=${window.id}`);

      // Verify session exists
      if (!sessionManager.hasSession(input.sessionId)) {
        console.log('[TIPC] claimTerminalOwnership: Session not found');
        return { success: false, reason: 'Session not found' };
      }

      const previousOwner = ownershipManager.getOwner(input.sessionId);

      const result = ownershipManager.claimOwnership(
        input.sessionId,
        window.id,
        input.force ?? false,
      );

      console.log(`[TIPC] claimTerminalOwnership result:`, result);

      // Telemetry: Ownership changed
      if (result.success) {
        const span = tracer.startSpan('terminal.ownership');
        span.addEvent('terminal.ownership.changed', {
          'session.id': input.sessionId,
          'new_owner.window_id': window.id,
          'previous_owner.window_id': previousOwner?.type === 'local' ? parseInt(previousOwner.id, 10) : -1,
        });
        span.end();
      }

      // If ownership was taken from another window, notify them
      if (
        result.success &&
        result.previousOwner !== undefined &&
        result.previousOwner.type === 'local'
      ) {
        const previousWindowId = parseInt(result.previousOwner.id, 10);
        const previousWindow = BrowserWindow.fromId(previousWindowId);
        if (previousWindow && !previousWindow.isDestroyed()) {
          console.log(
            `[TIPC] Notifying previous owner window ${previousWindowId}`,
          );
          previousWindow.webContents.send('terminal:ownershipLost', {
            sessionId: input.sessionId,
            newOwnerWindowId: window.id,
          });
        }
      }

      // Note: Port creation is handled separately by requestTerminalDataPort
      // This matches the terminal-testing-app pattern where ownership and port are separate

      return result;
    }),

  releaseTerminalOwnership: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input, context }) => {
      const window = BrowserWindow.fromWebContents(context.sender);
      if (!window) {
        return { success: false, reason: 'No window found' };
      }
      return ownershipManager.releaseOwnership(input.sessionId, window.id);
    }),

  requestTerminalDataPort: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input, context }) => {
      console.log(
        `[TIPC] requestTerminalDataPort called: sessionId=${input.sessionId}`,
      );

      const window = BrowserWindow.fromWebContents(context.sender);
      if (!window) {
        console.log('[TIPC] requestTerminalDataPort: No window found');
        return { success: false, reason: 'No window found' };
      }

      console.log(`[TIPC] requestTerminalDataPort: windowId=${window.id}`);

      if (!sessionManager.hasSession(input.sessionId)) {
        console.log('[TIPC] requestTerminalDataPort: Session not found');
        return { success: false, reason: 'Session not found' };
      }

      // Check if this window is the owner - if so, tell the worker so it can send scrollback
      const isOwner = ownershipManager.isOwner(input.sessionId, window.id);
      console.log(`[TIPC] requestTerminalDataPort: isOwner=${isOwner}`);

      // Telemetry for scrollback decision
      const span = tracer.startSpan('terminal.port.request');
      span.addEvent('terminal.port.requesting', {
        'session.id': input.sessionId,
        'window.id': window.id,
        'isOwner': isOwner,
        'scrollback.willSend': isOwner, // Worker sends scrollback when isOwner=true
      });

      // Create port and pass ownership status to worker
      // Worker will replay scrollback if this window is the owner (for reconnection)
      const port = sessionManager.createPortForSession(
        input.sessionId,
        window.id,
        isOwner, // Pass actual ownership status so worker can send scrollback
      );

      span.addEvent('terminal.port.created', {
        'session.id': input.sessionId,
        'success': port.success,
        // false means an existing channel was reused. After a reload that
        // should be impossible (the ports are dropped on navigation), so this
        // attribute is what makes a dead reconnect visible in a trace.
        'port.created': port.created,
        'isOwner': isOwner,
      });
      span.setStatus({ code: port.success ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      span.end();

      console.log(
        `[TIPC] requestTerminalDataPort result: success=${port.success} created=${port.created}`,
      );
      return {
        success: port.success,
        created: port.created,
        reason: port.success ? undefined : (port.reason ?? 'Failed to create port'),
      };
    }),

  getTerminalBuffer: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input }) => {
      const span = tracer.startSpan('terminal.buffer.get');
      span.setAttribute('session.id', input.sessionId);

      try {
        span.addEvent('terminal.buffer.requested', {
          'session.id': input.sessionId,
        });

        const buffer = await sessionManager.getScrollbackBuffer(input.sessionId);

        span.addEvent('terminal.buffer.retrieved', {
          'session.id': input.sessionId,
          'buffer.size': buffer?.length ?? 0,
          'buffer.exists': buffer !== null,
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return {
          success: buffer !== null,
          buffer,
          size: buffer?.length ?? 0,
        };
      } catch (error) {
        console.error('[terminalRouter] getTerminalBuffer error:', error);
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setStatus({ code: SpanStatusCode.ERROR });
        return {
          success: false,
          buffer: null,
          size: 0,
        };
      } finally {
        span.end();
      }
    }),

  // ============================================
  // Terminal Activity Tracking
  // ============================================

  updateActivity: t.procedure
    .input<{
      sessionId: string;
      isWorking: boolean;
      workingMessage?: string;
      workingSubtitle?: string;
    }>()
    .action(async ({ input, context }) => {
      const span = tracer.startSpan('terminal.activity.update');

      try {
        const window = BrowserWindow.fromWebContents(context.sender);
        if (!window) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'No window found',
          });
          return;
        }

        // Event: Router handled the TIPC procedure
        span.addEvent('terminal.activity.router_handled', {
          'window.id': window.id,
          'session.id': input.sessionId,
          'is_working': input.isWorking,
        });

        // Update activity in session manager (validates session exists)
        const { activities, sessionExists } = sessionManager.updateActivity(
          input.sessionId,
          window.id,
          input.isWorking,
          input.workingMessage,
          input.workingSubtitle,
        );

        // Log warning if session doesn't exist (but still track activity for graceful handling)
        if (!sessionExists) {
          console.warn(
            `[Terminal] Activity update for non-existent session: ${input.sessionId}`,
          );
        }

        // Event: Agent started/stopped working
        if (input.isWorking) {
          span.addEvent('terminal.activity.agent_started', {
            'session.id': input.sessionId,
            'store.size': sessionManager.getActivityStoreSize(),
          });
        } else {
          span.addEvent('terminal.activity.agent_stopped', {
            'session.id': input.sessionId,
            'store.size': sessionManager.getActivityStoreSize(),
          });
        }

        // Broadcast to all windows
        const allWindows = BrowserWindow.getAllWindows();
        const activeWindowCount = allWindows.filter(
          (w) => !w.isDestroyed(),
        ).length;

        allWindows.forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send('terminal:activity-sync', activities);
          }
        });

        // Event: Broadcast sent
        span.addEvent('terminal.activity.broadcast_sent', {
          channel: 'terminal:activity-sync',
          'windows.count': activeWindowCount,
          'activities.count': activities.length,
        });

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(
          error instanceof Error ? error : new Error(String(error)),
        );
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }),

  getActivityState: t.procedure.action(async () => {
    return sessionManager.getActivityState();
  }),

  // ============================================
  // Daemon Status
  // ============================================

  getDaemonStatus: t.procedure.action(async () => {
    const isRunning = await isDaemonRunning();
    if (!isRunning) {
      return {
        isRunning: false,
        status: null,
      };
    }

    const status = await getDaemonStatus();
    return {
      isRunning: true,
      status,
    };
  }),

  startDaemon: t.procedure.action(async () => {
    try {
      await ensureDaemonRunning();
      return { success: true };
    } catch (error) {
      console.error('[Terminal] Failed to start daemon:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }),

  stopDaemon: t.procedure.action(async () => {
    try {
      await stopDaemon();
      return { success: true };
    } catch (error) {
      console.error('[Terminal] Failed to stop daemon:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }),
};

// Export the session manager for cleanup on app quit
export { sessionManager as tipcSessionManager };

export type TerminalRouter = typeof terminalRouter;
