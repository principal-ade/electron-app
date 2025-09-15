export interface BranchInfo {
    currentBranch?: string;
    defaultBranch?: string;
    availableBranches: string[];
    remotes: string[];
    currentCommit?: string;
    branchStatus?: {
        ahead: number;
        behind: number;
        upToDate: boolean;
    };
}
export declare class GitBranchService {
    /**
     * Get comprehensive branch information for a git repository
     * Uses multiple fallback methods to ensure we get the information
     */
    getBranchInfo(directory: string): Promise<BranchInfo | null>;
    /**
     * Get the git root directory
     */
    private getGitRoot;
    /**
     * Get current branch using multiple methods
     */
    private getCurrentBranch;
    /**
     * Get default branch using multiple methods
     * This is crucial for repositories, especially private ones
     */
    private getDefaultBranch;
    /**
     * Get all available branches (local and remote)
     */
    private getAvailableBranches;
    /**
     * Get list of remotes
     */
    private getRemotes;
    /**
     * Get the remote URL for origin
     */
    private getRemoteUrl;
    /**
     * Get the current commit hash
     */
    private getCurrentCommit;
    /**
     * Get branch status relative to remote
     */
    private getBranchStatus;
    /**
     * Fetch latest information from remote (if possible)
     * This is useful to ensure we have the latest branch information
     */
    fetchRemoteInfo(directory: string): Promise<boolean>;
}
//# sourceMappingURL=gitBranchService.d.ts.map