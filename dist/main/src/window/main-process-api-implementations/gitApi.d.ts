import { Repository } from '../../shared/types/repository.types';
export interface GitRepositoryInfo {
    root: string;
    relativePath: string;
    isRepository: boolean;
    remotes?: Array<{
        name: string;
        url: string;
        owner?: string;
        repo?: string;
    }>;
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
export interface GitCommand {
    stdout: string;
    stderr: string;
}
export declare const gitAPI: {
    getRepositoryInfo: (filePath: string) => Promise<GitRepositoryInfo | null>;
    checkIfPrivateRepo: (remoteUrl: string) => Promise<boolean>;
    getStatus: (directory: string) => Promise<GitStatus>;
    getDetailedChanges: (directory: string, files?: string[]) => Promise<GitDetailedChanges>;
    getUncommittedChanges: (directory: string) => Promise<string[]>;
    stageFiles: (directory: string, files: string[]) => Promise<boolean>;
    createCommit: (directory: string, message: string) => Promise<string>;
    execCommand: (directory: string, args: string[]) => Promise<GitCommand>;
    cloneRepository: (remoteUrl: string, targetPath: string) => Promise<boolean>;
    checkAuthMethods: (remoteUrl: string) => Promise<{
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
    deleteGitRepository: (repoPath: string) => Promise<{
        success: boolean;
        error?: string;
        hasUncommittedChanges?: boolean;
        unpushedCommits?: number;
        currentBranch?: string;
        requiresConfirmation?: boolean;
    }>;
    forceDeleteGitRepository: (repoPath: string) => Promise<{
        success: boolean;
        error?: string;
    }>;
    onStatusUpdate: (callback: (status: any) => void) => () => void;
    onRepositoryUpdated: (callback: (updatedRepo: Repository) => void) => () => void;
    onRepositoryCloneAdded: (callback: (data: {
        repository: Repository;
        clonePath: string;
    }) => void) => () => void;
    onRepositoryCloneRemoved: (callback: (data: {
        repository: Repository;
        clonePath: string;
    }) => void) => () => void;
    onLocalCloneMissing: (callback: (data: {
        repoPath: string;
    }) => void) => () => void;
};
//# sourceMappingURL=gitApi.d.ts.map