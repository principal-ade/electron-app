import { GitAdapter } from "@principal-ai/codebase-composition";
type GitRepositoryInfo = {
    isGitRepository: boolean;
    currentBranch?: string;
    owner?: string;
    repo?: string;
};
export declare class GitHubGitAdapter implements GitAdapter {
    private owner;
    private repo;
    private branch?;
    constructor(owner: string, repo: string, branch?: string | undefined);
    detectRepository(_path: string): Promise<GitRepositoryInfo | null>;
    watchGitRepository(_path: string): Promise<boolean>;
    stopWatchingGit(): Promise<void>;
    onGitStatusChange(_callback: (data: {
        changedFiles: Array<{
            path: string;
            status: 'added' | 'modified' | 'deleted' | 'renamed';
            lastModified?: Date;
        }>;
    }) => void): () => void;
}
export {};
//# sourceMappingURL=GitHubGitAdapter.d.ts.map