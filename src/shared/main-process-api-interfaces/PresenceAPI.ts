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

export interface PresenceEvent {
  type:
    | 'presence:user_online'
    | 'presence:user_offline'
    | 'presence:repo_opened'
    | 'presence:repo_closed'
    | 'presence:repo_focused'
    | 'presence:status_changed';
  payload: Record<string, unknown>;
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
}
