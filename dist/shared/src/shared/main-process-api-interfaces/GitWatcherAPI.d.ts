export interface GitStatus {
    repoPath: string;
    branch: string;
    isDirty: boolean;
    hasUntracked: boolean;
    hasStaged: boolean;
    ahead: number;
    behind: number;
}
export interface WatchResult {
    success: boolean;
    error?: string;
}
export declare enum GitWatcherEvents {
    WATCH_REPOSITORY = "git-watcher:watch",
    UNWATCH_REPOSITORY = "git-watcher:unwatch",
    GET_STATUS = "git-watcher:get-status",
    GET_ALL_STATUSES = "git-watcher:get-all-statuses",
    REFRESH_STATUS = "git-watcher:refresh-status",
    STATUS_UPDATE = "git:status-update"
}
export interface GitWatcherAPI {
    watchRepository(repoPath: string): Promise<WatchResult>;
    unwatchRepository(repoPath: string): Promise<WatchResult>;
    getStatus(repoPath: string): Promise<GitStatus | null>;
    getAllStatuses(): Promise<Record<string, GitStatus>>;
    refreshStatus(repoPath: string): Promise<GitStatus | null>;
    onStatusUpdate(callback: (status: GitStatus) => void): () => void;
}
//# sourceMappingURL=GitWatcherAPI.d.ts.map