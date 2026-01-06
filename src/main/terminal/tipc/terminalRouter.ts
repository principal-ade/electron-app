/**
 * TIPC Router for Terminal Operations
 *
 * This provides type-safe RPC for terminal management, matching the
 * terminal-testing-app implementation that is known to work.
 */

import { tipc } from '@egoist/tipc/main';
import { BrowserWindow } from 'electron';
import { getSessionManagerInstance } from '../sessionManagerSingleton';
import { ownershipManager } from '../TerminalOwnershipManager';
import { isPtyAvailable } from '../utils/ptyLoader';

// Get singleton session manager instance
const sessionManager = getSessionManagerInstance();

const t = tipc.create();

export const terminalRouter = {
  // ============================================
  // Terminal Session Management
  // ============================================

  createTerminalSession: t.procedure
    .input<{ cwd?: string; command?: string; context?: string }>()
    .action(async ({ input, context }) => {
      if (!isPtyAvailable()) {
        throw new Error(
          'Terminal functionality is not available in this build',
        );
      }

      const window = BrowserWindow.fromWebContents(context.sender);
      if (!window) {
        throw new Error('No window found for terminal session');
      }

      // Check session limit
      if (!sessionManager.canCreateSession()) {
        throw new Error(
          `Maximum number of terminal sessions (${sessionManager.getMaxSessions()}) reached`,
        );
      }

      // Create the session
      const sessionId = await sessionManager.createSession(
        input.cwd || process.env.HOME || '/',
        input.context,
        input.command,
      );

      // Create MessageChannel and send port to renderer
      sessionManager.createMessageChannelForSession(sessionId, window.id);

      // Auto-claim ownership for the creating window
      ownershipManager.claimOwnership(sessionId, window.id);

      return sessionId;
    }),

  destroyTerminalSession: t.procedure
    .input<{ sessionId: string }>()
    .action(async ({ input }) => {
      sessionManager.destroySession(input.sessionId);
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

      const result = ownershipManager.claimOwnership(
        input.sessionId,
        window.id,
        input.force ?? false,
      );

      console.log(`[TIPC] claimTerminalOwnership result:`, result);

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
};

// Export the session manager for cleanup on app quit
export { sessionManager as tipcSessionManager };

export type TerminalRouter = typeof terminalRouter;
