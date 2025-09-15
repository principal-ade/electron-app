import type { ModernApplicationWindow } from '../window/modernWindowManager';
export interface GitRepositoryInfo {
    path: string;
    isGitRepository: boolean;
    remotes: GitRemoteInfo[];
    owner?: string;
    repo?: string;
    isGitHub: boolean;
    currentBranch?: string;
    defaultBranch?: string;
}
export interface GitRemoteInfo {
    name: string;
    url: string;
    owner?: string;
    repo?: string;
    isGitHub: boolean;
    provider?: 'github' | 'gitlab' | 'bitbucket' | 'other';
}
export interface CommandResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
}
export interface AuthStatus {
    isAuthenticated: boolean;
    method: 'cli' | 'token' | 'none';
    username?: string;
    scope?: string[];
    rateLimit?: {
        remaining: number;
        total: number;
        resetTime: Date;
    };
}
export declare class GitHubAdapter {
    private cache;
    detectRepository(directoryPath: string): Promise<GitRepositoryInfo | null>;
    private getGitRemotes;
    private parseGitRemoteUrl;
    checkAuthStatus(): Promise<AuthStatus>;
    refreshData(owner: string, repo: string): Promise<void>;
    getFileAges(directoryPath: string): Promise<Map<string, {
        lastCommitDate: Date;
        daysSinceLastCommit: number;
    }>>;
    getChangedFiles(directoryPath: string): Promise<{
        path: string;
        status: 'added' | 'modified' | 'deleted' | 'renamed';
        lastModified?: Date;
    }[]>;
    getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string | null>;
    getFileContentLocalFirst(owner: string, repo: string, path: string, cwd: string, ref?: string): Promise<string | null>;
    getMarkdownDocuments(owner: string, repo: string, ref?: string): Promise<Array<{
        path: string;
        name: string;
        lastModified: Date;
        gitLastModified?: Date;
        size: number;
        isTracked: boolean;
    }>>;
    getMarkdownDocumentsLocalFirst(owner: string, repo: string, cwd: string, ref?: string): Promise<Array<{
        path: string;
        name: string;
        lastModified: Date;
        gitLastModified?: Date;
        size: number;
        isTracked: boolean;
    }>>;
    getRepoDefaultBranch(owner: string, repo: string): Promise<string | null>;
    private executeCommand;
    getTreeForPublicRepo(owner: string, repo: string, ref: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    createIssue(owner: string, repo: string, issue: any): Promise<any>;
    getIssues(owner: string, repo: string): Promise<any[]>;
}
export declare function registerGitHubIpcHandlers(appWindows: Map<number, ModernApplicationWindow>): void;
//# sourceMappingURL=githubHandlers.d.ts.map