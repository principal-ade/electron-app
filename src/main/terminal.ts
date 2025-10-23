import { ipcMain, BrowserWindow, app, screen } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import { agentSessionService } from './agent-sessions/agentSessionService';
import { resolveHtmlPath } from './util';
import { EnvironmentConfig } from './utils/environmentConfig';
import { terminalEnvironment } from './terminalEnvironment';
import { TerminalAPIEvents } from '../shared/main-process-api-interfaces/TerminalService';
import { TerminalInfo } from '../shared/main-process-api-interfaces/TerminalService';
import { ModernApplicationWindow } from './window/modernWindowManager';
import { WindowType } from './window/windowTypes';

// Try to import node-pty at runtime without bundling it
// Use eval("require") so webpack does not attempt to bundle the native module
let pty: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dynamicRequire: any = eval('require');
  pty = dynamicRequire('node-pty');
  // Optionally sanity check property to ensure native loaded; if not, fall into catch
  if (!pty) {
    throw new Error('node-pty unresolved');
  }
} catch (error) {
  console.warn('node-pty not available, terminal features will be disabled');
  pty = null;
}

interface TerminalSession {
  id: string;
  pty: any; // Changed from pty.IPty to any for optional support
  directory: string;
  context?: string; // 'principal' | 'dashboard' | 'agent' | etc
  agentSessionId?: string; // Associated AI session
  createdAt: number;
  lastActivity: number;
  ownedByWindowId?: number; // NEW: Which window currently has the active xterm.js instance
  ownershipClaimedAt?: number; // NEW: When ownership was last claimed
}

class TerminalManager {
  private sessions: Map<string, TerminalSession> = new Map();

  // Track sessions by repository path + context for persistence
  private sessionsByRepo: Map<string, string> = new Map(); // "repoPath:context" -> sessionId

  private maxSessions = 10; // Limit number of concurrent sessions

  private terminalWindows: Map<string, BrowserWindow> = new Map(); // Track terminal windows

  private rendererWindows: Set<BrowserWindow> = new Set();

  constructor() {
    this.setupIPCHandlers();
  }

  setMainWindow(window: BrowserWindow) {
    if (!window) {
      return;
    }

    if (this.rendererWindows.has(window)) {
      return;
    }

    this.rendererWindows.add(window);

    const cleanup = () => {
      this.rendererWindows.delete(window);
      window.removeListener('closed', cleanup);
    };

    window.on('closed', cleanup);
  }

  private broadcastToRendererWindows(channel: string, payload: unknown) {
    for (const rendererWindow of Array.from(this.rendererWindows)) {
      if (rendererWindow.isDestroyed()) {
        this.rendererWindows.delete(rendererWindow);
        continue;
      }

      try {
        rendererWindow.webContents.send(channel, payload);
      } catch (error) {
        console.warn(
          `[Terminal] Failed to send ${channel} to window ${rendererWindow.id}:`,
          error,
        );
      }
    }
  }

  // Helper to generate session key from directory and context
  private getSessionKey(directory: string, context?: string): string {
    return `${directory}:${context || 'default'}`;
  }

  // Helper to clean up a session and its repo tracking
  private cleanupSession(sessionId: string) {
    this.sessions.delete(sessionId);
    // Clean up repo tracking
    for (const [repo, sid] of this.sessionsByRepo.entries()) {
      if (sid === sessionId) {
        this.sessionsByRepo.delete(repo);
        break;
      }
    }
  }

  // Extract terminal creation logic - delegates to the main create handler
  private async createTerminalForDirectory(directory: string): Promise<string> {
    // For now, we'll use the existing IPC handler directly
    // In the future, we could extract the shared logic here
    // But for now, let's call the create handler through IPC to avoid duplication
    const event = { sender: { send: () => {} } }; // Dummy event for the handler
    return await this.handleTerminalCreate(event as any, directory);
  }

  // Extract the create logic into a separate method
  private async handleTerminalCreate(
    event: any,
    directory: string,
    context?: string,
  ): Promise<string> {
    // This will contain the actual terminal creation logic
    // We'll move the existing create handler logic here
    const sessionId = uuidv4();

    // Generate a Claude-compatible session ID for hooks
    const claudeSessionId = `terminal-${sessionId}`;
    console.log(
      `[Terminal] Creating terminal ${sessionId} with CLAUDE_SESSION_ID=${claudeSessionId} in directory: ${directory}`,
    );

    // Get shell from environment manager
    const shell = terminalEnvironment.getUserShell();
    const args: string[] = [];

    // Validate and sanitize directory
    const fs = require('fs');
    let workingDirectory = directory;

    if (!workingDirectory || !fs.existsSync(workingDirectory)) {
      console.warn(
        `Directory ${workingDirectory} does not exist, using home directory`,
      );
      workingDirectory = process.env.HOME || process.env.USERPROFILE || '.';
    }

    // Get properly configured environment with user's full PATH
    const env = await terminalEnvironment.getTerminalEnvironment(
      workingDirectory,
      claudeSessionId,
    );

    console.log(
      `[Terminal] Using shell: ${shell} in directory: ${workingDirectory}`,
    );

    // Create PTY process
    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: workingDirectory,
      env,
    });

    // Check for active AI session
    let activeAgentSessionId: string | null = null;
    try {
      const sessionStore =
        await agentSessionService.getSessionsForDirectory(directory);
      activeAgentSessionId = sessionStore.activeSessionId;
    } catch (err) {
      console.warn('[Terminal] Could not get active agent session:', err);
    }

    const now = Date.now();
    const session: TerminalSession = {
      id: sessionId,
      pty: ptyProcess,
      directory,
      context,
      agentSessionId: activeAgentSessionId || undefined,
      createdAt: now,
      lastActivity: now,
    };
    this.sessions.set(sessionId, session);

    // If there's an active AI session, update it to include this terminal
    if (activeAgentSessionId) {
      try {
        const agentSession = await agentSessionService.getSession(
          directory,
          activeAgentSessionId,
        );
        if (agentSession) {
          if (!agentSession.terminalSessions) {
            agentSession.terminalSessions = [];
          }
          agentSession.terminalSessions.push({
            terminalId: sessionId,
            createdAt: now,
            lastActivity: now,
            status: 'active',
          });
          await agentSessionService.upsertSession(directory, agentSession);
          console.log(
            `[Terminal] Associated terminal ${sessionId} with AI session ${activeAgentSessionId}`,
          );
        }
      } catch (err) {
        console.warn('[Terminal] Could not associate with agent session:', err);
      }
    }

    // Handle PTY data
    ptyProcess.onData((data: string) => {
      this.broadcastToRendererWindows('terminal:data', {
        sessionId,
        data,
      });
    });

    // Handle PTY exit
    ptyProcess.onExit(async (exitCode: { exitCode: number }) => {
      this.broadcastToRendererWindows('terminal:exit', {
        sessionId,
        code: exitCode.exitCode,
      });

      // Update AI session to mark terminal as closed
      if (session.agentSessionId) {
        try {
          const agentSession = await agentSessionService.getSession(
            directory,
            session.agentSessionId,
          );
          if (agentSession && agentSession.terminalSessions) {
            const terminalSession = agentSession.terminalSessions.find(
              (t) => t.terminalId === sessionId,
            );
            if (terminalSession) {
              terminalSession.status = 'closed';
              terminalSession.lastActivity = Date.now();
              await agentSessionService.upsertSession(directory, agentSession);
            }
          }
        } catch (err) {
          console.warn(
            '[Terminal] Could not update agent session on exit:',
            err,
          );
        }
      }

      this.cleanupSession(sessionId);
    });

    console.log(`Terminal session created successfully: ${sessionId}`);

    // Send a newline to trigger the shell prompt (only if no command will be sent)
    setTimeout(() => {
      console.log(
        `[Terminal] Sending initial newline to trigger prompt for ${sessionId}`,
      );
      ptyProcess.write('\r');
    }, 200);

    return sessionId;
  }

  private setupIPCHandlers() {
    // Get or create a terminal session for a repository
    ipcMain.handle(
      'terminal:getOrCreate',
      async (event, directory: string, context?: string) => {
        try {
          // Check if node-pty is available
          if (!pty) {
            throw new Error(
              'Terminal functionality is not available in this build',
            );
          }

          // Check if we already have a session for this directory+context
          const sessionKey = this.getSessionKey(directory, context);
          const existingSessionId = this.sessionsByRepo.get(sessionKey);
          if (existingSessionId && this.sessions.has(existingSessionId)) {
            console.log(
              `[Terminal] REUSING existing session ${existingSessionId} for ${sessionKey}`,
            );
            return existingSessionId;
          }

          console.log(
            `[Terminal] Creating NEW session for ${sessionKey} (current sessions: ${this.sessions.size})`,
          );

          // Check if we've reached the session limit
          if (this.sessions.size >= this.maxSessions) {
            throw new Error(
              `Maximum number of terminal sessions (${this.maxSessions}) reached. Please close some terminals before opening new ones.`,
            );
          }

          // Create new session with context
          const sessionId = await this.handleTerminalCreate(
            event,
            directory,
            context,
          );

          // Track by repository+context
          this.sessionsByRepo.set(sessionKey, sessionId);

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
      async (event, directory: string, context?: string) => {
        try {
          // Check if node-pty is available
          if (!pty) {
            throw new Error(
              'Terminal functionality is not available in this build',
            );
          }

          console.log(
            `[Terminal] CREATE called for ${directory} with context: ${context || 'default'} (current sessions: ${this.sessions.size})`,
          );

          // Check if we've reached the session limit
          if (this.sessions.size >= this.maxSessions) {
            throw new Error(
              `Maximum number of terminal sessions (${this.maxSessions}) reached. Please close some terminals before opening new ones.`,
            );
          }

          // Use the shared terminal creation logic with context
          return await this.handleTerminalCreate(event, directory, context);
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
        event,
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
          if (this.sessions.size >= this.maxSessions) {
            throw new Error(
              `Maximum number of terminal sessions (${this.maxSessions}) reached. Please close some terminals before opening new ones.`,
            );
          }

          const sessionId = uuidv4();

          // Generate a Claude-compatible session ID for hooks
          const claudeSessionId = `terminal-${sessionId}`;

          // Get shell from environment manager
          const shell = terminalEnvironment.getUserShell();
          const args: string[] = [];

          // Validate and sanitize directory
          const fs = require('fs');
          let workingDirectory = directory;

          if (!workingDirectory || !fs.existsSync(workingDirectory)) {
            workingDirectory = os.homedir();
            console.warn(
              `Directory '${directory}' does not exist, using home directory: ${workingDirectory}`,
            );
          }

          console.log(
            `Creating terminal with shell: ${shell} in directory: ${workingDirectory} with command: ${command}`,
          );

          // Get properly configured environment with user's full PATH
          const env = await terminalEnvironment.getTerminalEnvironment(
            workingDirectory,
            claudeSessionId,
          );

          // Create PTY instance with error handling
          let ptyProcess;
          try {
            ptyProcess = pty.spawn(shell, args, {
              name: 'xterm-color',
              cols: 80,
              rows: 30,
              cwd: workingDirectory,
              env: env as { [key: string]: string },
            });
          } catch (spawnError) {
            console.error(
              'Failed to spawn shell, trying fallback:',
              spawnError,
            );

            // Try fallback shell
            const fallbackShell =
              process.platform === 'darwin' ? '/bin/bash' : '/bin/sh';
            console.log(`Trying fallback shell: ${fallbackShell}`);

            ptyProcess = pty.spawn(fallbackShell, args, {
              name: 'xterm-color',
              cols: 80,
              rows: 30,
              cwd: workingDirectory,
              env: env as { [key: string]: string },
            });
          }

          // Check for active AI session and create terminal session
          const sessionStore =
            await agentSessionService.getSessionsForDirectory(directory);
          const activeAgentSessionId = sessionStore.activeSessionId;

          const now = Date.now();
          const session: TerminalSession = {
            id: sessionId,
            pty: ptyProcess,
            directory,
            context,
            agentSessionId: activeAgentSessionId || undefined,
            createdAt: now,
            lastActivity: now,
          };
          this.sessions.set(sessionId, session);

          // If there's an active AI session, update it to include this terminal
          if (activeAgentSessionId) {
            const agentSession = await agentSessionService.getSession(
              directory,
              activeAgentSessionId,
            );
            if (agentSession) {
              if (!agentSession.terminalSessions) {
                agentSession.terminalSessions = [];
              }
              agentSession.terminalSessions.push({
                terminalId: sessionId,
                createdAt: now,
                lastActivity: now,
                status: 'active',
              });
              await agentSessionService.upsertSession(directory, agentSession);
              console.log(
                `Associated terminal ${sessionId} with AI session ${activeAgentSessionId}`,
              );
            }
          }

          // Handle PTY data
          ptyProcess.onData((data: string) => {
            this.broadcastToRendererWindows('terminal:data', {
              sessionId,
              data,
            });
          });

          // Handle PTY exit
          ptyProcess.onExit(async (exitCode: { exitCode: number }) => {
            this.broadcastToRendererWindows('terminal:exit', {
              sessionId,
              code: exitCode.exitCode,
            });

            // Update AI session to mark terminal as closed
            if (session.agentSessionId) {
              const agentSession = await agentSessionService.getSession(
                directory,
                session.agentSessionId,
              );
              if (agentSession && agentSession.terminalSessions) {
                const terminalSession = agentSession.terminalSessions.find(
                  (t) => t.terminalId === sessionId,
                );
                if (terminalSession) {
                  terminalSession.status = 'closed';
                  terminalSession.lastActivity = Date.now();
                  await agentSessionService.upsertSession(
                    directory,
                    agentSession,
                  );
                }
              }
            }

            this.cleanupSession(sessionId);
          });

          // Send the initial command after a delay to ensure the terminal is ready
          setTimeout(() => {
            if (command) {
              console.log(
                `[Terminal] Sending command for session ${sessionId}: ${command}`,
              );
              ptyProcess.write(`${command}\r`);
            }
          }, 500); // Increased delay to ensure shell prompt is ready

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

    // Write data to terminal
    ipcMain.handle(
      TerminalAPIEvents.WRITE,
      async (event, sessionId: string, data: string) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.pty.write(data);
        }
      },
    );

    // Resize terminal
    ipcMain.handle(
      TerminalAPIEvents.RESIZE,
      async (event, sessionId: string, cols: number, rows: number) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.pty.resize(cols, rows);
        }
      },
    );

    // Destroy terminal session
    ipcMain.handle(
      TerminalAPIEvents.DESTROY,
      async (event, sessionId: string) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.pty.kill();
          this.cleanupSession(sessionId);
          console.log(`Terminal session destroyed: ${sessionId}`);
        }
      },
    );

    // Get list of active terminals
    ipcMain.handle(TerminalAPIEvents.LIST, async (event) => {
      const terminals: TerminalInfo[] = Array.from(this.sessions.entries()).map(
        ([id, session]) => ({
          id,
          directory: session.directory,
          context: session.context,
          agentSessionId: session.agentSessionId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          status: 'active' as const,
          ownedByWindowId: session.ownedByWindowId,
          ownershipClaimedAt: session.ownershipClaimedAt,
        }),
      );
      return terminals;
    });

    // Request terminal to refresh its display
    ipcMain.handle(
      TerminalAPIEvents.REFRESH,
      async (event, sessionId: string) => {
        const session = this.sessions.get(sessionId);
        if (session && session.pty) {
          // Send a refresh sequence to the terminal
          // This triggers the terminal to redraw its current state
          try {
            // Send Ctrl+L to clear and redraw
            session.pty.write('\x0c');
            return true;
          } catch (error) {
            console.error('Failed to refresh terminal:', error);
            return false;
          }
        }
        return false;
      },
    );

    // Pop out terminal to new window
    ipcMain.handle(
      TerminalAPIEvents.POP_OUT,
      async (event, sessionId: string) => {
        try {
          const session = this.sessions.get(sessionId);
          if (!session) {
            throw new Error(`Terminal session ${sessionId} not found`);
          }

          return this.createTerminalWindow(sessionId, session);
        } catch (error) {
          console.error('Failed to pop out terminal:', error);
          throw error;
        }
      },
    );

    // Focus a terminal window by window ID
    ipcMain.handle(
      TerminalAPIEvents.FOCUS_WINDOW,
      async (event, windowId: number) => {
        try {
          const window = BrowserWindow.fromId(windowId);
          if (window && !window.isDestroyed()) {
            window.focus();
            if (window.isMinimized()) {
              window.restore();
            }
            console.log(`[Terminal] Focused window ${windowId}`);
          } else {
            console.warn(
              `[Terminal] Window ${windowId} not found or destroyed`,
            );
          }
        } catch (error) {
          console.error('Failed to focus terminal window:', error);
          throw error;
        }
      },
    );

    // Check if a command is available in the user's PATH
    ipcMain.handle(
      TerminalAPIEvents.CHECK_COMMAND,
      async (event, command: string) => {
        try {
          const isAvailable =
            await terminalEnvironment.isCommandAvailable(command);
          const fullPath = isAvailable
            ? await terminalEnvironment.findCommand(command)
            : null;
          return { available: isAvailable, path: fullPath };
        } catch (error) {
          console.error(`Failed to check command ${command}:`, error);
          return { available: false, path: null };
        }
      },
    );

    // Clear cached PATH (useful after installing new tools)
    ipcMain.handle(TerminalAPIEvents.CLEAR_PATH_CACHE, async () => {
      terminalEnvironment.clearCache();
      console.log('[Terminal] PATH cache cleared');
      return true;
    });

    // Get list of open terminal windows
    ipcMain.handle(TerminalAPIEvents.GET_OPEN_WINDOWS, async () => {
      const openWindows: Array<{ terminalId: string; windowId: number }> = [];

      this.terminalWindows.forEach((window, terminalId) => {
        if (!window.isDestroyed()) {
          openWindows.push({
            terminalId,
            windowId: window.id,
          });
        }
      });

      return openWindows;
    });

    // Check ownership of a terminal session
    ipcMain.handle(
      TerminalAPIEvents.CHECK_OWNERSHIP,
      async (event, sessionId: string) => {
        const session = this.sessions.get(sessionId);
        if (!session) {
          return { exists: false, ownedByWindowId: null, canClaim: false };
        }

        const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
        const isOwnedByThisWindow = session.ownedByWindowId === senderWindowId;
        const isUnowned = !session.ownedByWindowId;

        // Check if owned by a window that no longer exists
        let ownerWindowExists = false;
        if (session.ownedByWindowId) {
          const ownerWindow = BrowserWindow.fromId(session.ownedByWindowId);
          ownerWindowExists = ownerWindow && !ownerWindow.isDestroyed();
        }

        return {
          exists: true,
          ownedByWindowId: session.ownedByWindowId,
          ownedByThisWindow: isOwnedByThisWindow,
          canClaim: isUnowned || !ownerWindowExists,
          ownerWindowExists,
        };
      },
    );

    // Claim ownership of a terminal session
    ipcMain.handle(
      TerminalAPIEvents.CLAIM_OWNERSHIP,
      async (event, sessionId: string, force: boolean = false) => {
        const session = this.sessions.get(sessionId);
        if (!session) {
          return { success: false, reason: 'Session not found' };
        }

        const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;
        if (!senderWindowId) {
          return { success: false, reason: 'Could not determine window ID' };
        }

        // Check if already owned by another window
        if (
          session.ownedByWindowId &&
          session.ownedByWindowId !== senderWindowId
        ) {
          const ownerWindow = BrowserWindow.fromId(session.ownedByWindowId);
          const ownerExists = ownerWindow && !ownerWindow.isDestroyed();

          if (ownerExists && !force) {
            return {
              success: false,
              reason: 'Owned by another window',
              ownedByWindowId: session.ownedByWindowId,
            };
          }

          // If owner window doesn't exist or force=true, notify old owner (if it exists)
          if (ownerExists) {
            ownerWindow.webContents.send(TerminalAPIEvents.OWNERSHIP_LOST, {
              sessionId,
              newOwnerWindowId: senderWindowId,
            });
          }
        }

        // Claim ownership
        session.ownedByWindowId = senderWindowId;
        session.ownershipClaimedAt = Date.now();

        console.log(
          `[Terminal] Window ${senderWindowId} claimed ownership of session ${sessionId}`,
        );

        return { success: true };
      },
    );

    // Release ownership of a terminal session
    ipcMain.handle(
      TerminalAPIEvents.RELEASE_OWNERSHIP,
      async (event, sessionId: string) => {
        const session = this.sessions.get(sessionId);
        if (!session) {
          return { success: false, reason: 'Session not found' };
        }

        const senderWindowId = BrowserWindow.fromWebContents(event.sender)?.id;

        // Only the owner can release ownership
        if (session.ownedByWindowId !== senderWindowId) {
          return { success: false, reason: 'Not the owner' };
        }

        session.ownedByWindowId = undefined;
        session.ownershipClaimedAt = undefined;

        console.log(
          `[Terminal] Window ${senderWindowId} released ownership of session ${sessionId}`,
        );

        return { success: true };
      },
    );
  }

  // Create terminal with command - used internally by other services
  async createTerminalWithCommand(
    directory: string,
    command: string,
  ): Promise<string | null> {
    try {
      // Check if we've reached the session limit
      if (this.sessions.size >= this.maxSessions) {
        throw new Error(
          `Maximum number of terminal sessions (${this.maxSessions}) reached. Please close some terminals before opening new ones.`,
        );
      }

      const sessionId = uuidv4();

      // Generate a Claude-compatible session ID for hooks
      const claudeSessionId = `terminal-${sessionId}`;
      console.log(
        `[Terminal] Creating terminal ${sessionId} with CLAUDE_SESSION_ID=${claudeSessionId} in directory: ${directory} with command: ${command}`,
      );

      // Get shell from environment manager
      const shell = terminalEnvironment.getUserShell();
      const args: string[] = [];

      // Validate and sanitize directory
      const fs = require('fs');
      let workingDirectory = directory;

      if (!workingDirectory || !fs.existsSync(workingDirectory)) {
        workingDirectory = os.homedir();
        console.warn(
          `Directory '${directory}' does not exist, using home directory: ${workingDirectory}`,
        );
      }

      console.log(
        `Creating terminal with shell: ${shell} in directory: ${workingDirectory} with command: ${command}`,
      );

      // Get properly configured environment with user's full PATH
      const env = await terminalEnvironment.getTerminalEnvironment(
        workingDirectory,
        claudeSessionId,
      );

      // Create PTY instance with error handling
      let ptyProcess;
      try {
        ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: workingDirectory,
          env: env as { [key: string]: string },
        });
      } catch (spawnError) {
        console.error('Failed to spawn shell, trying fallback:', spawnError);

        // Try fallback shell
        const fallbackShell =
          process.platform === 'darwin' ? '/bin/bash' : '/bin/sh';
        console.log(`Trying fallback shell: ${fallbackShell}`);

        ptyProcess = pty.spawn(fallbackShell, args, {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: workingDirectory,
          env: env as { [key: string]: string },
        });
      }

      // Check for active AI session and create terminal session
      const sessionStore =
        await agentSessionService.getSessionsForDirectory(directory);
      const activeAgentSessionId = sessionStore.activeSessionId;

      const now = Date.now();
      const session: TerminalSession = {
        id: sessionId,
        pty: ptyProcess,
        directory,
        agentSessionId: activeAgentSessionId || undefined,
        createdAt: now,
        lastActivity: now,
      };
      this.sessions.set(sessionId, session);

      // If there's an active AI session, update it to include this terminal
      if (activeAgentSessionId) {
        const agentSession = await agentSessionService.getSession(
          directory,
          activeAgentSessionId,
        );
        if (agentSession) {
          if (!agentSession.terminalSessions) {
            agentSession.terminalSessions = [];
          }
          agentSession.terminalSessions.push({
            terminalId: sessionId,
            createdAt: now,
            lastActivity: now,
            status: 'active',
          });
          await agentSessionService.upsertSession(directory, agentSession);
          console.log(
            `Associated terminal ${sessionId} with AI session ${activeAgentSessionId}`,
          );
        }
      }

      // Handle PTY data
      ptyProcess.onData((data: string) => {
        this.broadcastToRendererWindows('terminal:data', {
          sessionId,
          data,
        });
      });

      // Handle PTY exit
      ptyProcess.onExit(async (exitCode: { exitCode: number }) => {
        this.broadcastToRendererWindows('terminal:exit', {
          sessionId,
          code: exitCode.exitCode,
        });

        // Update AI session to mark terminal as closed
        if (session.agentSessionId) {
          const agentSession = await agentSessionService.getSession(
            directory,
            session.agentSessionId,
          );
          if (agentSession && agentSession.terminalSessions) {
            const terminalSession = agentSession.terminalSessions.find(
              (t) => t.terminalId === sessionId,
            );
            if (terminalSession) {
              terminalSession.status = 'closed';
              terminalSession.lastActivity = Date.now();
              await agentSessionService.upsertSession(directory, agentSession);
            }
          }
        }

        this.sessions.delete(sessionId);
      });

      // Send the initial command after a short delay to ensure the terminal is ready
      setTimeout(() => {
        if (command) {
          // For Claude command, we need to ensure the session ID environment variable is set
          if (command.toLowerCase() === 'claude') {
            // The CLAUDE_SESSION_ID is already set in the environment, just run the command
            console.log(`Launching Claude with session ID: ${claudeSessionId}`);
          }
          ptyProcess.write(`${command}\r`);
        }
      }, 100);

      console.log(
        `Terminal session created successfully with command: ${sessionId}`,
      );
      return sessionId;
    } catch (error) {
      console.error('Failed to create terminal with command:', error);
      return null;
    }
  }

  // Create a new window for a terminal session
  async createTerminalWindow(
    sessionId: string,
    session: TerminalSession,
  ): Promise<{ windowId: number }> {
    const iconPath = EnvironmentConfig.getAssetsPath('icon.png');

    // Get screen dimensions for positioning
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workAreaSize;

    // Position on left half of screen
    const windowWidth = Math.floor(screenWidth / 2);
    const windowHeight = screenHeight;

    // Create terminal window using ApplicationWindow with TERMINAL type
    const terminalAppWindow = new ModernApplicationWindow(
      {
        // Window sizing and positioning
        width: windowWidth,
        height: windowHeight,
        x: 0,
        y: 0,
        title: `Terminal - ${session.directory.split('/').pop()}`,
        icon: iconPath,
      },
      WindowType.TERMINAL,
    );

    const terminalWindow = terminalAppWindow.window;

    // Track the window
    this.terminalWindows.set(sessionId, terminalWindow);

    // Terminal-specific: Notify all windows when the terminal window is shown
    terminalWindow.once('show', () => {
      this.broadcastToRendererWindows(TerminalAPIEvents.ON_WINDOW_READY, {
        terminalId: sessionId,
        agentSessionId: session.agentSessionId,
        windowId: terminalWindow.id,
      });

      if (!terminalWindow.isDestroyed()) {
        terminalWindow.webContents.send(TerminalAPIEvents.ON_WINDOW_READY, {
          terminalId: sessionId,
          agentSessionId: session.agentSessionId,
          windowId: terminalWindow.id,
        });
      }
      console.log(
        `[Terminal] Window ready event sent for terminal ${sessionId}, agent session ${session.agentSessionId}`,
      );
    });

    // Load the terminal route with session ID
    const htmlPath = resolveHtmlPath('index.html');
    const urlWithRoute = `${htmlPath}#/terminal/${sessionId}`;
    console.log(`[Terminal] Loading pop-out window with URL: ${urlWithRoute}`);
    await terminalWindow.loadURL(urlWithRoute);

    // Clean up when window is closed
    terminalWindow.on('closed', () => {
      console.log(`[Terminal] Pop-out window closed for session ${sessionId}`);
      this.terminalWindows.delete(sessionId);

      // Notify registered windows about the terminal window close
      this.broadcastToRendererWindows(TerminalAPIEvents.ON_WINDOW_CLOSE, {
        terminalId: sessionId,
        agentSessionId: session.agentSessionId,
        windowId: terminalWindow.id,
      });
    });

    // Send terminal data to this window as well
    if (session.pty) {
      // Add an additional data listener for the pop-out window
      // The existing main window listener is already set up in the terminal creation
      session.pty.onData((data: string) => {
        // Send to pop-out window
        if (!terminalWindow.isDestroyed()) {
          terminalWindow.webContents.send('terminal:data', {
            sessionId,
            data,
          });
        }
      });
    }

    return { windowId: terminalWindow.id };
  }

  // Clean up all sessions
  destroyAllSessions() {
    this.sessions.forEach((session, sessionId) => {
      try {
        session.pty.kill();
      } catch (error) {
        // console.error(`Failed to kill terminal session ${sessionId}:`, error);
      }
    });
    this.sessions.clear();
    this.sessionsByRepo.clear(); // Clear repo tracking

    // Close all terminal windows
    this.terminalWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    this.terminalWindows.clear();
  }
}

// Export singleton instance only if pty is available
let terminalManager: TerminalManager | null = null;
if (pty) {
  terminalManager = new TerminalManager();
} else {
  console.warn('Terminal functionality disabled - node-pty not available');
}

export default terminalManager;
export { terminalManager };
export type { TerminalManager };
