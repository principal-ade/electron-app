import { PeerManager, PeerData } from './PeerManager';
import {
  GitService,
  GitStatus as GitServiceStatus,
} from '../../main-process-api/GitService';

export interface GitSyncData {
  type: 'git-sync';
  action:
    | 'commit-available'
    | 'request-sync'
    | 'sync-complete'
    | 'conflict-detected';
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

export class GitSyncManager {
  private peerManager: PeerManager;
  private currentRepoPath: string = '';
  private currentBranch: string = '';
  private syncStatus: Map<string, SyncStatus> = new Map(); // peerId -> status
  private onSyncUpdate?: (status: SyncStatus, peerId: string) => void;
  private onConflict?: (files: string[]) => void;

  constructor(peerManager: PeerManager) {
    this.peerManager = peerManager;

    // Listen for git sync messages from peers
    const originalCallback = peerManager['onDataReceived'];
    peerManager.setCallbacks({
      onDataReceived: (peerId: string, data: PeerData) => {
        if (data.type === 'git-sync') {
          this.handleGitSyncMessage(peerId, data as GitSyncData);
        }
        originalCallback?.(peerId, data);
      },
      onPeerUpdate: peerManager['onPeerUpdate'],
    });
  }

  /**
   * Initialize sync for a repository
   */
  async initializeSync(repoPath: string): Promise<void> {
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
  async broadcastSyncState(): Promise<void> {
    const commitInfo = await GitService.getLatestCommit(this.currentRepoPath);
    const status = await GitService.getStatus(this.currentRepoPath);

    // Combine staged and unstaged files as modified
    const modifiedFiles = [
      ...new Set([
        ...status.staged.map((f) => f.path),
        ...status.unstaged.map((f) => f.path),
      ]),
    ];

    const syncData: GitSyncData = {
      type: 'git-sync',
      action: 'commit-available',
      data: {
        repoPath: this.currentRepoPath,
        branch: this.currentBranch,
        commit: commitInfo.hash,
        message: commitInfo.message,
        files: modifiedFiles.concat(status.untracked.map((f) => f.path)),
        author: commitInfo.author,
        timestamp: Date.now(),
      },
    };

    this.peerManager.broadcast(syncData);
  }

  /**
   * Handle incoming git sync messages
   */
  private async handleGitSyncMessage(peerId: string, message: GitSyncData) {
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
  private async handleCommitAvailable(
    peerId: string,
    data: GitSyncData['data'],
  ) {
    const localCommit = await GitService.getLatestCommit(this.currentRepoPath);

    // Check if we're behind
    const isBehind = localCommit.hash !== data.commit;

    // Update sync status
    const status: SyncStatus = {
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
        ...localStatus.staged.map((f) => f.path),
        ...localStatus.unstaged.map((f) => f.path),
        ...localStatus.untracked.map((f) => f.path),
      ]);

      // Check if any remote files conflict with local changes
      const conflicts = data.files.filter((file) =>
        localChangedFiles.has(file),
      );

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
  async requestSync(peerId: string): Promise<void> {
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
  private async handleSyncRequest(peerId: string) {
    // In a real implementation, this would:
    // 1. Push changes to a shared remote
    // 2. Or create a patch/bundle to send
    // For now, we'll signal that sync is ready

    await this.broadcastSyncState();
  }

  /**
   * Perform the actual sync operation
   */
  async performSync(
    peerId: string,
  ): Promise<{ success: boolean; message: string }> {
    const status = this.syncStatus.get(peerId);
    if (!status) {
      return { success: false, message: 'No sync status available' };
    }

    if (status.conflicts.length > 0) {
      return {
        success: false,
        message: `Conflicts detected in: ${status.conflicts.join(', ')}`,
      };
    }

    try {
      // Ensure we have no uncommitted changes
      const localStatus = await GitService.getStatus(this.currentRepoPath);
      const hasChanges =
        localStatus.staged.length > 0 ||
        localStatus.unstaged.length > 0 ||
        localStatus.untracked.length > 0;

      if (hasChanges) {
        // Auto-commit local changes first
        const filesToCommit = [
          ...new Set([
            ...localStatus.staged.map((f) => f.path),
            ...localStatus.unstaged.map((f) => f.path),
            ...localStatus.untracked.map((f) => f.path),
          ]),
        ];
        await GitService.commitChanges(
          this.currentRepoPath,
          'Auto-commit before sync',
          filesToCommit,
        );
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

      const mergeResult = await GitService.merge(
        this.currentRepoPath,
        `origin/${this.currentBranch}`,
      );
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
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, message: `Sync failed: ${error}` };
    }
  }

  /**
   * Handle sync completion notification
   */
  private async handleSyncComplete(peerId: string, data: GitSyncData['data']) {
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
  private handleConflictDetected(peerId: string, data: GitSyncData['data']) {
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
  setCallbacks(callbacks: {
    onSyncUpdate?: (status: SyncStatus, peerId: string) => void;
    onConflict?: (files: string[]) => void;
  }) {
    this.onSyncUpdate = callbacks.onSyncUpdate;
    this.onConflict = callbacks.onConflict;
  }

  /**
   * Get current commit hash
   */
  private async getCurrentCommit(): Promise<string> {
    const commit = await GitService.getLatestCommit(this.currentRepoPath);
    return commit.hash;
  }

  /**
   * Get sync status for a peer
   */
  getSyncStatus(peerId: string): SyncStatus | undefined {
    return this.syncStatus.get(peerId);
  }

  /**
   * Get all sync statuses
   */
  getAllSyncStatuses(): Map<string, SyncStatus> {
    return this.syncStatus;
  }

  /**
   * Check if all peers are synced
   */
  areAllPeersSynced(): boolean {
    for (const status of this.syncStatus.values()) {
      if (!status.isSynced) return false;
    }
    return true;
  }
}
