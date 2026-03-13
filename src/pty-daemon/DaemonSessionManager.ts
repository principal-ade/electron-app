/**
 * DaemonSessionManager
 *
 * Manages PTY sessions within the daemon process.
 * Handles spawning, data flow, resize, and cleanup of PTY processes.
 */

import { EventEmitter } from 'events';
import type { IPty } from 'node-pty';
import { ScrollbackBuffer } from './ScrollbackBuffer';
import {
  SessionInfo,
  DaemonMessage,
  CreateSessionMessage,
} from '../shared/pty-daemon/protocol';
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  TERM_TYPE,
} from '../shared/pty-daemon/constants';

// node-pty is loaded dynamically to avoid webpack bundling issues
let pty: typeof import('node-pty') | null = null;

function loadNodePty(): typeof import('node-pty') {
  if (!pty) {
    // Use eval to prevent webpack from trying to bundle node-pty
    // eslint-disable-next-line no-eval
    pty = eval('require')('node-pty') as typeof import('node-pty');
  }
  return pty;
}

interface PtySession {
  id: string;
  pty: IPty;
  cwd: string;
  cols: number;
  rows: number;
  createdAt: Date;
  lastActivity: Date;
  scrollback: ScrollbackBuffer;
}

export interface DaemonSessionManagerEvents {
  message: (msg: DaemonMessage) => void;
  sessionCreated: (sessionId: string) => void;
  sessionDestroyed: (sessionId: string) => void;
}

export class DaemonSessionManager extends EventEmitter {
  private sessions: Map<string, PtySession> = new Map();

  constructor() {
    super();
  }

  /**
   * Create a new PTY session.
   */
  createSession(msg: CreateSessionMessage): void {
    const { id, cwd, shell, env, cols = DEFAULT_COLS, rows = DEFAULT_ROWS } = msg;

    // Check if session already exists
    if (this.sessions.has(id)) {
      this.emitMessage({
        type: 'error',
        id,
        error: `Session ${id} already exists`,
      });
      return;
    }

    try {
      const nodePty = loadNodePty();

      // Determine shell to use
      const shellPath = shell || this.getDefaultShell();

      // Merge environment
      const ptyEnv = {
        ...process.env,
        ...env,
        TERM: TERM_TYPE,
      };

      // Spawn PTY process
      const ptyProcess = nodePty.spawn(shellPath, [], {
        name: TERM_TYPE,
        cols,
        rows,
        cwd,
        env: ptyEnv as Record<string, string>,
      });

      const session: PtySession = {
        id,
        pty: ptyProcess,
        cwd,
        cols,
        rows,
        createdAt: new Date(),
        lastActivity: new Date(),
        scrollback: new ScrollbackBuffer(),
      };

      // Handle PTY data output
      ptyProcess.onData((data: string) => {
        session.lastActivity = new Date();
        session.scrollback.append(data);

        this.emitMessage({
          type: 'data',
          id,
          data,
        });
      });

      // Handle PTY exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        this.emitMessage({
          type: 'exit',
          id,
          exitCode,
          signal: signal !== undefined ? String(signal) : undefined,
        });

        // Clean up session
        this.sessions.delete(id);
        this.emit('sessionDestroyed', id);
      });

      // Store session
      this.sessions.set(id, session);

      // Emit created message
      this.emitMessage({
        type: 'created',
        id,
        pid: ptyProcess.pid,
      });

      this.emit('sessionCreated', id);

      // Send initial newline after short delay (helps shell initialize)
      setTimeout(() => {
        if (this.sessions.has(id)) {
          // Don't send anything - let the shell prompt appear naturally
        }
      }, 100);
    } catch (error) {
      this.emitMessage({
        type: 'error',
        id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Write data to a session.
   */
  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.emitMessage({
        type: 'error',
        id: sessionId,
        error: `Session ${sessionId} not found`,
      });
      return;
    }

    session.lastActivity = new Date();
    session.pty.write(data);
  }

  /**
   * Resize a session.
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.emitMessage({
        type: 'error',
        id: sessionId,
        error: `Session ${sessionId} not found`,
      });
      return;
    }

    session.cols = cols;
    session.rows = rows;
    session.lastActivity = new Date();
    session.pty.resize(cols, rows);
  }

  /**
   * Destroy a session.
   */
  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Session doesn't exist, not an error
      return;
    }

    try {
      session.pty.kill();
    } catch {
      // Ignore kill errors
    }

    this.sessions.delete(sessionId);
    this.emit('sessionDestroyed', sessionId);
  }

  /**
   * List all active sessions.
   */
  listSessions(): SessionInfo[] {
    const sessions: SessionInfo[] = [];

    for (const [id, session] of this.sessions) {
      sessions.push({
        id,
        cwd: session.cwd,
        pid: session.pty.pid,
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
        cols: session.cols,
        rows: session.rows,
      });
    }

    return sessions;
  }

  /**
   * Attach to a session and get scrollback.
   */
  attach(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.emitMessage({
        type: 'error',
        id: sessionId,
        error: `Session ${sessionId} not found`,
      });
      return null;
    }

    return session.scrollback.getAll();
  }

  /**
   * Get session count.
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Shutdown all sessions.
   */
  shutdown(): void {
    for (const [id] of this.sessions) {
      this.destroy(id);
    }
  }

  /**
   * Get default shell for the platform.
   */
  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/sh';
  }

  /**
   * Emit a daemon message to all connected clients.
   */
  private emitMessage(msg: DaemonMessage): void {
    this.emit('message', msg);
  }
}
