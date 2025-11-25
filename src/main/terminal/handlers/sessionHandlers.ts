import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { TerminalSessionManager } from '../TerminalSessionManager';
import { TerminalOwnershipManager } from '../TerminalOwnershipManager';
import { TerminalAPIEvents } from '../../../shared/main-process-api-interfaces/TerminalService';
import { TerminalInfo } from '../../../shared/main-process-api-interfaces/TerminalService';
import { isPtyAvailable } from '../utils/ptyLoader';

export function setupSessionHandlers(
  sessionManager: TerminalSessionManager,
  ownershipManager: TerminalOwnershipManager,
): void {
  // Get or create a terminal session for a repository
  ipcMain.handle(
    'terminal:getOrCreate',
    async (event: IpcMainInvokeEvent, directory: string, context?: string) => {
      try {
        // Check if node-pty is available
        if (!isPtyAvailable()) {
          throw new Error(
            'Terminal functionality is not available in this build',
          );
        }

        const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
        if (!senderWindowId) {
          throw new Error('Could not determine sender window ID');
        }
        let sessionId: string;

        // Check if we already have a session for this directory+context
        const sessionKey = sessionManager.getSessionKey(directory, context);
        const existingSession = sessionManager.getSessionByRepoKey(sessionKey);
        if (existingSession) {
          console.log(
            `[Terminal] REUSING existing session ${existingSession.id} for ${sessionKey}`,
          );
          sessionId = existingSession.id;
        } else {
          console.log(
            `[Terminal] Creating NEW session for ${sessionKey} (current sessions: ${sessionManager.getAllSessions().size})`,
          );

          // Check if we've reached the session limit
          if (!sessionManager.canCreateSession()) {
            throw new Error(
              `Maximum number of terminal sessions (${sessionManager.getMaxSessions()}) reached. Please close some terminals before opening new ones.`,
            );
          }

          // Create new session with context
          sessionId = await sessionManager.createSession(directory, context);

          // Track by repository+context
          sessionManager.trackSessionByRepo(sessionKey, sessionId);
        }

        // Automatically claim ownership for the calling window
        const session = sessionManager.getSession(sessionId);
        if (session) {
          ownershipManager.handleAutomaticOwnershipClaim(
            session,
            senderWindowId,
          );
        }

        return sessionId;
      } catch (error) {
        console.error('Failed to get or create terminal session:', error);
        throw error;
      }
    },
  );

  // Create a new terminal session (keep for backward compatibility)
  ipcMain.handle(
    'terminal:create',
    async (event: IpcMainInvokeEvent, directory: string, context?: string) => {
      try {
        // Check if node-pty is available
        if (!isPtyAvailable()) {
          throw new Error(
            'Terminal functionality is not available in this build',
          );
        }

        console.log(
          `[Terminal] CREATE called for ${directory} with context: ${context || 'default'} (current sessions: ${sessionManager.getAllSessions().size})`,
        );

        // Check if we've reached the session limit
        if (!sessionManager.canCreateSession()) {
          throw new Error(
            `Maximum number of terminal sessions (${sessionManager.getMaxSessions()}) reached. Please close some terminals before opening new ones.`,
          );
        }

        const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
        if (!senderWindowId) {
          throw new Error('Could not determine sender window ID');
        }

        // Create new session with context
        const sessionId = await sessionManager.createSession(directory, context);

        // Automatically claim ownership for the calling window
        const session = sessionManager.getSession(sessionId);
        if (session) {
          ownershipManager.handleAutomaticOwnershipClaim(
            session,
            senderWindowId,
          );
        }

        return sessionId;
      } catch (error) {
        console.error('Failed to create terminal session:', error);

        // More detailed error message
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('posix_spawnp')) {
          throw new Error(
            `Failed to spawn terminal: ${errorMessage}. ` +
              `Please ensure node-pty is properly built for Electron. ` +
              `Try running: cd electron-react && npm rebuild node-pty`,
          );
        }

        throw error;
      }
    },
  );

  // Create a new terminal session with a specific command
  ipcMain.handle(
    'terminal:create-with-command',
    async (
      event: IpcMainInvokeEvent,
      {
        directory,
        command,
        context,
      }: { directory: string; command: string; context?: string },
    ) => {
      console.log(
        `[Terminal] create-with-command called with command: "${command}" in directory: "${directory}" context: "${context || 'default'}"`,
      );
      try {
        // Check if we've reached the session limit
        if (!sessionManager.canCreateSession()) {
          throw new Error(
            `Maximum number of terminal sessions (${sessionManager.getMaxSessions()}) reached. Please close some terminals before opening new ones.`,
          );
        }

        // Create new session with command
        const sessionId = await sessionManager.createSession(
          directory,
          context,
          command,
        );

        // Automatically claim ownership for the calling window
        const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
        if (senderWindowId) {
          const session = sessionManager.getSession(sessionId);
          if (session) {
            ownershipManager.handleAutomaticOwnershipClaim(
              session,
              senderWindowId,
            );
          }
        }

        console.log(
          `Terminal session created successfully with command: ${sessionId}`,
        );
        return sessionId;
      } catch (error) {
        console.error(
          'Failed to create terminal session with command:',
          error,
        );

        // More detailed error message
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('posix_spawnp')) {
          throw new Error(
            `Failed to spawn terminal: ${errorMessage}. ` +
              `Please ensure node-pty is properly built for Electron. ` +
              `Try running: cd electron-react && npm rebuild node-pty`,
          );
        }

        throw error;
      }
    },
  );

  // Destroy terminal session
  ipcMain.handle(
    TerminalAPIEvents.DESTROY,
    async (event: IpcMainInvokeEvent, sessionId: string) => {
      sessionManager.destroySession(sessionId);
    },
  );

  // Get list of active terminals
  ipcMain.handle(TerminalAPIEvents.LIST, async (event: IpcMainInvokeEvent) => {
    const terminals: TerminalInfo[] = Array.from(
      sessionManager.getAllSessions().entries(),
    ).map(([id, session]) => ({
      id,
      directory: session.directory,
      context: session.context,
      agentSessionId: session.agentSessionId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      status: 'active' as const,
      ownedByWindowId: session.ownedByWindowId,
      ownershipClaimedAt: session.ownershipClaimedAt,
    }));
    return terminals;
  });
}
