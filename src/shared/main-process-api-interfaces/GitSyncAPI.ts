/**
 * GitSyncAPI - Type-safe interface for git-sync operations
 * Manages connections to git-sync server for real-time collaboration
 */

export interface GitSyncConfig {
  repoId: string;
  repoPath: string;
  branch: string;
  token?: string;
}

export interface GitSyncConnectionResult {
  success: boolean;
  connectionId?: string;
  error?: string;
  message?: string;
}

export interface GitSyncLockOwner {
  agentId: string;
  userId: string;
}

export interface GitSyncLockInfo {
  id: string;
  resource: string;
  type: 'file' | 'directory';
  branch: string;
  owner: GitSyncLockOwner;
  exclusive: boolean;
  acquiredAt: number;
  expiresAt: number;
}

export interface GitSyncPeer {
  agentId: string;
  userId: string;
  branch: string;
}

export interface GitSyncStatus {
  connected: boolean;
  authenticated: boolean;
  repoId: string;
  branch: string;
  activeLocks: GitSyncLockInfo[];
  queuedLocks: number;
  peers: GitSyncPeer[];
}

export interface GitSyncConnectionInfo {
  connectionId: string;
  repoId: string;
  repoPath: string;
  branch: string;
  status: GitSyncStatus;
}

export interface GitSyncMessage {
  connectionId: string;
  type: string;
  data: unknown;
}

export interface GitSyncRoomTokenRequest {
  repositoryId: string;
  branch: string;
  isOwner: boolean;
}

export interface GitSyncRoomTokenResponse {
  success: boolean;
  token?: string;
  error?: string;
}

export interface GitSyncAPI {
  /**
   * Connect to git-sync server for a repository
   */
  connect(config: GitSyncConfig): Promise<GitSyncConnectionResult>;

  /**
   * Disconnect from git-sync server
   */
  disconnect(
    connectionId: string,
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Get current connection status
   */
  getStatus(connectionId: string): Promise<GitSyncStatus>;

  /**
   * Send a message through the git-sync connection
   */
  sendMessage(
    message: GitSyncMessage,
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Get a room token for git-sync collaboration
   */
  getRoomToken(
    request: GitSyncRoomTokenRequest,
  ): Promise<GitSyncRoomTokenResponse>;

  /**
   * Get the git-sync server URL
   */
  getServerUrl(): Promise<string>;

  /**
   * Check if user has access to a repository
   */
  checkRepoAccess(repoUrl: string, token: string): Promise<boolean>;

  /**
   * Subscribe to git-sync messages
   * @returns Unsubscribe function
   */
  onMessage(
    callback: (connectionKey: string, message: unknown) => void,
  ): () => void;

  /**
   * Get all active connections across all renderer processes
   * This is the source of truth for connection state
   */
  getAllConnections(): Promise<GitSyncConnectionInfo[]>;

  /**
   * Subscribe to connection-added events from main process
   * @returns Unsubscribe function
   */
  onConnectionAdded(callback: (connectionId: string) => void): () => void;

  /**
   * Subscribe to connection-removed events from main process
   * @returns Unsubscribe function
   */
  onConnectionRemoved(callback: (connectionId: string) => void): () => void;

  /**
   * Subscribe to connection-status-changed events from main process
   * @returns Unsubscribe function
   */
  onConnectionStatusChanged(
    callback: (connectionId: string) => void,
  ): () => void;

  /**
   * Check if a service is available
   */
  checkService(url: string, serviceName: string): Promise<{ available: boolean; status?: number; error?: string }>;

  /**
   * Set the environment (dev or prod) for GitSync servers
   */
  setEnvironment(environment: 'development' | 'production'): Promise<void>;

  /**
   * Get the current environment
   */
  getEnvironment(): Promise<'development' | 'production'>;
}
