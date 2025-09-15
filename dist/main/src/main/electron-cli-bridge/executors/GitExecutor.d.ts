/**
 * GitExecutor - Specialized executor for Git operations
 * Provides comprehensive git functionality through electron-cli-bridge
 */
import { BaseExecutor } from './BaseExecutor';
import type { ExecuteResult } from '../types';
export interface GitStatus {
    staged: string[];
    unstaged: string[];
    untracked: string[];
}
export interface GitRemote {
    name: string;
    url: string;
    owner?: string;
    repo?: string;
}
export interface GitDiffStats {
    files: Array<{
        additions: number;
        deletions: number;
        file: string;
    }>;
    totalAdditions: number;
    totalDeletions: number;
}
export declare class GitExecutor extends BaseExecutor {
    /**
     * Get git version
     */
    getVersion(): Promise<string | null>;
    /**
     * Check if git is available
     */
    checkAvailability(): Promise<{
        available: boolean;
        version?: string;
        error?: string;
    }>;
    /**
     * Find the git repository root
     */
    findGitRoot(directory: string): Promise<string | null>;
    /**
     * Check if a directory is a git repository
     */
    isGitRepository(directory: string): Promise<boolean>;
    /**
     * Get current branch name
     */
    getCurrentBranch(directory: string): Promise<string | null>;
    /**
     * Get git status
     */
    getStatus(directory: string): Promise<GitStatus>;
    /**
     * Get remotes with parsed GitHub info
     */
    getRemotes(directory: string): Promise<GitRemote[]>;
    /**
     * Get local branches
     */
    getLocalBranches(directory: string): Promise<string[]>;
    /**
     * Get remote branches
     */
    getRemoteBranches(directory: string): Promise<string[]>;
    /**
     * Get current commit hash
     */
    getCurrentCommit(directory: string): Promise<string | null>;
    /**
     * Get config value
     */
    getConfig(directory: string, key: string): Promise<string | null>;
    /**
     * Add files to staging
     */
    add(directory: string, files: string[]): Promise<ExecuteResult>;
    /**
     * Commit with message
     */
    commit(directory: string, message: string): Promise<ExecuteResult>;
    /**
     * Get diff statistics
     */
    getDiffStats(directory: string, cached?: boolean): Promise<GitDiffStats>;
    /**
     * Get default branch
     */
    getDefaultBranch(directory: string): Promise<string | null>;
    /**
     * Set remote HEAD
     */
    setRemoteHead(directory: string, remote?: string): Promise<boolean>;
    /**
     * Get branch tracking info
     */
    getBranchTracking(directory: string, branch: string): Promise<string | null>;
    /**
     * Get ahead/behind counts
     */
    getAheadBehind(directory: string, branch: string, upstream: string): Promise<{
        ahead: number;
        behind: number;
    } | null>;
    /**
     * Fetch from remote
     */
    fetch(directory: string, options?: {
        timeout?: number;
    }): Promise<boolean>;
    /**
     * Execute raw git command
     */
    raw(directory: string, args: string[]): Promise<ExecuteResult>;
    /**
     * Clone a repository
     */
    clone(url: string, destination: string, options?: {
        depth?: number;
    }): Promise<boolean>;
    /**
     * Pull changes
     */
    pull(directory: string, options?: {
        rebase?: boolean;
    }): Promise<ExecuteResult>;
    /**
     * Push changes
     */
    push(directory: string, options?: {
        force?: boolean;
        setUpstream?: string;
    }): Promise<ExecuteResult>;
    /**
     * Check out a branch
     */
    checkout(directory: string, branch: string, options?: {
        create?: boolean;
    }): Promise<ExecuteResult>;
    /**
     * Stash changes
     */
    stash(directory: string, options?: {
        message?: string;
    }): Promise<ExecuteResult>;
    /**
     * Apply stash
     */
    stashApply(directory: string, stashRef?: string): Promise<ExecuteResult>;
}
//# sourceMappingURL=GitExecutor.d.ts.map