import { GitService } from '../../main-process-api/GitService';
export class GitSyncManager {
    peerManager;
    currentRepoPath = '';
    currentBranch = '';
    syncStatus = new Map(); // peerId -> status
    onSyncUpdate;
    onConflict;
    constructor(peerManager) {
        this.peerManager = peerManager;
        // Listen for git sync messages from peers
        const originalCallback = peerManager['onDataReceived'];
        peerManager.setCallbacks({
            onDataReceived: (peerId, data) => {
                if (data.type === 'git-sync') {
                    this.handleGitSyncMessage(peerId, data);
                }
                originalCallback?.(peerId, data);
            },
            onPeerUpdate: peerManager['onPeerUpdate'],
        });
    }
    /**
     * Initialize sync for a repository
     */
    async initializeSync(repoPath) {
        this.currentRepoPath = repoPath;
        // Get current branch and commit
        const branchInfo = await GitService.getCurrentBranch(repoPath);
        const commitInfo = await GitService.getLatestCommit(repoPath);
        this.currentBranch = branchInfo.branch;
        // Broadcast our current state to all peers
        this.broadcastSyncState();
    }
    /**
     * Broadcast current git state to all peers
     */
    async broadcastSyncState() {
        const commitInfo = await GitService.getLatestCommit(this.currentRepoPath);
        const status = await GitService.getStatus(this.currentRepoPath);
        // Combine staged and unstaged files as modified
        const modifiedFiles = [...new Set([...status.staged, ...status.unstaged])];
        const syncData = {
            type: 'git-sync',
            action: 'commit-available',
            data: {
                repoPath: this.currentRepoPath,
                branch: this.currentBranch,
                commit: commitInfo.hash,
                message: commitInfo.message,
                files: modifiedFiles.concat(status.untracked),
                author: commitInfo.author,
                timestamp: Date.now(),
            },
        };
        this.peerManager.broadcast(syncData);
    }
    /**
     * Handle incoming git sync messages
     */
    async handleGitSyncMessage(peerId, message) {
        switch (message.action) {
            case 'commit-available':
                await this.handleCommitAvailable(peerId, message.data);
                break;
            case 'request-sync':
                await this.handleSyncRequest(peerId);
                break;
            case 'sync-complete':
                await this.handleSyncComplete(peerId, message.data);
                break;
            case 'conflict-detected':
                this.handleConflictDetected(peerId, message.data);
                break;
        }
    }
    /**
     * Handle when a peer announces a new commit
     */
    async handleCommitAvailable(peerId, data) {
        const localCommit = await GitService.getLatestCommit(this.currentRepoPath);
        // Check if we're behind
        const isBehind = localCommit.hash !== data.commit;
        // Update sync status
        const status = {
            localCommit: localCommit.hash,
            remoteCommit: data.commit,
            isSynced: !isBehind,
            pendingChanges: data.files.length,
            conflicts: [],
        };
        this.syncStatus.set(peerId, status);
        this.onSyncUpdate?.(status, peerId);
        if (isBehind) {
            // Check for potential conflicts
            const localStatus = await GitService.getStatus(this.currentRepoPath);
            const localChangedFiles = new Set([
                ...localStatus.staged,
                ...localStatus.unstaged,
                ...localStatus.untracked,
            ]);
            // Check if any remote files conflict with local changes
            const conflicts = data.files.filter(file => localChangedFiles.has(file));
            if (conflicts.length > 0) {
                status.conflicts = conflicts;
                this.syncStatus.set(peerId, status);
                this.onConflict?.(conflicts);
                // Notify peer about conflict
                this.peerManager.sendToPeer(peerId, {
                    type: 'git-sync',
                    action: 'conflict-detected',
                    data: {
                        ...data,
                        files: conflicts,
                    },
                });
            }
        }
    }
    /**
     * Request sync from a specific peer
     */
    async requestSync(peerId) {
        this.peerManager.sendToPeer(peerId, {
            type: 'git-sync',
            action: 'request-sync',
            data: {
                repoPath: this.currentRepoPath,
                branch: this.currentBranch,
                commit: await this.getCurrentCommit(),
                message: '',
                files: [],
                author: '',
                timestamp: Date.now(),
            },
        });
    }
    /**
     * Handle sync request from peer
     */
    async handleSyncRequest(peerId) {
        // In a real implementation, this would:
        // 1. Push changes to a shared remote
        // 2. Or create a patch/bundle to send
        // For now, we'll signal that sync is ready
        await this.broadcastSyncState();
    }
    /**
     * Perform the actual sync operation
     */
    async performSync(peerId) {
        const status = this.syncStatus.get(peerId);
        if (!status) {
            return { success: false, message: 'No sync status available' };
        }
        if (status.conflicts.length > 0) {
            return { success: false, message: `Conflicts detected in: ${status.conflicts.join(', ')}` };
        }
        try {
            // Ensure we have no uncommitted changes
            const localStatus = await GitService.getStatus(this.currentRepoPath);
            const hasChanges = localStatus.staged.length > 0 || localStatus.unstaged.length > 0 || localStatus.untracked.length > 0;
            if (hasChanges) {
                // Auto-commit local changes first
                const filesToCommit = [...new Set([...localStatus.staged, ...localStatus.unstaged, ...localStatus.untracked])];
                await GitService.commitChanges(this.currentRepoPath, 'Auto-commit before sync', filesToCommit);
            }
            // In a real implementation, we would:
            // 1. Fetch from remote: git fetch origin
            // 2. Merge or rebase: git merge origin/branch
            // For P2P, we could:
            // - Exchange git bundles
            // - Use a shared remote as intermediary
            // - Direct file transfer via WebRTC data channel
            // Simplified version: assume shared remote exists
            const fetchResult = await GitService.fetch(this.currentRepoPath);
            if (!fetchResult.success) {
                return { success: false, message: 'Failed to fetch changes' };
            }
            const mergeResult = await GitService.merge(this.currentRepoPath, `origin/${this.currentBranch}`);
            if (!mergeResult.success) {
                return { success: false, message: 'Failed to merge changes' };
            }
            // Notify peer that sync is complete
            this.peerManager.sendToPeer(peerId, {
                type: 'git-sync',
                action: 'sync-complete',
                data: {
                    repoPath: this.currentRepoPath,
                    branch: this.currentBranch,
                    commit: await this.getCurrentCommit(),
                    message: 'Sync completed',
                    files: [],
                    author: '',
                    timestamp: Date.now(),
                },
            });
            // Update our sync status
            const newCommit = await this.getCurrentCommit();
            status.localCommit = newCommit;
            status.isSynced = true;
            this.syncStatus.set(peerId, status);
            this.onSyncUpdate?.(status, peerId);
            return { success: true, message: 'Sync completed successfully' };
        }
        catch (error) {
            console.error('Sync error:', error);
            return { success: false, message: `Sync failed: ${error}` };
        }
    }
    /**
     * Handle sync completion notification
     */
    async handleSyncComplete(peerId, data) {
        const status = this.syncStatus.get(peerId);
        if (status) {
            status.remoteCommit = data.commit;
            status.isSynced = status.localCommit === data.commit;
            this.syncStatus.set(peerId, status);
            this.onSyncUpdate?.(status, peerId);
        }
    }
    /**
     * Handle conflict detection
     */
    handleConflictDetected(peerId, data) {
        const status = this.syncStatus.get(peerId);
        if (status) {
            status.conflicts = data.files;
            this.syncStatus.set(peerId, status);
            this.onSyncUpdate?.(status, peerId);
            this.onConflict?.(data.files);
        }
    }
    /**
     * Set callbacks for sync events
     */
    setCallbacks(callbacks) {
        this.onSyncUpdate = callbacks.onSyncUpdate;
        this.onConflict = callbacks.onConflict;
    }
    /**
     * Get current commit hash
     */
    async getCurrentCommit() {
        const commit = await GitService.getLatestCommit(this.currentRepoPath);
        return commit.hash;
    }
    /**
     * Get sync status for a peer
     */
    getSyncStatus(peerId) {
        return this.syncStatus.get(peerId);
    }
    /**
     * Get all sync statuses
     */
    getAllSyncStatuses() {
        return this.syncStatus;
    }
    /**
     * Check if all peers are synced
     */
    areAllPeersSynced() {
        for (const status of this.syncStatus.values()) {
            if (!status.isSynced)
                return false;
        }
        return true;
    }
}
