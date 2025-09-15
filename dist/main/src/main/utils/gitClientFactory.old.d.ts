import { SimpleGit } from 'simple-git';
/**
 * Factory for creating and managing simple-git instances
 * Provides centralized configuration and error handling
 */
export declare class GitClientFactory {
    private static instances;
    /**
     * Default options for all git instances
     */
    private static getDefaultOptions;
    /**
     * Get or create a SimpleGit instance for a directory
     * @param baseDir The directory to run git commands in
     * @returns SimpleGit instance configured for the directory
     */
    static getClient(baseDir: string): SimpleGit;
    /**
     * Clear cached instances (useful for testing or cleanup)
     */
    static clearCache(): void;
    /**
     * Check if Git is available on the system
     * @returns Promise<boolean> indicating if Git is installed
     */
    static checkGitAvailability(): Promise<{
        available: boolean;
        version?: string;
        error?: string;
    }>;
    /**
     * Find the git root for a given path
     * This replaces: git rev-parse --show-toplevel
     * @param filePath The file or directory path to check
     * @returns The git repository root path or null if not in a git repo
     */
    static findGitRoot(filePath: string): Promise<string | null>;
    /**
     * Check if a directory is a git repository
     * This replaces: git rev-parse --is-inside-work-tree
     * @param directory The directory to check
     * @returns true if the directory is inside a git repository
     */
    static isGitRepository(directory: string): Promise<boolean>;
    /**
     * Get git status for a directory
     * This replaces: git status --porcelain
     * @param directory The directory to check status for
     * @returns Object with staged, unstaged, and untracked files
     */
    static getGitStatus(directory: string): Promise<{
        staged: string[];
        unstaged: string[];
        untracked: string[];
    }>;
    /**
     * Get git remotes for a directory
     * This replaces: git remote -v
     * @param directory The directory to check remotes for
     * @returns Array of remotes with parsed GitHub info
     */
    static getRemotes(directory: string): Promise<Array<{
        name: string;
        url: string;
        owner?: string;
        repo?: string;
    }>>;
    /**
     * Get current branch name
     * This replaces: git branch --show-current, git symbolic-ref --short HEAD, git rev-parse --abbrev-ref HEAD
     * @param directory The directory to check
     * @returns Current branch name or null if not on a branch
     */
    static getCurrentBranch(directory: string): Promise<string | null>;
    /**
     * Get all local branches
     * This replaces: git branch
     * @param directory The directory to check
     * @returns Array of local branch names
     */
    static getLocalBranches(directory: string): Promise<string[]>;
    /**
     * Get all remote branches
     * This replaces: git branch -r
     * @param directory The directory to check
     * @returns Array of remote branch names
     */
    static getRemoteBranches(directory: string): Promise<string[]>;
    /**
     * Get current commit hash
     * This replaces: git rev-parse HEAD
     * @param directory The directory to check
     * @returns Current commit hash or null if no commits
     */
    static getCurrentCommit(directory: string): Promise<string | null>;
    /**
     * Get git configuration value
     * This replaces: git config --get <key>
     * @param directory The directory to check
     * @param key The config key to get
     * @returns Config value or null if not set
     */
    static getConfig(directory: string, key: string): Promise<string | null>;
}
export declare const gitClientFactory: typeof GitClientFactory;
//# sourceMappingURL=gitClientFactory.old.d.ts.map