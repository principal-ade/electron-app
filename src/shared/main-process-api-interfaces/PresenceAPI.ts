/**
 * PresenceAPI - Type-safe interface for presence operations
 * Manages real-time user presence information from traffic controller
 */

export interface DeviceInfo {
  agentId: string;
  deviceName?: string;
  platform?: string;
  connectedAt: number;
  lastHeartbeat: number;
}

export interface RepositorySession {
  repoId: string;
  branch: string;
  openedAt: number;
  lastActivity: number;
  currentFile?: string;
  hasUnsavedChanges?: boolean;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
  };
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  openRepositories: RepositorySession[];
  activeRepository?: string;
  lastSeen: number;
  devices: DeviceInfo[];
  statusMessage?: string;
}

export interface PresenceStats {
  totalOnline: number;
  totalRepositories: number;
  activeCollaborations: number;
}

export interface PresenceData {
  users: UserPresence[];
  stats: PresenceStats;
}

export interface PresenceEventPayloads {
  'presence:user_online': {
    userId: string;
    agentId: string;
  };
  'presence:user_offline': {
    userId: string;
    agentId: string;
  };
  'presence:repo_opened': {
    userId: string;
    repoId: string;
    branch: string;
  };
  'presence:repo_closed': {
    userId: string;
    repoId: string;
  };
  'presence:repo_focused': {
    userId: string;
    repoId: string;
  };
  'presence:status_changed': {
    userId: string;
    status: 'online' | 'away' | 'offline';
    message?: string;
  };
}

export type PresenceEventType = keyof PresenceEventPayloads;

export interface PresenceEvent<
  T extends PresenceEventType = PresenceEventType,
> {
  type: T;
  payload: PresenceEventPayloads[T];
  timestamp: number;
}

export interface PresenceAPI {
  /**
   * Get all currently online users
   */
  getUsers(): Promise<PresenceData>;

  /**
   * Get users in a specific repository
   */
  getUsersInRepository(
    owner: string,
    repo: string,
  ): Promise<{ repoId: string; users: UserPresence[]; totalUsers: number }>;

  /**
   * Get presence for a specific user
   */
  getUser(userId: string): Promise<UserPresence | null>;

  /**
   * Subscribe to global presence events
   * Returns true if successfully subscribed
   */
  subscribeToPresence(): Promise<boolean>;

  /**
   * Unsubscribe from presence events
   */
  unsubscribeFromPresence(): Promise<void>;

  /**
   * Connect to Git-Sync for presence tracking only (no repository required)
   * @param token - GitHub token for authentication
   * @returns Connection result
   */
  connectToPresence(token: string): Promise<{
    success: boolean;
    connectionId?: string;
    message?: string;
    error?: string;
  }>;

  /**
   * Disconnect from presence-only connection
   */
  disconnectFromPresence(): Promise<{ success: boolean; message?: string }>;

  /**
   * Listen for presence events
   */
  onPresenceEvent(callback: (message: PresenceEvent) => void): () => void;

  /**
   * Report that a repository has been opened
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branch - Current branch
   * @param localPath - Optional local path
   */
  reportRepositoryOpened(
    owner: string,
    repo: string,
    branch: string,
    localPath?: string,
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Report that a repository has been closed
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  reportRepositoryClosed(
    owner: string,
    repo: string,
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Report that a repository is now the active/focused one
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  reportActiveRepository(
    owner: string,
    repo: string,
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Update user status
   * @param status - User status (online/away)
   * @param message - Optional status message
   */
  updateStatus(
    status: 'online' | 'away',
    message?: string,
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Set user visibility (visible/invisible mode)
   * @param visible - Whether user should be visible to others
   */
  setVisibility(
    visible: boolean,
  ): Promise<{ success: boolean; message?: string }>;

  /**
   * Send a heartbeat to keep presence alive
   */
  sendHeartbeat(): Promise<{ success: boolean; message?: string }>;
}
