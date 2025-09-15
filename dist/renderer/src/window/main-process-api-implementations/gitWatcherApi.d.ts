import { GitStatus, WatchResult } from '../../shared/main-process-api-interfaces/GitWatcherAPI';
export declare const gitWatcherAPI: {
    watchRepository: (repoPath: string) => Promise<WatchResult>;
    unwatchRepository: (repoPath: string) => Promise<WatchResult>;
    getStatus: (repoPath: string) => Promise<GitStatus | null>;
    getAllStatuses: () => Promise<Record<string, GitStatus>>;
    refreshStatus: (repoPath: string) => Promise<GitStatus | null>;
    onStatusUpdate: (callback: (status: GitStatus) => void) => () => void;
};
//# sourceMappingURL=gitWatcherApi.d.ts.map