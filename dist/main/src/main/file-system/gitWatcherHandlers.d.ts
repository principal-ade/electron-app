export declare enum GitWatcherEvents {
    WATCH_REPOSITORY = "git-watcher:watch",
    UNWATCH_REPOSITORY = "git-watcher:unwatch",
    GET_STATUS = "git-watcher:get-status",
    GET_ALL_STATUSES = "git-watcher:get-all-statuses",
    REFRESH_STATUS = "git-watcher:refresh-status",
    STATUS_UPDATE = "git:status-update"
}
export declare function registerGitWatcherHandlers(): void;
export declare function cleanupGitWatcherHandlers(): void;
//# sourceMappingURL=gitWatcherHandlers.d.ts.map