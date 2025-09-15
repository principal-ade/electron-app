/**
 * GitClientFactory - Migration to electron-cli-bridge
 * This replaces the simple-git implementation with electron-cli-bridge
 */
/**
 * Factory for Git operations using electron-cli-bridge
 * Provides compatibility layer for existing code while using new implementation
 */
export declare class GitClientFactory {
    private static gitExecutor;
    /**
     * Initialize the git executor
     */
    private static ensureInitialized;
    /**
     * Get client for compatibility (returns git executor)
     */
    static getClient(_baseDir: string): Promise<any>;
    /**
     * Clear cache (no-op for compatibility)
     */
    static clearCache(): void;
    /**
     * Check if Git is available on the system
     */
    static checkGitAvailability(): Promise<{
        available: boolean;
        version?: string;
        error?: string;
    }>;
    /**
     * Find the git root for a given path
     */
    static findGitRoot(filePath: string): Promise<string | null>;
    /**
     * Check if a directory is a git repository
     */
    static isGitRepository(directory: string): Promise<boolean>;
    /**
     * Get git status for a directory
     */
    static getGitStatus(directory: string): Promise<{
        staged: string[];
        unstaged: string[];
        untracked: string[];
    }>;
    /**
     * Get git remotes for a directory
     */
    static getRemotes(directory: string): Promise<Array<{
        name: string;
        url: string;
        owner?: string;
        repo?: string;
    }>>;
    /**
     * Get current branch name
     */
    static getCurrentBranch(directory: string): Promise<string | null>;
    /**
     * Get all local branches
     */
    static getLocalBranches(directory: string): Promise<string[]>;
    /**
     * Get all remote branches
     */
    static getRemoteBranches(directory: string): Promise<string[]>;
    /**
     * Get current commit hash
     */
    static getCurrentCommit(directory: string): Promise<string | null>;
    /**
     * Get git configuration value
     */
    static getConfig(directory: string, key: string): Promise<string | null>;
}
export declare const gitClientFactory: typeof GitClientFactory;
//# sourceMappingURL=gitClientFactory.d.ts.map