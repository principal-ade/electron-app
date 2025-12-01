import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { BrowserWindow, MessageChannelMain } from 'electron';
import { TerminalSession } from './types';
import { pty } from './utils/ptyLoader';
import { agentSessionService } from '../agent-sessions/agentSessionService';
import { terminalEnvironment } from '../terminalEnvironment';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';
import { terminalConfig } from './config';

export class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionsByRepo: Map<string, string> = new Map(); // "repoPath:context" -> sessionId
  private maxSessions = 20;
  private rendererWindows: Set<BrowserWindow> = new Set();

  // MessagePort support
  private sessionPorts: Map<string, MessageChannelMain> = new Map();

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
      return; // No one viewing, skip entirely
    }

    const channel = this.sessionPorts.get(sessionId);
    if (!channel) {
      console.error(
        `[Terminal] No MessagePort found for session ${sessionId}. Data will be lost. ` +
        `Active viewers: ${Array.from(session.activeViewers).join(', ')}`,
      );
      return;
    }

    try {
      // Send data through port1 (which will arrive at port2 in renderer)
      channel.port1.postMessage({ type: 'DATA', data });
    } catch (error) {
      console.error(
        `[Terminal] Failed to send data via MessagePort for session ${sessionId}:`,
        error,
      );
      // No fallback - let the error surface so we can debug MessagePort issues
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
      const session = this.sessions.get(sessionId);
      return session ?? null;
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
    // Close MessageChannel if it exists
    this.closeMessageChannel(sessionId);

    this.sessions.delete(sessionId);
    // Clean up repo tracking
    for (const [repo, sid] of Array.from(this.sessionsByRepo.entries())) {
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
        // Close MessageChannel if it exists
        this.closeMessageChannel(sessionId);
      } catch (_error) {
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
  resizeSession(sessionId: string, cols: number, rows: number, force: boolean = false): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (force) {
        // Force SIGWINCH by temporarily changing dimensions
        // This ensures the shell redraws even if dimensions match
        session.pty.resize(cols + 1, rows);
        session.pty.resize(cols, rows);
      } else {
        session.pty.resize(cols, rows);
      }
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

  // MessagePort support methods

  /**
   * Create a MessageChannel for a session and transfer port to renderer
   */
  createMessageChannelForSession(sessionId: string, windowId: number): boolean {
    if (!terminalConfig.enableMessagePorts) {
      console.log('[Terminal] MessagePorts disabled, skipping channel creation');
      return false;
    }

    const window = BrowserWindow.fromId(windowId);
    if (!window || window.isDestroyed()) {
      console.error(`[Terminal] Cannot create MessageChannel: window ${windowId} not found`);
      return false;
    }

    try {
      // Create MessageChannel
      const channel = new MessageChannelMain();
      this.sessionPorts.set(sessionId, channel);

      console.log(`[Terminal] Created MessageChannel for session ${sessionId}`);

      // Start listening on port1 (main process side)
      channel.port1.start();

      // Listen for messages from renderer (via port2 -> port1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MessageChannelMain event type is not exported by Electron
      channel.port1.on('message', (event: any) => {
        this.handlePortMessage(sessionId, event.data);
      });

      // Transfer port2 to renderer
      window.webContents.postMessage(
        TerminalAPIEvents.PORT_READY,
        {
          sessionId,
          writable: true, // TODO: Check ownership before setting this
        },
        [channel.port2],
      );

      console.log(`[Terminal] Transferred port2 to window ${windowId} for session ${sessionId}`);

      return true;
    } catch (error) {
      console.error(`[Terminal] Failed to create MessageChannel for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Handle messages received from renderer via MessagePort
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Using TerminalPortMessage type here causes module load failures
  private handlePortMessage(sessionId: string, message: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[Terminal] Received message for non-existent session ${sessionId}`);
      return;
    }

    try {
      if (message.type === 'WRITE') {
        session.pty.write(message.data);
      } else if (message.type === 'RESIZE') {
        session.pty.resize(message.cols, message.rows);
      } else {
        console.warn(`[Terminal] Unknown message type from port: ${message.type}`);
      }
    } catch (error) {
      console.error(`[Terminal] Error handling port message for session ${sessionId}:`, error);
    }
  }

  /**
   * Close MessageChannel for a session
   */
  closeMessageChannel(sessionId: string): void {
    const channel = this.sessionPorts.get(sessionId);
    if (channel) {
      try {
        channel.port1.close();
        // port2 will be closed automatically when port1 closes
      } catch (error) {
        console.error(`[Terminal] Error closing MessageChannel for session ${sessionId}:`, error);
      }
      this.sessionPorts.delete(sessionId);
      console.log(`[Terminal] Closed MessageChannel for session ${sessionId}`);
    }
  }
}
