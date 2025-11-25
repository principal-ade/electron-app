import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { BrowserWindow } from 'electron';
import { TerminalSession } from './types';
import { pty } from './utils/ptyLoader';
import { agentSessionService } from '../agent-sessions/agentSessionService';
import { terminalEnvironment } from '../terminalEnvironment';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';

export class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionsByRepo: Map<string, string> = new Map(); // "repoPath:context" -> sessionId
  private maxSessions = 20;
  private rendererWindows: Set<BrowserWindow> = new Set();

  constructor() {}

  // Renderer window tracking
  addRendererWindow(window: BrowserWindow): void {
    if (!window || this.rendererWindows.has(window)) {
      return;
    }

    this.rendererWindows.add(window);

    const cleanup = () => {
      this.rendererWindows.delete(window);
      window.removeListener('closed', cleanup);
    };

    window.on('closed', cleanup);
  }

  // Broadcasting
  broadcastToRendererWindows(channel: string, payload: unknown): void {
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

  // Send terminal data only to windows actively viewing this terminal
  sendToActiveViewers(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.activeViewers.size === 0) {
      return; // No one viewing, skip IPC entirely
    }

    // Use session-specific channel for better performance
    const sessionChannel = `${TerminalAPIEvents.ON_DATA}:${sessionId}`;

    const viewerIds = Array.from(session.activeViewers);
    for (const windowId of viewerIds) {
      const window = BrowserWindow.fromId(windowId);
      if (window && !window.isDestroyed()) {
        try {
          window.webContents.send(sessionChannel, data);
        } catch (error) {
          console.warn(
            `[Terminal] Failed to send data to window ${windowId}:`,
            error,
          );
        }
      } else {
        // Window no longer exists, remove from viewers
        session.activeViewers.delete(windowId);
      }
    }
  }

  // Helper to generate session key from directory and context
  getSessionKey(directory: string, context?: string): string {
    return `${directory}:${context || 'default'}`;
  }

  // Get existing session by repo key
  getSessionByRepoKey(sessionKey: string): TerminalSession | null {
    const sessionId = this.sessionsByRepo.get(sessionKey);
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }
    return null;
  }

  // Get session by ID
  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Get all sessions
  getAllSessions(): Map<string, TerminalSession> {
    return this.sessions;
  }

  // Check session limit
  canCreateSession(): boolean {
    return this.sessions.size < this.maxSessions;
  }

  getMaxSessions(): number {
    return this.maxSessions;
  }

  // Create a new terminal session
  async createSession(
    directory: string,
    context?: string,
    command?: string,
  ): Promise<string> {
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
      workingDirectory = process.env.HOME || process.env.USERPROFILE || os.homedir();
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
    let ptyProcess;
    try {
      ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: workingDirectory,
        env,
      });
    } catch (spawnError) {
      console.error('Failed to spawn shell, trying fallback:', spawnError);

      // Try fallback shell
      const fallbackShell =
        process.platform === 'darwin' ? '/bin/bash' : '/bin/sh';
      console.log(`Trying fallback shell: ${fallbackShell}`);

      ptyProcess = pty.spawn(fallbackShell, args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: workingDirectory,
        env,
      });
    }

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
      activeViewers: new Set(),
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
      this.sendToActiveViewers(sessionId, data);
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
    if (!command) {
      setTimeout(() => {
        console.log(
          `[Terminal] Sending initial newline to trigger prompt for ${sessionId}`,
        );
        ptyProcess.write('\r');
      }, 200);
    } else {
      // Send the initial command after a delay to ensure the terminal is ready
      setTimeout(() => {
        console.log(
          `[Terminal] Sending command for session ${sessionId}: ${command}`,
        );
        ptyProcess.write(`${command}\r`);
      }, 500);
    }

    return sessionId;
  }

  // Track session by repo key
  trackSessionByRepo(sessionKey: string, sessionId: string): void {
    this.sessionsByRepo.set(sessionKey, sessionId);
  }

  // Clean up a session and its repo tracking
  cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    // Clean up repo tracking
    for (const [repo, sid] of this.sessionsByRepo.entries()) {
      if (sid === sessionId) {
        this.sessionsByRepo.delete(repo);
        break;
      }
    }
  }

  // Destroy a specific session
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.kill();
      this.cleanupSession(sessionId);
      console.log(`Terminal session destroyed: ${sessionId}`);
    }
  }

  // Clean up all sessions
  destroyAllSessions(): void {
    this.sessions.forEach((session, sessionId) => {
      try {
        session.pty.kill();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    this.sessions.clear();
    this.sessionsByRepo.clear();
  }

  // Write data to a session
  writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.write(data);
    }
  }

  // Resize a session
  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  // Refresh a session (send Ctrl+L)
  refreshSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.pty) {
      try {
        session.pty.write('\x0c');
        return true;
      } catch (error) {
        console.error('Failed to refresh terminal:', error);
        return false;
      }
    }
    return false;
  }
}
