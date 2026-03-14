/**
 * SocketServer
 *
 * Unix domain socket server for PTY daemon.
 * Handles client connections and message routing.
 */

import * as net from 'net';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import {
  ClientMessage,
  DaemonMessage,
  serializeMessage,
  parseMessage,
  isClientMessage,
} from '../shared/pty-daemon/protocol';
import { DaemonSessionManager } from './DaemonSessionManager';
import { SOCKET_PATH, DAEMON_DIR } from '../shared/pty-daemon/constants';
import { Logger } from './Logger';
import {
  addServerEvent,
  addSocketConnectionEvent,
  addHealthCheckEvent,
} from './telemetry';

interface ConnectedClient {
  id: number;
  socket: net.Socket;
  buffer: string;
}

export class SocketServer extends EventEmitter {
  private server: net.Server | null = null;
  private clients: Map<number, ConnectedClient> = new Map();
  private clientIdCounter: number = 0;
  private sessionManager: DaemonSessionManager;
  private socketPath: string;
  private logger: Logger;

  constructor(sessionManager: DaemonSessionManager, logger: Logger, socketPath?: string) {
    super();
    this.sessionManager = sessionManager;
    this.socketPath = socketPath || SOCKET_PATH;
    this.logger = logger;

    // Forward session manager messages to all clients
    this.sessionManager.on('message', (msg: DaemonMessage) => {
      this.broadcast(msg);
    });
  }

  /**
   * Start the socket server.
   */
  async start(): Promise<void> {
    // Ensure daemon directory exists
    await this.ensureDirectory();

    // Remove stale socket file if it exists
    await this.cleanupSocket();

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        this.logger.error('Server error:', err);
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        this.logger.info(`Socket server listening on ${this.socketPath}`);

        // Add server listening event
        addServerEvent('listening', this.clients.size);

        // Set socket permissions (Unix only)
        if (process.platform !== 'win32') {
          try {
            fs.chmodSync(this.socketPath, 0o600);
          } catch (err) {
            this.logger.warn('Failed to set socket permissions:', err);
          }
        }

        resolve();
      });
    });
  }

  /**
   * Stop the socket server.
   */
  async stop(): Promise<void> {
    // Close all client connections
    for (const [, client] of this.clients) {
      client.socket.destroy();
    }
    this.clients.clear();

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          resolve();
        });
      });
      this.server = null;
    }

    // Clean up socket file
    await this.cleanupSocket();

    // Add server stopped event
    addServerEvent('stopped', 0);

    this.logger.info('Socket server stopped');
  }

  /**
   * Get connected client count.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Broadcast a message to all connected clients.
   */
  private broadcast(msg: DaemonMessage): void {
    const data = serializeMessage(msg);

    for (const [, client] of this.clients) {
      try {
        client.socket.write(data);
      } catch (err) {
        this.logger.error(`Failed to send to client ${client.id}:`, err);
      }
    }
  }

  /**
   * Send a message to a specific client.
   */
  private sendToClient(clientId: number, msg: DaemonMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.socket.write(serializeMessage(msg));
    } catch (err) {
      this.logger.error(`Failed to send to client ${clientId}:`, err);
    }
  }

  /**
   * Handle new client connection.
   */
  private handleConnection(socket: net.Socket): void {
    const clientId = ++this.clientIdCounter;

    const client: ConnectedClient = {
      id: clientId,
      socket,
      buffer: '',
    };

    this.clients.set(clientId, client);
    this.logger.info(`Client ${clientId} connected (${this.clients.size} total)`);

    // Add connection event
    addSocketConnectionEvent('connected', clientId);

    this.emit('clientConnected', clientId);

    // Send current session list to new client
    this.sendToClient(clientId, {
      type: 'sessions',
      sessions: this.sessionManager.listSessions(),
    });

    // Handle incoming data
    socket.on('data', (data: Buffer) => {
      this.handleData(client, data);
    });

    // Handle client disconnect
    socket.on('close', () => {
      this.clients.delete(clientId);
      this.logger.info(`Client ${clientId} disconnected (${this.clients.size} total)`);

      // Add disconnection event
      addSocketConnectionEvent('disconnected', clientId);

      this.emit('clientDisconnected', clientId);
    });

    // Handle errors
    socket.on('error', (err) => {
      this.logger.error(`Client ${clientId} error:`, err);
      this.clients.delete(clientId);

      // Add error event
      addSocketConnectionEvent('error', clientId, err.message);

      this.emit('clientDisconnected', clientId);
    });
  }

  /**
   * Handle incoming data from a client.
   */
  private handleData(client: ConnectedClient, data: Buffer): void {
    // Append to buffer
    client.buffer += data.toString('utf-8');

    // Process complete messages (newline-delimited)
    let newlineIndex: number;
    while ((newlineIndex = client.buffer.indexOf('\n')) !== -1) {
      const line = client.buffer.slice(0, newlineIndex);
      client.buffer = client.buffer.slice(newlineIndex + 1);

      if (line.trim()) {
        this.handleMessage(client.id, line);
      }
    }
  }

  /**
   * Handle a parsed message from a client.
   */
  private handleMessage(clientId: number, line: string): void {
    const msg = parseMessage<ClientMessage>(line);

    if (!msg || !isClientMessage(msg)) {
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Invalid message format',
      });
      return;
    }

    this.logger.debug(`Received from client ${clientId}:`, msg.type);

    switch (msg.type) {
      case 'create':
        this.sessionManager.createSession(msg);
        break;

      case 'write':
        this.sessionManager.write(msg.id, msg.data);
        break;

      case 'resize':
        this.sessionManager.resize(msg.id, msg.cols, msg.rows);
        break;

      case 'destroy':
        this.sessionManager.destroy(msg.id);
        break;

      case 'list':
        this.sendToClient(clientId, {
          type: 'sessions',
          sessions: this.sessionManager.listSessions(),
        });
        break;

      case 'attach': {
        const scrollback = this.sessionManager.attach(msg.id);
        if (scrollback !== null) {
          this.sendToClient(clientId, {
            type: 'scrollback',
            id: msg.id,
            data: scrollback,
          });
        }
        break;
      }

      case 'ping':
        // Add health check event
        addHealthCheckEvent('pong', 0, 0);
        this.sendToClient(clientId, { type: 'pong' });
        break;

      default:
        this.sendToClient(clientId, {
          type: 'error',
          error: `Unknown message type: ${(msg as { type: string }).type}`,
        });
    }
  }

  /**
   * Ensure daemon directory exists.
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(DAEMON_DIR, { recursive: true, mode: 0o700 });
    } catch (err) {
      // Directory may already exist
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }
    }
  }

  /**
   * Clean up stale socket file.
   */
  private async cleanupSocket(): Promise<void> {
    if (process.platform === 'win32') {
      // Named pipes don't need cleanup
      return;
    }

    try {
      await fs.promises.unlink(this.socketPath);
      this.logger.debug('Removed stale socket file');
    } catch (err) {
      // File may not exist
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Failed to remove socket file:', err);
      }
    }
  }
}
