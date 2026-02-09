import { EventEmitter } from 'events';

export interface GitSyncConfig {
  serverUrl: string;
  githubToken: string; // GitHub token for OAuth server
  repoUrl: string;
  repoPath: string;
  branch: string;
  userId: string;
  agentId: string;
  proxyMode?: boolean; // If true, use IPC proxy instead of direct WebSocket
}

export interface RoomTokenInfo {
  access_token: string;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canAdmin?: boolean;
  };
  repository: string;
  branch: string;
  expiresIn: number;
}

export interface LockRequest {
  resource: string;
  type: 'file' | 'directory';
  exclusive?: boolean;
  duration?: number;
  metadata?: {
    operation?: string;
    description?: string;
  };
}

export interface LockInfo {
  id: string;
  resource: string;
  type: 'file' | 'directory';
  branch: string;
  owner: {
    agentId: string;
    userId: string;
  };
  exclusive: boolean;
  acquiredAt: number;
  expiresAt: number;
}

export interface SyncEvent {
  type:
    | 'file_change'
    | 'commit'
    | 'lock_acquired'
    | 'lock_released'
    | 'branch_change';
  agentId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface CrossBranchWarning {
  type:
    | 'same_file_different_branch'
    | 'merge_conflict_potential'
    | 'branch_divergence';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedAction?: string;
}

export interface SyncStatus {
  connected: boolean;
  authenticated: boolean;
  repoId: string;
  branch: string;
  activeLocks: LockInfo[];
  queuedLocks: number;
  peers: {
    agentId: string;
    userId: string;
    branch: string;
  }[];
}

export interface GitSyncMessage {
  type: string;
  [key: string]: unknown;
}

export class GitSyncClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: GitSyncConfig;
  private status: SyncStatus;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageQueue: GitSyncMessage[] = [];
  private isReconnecting = false;
  private roomToken: RoomTokenInfo | null = null;

  constructor(config: GitSyncConfig) {
    super();
    this.config = config;
    this.status = {
      connected: false,
      authenticated: false,
      repoId: this.extractRepoId(config.repoUrl),
      branch: config.branch,
      activeLocks: [],
      queuedLocks: 0,
      peers: [],
    };
  }

  /**
   * Connect to the git-sync server
   */
  async connect(): Promise<void> {
    // If in proxy mode, just emit connected event - actual connection handled by main process
    if (this.config.proxyMode) {
      this.status.connected = true;
      this.status.authenticated = true;
      this.emit('connected');
      this.emit('authenticated');
      return Promise.resolve();
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // First, get room token from OAuth server
    await this.getRoomToken();

    return new Promise((resolve, reject) => {
      try {
        // Properly convert HTTP URL to WebSocket URL
        let wsUrl = this.config.serverUrl;
        if (wsUrl.startsWith('https://')) {
          wsUrl = wsUrl.replace('https://', 'wss://');
        } else if (wsUrl.startsWith('http://')) {
          wsUrl = wsUrl.replace('http://', 'ws://');
        }

        // Create WebSocket - will authenticate via message after connection
        this.ws = new WebSocket(`${wsUrl}/ws`);

        this.ws.onopen = () => {
          console.info('Connected to git-sync server');
          this.status.connected = true;
          this.isReconnecting = false;

          // Authenticate immediately
          this.authenticate();

          // Start ping interval
          this.startPingInterval();

          // Process queued messages
          this.processMessageQueue();

          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.info('Disconnected from git-sync server');
          this.status.connected = false;
          this.status.authenticated = false;
          this.stopPingInterval();
          this.emit('disconnected');

          // Auto-reconnect if not manually disconnected
          if (!this.isReconnecting) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get room token from OAuth server via main process
   */
  private async getRoomToken(): Promise<void> {
    try {
      const repository = this.extractRepoId(this.config.repoUrl);
      console.info(`Getting room token for repository: ${repository}`);

      // Import GitSyncService dynamically to avoid circular imports
      const { GitSyncService } =
        await import('../../main-process-api/GitSyncService');

      const result = await GitSyncService.getRoomToken({
        repositoryId: repository,
        branch: this.config.branch,
        isOwner: true, // TODO: Determine this properly
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to get room token');
      }

      this.roomToken = {
        access_token: result.token || '',
        permissions: { canWrite: true, canRead: true }, // Default permissions
        repository,
        branch: this.config.branch,
        expiresIn: 3600, // 1 hour default
      };

      console.info(
        `Room token obtained for ${this.roomToken.repository} (${this.roomToken.permissions.canWrite ? 'write' : 'read'} access)`,
      );
    } catch (error) {
      console.error('Failed to get room token:', error);
      throw error;
    }
  }

  /**
   * Authenticate with the server using room token
   */
  private async authenticate(): Promise<void> {
    try {
      if (!this.roomToken) {
        throw new Error('No room token available');
      }

      // Use room token JWT for authentication
      this.send({
        type: 'auth',
        token: this.roomToken.access_token, // JWT room token from OAuth server
        repoId: this.extractRepoId(this.config.repoUrl),
        agentId: this.config.agentId,
        userId: this.config.userId,
        branch: this.config.branch,
        watchingBranches: ['main', 'master', this.config.branch],
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Register for sync events
   */
  registerForSync(): void {
    this.send({
      type: 'register',
      repoId: this.status.repoId,
      branch: this.config.branch,
      agentId: this.config.agentId,
      userId: this.config.userId,
    });
  }

  /**
   * Acquire a lock on a resource
   */
  async acquireLock(request: LockRequest): Promise<{
    success: boolean;
    lock?: LockInfo;
    error?: string;
    warnings?: CrossBranchWarning[];
  }> {
    return new Promise((resolve) => {
      const requestId = this.generateRequestId();

      const handler = (message: GitSyncMessage) => {
        if (
          message.type === 'lock_response' &&
          message.requestId === requestId
        ) {
          this.removeListener('lock_response', handler);

          if (message.success && message.lock) {
            this.status.activeLocks.push(message.lock);
          }

          resolve({
            success: message.success,
            lock: message.lock,
            error: message.error,
            warnings: message.warnings,
          });
        }
      };

      this.on('lock_response', handler);

      this.send({
        type: 'acquire_lock',
        requestId,
        resource: request.resource,
        resourceType: request.type,
        branch: this.config.branch,
        exclusive: request.exclusive ?? true,
        duration: request.duration,
        metadata: request.metadata,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        this.removeListener('lock_response', handler);
        resolve({
          success: false,
          error: 'Lock request timed out',
        });
      }, 10000);
    });
  }

  /**
   * Release a lock
   */
  async releaseLock(lockId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const requestId = this.generateRequestId();

      const handler = (message: GitSyncMessage) => {
        if (
          message.type === 'lock_released' &&
          message.requestId === requestId
        ) {
          this.removeListener('lock_released', handler);

          // Remove from active locks
          this.status.activeLocks = this.status.activeLocks.filter(
            (l) => l.id !== lockId,
          );

          resolve(message.success);
        }
      };

      this.on('lock_released', handler);

      this.send({
        type: 'release_lock',
        requestId,
        lockId,
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.removeListener('lock_released', handler);
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Broadcast a sync event
   */
  broadcastEvent(event: Omit<SyncEvent, 'agentId' | 'timestamp'>): void {
    this.send({
      type: 'sync_event',
      event: {
        ...event,
        agentId: this.config.agentId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Check if a merge is safe
   */
  async checkMergeSafety(
    toBranch: string,
    files: string[],
  ): Promise<{
    safe: boolean;
    blockingLocks: LockInfo[];
    warnings: CrossBranchWarning[];
  }> {
    return new Promise((resolve) => {
      const requestId = this.generateRequestId();

      const handler = (message: GitSyncMessage) => {
        if (
          message.type === 'merge_safety_response' &&
          message.requestId === requestId
        ) {
          this.removeListener('merge_safety_response', handler);
          resolve(message);
        }
      };

      this.on('merge_safety_response', handler);

      this.send({
        type: 'check_merge_safety',
        requestId,
        fromBranch: this.config.branch,
        toBranch,
        files,
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.removeListener('merge_safety_response', handler);
        resolve({
          safe: true,
          blockingLocks: [],
          warnings: [],
        });
      }, 5000);
    });
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(newBranch: string): Promise<{
    success: boolean;
    released: number;
    warnings: CrossBranchWarning[];
  }> {
    return new Promise((resolve) => {
      const requestId = this.generateRequestId();

      const handler = (message: GitSyncMessage) => {
        if (
          message.type === 'branch_switched' &&
          message.requestId === requestId
        ) {
          this.removeListener('branch_switched', handler);

          // Update our branch
          this.config.branch = newBranch;
          this.status.branch = newBranch;

          // Clear active locks
          this.status.activeLocks = [];

          resolve({
            success: true,
            released: message.released,
            warnings: message.warnings,
          });
        }
      };

      this.on('branch_switched', handler);

      this.send({
        type: 'switch_branch',
        requestId,
        fromBranch: this.config.branch,
        toBranch: newBranch,
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        this.removeListener('branch_switched', handler);
        resolve({
          success: false,
          released: 0,
          warnings: [],
        });
      }, 5000);
    });
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.isReconnecting = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.status.connected = false;
    this.status.authenticated = false;
    this.emit('disconnected');
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: GitSyncMessage): void {
    switch (message.type) {
      case 'auth_response':
      case 'auth_success':
        if (message.success || message.type === 'auth_success') {
          this.status.authenticated = true;

          // Handle initial peers list if provided
          if (message.peers && Array.isArray(message.peers)) {
            this.status.peers = message.peers;
          }

          // Control Tower Core automatically assigns you to a room based on JWT repoId
          // No separate registration needed
          this.emit('authenticated');
        } else {
          this.emit(
            'error',
            new Error(message.error || 'Authentication failed'),
          );
        }
        break;

      case 'register_response':
        if (message.success) {
          this.emit('registered', message.room);
        }
        break;

      case 'sync_event':
        this.emit('sync_event', message.event);
        break;

      case 'lock_acquired':
        this.emit('lock_acquired', message.lock);
        break;

      case 'lock_released': {
        const releasedLock = this.status.activeLocks.find(
          (l) => l.id === message.lockId,
        );
        if (releasedLock) {
          this.status.activeLocks = this.status.activeLocks.filter(
            (l) => l.id !== message.lockId,
          );
          this.emit('lock_released_event', releasedLock);
        }
        break;
      }

      case 'cross_branch_warning':
        this.emit('cross_branch_warning', message.warning);
        break;

      case 'peer_joined':
        this.status.peers.push(message.peer);
        this.emit('peer_joined', message.peer);
        break;

      case 'peer_left':
        this.status.peers = this.status.peers.filter(
          (p) => p.agentId !== message.agentId,
        );
        this.emit('peer_left', message.agentId);
        break;

      case 'lock_response':
      case 'merge_safety_response':
      case 'branch_switched':
        // These are handled by specific request handlers
        this.emit(message.type, message);
        break;

      case 'pong':
        // Keep-alive response
        break;

      case 'auth_error':
        console.error(
          'Authentication failed:',
          message.message || 'Invalid token',
        );
        this.status.isAuthenticated = false;
        this.emit('auth_error', message.message || 'Authentication failed');
        this.disconnect();
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Send a message to the server
   */
  private send(message: GitSyncMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when we reconnect
      this.messageQueue.push(message);
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectTimer = setTimeout(() => {
      console.info('Attempting to reconnect...');
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
        this.scheduleReconnect();
      });
    }, 5000);
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Extract repository ID from URL
   */
  private extractRepoId(repoUrl: string): string {
    const match = repoUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    return match ? match[1] : repoUrl;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
