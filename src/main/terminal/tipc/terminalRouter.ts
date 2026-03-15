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
import { isPtyAvailable } from '../utils/ptyLoader';
import { getTracer } from '../../telemetry';
import { getDaemonStatus, isDaemonRunning, stopDaemon, ensureDaemonRunning } from '../daemonSpawner';

// Tracer for terminal activity telemetry
const tracer = getTracer('terminal-activity');

// Tracer for terminal session management telemetry
const sessionTracer = getTracer('terminal-session-management');

// Get singleton session manager instance
const sessionManager = getSessionManagerInstance();

const t = tipc.create();

/**
 * Broadcast terminal sessions list to all windows.
 * Called when sessions are created or destroyed.
 * Returns counts for telemetry.
 */
function broadcastSessionsChanged(): { sessionsCount: number; windowsCount: number } {
  const sessions = Array.from(sessionManager.getAllSessions().entries()).map(
    ([id, session]) => {
      const owner = ownershipManager.getOwner(id);
      const ownerWindowId =
        owner && owner.type === 'local' ? parseInt(owner.id, 10) : undefined;
      return {
        id,
        cwd: session.directory,
        directory: session.directory,
        context: session.context,
        agentSessionId: undefined,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        status: 'active' as const,
        ownedByWindowId: ownerWindowId,
        metadata: session.metadata,
      };
    },
  );

  const allWindows = BrowserWindow.getAllWindows();
  let windowsCount = 0;

  allWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('terminal:sessions-changed', sessions);
      windowsCount++;
    }
  });

  return { sessionsCount: sessions.length, windowsCount };
}

export const terminalRouter = {
  // ============================================
  // Terminal Session Management
  // ============================================

  createTerminalSession: t.procedure
    .input<{ cwd?: string; command?: string; context?: string; metadata?: import('../../../shared/tipc/terminalRouterTypes').TerminalSessionMetadata }>()
    .action(async ({ input, context }) => {
      const span = sessionTracer.startSpan('terminal.session.create');

      try {
        if (!isPtyAvailable()) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'PTY not available' });
          throw new Error(
            'Terminal functionality is not available in this build',
          );
        }

        const window = BrowserWindow.fromWebContents(context.sender);
        if (!window) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'No window found' });
          throw new Error('No window found for terminal session');
        }

        const canCreate = sessionManager.canCreateSession();

        // Event: Router handled session creation request
        span.addEvent('terminal.session.router_handled', {
          'window.id': window.id,
          can_create: canCreate,
        });

        // Check session limit
        if (!canCreate) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Session limit reached' });
          throw new Error(
            `Maximum number of terminal sessions (${sessionManager.getMaxSessions()}) reached`,
          );
        }

        // Create the session
        const sessionId = await sessionManager.createSession(
          input.cwd || process.env.HOME || '/',
          input.context,
          input.command,
          input.metadata,
        );

        span.setAttribute('session.id', sessionId);

        // Event: Manager action - create
        span.addEvent('terminal.session.manager_action', {
          action: 'create',
          'session.id': sessionId,
        });

        // Event: Store updated
        span.addEvent('terminal.session.store_updated', {
          operation: 'set',
          'session.id': sessionId,
          'store.size': sessionManager.getAllSessions().size,
        });

        // Create MessageChannel and send port to renderer
        sessionManager.createMessageChannelForSession(sessionId, window.id);

        // Auto-claim ownership for the creating window
        const ownershipResult = ownershipManager.claimOwnership(sessionId, window.id);
        console.log('[Terminal] Ownership claimed:', { sessionId, windowId: window.id, result: ownershipResult });

        // Verify ownership was set
        const verifyOwner = ownershipManager.getOwner(sessionId);
        console.log('[Terminal] Verified owner after claim:', { sessionId, owner: verifyOwner });

        // Broadcast session list change to all windows
        try {
          const { sessionsCount, windowsCount } = broadcastSessionsChanged();
          span.addEvent('terminal.sessions.broadcast', {
            'sessions.count': sessionsCount,
            'windows.count': windowsCount,
          });
        } catch (err) {
          console.warn('[Terminal] Failed to broadcast session change:', err);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return sessionId;
      } catch (error) {
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    }),

  destroyTerminalSession: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input }) => {
      const span = sessionTracer.startSpan('terminal.session.destroy');
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
          const { sessionsCount, windowsCount } = broadcastSessionsChanged();
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

  listTerminalSessions: t.procedure.action(async () => {
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
          agentSessionId: undefined, // TODO: Add agentSessionId to TerminalSession type
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          status: 'active' as const,
          ownedByWindowId: ownerWindowId,
          metadata: session.metadata,
        };
      },
    );
    return sessions;
  }),

  resizeTerminal: t.procedure
    .input<{ sessionId: string; cols: number; rows: number; force?: boolean }>()
    .action(async ({ input }) => {
      sessionManager.resizeSession(
        input.sessionId,
        input.cols,
        input.rows,
        input.force ?? false,
      );
    }),

  refreshTerminal: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input }) => {
      // Send Ctrl+L to redraw the terminal
      sessionManager.writeToSession(input.sessionId, '\x0c');
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
        const span = sessionTracer.startSpan('terminal.ownership');
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

      // Use createPortForSession WITHOUT claiming ownership
      // This matches terminal-testing-app pattern where ownership is managed separately
      const success = sessionManager.createPortForSession(
        input.sessionId,
        window.id,
        false, // Don't claim ownership - that's done separately via claimTerminalOwnership
      );

      console.log(`[TIPC] requestTerminalDataPort result: success=${success}`);
      return { success, reason: success ? undefined : 'Failed to create port' };
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
