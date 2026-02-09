import { EventEmitter } from 'events';
import { GitSyncClient } from './GitSyncClient';
import { GitSyncService } from '../../main-process-api/GitSyncService';
import { AuthenticationService } from '../../main-process-api/AuthenticationService';
import type { GitSyncConnectionInfo } from '../../../shared/main-process-api-interfaces/GitSyncAPI';

interface ConnectionInfo {
  repoId: string;
  repoPath: string;
  branch: string;
  client: GitSyncClient;
  // Note: status is tracked in main process, not here
  // Use getActiveConnections() to get status from main process
}

interface GitHubUser {
  githubHandle: string;
  email?: string;
  status: string;
  metadata?: Record<string, unknown>;
}

interface ConnectionManagerEvents {
  'connection-added': (repoId: string) => void;
  'connection-removed': (repoId: string) => void;
  'connection-status-changed': (repoId: string) => void;
  'auth-changed': (authenticated: boolean, user?: GitHubUser) => void;
}

/**
 * Singleton service that manages persistent GitSync connections
 * Survives component mounting/unmounting and maintains connection state
 */
export class GitSyncConnectionManager extends EventEmitter {
  private static instance: GitSyncConnectionManager;
  private connections: Map<string, ConnectionInfo> = new Map();
  private authUser: GitHubUser | null = null;
  private authToken: string | null = null;
  private isAuthenticated: boolean = false;
  private _authReadyPromise: Promise<boolean>;
  private _authReadyResolve!: (value: boolean) => void;
  private _authReadyReject!: (error: Error) => void;

  private constructor() {
    super();

    // Create a Promise that will resolve when auth is initialized
    this._authReadyPromise = new Promise((resolve, reject) => {
      this._authReadyResolve = resolve;
      this._authReadyReject = reject;
    });

    this.initializeAuth();
    this.setupIPCMessageForwarding();
    this.setupConnectionEventListeners();
    this.subscribeToAuthChanges();
  }

  /**
   * Listen for connection lifecycle events broadcast from main process
   * This allows all renderer windows to stay in sync with connection state
   */
  private setupConnectionEventListeners() {
    // Subscribe to connection-added events from main process
    GitSyncService.onConnectionAdded((connectionId: string) => {
      this.emit('connection-added', connectionId);
    });

    // Subscribe to connection-removed events from main process
    GitSyncService.onConnectionRemoved((connectionId: string) => {
      this.emit('connection-removed', connectionId);
    });

    // Subscribe to connection-status-changed events from main process
    GitSyncService.onConnectionStatusChanged((connectionId: string) => {
      this.emit('connection-status-changed', connectionId);
    });
  }

  static getInstance(): GitSyncConnectionManager {
    if (!GitSyncConnectionManager.instance) {
      GitSyncConnectionManager.instance = new GitSyncConnectionManager();
    }
    return GitSyncConnectionManager.instance;
  }

  private async initializeAuth() {
    // Check for CLI auth instead of GitHubAuth
    const startTime = Date.now();
    console.info('[GitSyncConnectionManager] Initializing auth...');

    try {
      const cliAuthResult = await AuthenticationService.check();
      const elapsed = Date.now() - startTime;

      console.info('[GitSyncConnectionManager] Auth check result:', {
        success: cliAuthResult.success,
        hasToken: !!cliAuthResult.token,
        hasUser: !!cliAuthResult.user,
        user: cliAuthResult.user?.login,
        elapsedMs: elapsed,
      });

      if (cliAuthResult.success && cliAuthResult.token && cliAuthResult.user) {
        this.authUser = {
          githubHandle: cliAuthResult.user.login,
          email: cliAuthResult.user.email,
          status: 'authenticated',
          metadata: {},
        };
        this.authToken = cliAuthResult.token;
        this.isAuthenticated = true;
        console.info(
          `[GitSyncConnectionManager] Auth initialized successfully for: ${this.authUser.githubHandle} (took ${elapsed}ms)`,
        );
        this.emit('auth-changed', true, this.authUser);
        this._authReadyResolve(true);
      } else {
        console.warn(
          '[GitSyncConnectionManager] Auth check did not return valid credentials',
        );
        this._authReadyResolve(false);
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(
        `[GitSyncConnectionManager] Failed to check CLI auth (took ${elapsed}ms):`,
        error,
      );
      this._authReadyReject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private _messageUnsubscribe?: () => void;

  private setupIPCMessageForwarding() {
    // Listen for WebSocket messages from main process using GitSyncService
    const unsubscribe = GitSyncService.onMessage(
      (connectionKey: string, message: Record<string, unknown>) => {
        const connection = this.connections.get(connectionKey);
        if (connection && connection.client) {
          // Forward message to the client's event handlers
          connection.client.emit('message', message);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (connection.client as any).handleMessage?.(message);
        }
      },
    );

    // Store unsubscribe function for cleanup if needed
    this._messageUnsubscribe = unsubscribe;
  }

  private _unsubscribeAuth?: () => void;

  private subscribeToAuthChanges() {
    // Subscribe to auth state changes from the main process
    if (window.mainProcess?.authentication) {
      // Store the unsubscribe function for cleanup if needed
      const unsubscribe = AuthenticationService.onAuthStateChanged(
        async (state) => {
          console.info('[GitSyncConnectionManager] Auth state changed:', {
            isAuthenticated: state.isAuthenticated,
            user: state.user?.login,
            currentUser: this.authUser?.githubHandle,
          });

          if (state.isAuthenticated && state.user) {
            // Guard: Only process if this is a NEW user (prevents infinite loop)
            if (
              this.authUser?.githubHandle === state.user.login &&
              this.isAuthenticated
            ) {
              console.info(
                '[GitSyncConnectionManager] Auth state unchanged, skipping update',
              );
              return;
            }

            // The auth state doesn't include the token, so we need to get it
            // NOTE: getGitHubAuth() will trigger another state change, but our guard above prevents loops
            try {
              const tokenResult = await AuthenticationService.getGitHubAuth();
              if (tokenResult.authenticated && tokenResult.token) {
                this.setAuthCredentials(state.user, tokenResult.token);
              }
            } catch (error) {
              console.error(
                '[GitSyncConnectionManager] Failed to get token after auth change:',
                error,
              );
            }
          } else {
            // User logged out - clear auth only if we had a user
            if (this.authUser || this.isAuthenticated) {
              console.info(
                '[GitSyncConnectionManager] User logged out, clearing auth',
              );
              this.clearAuth();
            }
          }
        },
      );

      // Store unsubscribe function for potential cleanup
      this._unsubscribeAuth = unsubscribe;
    }
  }

  /**
   * Update authentication state with user and token
   */
  private setAuthCredentials(
    user: { login: string; email?: string },
    token: string,
  ) {
    console.info(
      '[GitSyncConnectionManager] Updating auth for user:',
      user.login,
    );

    this.authUser = {
      githubHandle: user.login,
      email: user.email,
      status: 'authenticated',
      metadata: {},
    };
    this.authToken = token;
    this.isAuthenticated = true;
    this.emit('auth-changed', true, this.authUser);
  }

  /**
   * Wait for authentication to initialize
   * Returns a promise that resolves to true if auth succeeds, false if no credentials
   * Rejects if auth initialization fails
   */
  public async waitForAuth(): Promise<boolean> {
    return this._authReadyPromise;
  }

  /**
   * Clear authentication state
   */
  public clearAuth() {
    console.log('[GitSyncConnectionManager] Clearing auth state');

    this.authUser = null;
    this.authToken = null;
    this.isAuthenticated = false;

    // Disconnect all connections when auth is cleared
    this.disconnectAll();

    this.emit('auth-changed', false, null);
  }

  /**
   * Get or create a connection for a repository
   */
  async getConnection(
    repoPath: string,
    branch: string = 'main',
    repository?: { owner?: string; name?: string; remoteUrl?: string },
  ): Promise<GitSyncClient | null> {
    console.log(
      '[GitSyncConnectionManager] getConnection called, auth status:',
      {
        isAuthenticated: this.isAuthenticated,
        hasToken: !!this.authToken,
        hasUser: !!this.authUser,
      },
    );

    // Wait for authentication to initialize if not ready
    if (!this.isAuthenticated || !this.authToken || !this.authUser) {
      console.log(
        '[GitSyncConnectionManager] Auth not ready, waiting for initialization...',
      );

      try {
        const authSuccess = await this.waitForAuth();

        if (
          !authSuccess ||
          !this.isAuthenticated ||
          !this.authToken ||
          !this.authUser
        ) {
          console.warn(
            '[GitSyncConnectionManager] Authentication failed or returned no credentials',
          );
          throw new Error('Not authenticated. Please sign in to use git-sync.');
        }

        console.log(
          '[GitSyncConnectionManager] Auth ready, proceeding with connection',
        );
      } catch (error) {
        console.error(
          '[GitSyncConnectionManager] Auth initialization failed:',
          error,
        );
        throw new Error(
          'Authentication initialization failed: ' +
            (error instanceof Error ? error.message : String(error)),
        );
      }
    }

    // Generate a unique key for this repo/branch combination
    const repoId =
      repository && repository.owner && repository.name
        ? `${repository.owner}/${repository.name}`
        : `${this.authUser.githubHandle}/${repoPath.split('/').pop() || 'unknown-repo'}`;

    const connectionKey = `${repoId}:${branch}`;

    // Return existing connection if available
    const existing = this.connections.get(connectionKey);
    if (existing && existing.client) {
      const status = existing.client.getStatus();
      if (status.connected) {
        console.log(
          `GitSyncConnectionManager: Returning existing connection for ${connectionKey}`,
        );
        return existing.client;
      }
    }

    // Create new connection via main process (secure)
    try {
      console.log(
        `GitSyncConnectionManager: Creating new connection for ${connectionKey}`,
      );

      // Get stored GitHub token from secure storage (not localStorage!)
      let githubToken: string;
      try {
        const tokenResult = await AuthenticationService.getGitHubAuth();
        if (!tokenResult.authenticated || !tokenResult.token) {
          console.warn('No auth token available for git-sync connection');
          return null;
        }
        githubToken = tokenResult.token;
      } catch (error) {
        console.error('Failed to get GitHub token from secure storage:', error);
        return null;
      }

      // Generate a stable device ID for this session
      let deviceId = sessionStorage.getItem('git-sync-device-id');
      if (!deviceId) {
        deviceId = `${this.authUser.githubHandle}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('git-sync-device-id', deviceId);
      }

      // Request connection from main process (handles all authentication securely)
      const connectionResult = await GitSyncService.connect({
        repoId,
        repoPath,
        branch,
        token: githubToken,
      });

      if (!connectionResult.success) {
        console.error('Failed to connect to git-sync:', connectionResult.error);

        // Throw error with details for UI handling
        const error = new Error(connectionResult.error || 'Connection failed');
        throw error;
      }

      // Create a proxy client that communicates through IPC
      const client = new GitSyncClient({
        serverUrl: '', // Not used in proxy mode
        githubToken: '', // Not used in proxy mode
        repoUrl: `github.com/${repoId}`,
        repoPath,
        branch,
        userId: this.authUser.githubHandle,
        agentId: deviceId,
        proxyMode: true,
      });

      // Override client methods to use IPC instead of direct WebSocket
      this.setupProxyClient(client, repoId, branch);

      // Set up event forwarding
      this.setupClientEventHandlers(client, connectionKey);

      // Store connection info (status tracked in main process)
      const connectionInfo: ConnectionInfo = {
        repoId,
        repoPath,
        branch,
        client,
      };

      this.connections.set(connectionKey, connectionInfo);
      this.emit('connection-added', connectionKey);

      return client;
    } catch (error) {
      console.error(
        `GitSyncConnectionManager: Failed to create connection for ${connectionKey}:`,
        error,
      );
      // Re-throw the error so the UI can handle it properly
      throw error;
    }
  }

  /**
   * Set up proxy client to communicate through IPC instead of direct WebSocket
   */
  private setupProxyClient(
    client: GitSyncClient,
    repoId: string,
    branch: string,
  ) {
    // Override send method to use GitSyncService
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).send = async (message: Record<string, unknown>) => {
      try {
        const result = await GitSyncService.sendMessage({
          connectionId: `${repoId}:${branch}`,
          type: (message.type as string) || 'message',
          data: message,
        });

        if (!result.success) {
          console.error('Failed to send git-sync message:', result.error);
        }
      } catch (error) {
        console.error(
          'Failed to send git-sync message via GitSyncService:',
          error,
        );
      }
    };

    // Override disconnect to use GitSyncService
    const originalDisconnect = client.disconnect.bind(client);
    client.disconnect = () => {
      GitSyncService.disconnect(`${repoId}:${branch}`).catch((error) => {
        console.error('Failed to disconnect via GitSyncService:', error);
      });
      originalDisconnect();
    };
  }

  /**
   * Set up event handlers for a client
   */
  private setupClientEventHandlers(
    client: GitSyncClient,
    connectionKey: string,
  ) {
    // Forward important events
    client.on('connected', () => {
      console.log(
        `GitSyncConnectionManager: Client connected for ${connectionKey}`,
      );
      this.updateConnectionStatus(connectionKey);
    });

    client.on('disconnected', () => {
      console.log(
        `GitSyncConnectionManager: Client disconnected for ${connectionKey}`,
      );
      this.updateConnectionStatus(connectionKey);
    });

    client.on('authenticated', () => {
      console.log(
        `GitSyncConnectionManager: Client authenticated for ${connectionKey}`,
      );
      this.updateConnectionStatus(connectionKey);
    });

    client.on('error', (error: Error) => {
      console.error(
        `GitSyncConnectionManager: Client error for ${connectionKey}:`,
        error,
      );
    });
  }

  /**
   * Notify listeners that connection status changed
   * Status is now tracked in main process, so this just emits the event
   * Listeners should re-query getActiveConnections() for current state
   */
  private updateConnectionStatus(connectionKey: string) {
    // Emit event so UI can re-query main process for updated status
    this.emit('connection-status-changed', connectionKey);
  }

  /**
   * Get all active connections from main process (source of truth)
   * This queries the main process WebSocket manager for connection state
   */
  async getActiveConnections(): Promise<Map<string, GitSyncConnectionInfo>> {
    try {
      const connections = await GitSyncService.getAllConnections();

      // Convert array to Map keyed by connectionId
      const connectionsMap = new Map<string, GitSyncConnectionInfo>();
      for (const conn of connections) {
        connectionsMap.set(conn.connectionId, conn);
      }

      return connectionsMap;
    } catch (error) {
      console.error(
        '[GitSyncConnectionManager] Failed to get connections from main process:',
        error,
      );
      return new Map();
    }
  }

  /**
   * Get connection for a specific repo/branch
   */
  getExistingConnection(
    repoId: string,
    branch: string = 'main',
  ): GitSyncClient | null {
    const connectionKey = `${repoId}:${branch}`;
    const connection = this.connections.get(connectionKey);
    return connection?.client || null;
  }

  /**
   * Disconnect a specific connection
   */
  disconnectConnection(repoId: string, branch: string = 'main') {
    const connectionKey = `${repoId}:${branch}`;
    const connection = this.connections.get(connectionKey);

    if (connection && connection.client) {
      console.log(`GitSyncConnectionManager: Disconnecting ${connectionKey}`);
      connection.client.disconnect();
      this.connections.delete(connectionKey);
      this.emit('connection-removed', connectionKey);
    }
  }

  /**
   * Disconnect all connections
   */
  disconnectAll() {
    console.log('GitSyncConnectionManager: Disconnecting all connections');

    // Collect connection keys before clearing
    const connectionKeys = Array.from(this.connections.keys());

    for (const connection of this.connections.values()) {
      if (connection.client) {
        connection.client.disconnect();
      }
    }

    this.connections.clear();

    // Emit connection-removed for each connection so UI updates
    for (const connectionKey of connectionKeys) {
      this.emit('connection-removed', connectionKey);
    }
  }

  /**
   * Get current auth status
   */
  getAuthStatus(): { isAuthenticated: boolean; user: GitHubUser | null } {
    return {
      isAuthenticated: this.isAuthenticated,
      user: this.authUser,
    };
  }

  // Type-safe event emitter override
  emit<K extends keyof ConnectionManagerEvents>(
    event: K,
    ...args: Parameters<ConnectionManagerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof ConnectionManagerEvents>(
    event: K,
    listener: ConnectionManagerEvents[K],
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof ConnectionManagerEvents>(
    event: K,
    listener: ConnectionManagerEvents[K],
  ): this {
    return super.off(event, listener);
  }
}

// Export singleton instance
export const gitSyncConnectionManager = GitSyncConnectionManager.getInstance();
