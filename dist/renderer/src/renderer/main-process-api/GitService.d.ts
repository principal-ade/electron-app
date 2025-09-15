import { Repository } from '../../shared/types/repository.types';
import { GitStatus as GitWatcherStatus } from '../../shared/main-process-api-interfaces/GitWatcherAPI';
export interface GitRemote {
    name: string;
    url: string;
    owner?: string;
    repo?: string;
}
export interface GitInfo {
    isRepository: boolean;
    root: string;
    remotes?: GitRemote[];
    currentBranch?: string;
    lastCommit?: string;
}
export interface GitBranchStatus {
    branch: string;
    upstream?: string;
    ahead: number;
    behind: number;
    hasUpstream: boolean;
    canFastForward?: boolean;
    hasUncommittedChanges?: boolean;
}
export interface GitStatus {
    staged: string[];
    unstaged: string[];
    untracked: string[];
}
export interface GitDetailedChanges {
    created: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{
        from: string;
        to: string;
    }>;
    stats: {
        additions: number;
        deletions: number;
    };
    fileStats: Record<string, {
        additions: number;
        deletions: number;
    }>;
}
export interface GitCommitInfo {
    hash: string;
    message: string;
    author: string;
    date: string;
}
export interface GitBranchInfo {
    branch: string;
    upstream?: string;
}
export declare class GitService {
    static getRepositoryInfo(directoryPath: string): Promise<GitInfo | null>;
    static checkIfPrivateRepo(remoteUrl: string): Promise<boolean>;
    static cloneRepository(remoteUrl: string, targetPath: string): Promise<boolean>;
    static checkAuthMethods(remoteUrl: string): Promise<{
        ssh: {
            available: boolean;
            reason?: string;
        };
        https: {
            available: boolean;
            reason?: string;
        };
        suggestions: string[];
    }>;
    static deleteGitRepository(repoPath: string): Promise<{
        success: boolean;
        error?: string;
        hasUncommittedChanges?: boolean;
        unpushedCommits?: number;
        currentBranch?: string;
        requiresConfirmation?: boolean;
    }>;
    static forceDeleteGitRepository(repoPath: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    static getStatus(directory: string): Promise<GitStatus>;
    static getDetailedChanges(directory: string, files?: string[]): Promise<GitDetailedChanges>;
    static getUncommittedChanges(directory: string): Promise<string[]>;
    static fastForwardMerge(directory: string): Promise<{
        success: boolean;
        message: string;
    }>;
    static getBranchStatus(directory: string): Promise<GitBranchStatus>;
    static fetchUpstream(directory: string): Promise<{
        success: boolean;
        message: string;
    }>;
    static getCurrentBranch(directory: string): Promise<GitBranchInfo>;
    static getLatestCommit(directory: string): Promise<GitCommitInfo>;
    static commitChanges(directory: string, message: string, files: string[]): Promise<{
        success: boolean;
        message: string;
    }>;
    static fetch(directory: string): Promise<{
        success: boolean;
        message: string;
    }>;
    static merge(directory: string, branch: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Subscribe to git status updates
     * @returns Unsubscribe function
     */
    static onStatusUpdate(callback: (status: GitWatcherStatus) => void): () => void;
    /**
     * Subscribe to repository updated events
     * @returns Unsubscribe function
     */
    static onRepositoryUpdated(callback: (updatedRepo: Repository) => void): () => void;
    /**
     * Subscribe to repository clone added events
     * @returns Unsubscribe function
     */
    static onRepositoryCloneAdded(callback: (data: {
        repository: Repository;
        clonePath: string;
    }) => void): () => void;
    /**
     * Subscribe to repository clone removed events
     * @returns Unsubscribe function
     */
    static onRepositoryCloneRemoved(callback: (data: {
        repository: Repository;
        clonePath: string;
    }) => void): () => void;
    /**
     * Subscribe to local clone missing events
     * @returns Unsubscribe function
     */
    static onLocalCloneMissing(callback: (data: {
        repoPath: string;
    }) => void): () => void;
}
//# sourceMappingURL=GitService.d.ts.map