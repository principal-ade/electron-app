import { PeerManager } from './PeerManager';
export interface GitSyncData {
    type: 'git-sync';
    action: 'commit-available' | 'request-sync' | 'sync-complete' | 'conflict-detected';
    data: {
        repoPath: string;
        branch: string;
        commit: string;
        message: string;
        files: string[];
        author: string;
        timestamp: number;
    };
}
export interface SyncStatus {
    localCommit: string;
    remoteCommit: string;
    isSynced: boolean;
    pendingChanges: number;
    conflicts: string[];
}
export declare class GitSyncManager {
    private peerManager;
    private currentRepoPath;
    private currentBranch;
    private syncStatus;
    private onSyncUpdate?;
    private onConflict?;
    constructor(peerManager: PeerManager);
    /**
     * Initialize sync for a repository
     */
    initializeSync(repoPath: string): Promise<void>;
    /**
     * Broadcast current git state to all peers
     */
    broadcastSyncState(): Promise<void>;
    /**
     * Handle incoming git sync messages
     */
    private handleGitSyncMessage;
    /**
     * Handle when a peer announces a new commit
     */
    private handleCommitAvailable;
    /**
     * Request sync from a specific peer
     */
    requestSync(peerId: string): Promise<void>;
    /**
     * Handle sync request from peer
     */
    private handleSyncRequest;
    /**
     * Perform the actual sync operation
     */
    performSync(peerId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handle sync completion notification
     */
    private handleSyncComplete;
    /**
     * Handle conflict detection
     */
    private handleConflictDetected;
    /**
     * Set callbacks for sync events
     */
    setCallbacks(callbacks: {
        onSyncUpdate?: (status: SyncStatus, peerId: string) => void;
        onConflict?: (files: string[]) => void;
    }): void;
    /**
     * Get current commit hash
     */
    private getCurrentCommit;
    /**
     * Get sync status for a peer
     */
    getSyncStatus(peerId: string): SyncStatus | undefined;
    /**
     * Get all sync statuses
     */
    getAllSyncStatuses(): Map<string, SyncStatus>;
    /**
     * Check if all peers are synced
     */
    areAllPeersSynced(): boolean;
}
//# sourceMappingURL=GitSyncManager.d.ts.map