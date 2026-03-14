/**
 * DaemonBridge - Socket client for connecting utility worker to PTY daemon.
 *
 * This class runs inside the utility worker and handles:
 * - Connecting to the daemon Unix socket
 * - Sending messages (create, write, resize, destroy)
 * - Receiving messages and emitting events (data, exit, created, sessions)
 *
 * The bridge keeps PTY data flowing efficiently:
 * Daemon → Socket → DaemonBridge → Worker → MessagePort → Renderer
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';
import { SOCKET_PATH } from '../shared/pty-daemon/constants';
import type {
  ClientMessage,
  DaemonMessage,
  SessionInfo,
} from '../shared/pty-daemon/protocol';

export interface DaemonBridgeEvents {
  connected: (sessions: SessionInfo[]) => void;
  disconnected: (error?: Error) => void;
  error: (error: Error) => void;
  data: (sessionId: string, data: string) => void;
  created: (sessionId: string, pid: number) => void;
  exit: (sessionId: string, exitCode: number, signal?: string) => void;
  'session-error': (sessionId: string, error: string) => void;
  scrollback: (sessionId: string, data: string) => void;
  sessions: (sessions: SessionInfo[]) => void;
}

export class DaemonBridge extends EventEmitter {
  private socket: Socket | null = null;
  private buffer = '';
  private isConnected = false;
  private connectResolve: ((sessions: SessionInfo[]) => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;

  /**
   * Connect to the daemon socket.
   * Returns a promise that resolves with the current session list.
   */
  connect(): Promise<SessionInfo[]> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        reject(new Error('Already connected'));
        return;
      }

      this.connectResolve = resolve;
      this.connectReject = reject;

      this.socket = new Socket();

      this.socket.on('connect', () => {
        console.info('[DaemonBridge] Connected to daemon socket');
        this.isConnected = true;
        // Daemon will send 'sessions' message on connect
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.processBuffer();
      });

      this.socket.on('error', (err: Error) => {
        console.error('[DaemonBridge] Socket error:', err.message);
        this.emit('error', err);

        // Reject connect promise if still pending
        if (this.connectReject) {
          this.connectReject(err);
          this.connectResolve = null;
          this.connectReject = null;
        }
      });

      this.socket.on('close', (hadError: boolean) => {
        console.info('[DaemonBridge] Socket closed', hadError ? '(with error)' : '');
        this.isConnected = false;
        this.socket = null;
        this.buffer = '';
        this.emit('disconnected', hadError ? new Error('Socket closed with error') : undefined);
      });

      console.info('[DaemonBridge] Connecting to:', SOCKET_PATH);
      this.socket.connect(SOCKET_PATH);
    });
  }

  /**
   * Check if currently connected.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Send a message to the daemon.
   */
  send(message: ClientMessage): void {
    if (!this.socket || !this.isConnected) {
      console.warn('[DaemonBridge] Cannot send, not connected');
      return;
    }

    const data = JSON.stringify(message) + '\n';
    this.socket.write(data);
  }

  /**
   * Disconnect from daemon.
   */
  disconnect(): void {
    if (this.socket) {
      console.info('[DaemonBridge] Disconnecting');
      this.socket.end();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Process buffered data, extracting complete JSON messages.
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    // Keep incomplete line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line) as DaemonMessage;
        this.handleMessage(msg);
      } catch (err) {
        console.error('[DaemonBridge] Failed to parse message:', line, err);
      }
    }
  }

  /**
   * Handle incoming daemon message.
   */
  private handleMessage(msg: DaemonMessage): void {
    switch (msg.type) {
      case 'sessions':
        // First 'sessions' message resolves the connect promise
        if (this.connectResolve) {
          this.connectResolve(msg.sessions);
          this.connectResolve = null;
          this.connectReject = null;
        }
        this.emit('connected', msg.sessions);
        this.emit('sessions', msg.sessions);
        break;

      case 'data':
        this.emit('data', msg.id, msg.data);
        break;

      case 'created':
        this.emit('created', msg.id, msg.pid);
        break;

      case 'exit':
        this.emit('exit', msg.id, msg.exitCode, msg.signal);
        break;

      case 'error':
        if (msg.id) {
          this.emit('session-error', msg.id, msg.error);
        } else {
          this.emit('error', new Error(msg.error));
        }
        break;

      case 'scrollback':
        this.emit('scrollback', msg.id, msg.data);
        break;

      case 'pong':
        // Health check response - could track latency here
        break;

      default:
        console.warn('[DaemonBridge] Unknown message type:', (msg as { type: string }).type);
    }
  }
}

// Type-safe event emitter (declaration merging)
// eslint-disable-next-line no-redeclare
export interface DaemonBridge {
  on<K extends keyof DaemonBridgeEvents>(event: K, listener: DaemonBridgeEvents[K]): this;
  emit<K extends keyof DaemonBridgeEvents>(
    event: K,
    ...args: Parameters<DaemonBridgeEvents[K]>
  ): boolean;
}
