import { GitStatus, WatchResult } from '../../shared/main-process-api-interfaces/GitWatcherAPI';
declare class GitWatcherServiceImpl {
    private statusListeners;
    private removeListenerFn;
    constructor();
    private setupListener;
    watchRepository(repoPath: string): Promise<WatchResult>;
    unwatchRepository(repoPath: string): Promise<WatchResult>;
    getStatus(repoPath: string): Promise<GitStatus | null>;
    getAllStatuses(): Promise<Record<string, GitStatus>>;
    refreshStatus(repoPath: string): Promise<GitStatus | null>;
    refreshAllStatuses(): Promise<Record<string, GitStatus>>;
    onStatusUpdate(callback: (status: GitStatus) => void): () => void;
    destroy(): void;
}
export declare const GitWatcherService: GitWatcherServiceImpl;
export {};
//# sourceMappingURL=GitWatcherService.d.ts.map