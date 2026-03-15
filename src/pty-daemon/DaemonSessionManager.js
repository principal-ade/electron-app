/**
 * DaemonSessionManager
 *
 * Manages PTY sessions within the daemon process.
 * Handles spawning, data flow, resize, and cleanup of PTY processes.
 */
import { EventEmitter } from 'events';
import { ScrollbackBuffer } from './ScrollbackBuffer';
import { DEFAULT_COLS, DEFAULT_ROWS, TERM_TYPE, } from '../shared/pty-daemon/constants';
import { addSessionActionEvent, addErrorEvent, addPtySpawnAttemptEvent, addPtySpawnedEvent, addPtySpawnFailedEvent, } from './telemetry';
// node-pty is loaded dynamically to avoid webpack bundling issues
let pty = null;
function loadNodePty() {
    if (!pty) {
        // Use eval to prevent webpack from trying to bundle node-pty
        pty = eval('require')('node-pty');
    }
    return pty;
}
export class DaemonSessionManager extends EventEmitter {
    sessions = new Map();
    constructor() {
        super();
    }
    /**
     * Create a new PTY session.
     */
    createSession(msg) {
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
            // Log spawn attempt with all details for debugging
            addPtySpawnAttemptEvent(id, shellPath, cwd, cols, rows, Object.keys(ptyEnv));
            // Spawn PTY process
            const ptyProcess = nodePty.spawn(shellPath, [], {
                name: TERM_TYPE,
                cols,
                rows,
                cwd,
                env: ptyEnv,
            });
            // Log successful spawn
            addPtySpawnedEvent(id, ptyProcess.pid);
            const session = {
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
            ptyProcess.onData((data) => {
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
            // Add telemetry event
            addSessionActionEvent('created', id, this.sessions.size);
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const shellPath = shell || this.getDefaultShell();
            // Log detailed error for daemon.log
            console.error('[DaemonSessionManager] PTY spawn failed:');
            console.error('  Session ID:', id);
            console.error('  Shell:', shellPath);
            console.error('  CWD:', cwd);
            console.error('  Error:', errorMessage);
            console.error('  process.execPath:', process.execPath);
            console.error('  process.cwd():', process.cwd());
            console.error('  PATH:', process.env.PATH);
            console.error('  SHELL:', process.env.SHELL);
            if (error instanceof Error && error.stack) {
                console.error('  Stack:', error.stack);
            }
            // Add detailed spawn failure telemetry
            addPtySpawnFailedEvent(id, errorMessage, shellPath, cwd);
            // Add error telemetry event
            addErrorEvent('session.create', errorMessage, 'SESSION_CREATE_FAILED', id, false);
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
    write(sessionId, data) {
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
    resize(sessionId, cols, rows) {
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
    destroy(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            // Session doesn't exist, not an error
            return;
        }
        try {
            session.pty.kill();
        }
        catch {
            // Ignore kill errors
        }
        this.sessions.delete(sessionId);
        // Add telemetry event
        addSessionActionEvent('destroyed', sessionId, this.sessions.size);
        this.emit('sessionDestroyed', sessionId);
    }
    /**
     * List all active sessions.
     */
    listSessions() {
        const sessions = [];
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
    attach(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.emitMessage({
                type: 'error',
                id: sessionId,
                error: `Session ${sessionId} not found`,
            });
            return null;
        }
        // Add telemetry event
        addSessionActionEvent('attached', sessionId, this.sessions.size);
        return session.scrollback.getAll();
    }
    /**
     * Get session count.
     */
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * Get session statistics for daemon status.
     */
    getSessionStats() {
        let totalScrollbackBytes = 0;
        for (const session of this.sessions.values()) {
            totalScrollbackBytes += session.scrollback.getByteSize();
        }
        return {
            count: this.sessions.size,
            totalScrollbackBytes,
        };
    }
    /**
     * Shutdown all sessions.
     */
    shutdown() {
        for (const [id] of this.sessions) {
            this.destroy(id);
        }
    }
    /**
     * Get default shell for the platform.
     */
    getDefaultShell() {
        if (process.platform === 'win32') {
            return process.env.COMSPEC || 'cmd.exe';
        }
        return process.env.SHELL || '/bin/sh';
    }
    /**
     * Emit a daemon message to all connected clients.
     */
    emitMessage(msg) {
        this.emit('message', msg);
    }
}
