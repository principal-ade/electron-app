import { EventEmitter } from 'events';
import type { GitStatus } from '../../shared/types/git.types';
export declare class GitRepositoryWatcher extends EventEmitter {
    private watchers;
    private gitService;
    constructor();
    /**
     * Start watching a repository for git status changes
     */
    watchRepository(repoPath: string): Promise<void>;
    /**
     * Stop watching a repository
     */
    unwatchRepository(repoPath: string): Promise<void>;
    /**
     * Stop watching all repositories
     */
    destroy(): Promise<void>;
    /**
     * Check git status and emit if changed
     */
    private checkStatus;
    /**
     * Get comprehensive git status
     */
    private getGitStatus;
    /**
     * Load and parse gitignore file - disabled for now
     */
    /**
     * Check if status has changed
     */
    private hasStatusChanged;
    /**
     * Get current status for a repository (if watching)
     */
    getCurrentStatus(repoPath: string): GitStatus | undefined;
    /**
     * Get all watched repositories
     */
    getWatchedRepositories(): string[];
    /**
     * Emit file change event
     */
    private emitFileChange;
    /**
     * Manually refresh status for a repository
     */
    refreshStatus(repoPath: string): Promise<GitStatus | null>;
}
export declare const gitRepositoryWatcher: GitRepositoryWatcher;
//# sourceMappingURL=GitRepositoryWatcher.d.ts.map