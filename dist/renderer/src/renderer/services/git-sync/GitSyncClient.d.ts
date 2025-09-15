import { EventEmitter } from 'events';
export interface GitSyncConfig {
    serverUrl: string;
    githubToken: string;
    repoUrl: string;
    repoPath: string;
    branch: string;
    userId: string;
    agentId: string;
    proxyMode?: boolean;
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
    type: 'file_change' | 'commit' | 'lock_acquired' | 'lock_released' | 'branch_change';
    agentId: string;
    timestamp: number;
    data: any;
}
export interface CrossBranchWarning {
    type: 'same_file_different_branch' | 'merge_conflict_potential' | 'branch_divergence';
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
export declare class GitSyncClient extends EventEmitter {
    private ws;
    private config;
    private status;
    private reconnectTimer;
    private pingInterval;
    private messageQueue;
    private isReconnecting;
    private roomToken;
    constructor(config: GitSyncConfig);
    /**
     * Connect to the git-sync server
     */
    connect(): Promise<void>;
    /**
     * Get room token from OAuth server via main process
     */
    private getRoomToken;
    /**
     * Authenticate with the server using room token
     */
    private authenticate;
    /**
     * Register for sync events
     */
    registerForSync(): void;
    /**
     * Acquire a lock on a resource
     */
    acquireLock(request: LockRequest): Promise<{
        success: boolean;
        lock?: LockInfo;
        error?: string;
        warnings?: CrossBranchWarning[];
    }>;
    /**
     * Release a lock
     */
    releaseLock(lockId: string): Promise<boolean>;
    /**
     * Broadcast a sync event
     */
    broadcastEvent(event: Omit<SyncEvent, 'agentId' | 'timestamp'>): void;
    /**
     * Check if a merge is safe
     */
    checkMergeSafety(toBranch: string, files: string[]): Promise<{
        safe: boolean;
        blockingLocks: LockInfo[];
        warnings: CrossBranchWarning[];
    }>;
    /**
     * Switch to a different branch
     */
    switchBranch(newBranch: string): Promise<{
        success: boolean;
        released: number;
        warnings: CrossBranchWarning[];
    }>;
    /**
     * Get current sync status
     */
    getStatus(): SyncStatus;
    /**
     * Disconnect from the server
     */
    disconnect(): void;
    /**
     * Handle incoming messages
     */
    private handleMessage;
    /**
     * Send a message to the server
     */
    private send;
    /**
     * Process queued messages
     */
    private processMessageQueue;
    /**
     * Schedule reconnection
     */
    private scheduleReconnect;
    /**
     * Start ping interval
     */
    private startPingInterval;
    /**
     * Stop ping interval
     */
    private stopPingInterval;
    /**
     * Extract repository ID from URL
     */
    private extractRepoId;
    /**
     * Generate unique request ID
     */
    private generateRequestId;
}
//# sourceMappingURL=GitSyncClient.d.ts.map