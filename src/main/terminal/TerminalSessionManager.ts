import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { BrowserWindow, MessageChannelMain } from 'electron';
import { TerminalSession } from './types';
import { pty } from './utils/ptyLoader';
import { ownershipManager } from './TerminalOwnershipManager';
import { agentSessionService } from '../agent-sessions/agentSessionService';
import { terminalEnvironment } from '../terminalEnvironment';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';

export class TerminalSessionManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionsByRepo: Map<string, string> = new Map(); // "repoPath:context" -> sessionId
  private maxSessions = 20;
  private rendererWindows: Set<BrowserWindow> = new Set();

  // MessagePort support - track ports per session per window
  private sessionPorts: Map<string, Map<number, MessageChannelMain>> = new Map();

  // Renderer window tracking
  addRendererWindow(window: BrowserWindow): void {
    if (!window || this.rendererWindows.has(window)) {
      return;
    }

    this.rendererWindows.add(window);

    const cleanup = () => {
      this.rendererWindows.delete(window);
      this.cleanupWindowPorts(window.id);
      ownershipManager.cleanupWindow(window.id);
      window.removeListener('closed', cleanup);
    };

    window.on('closed', cleanup);
  }

  // Broadcasting to all renderer windows (for exit events, etc.)
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

  /**
   * Send terminal data to the owner window only.
   * This avoids sizing conflicts from multiple windows receiving data.
   */
  private sendToOwner(sessionId: string, data: string): void {
    const ownerWindowId = ownershipManager.getOwner(sessionId);
    if (ownerWindowId === undefined) {
      // Only log occasionally to avoid spam
      if (data.length > 0 && data.charCodeAt(0) !== 27) { // Skip escape sequences
        console.warn(`[Terminal] No owner for session ${sessionId}, dropping ${data.length} bytes`);
      }
      return;
    }

    const windowPorts = this.sessionPorts.get(sessionId);
    if (!windowPorts) {
      console.warn(`[Terminal] No ports map for session ${sessionId}`);
      return;
    }

    const channel = windowPorts.get(ownerWindowId);
    if (!channel) {
      console.warn(
        `[Terminal] No MessagePort found for owner window ${ownerWindowId} on session ${sessionId}. ` +
        `Available windows: ${Array.from(windowPorts.keys()).join(', ')}`
      );
      return;
    }

    try {
      channel.port1.postMessage({ type: 'DATA', data });
    } catch (error) {
      console.error(
        `[Terminal] Failed to send data via MessagePort for session ${sessionId}:`,
        error,
      );
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

  // Check if session exists
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
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
    };
    this.sessions.set(sessionId, session);

    // Initialize port tracking for this session
    this.sessionPorts.set(sessionId, new Map());

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

    // Handle PTY data - send only to owner
    ptyProcess.onData((data: string) => {
      session.lastActivity = Date.now();
      this.sendToOwner(sessionId, data);
    });

    // Handle PTY exit
    ptyProcess.onExit(async (exitCode: { exitCode: number }) => {
      this.broadcastToRendererWindows(TerminalAPIEvents.ON_EXIT, {
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
    // Close all MessageChannels for this session
    this.closeAllPortsForSession(sessionId);

    // Clean up ownership
    ownershipManager.removeSession(sessionId);

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
        this.closeAllPortsForSession(sessionId);
      } catch (_error) {
        // Ignore errors during cleanup
      }
    });
    this.sessions.clear();
    this.sessionsByRepo.clear();
    this.sessionPorts.clear();
  }

  // Write data to a session
  writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
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
   * Create a MessageChannel for a session and transfer port to renderer.
   * Also claims ownership for the window.
   * @deprecated Use createPortForSession instead (matches terminal-testing-app pattern)
   */
  createMessageChannelForSession(sessionId: string, windowId: number): boolean {
    // Delegate to createPortForSession with claimOwnership=true for backward compat
    return this.createPortForSession(sessionId, windowId, true);
  }

  /**
   * Create and send a new MessagePort for a session to a window.
   * Matches the terminal-testing-app pattern where ownership is managed separately.
   *
   * @param sessionId - The session to create a port for
   * @param windowId - The window to send the port to
   * @param claimOwnership - Whether to also claim ownership (default: false)
   */
  createPortForSession(sessionId: string, windowId: number, claimOwnership: boolean = false): boolean {
    console.log(`[Terminal] createPortForSession called: sessionId=${sessionId}, windowId=${windowId}, claimOwnership=${claimOwnership}`);

    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[Terminal] Cannot create port: session ${sessionId} not found`);
      console.error(`[Terminal] Available sessions: ${Array.from(this.sessions.keys()).join(', ')}`);
      return false;
    }

    const window = BrowserWindow.fromId(windowId);
    if (!window || window.isDestroyed()) {
      console.error(`[Terminal] Cannot create port: window ${windowId} not found or destroyed`);
      console.error(`[Terminal] All windows: ${BrowserWindow.getAllWindows().map(w => w.id).join(', ')}`);
      return false;
    }

    // Check if this window already has a port for this session (matches testing app)
    const existingPorts = this.sessionPorts.get(sessionId);
    if (existingPorts?.has(windowId)) {
      console.log(`[Terminal] Window ${windowId} already has a port for session ${sessionId}`);
      // Still claim ownership if requested
      if (claimOwnership) {
        ownershipManager.claimOwnership(sessionId, windowId);
      }
      return true;
    }

    console.log(`[Terminal] Session and window validated, creating new MessageChannel`);

    try {
      // Create MessageChannel
      const channel = new MessageChannelMain();

      // Store the channel
      if (!this.sessionPorts.has(sessionId)) {
        this.sessionPorts.set(sessionId, new Map());
      }
      this.sessionPorts.get(sessionId)!.set(windowId, channel);

      console.log(`[Terminal] Created MessageChannel for session ${sessionId} -> window ${windowId}`);

      // Start listening on port1 (main process side)
      channel.port1.start();

      // Listen for messages from renderer (via port2 -> port1)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MessageChannelMain event type is not exported by Electron
      channel.port1.on('message', (event: any) => {
        this.handlePortMessage(sessionId, event.data);
      });

      // Claim ownership only if requested
      if (claimOwnership) {
        ownershipManager.claimOwnership(sessionId, windowId);
      }

      // Transfer port2 to renderer using 'terminal:port' channel (matches testing app)
      console.log(`[Terminal] Sending port to window ${windowId} for session ${sessionId}`);

      try {
        window.webContents.postMessage('terminal:port', sessionId, [channel.port2]);
        console.log(`[Terminal] ✅ Port sent successfully to window ${windowId} for session ${sessionId}`);
      } catch (postError) {
        console.error(`[Terminal] ❌ Failed to send port:`, postError);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[Terminal] Failed to create port for session ${sessionId}:`, error);
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
        session.lastActivity = Date.now();
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
   * Close all MessageChannels for a session
   */
  private closeAllPortsForSession(sessionId: string): void {
    const windowPorts = this.sessionPorts.get(sessionId);
    if (windowPorts) {
      for (const [windowId, channel] of windowPorts.entries()) {
        try {
          channel.port1.close();
        } catch (error) {
          console.error(`[Terminal] Error closing port for window ${windowId} on session ${sessionId}:`, error);
        }
      }
      this.sessionPorts.delete(sessionId);
      console.log(`[Terminal] Closed all ports for session ${sessionId}`);
    }
  }

  /**
   * Clean up ports for a specific window (called when window closes)
   */
  private cleanupWindowPorts(windowId: number): void {
    for (const [sessionId, windowPorts] of this.sessionPorts.entries()) {
      const channel = windowPorts.get(windowId);
      if (channel) {
        try {
          channel.port1.close();
        } catch {
          // Port may already be closed
        }
        windowPorts.delete(windowId);
        console.log(`[Terminal] Cleaned up port for window ${windowId} on session ${sessionId}`);
      }
    }
  }
}
