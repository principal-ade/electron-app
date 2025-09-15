/**
 * GitClientFactory - Migration to electron-cli-bridge
 * This replaces the simple-git implementation with electron-cli-bridge
 */
import { electronCLI } from '../electron-cli-bridge';
/**
 * Factory for Git operations using electron-cli-bridge
 * Provides compatibility layer for existing code while using new implementation
 */
export class GitClientFactory {
    static gitExecutor = null;
    /**
     * Initialize the git executor
     */
    static async ensureInitialized() {
        if (!this.gitExecutor) {
            await electronCLI.initialize();
            this.gitExecutor = electronCLI.git;
        }
        return this.gitExecutor;
    }
    /**
     * Get client for compatibility (returns git executor)
     */
    static async getClient(_baseDir) {
        const git = await this.ensureInitialized();
        // Return a compatibility object that mimics simple-git interface
        return {
            revparse: async (args) => {
                if (args[0] === '--show-toplevel') {
                    const root = await git.findGitRoot(_baseDir);
                    return root || '';
                }
                if (args[0] === '--is-inside-work-tree') {
                    const isRepo = await git.isGitRepository(_baseDir);
                    return isRepo ? 'true' : 'false';
                }
                if (args[0] === 'HEAD') {
                    return await git.getCurrentCommit(_baseDir) || '';
                }
                if (args[0] === '--abbrev-ref' && args[1] === 'HEAD') {
                    return await git.getCurrentBranch(_baseDir) || 'HEAD';
                }
                return '';
            },
            status: async () => {
                const status = await git.getStatus(_baseDir);
                return {
                    current: await git.getCurrentBranch(_baseDir),
                    staged: status.staged,
                    modified: status.unstaged,
                    deleted: [],
                    not_added: status.untracked,
                };
            },
            branchLocal: async () => {
                const branches = await git.getLocalBranches(_baseDir);
                return { all: branches };
            },
            branch: async (args) => {
                if (args.includes('-r')) {
                    const branches = await git.getRemoteBranches(_baseDir);
                    return { all: branches };
                }
                return { all: [] };
            },
            getRemotes: async (verbose) => {
                const remotes = await git.getRemotes(_baseDir);
                return remotes.map(r => ({
                    name: r.name,
                    refs: {
                        fetch: r.url,
                        push: r.url,
                    }
                }));
            },
            getConfig: async (key) => {
                const value = await git.getConfig(_baseDir, key);
                return { value };
            },
            add: async (files) => {
                return await git.add(_baseDir, files);
            },
            commit: async (message) => {
                const result = await git.commit(_baseDir, message);
                // Extract commit hash from output if available
                if (result.stdout) {
                    const match = result.stdout.match(/\[[\w\s-]+\s+([a-f0-9]+)\]/);
                    if (match) {
                        return { commit: match[1] };
                    }
                }
                return { commit: await git.getCurrentCommit(_baseDir) };
            },
            raw: async (args) => {
                const result = await git.raw(_baseDir, args);
                return result.stdout || '';
            }
        };
    }
    /**
     * Clear cache (no-op for compatibility)
     */
    static clearCache() {
        // No cache to clear
    }
    /**
     * Check if Git is available on the system
     */
    static async checkGitAvailability() {
        const git = await this.ensureInitialized();
        return await git.checkAvailability();
    }
    /**
     * Find the git root for a given path
     */
    static async findGitRoot(filePath) {
        const git = await this.ensureInitialized();
        return await git.findGitRoot(filePath);
    }
    /**
     * Check if a directory is a git repository
     */
    static async isGitRepository(directory) {
        const git = await this.ensureInitialized();
        return await git.isGitRepository(directory);
    }
    /**
     * Get git status for a directory
     */
    static async getGitStatus(directory) {
        const git = await this.ensureInitialized();
        return await git.getStatus(directory);
    }
    /**
     * Get git remotes for a directory
     */
    static async getRemotes(directory) {
        const git = await this.ensureInitialized();
        return await git.getRemotes(directory);
    }
    /**
     * Get current branch name
     */
    static async getCurrentBranch(directory) {
        const git = await this.ensureInitialized();
        return await git.getCurrentBranch(directory);
    }
    /**
     * Get all local branches
     */
    static async getLocalBranches(directory) {
        const git = await this.ensureInitialized();
        return await git.getLocalBranches(directory);
    }
    /**
     * Get all remote branches
     */
    static async getRemoteBranches(directory) {
        const git = await this.ensureInitialized();
        return await git.getRemoteBranches(directory);
    }
    /**
     * Get current commit hash
     */
    static async getCurrentCommit(directory) {
        const git = await this.ensureInitialized();
        return await git.getCurrentCommit(directory);
    }
    /**
     * Get git configuration value
     */
    static async getConfig(directory, key) {
        const git = await this.ensureInitialized();
        return await git.getConfig(directory, key);
    }
}
// Export a singleton instance for convenience (maintains compatibility)
export const gitClientFactory = GitClientFactory;
