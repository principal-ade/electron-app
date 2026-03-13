/**
 * PtyDaemonClient
 *
 * Client for communicating with the external PTY daemon.
 * Handles connection, reconnection, and message routing.
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import {
  ClientMessage,
  DaemonMessage,
  SessionInfo,
  serializeMessage,
  parseMessage,
  isDaemonMessage,
  CreateSessionMessage,
} from '../../shared/pty-daemon/protocol';
import {
  SOCKET_PATH,
  HEALTH_CHECK_INTERVAL_MS,
  HEALTH_CHECK_TIMEOUT_MS,
  RECONNECT_INITIAL_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  RECONNECT_BACKOFF_FACTOR,
  RECONNECT_MAX_ATTEMPTS,
} from '../../shared/pty-daemon/constants';

export interface CreateSessionOptions {
  id: string;
  cwd: string;
  shell?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface PtyDaemonClientEvents {
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number) => void;
  data: (sessionId: string, data: string) => void;
  exit: (sessionId: string, exitCode: number, signal?: string) => void;
  error: (sessionId: string | undefined, error: string) => void;
  sessionsUpdated: (sessions: SessionInfo[]) => void;
}

type PendingCallback = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class PtyDaemonClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private socketPath: string;
  private buffer: string = '';
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private healthCheckPending: boolean = false;
  private pendingCallbacks: Map<string, PendingCallback> = new Map();
  private sessions: SessionInfo[] = [];

  constructor(socketPath?: string) {
    super();
    this.socketPath = socketPath || SOCKET_PATH;
  }

  /**
   * Connect to the daemon.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const onConnected = () => {
          this.off('error', onError);
          resolve();
        };
        const onError = (err: Error) => {
          this.off('connected', onConnected);
          reject(err);
        };
        this.once('connected', onConnected);
        this.once('error', onError);
      });
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);

      this.socket.on('connect', () => {
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.buffer = '';

        this.startHealthCheck();
        this.emit('connected');
        resolve();
      });

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.handleDisconnect();
      });

      this.socket.on('error', (err) => {
        this.isConnecting = false;

        if (!this.isConnected) {
          reject(err);
        } else {
          this.emit('error', undefined, err.message);
        }

        this.handleDisconnect();
      });
    });
  }

  /**
   * Disconnect from the daemon.
   */
  disconnect(): void {
    this.stopHealthCheck();
    this.stopReconnect();

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.buffer = '';

    // Reject all pending callbacks
    for (const [, callback] of this.pendingCallbacks) {
      clearTimeout(callback.timeout);
      callback.reject(new Error('Disconnected'));
    }
    this.pendingCallbacks.clear();
  }

  /**
   * Check if connected to daemon.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get cached session list.
   */
  getSessions(): SessionInfo[] {
    return this.sessions;
  }

  /**
   * Create a new PTY session.
   */
  async createSession(opts: CreateSessionOptions): Promise<{ id: string; pid: number }> {
    const msg: CreateSessionMessage = {
      type: 'create',
      id: opts.id,
      cwd: opts.cwd,
      shell: opts.shell,
      env: opts.env,
      cols: opts.cols,
      rows: opts.rows,
    };

    this.send(msg);

    // Wait for 'created' response
    return this.waitForResponse<{ id: string; pid: number }>(
      `create:${opts.id}`,
      (response) => {
        if (response.type === 'created' && response.id === opts.id) {
          return { id: response.id, pid: response.pid };
        }
        if (response.type === 'error' && response.id === opts.id) {
          throw new Error(response.error);
        }
        return null;
      },
      10000 // 10 second timeout
    );
  }

  /**
   * Write data to a session.
   */
  writeToSession(sessionId: string, data: string): void {
    this.send({
      type: 'write',
      id: sessionId,
      data,
    });
  }

  /**
   * Resize a session.
   */
  resizeSession(sessionId: string, cols: number, rows: number): void {
    this.send({
      type: 'resize',
      id: sessionId,
      cols,
      rows,
    });
  }

  /**
   * Destroy a session.
   */
  destroySession(sessionId: string): void {
    this.send({
      type: 'destroy',
      id: sessionId,
    });
  }

  /**
   * List all sessions.
   */
  async listSessions(): Promise<SessionInfo[]> {
    this.send({ type: 'list' });

    return this.waitForResponse<SessionInfo[]>(
      'list',
      (response) => {
        if (response.type === 'sessions') {
          return response.sessions;
        }
        return null;
      },
      5000
    );
  }

  /**
   * Attach to a session and get scrollback.
   */
  async attachToSession(sessionId: string): Promise<string> {
    this.send({
      type: 'attach',
      id: sessionId,
    });

    return this.waitForResponse<string>(
      `attach:${sessionId}`,
      (response) => {
        if (response.type === 'scrollback' && response.id === sessionId) {
          return response.data;
        }
        if (response.type === 'error' && response.id === sessionId) {
          throw new Error(response.error);
        }
        return null;
      },
      5000
    );
  }

  /**
   * Send a ping to check daemon health.
   */
  async ping(): Promise<void> {
    this.send({ type: 'ping' });

    return this.waitForResponse<void>(
      'ping',
      (response) => {
        if (response.type === 'pong') {
          return undefined;
        }
        return null;
      },
      HEALTH_CHECK_TIMEOUT_MS
    );
  }

  /**
   * Send a message to the daemon.
   */
  private send(msg: ClientMessage): void {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to daemon');
    }

    this.socket.write(serializeMessage(msg));
  }

  /**
   * Handle incoming data from socket.
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString('utf-8');

    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.trim()) {
        this.handleMessage(line);
      }
    }
  }

  /**
   * Handle a parsed message from daemon.
   */
  private handleMessage(line: string): void {
    const msg = parseMessage<DaemonMessage>(line);

    if (!msg || !isDaemonMessage(msg)) {
      console.warn('[PtyDaemonClient] Invalid message:', line);
      return;
    }

    // Check pending callbacks
    this.checkPendingCallbacks(msg);

    // Handle message types
    switch (msg.type) {
      case 'data':
        this.emit('data', msg.id, msg.data);
        break;

      case 'exit':
        this.emit('exit', msg.id, msg.exitCode, msg.signal);
        break;

      case 'error':
        this.emit('error', msg.id, msg.error);
        break;

      case 'sessions':
        this.sessions = msg.sessions;
        this.emit('sessionsUpdated', msg.sessions);
        break;

      case 'pong':
        this.healthCheckPending = false;
        break;

      case 'created':
      case 'scrollback':
        // Handled by pending callbacks
        break;
    }
  }

  /**
   * Handle socket disconnect.
   */
  private handleDisconnect(): void {
    const wasConnected = this.isConnected;

    this.isConnected = false;
    this.isConnecting = false;
    this.socket = null;

    this.stopHealthCheck();

    if (wasConnected) {
      this.emit('disconnected');
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      console.warn('[PtyDaemonClient] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_FACTOR, this.reconnectAttempts),
      RECONNECT_MAX_DELAY_MS
    );

    this.reconnectAttempts++;
    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // Will trigger another reconnect via handleDisconnect
      }
    }, delay);
  }

  /**
   * Stop reconnection attempts.
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * Start health check interval.
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      if (this.healthCheckPending) {
        // Previous ping didn't get pong, consider disconnected
        console.warn('[PtyDaemonClient] Health check timeout');
        this.handleDisconnect();
        return;
      }

      this.healthCheckPending = true;
      try {
        this.send({ type: 'ping' });
      } catch {
        this.handleDisconnect();
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Stop health check interval.
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.healthCheckPending = false;
  }

  /**
   * Wait for a specific response from daemon.
   */
  private waitForResponse<T>(
    key: string,
    matcher: (msg: DaemonMessage) => T | null,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(key);
        reject(new Error(`Timeout waiting for ${key}`));
      }, timeoutMs);

      this.pendingCallbacks.set(key, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      // Store matcher for later use
      (this.pendingCallbacks.get(key) as PendingCallback & { matcher: typeof matcher }).matcher =
        matcher;
    });
  }

  /**
   * Check if any pending callbacks match this message.
   */
  private checkPendingCallbacks(msg: DaemonMessage): void {
    for (const [key, callback] of this.pendingCallbacks) {
      const matcher = (callback as PendingCallback & { matcher: (msg: DaemonMessage) => unknown })
        .matcher;
      if (matcher) {
        try {
          const result = matcher(msg);
          if (result !== null) {
            clearTimeout(callback.timeout);
            this.pendingCallbacks.delete(key);
            callback.resolve(result);
            return;
          }
        } catch (err) {
          clearTimeout(callback.timeout);
          this.pendingCallbacks.delete(key);
          callback.reject(err as Error);
          return;
        }
      }
    }
  }
}
