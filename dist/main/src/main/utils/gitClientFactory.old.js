import simpleGit from 'simple-git';
/**
 * Factory for creating and managing simple-git instances
 * Provides centralized configuration and error handling
 */
export class GitClientFactory {
    static instances = new Map();
    /**
     * Default options for all git instances
     */
    static getDefaultOptions() {
        // In Electron, we need to handle spawn configuration carefully
        const isElectron = process.versions?.electron;
        const isPackaged = isElectron && !process.defaultApp;
        return {
            // Set binary path explicitly if needed (auto-detected by default)
            binary: 'git',
            // Max concurrent processes
            maxConcurrentProcesses: 6,
            // Trim trailing whitespace from responses
            trimmed: true,
            // Configuration for git operations
            config: [],
            // Add spawn options to handle Electron environment
            ...(isElectron ? {
                // Force using shell in Electron to avoid spawn issues
                // This helps with PATH resolution and file descriptor handling
                completion: {
                    onClose: true, // Wait for process completion to avoid spawn issues
                },
            } : {}),
        };
    }
    /**
     * Get or create a SimpleGit instance for a directory
     * @param baseDir The directory to run git commands in
     * @returns SimpleGit instance configured for the directory
     */
    static getClient(baseDir) {
        // Check if we already have an instance for this directory
        if (this.instances.has(baseDir)) {
            return this.instances.get(baseDir);
        }
        // Create new instance with default options
        const options = this.getDefaultOptions();
        // In Electron environment, we need to be careful with spawn options
        // to avoid EBADF errors
        const isElectron = process.versions?.electron;
        if (isElectron) {
            // Don't use custom spawn - let simple-git handle it
            // Just ensure we have proper environment
            options.env = {
                ...process.env,
                // Ensure PATH is properly set for git
                PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
            };
            // Disable concurrent processes to avoid file descriptor issues
            options.maxConcurrentProcesses = 1;
        }
        const git = simpleGit(baseDir, options);
        // Configure error handling
        git.outputHandler((_command, stdout, stderr) => {
            // Log git operations for debugging (optional)
            if (process.env.DEBUG_GIT === 'true') {
                console.log('[Git Debug]', { stdout, stderr });
            }
        });
        // Store instance for reuse
        this.instances.set(baseDir, git);
        return git;
    }
    /**
     * Clear cached instances (useful for testing or cleanup)
     */
    static clearCache() {
        this.instances.clear();
    }
    /**
     * Check if Git is available on the system
     * @returns Promise<boolean> indicating if Git is installed
     */
    static async checkGitAvailability() {
        try {
            // In Electron, try execSync first as it's more reliable
            const isElectron = process.versions?.electron;
            if (isElectron) {
                try {
                    const { execSync } = require('child_process');
                    const versionOutput = execSync('git --version', {
                        encoding: 'utf8',
                        stdio: 'pipe',
                        timeout: 5000,
                    });
                    // Parse version from output like "git version 2.34.1"
                    const versionMatch = versionOutput.match(/git version (\d+\.\d+\.\d+)/);
                    if (versionMatch) {
                        return {
                            available: true,
                            version: versionMatch[1],
                        };
                    }
                }
                catch (execError) {
                    console.warn('[GitClientFactory] execSync check failed, falling back to simple-git');
                }
            }
            // Fallback to simple-git's version check
            const git = simpleGit();
            const version = await git.version();
            if (version.installed) {
                return {
                    available: true,
                    version: `${version.major}.${version.minor}.${version.patch}`,
                };
            }
            return {
                available: false,
                error: 'Git is not installed',
            };
        }
        catch (error) {
            return {
                available: false,
                error: error instanceof Error ? error.message : 'Failed to detect Git',
            };
        }
    }
    /**
     * Find the git root for a given path
     * This replaces: git rev-parse --show-toplevel
     * @param filePath The file or directory path to check
     * @returns The git repository root path or null if not in a git repo
     */
    static async findGitRoot(filePath) {
        try {
            console.log(`[GitClientFactory] Finding git root for: "${filePath}"`);
            // First check if git is available
            const gitAvailable = await this.checkGitAvailability();
            if (!gitAvailable.available) {
                console.warn(`[GitClientFactory] Git is not available: ${gitAvailable.error}`);
                return null;
            }
            const git = this.getClient(filePath);
            const result = await git.revparse(['--show-toplevel']);
            const gitRoot = result.trim();
            console.log(`[GitClientFactory] Found git root: "${gitRoot}" for path: "${filePath}"`);
            return gitRoot;
        }
        catch (error) {
            // Not in a git repository or git command failed
            console.log(`[GitClientFactory] No git repo found for: "${filePath}"`);
            // Check for specific error types
            if (error?.message?.includes('spawn EBADF')) {
                console.error(`[GitClientFactory] Git spawn error (EBADF) - This usually indicates an issue with Electron's process spawning.`);
                console.error(`[GitClientFactory] Attempting workaround...`);
                // Try a direct execution as a fallback
                try {
                    const { execSync } = require('child_process');
                    const result = execSync('git rev-parse --show-toplevel', {
                        cwd: filePath,
                        encoding: 'utf8',
                        stdio: 'pipe',
                    });
                    const gitRoot = result.trim();
                    console.log(`[GitClientFactory] Fallback successful, found git root: "${gitRoot}"`);
                    return gitRoot;
                }
                catch (fallbackError) {
                    console.error(`[GitClientFactory] Fallback also failed:`, fallbackError);
                }
            }
            else {
                console.log(`[GitClientFactory] Error details:`, error?.message || error);
            }
            // Try to check if the path exists
            const fs = require('fs');
            try {
                const stats = await fs.promises.stat(filePath);
                console.log(`[GitClientFactory] Path exists, type: ${stats.isDirectory() ? 'directory' : 'file'}`);
            }
            catch (pathError) {
                console.log(`[GitClientFactory] Path access error:`, pathError);
            }
            return null;
        }
    }
    /**
     * Check if a directory is a git repository
     * This replaces: git rev-parse --is-inside-work-tree
     * @param directory The directory to check
     * @returns true if the directory is inside a git repository
     */
    static async isGitRepository(directory) {
        try {
            const git = this.getClient(directory);
            const result = await git.revparse(['--is-inside-work-tree']);
            return result.trim() === 'true';
        }
        catch {
            return false;
        }
    }
    /**
     * Get git status for a directory
     * This replaces: git status --porcelain
     * @param directory The directory to check status for
     * @returns Object with staged, unstaged, and untracked files
     */
    static async getGitStatus(directory) {
        try {
            const git = this.getClient(directory);
            const status = await git.status();
            return {
                staged: status.staged,
                unstaged: status.modified.concat(status.deleted),
                untracked: status.not_added,
            };
        }
        catch (error) {
            console.log(`[GitClientFactory] Failed to get git status for: "${directory}"`);
            // Return empty status on error
            return {
                staged: [],
                unstaged: [],
                untracked: [],
            };
        }
    }
    /**
     * Get git remotes for a directory
     * This replaces: git remote -v
     * @param directory The directory to check remotes for
     * @returns Array of remotes with parsed GitHub info
     */
    static async getRemotes(directory) {
        try {
            const git = this.getClient(directory);
            const remotes = await git.getRemotes(true); // true = verbose, includes URLs
            return remotes.map(remote => {
                // Parse GitHub URLs for owner/repo extraction
                let owner;
                let repo;
                const url = remote.refs.fetch || remote.refs.push || '';
                const githubMatch = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
                if (githubMatch) {
                    owner = githubMatch[1];
                    repo = githubMatch[2];
                }
                return {
                    name: remote.name,
                    url,
                    owner,
                    repo,
                };
            });
        }
        catch (error) {
            console.log(`[GitClientFactory] Failed to get git remotes for: "${directory}"`);
            return [];
        }
    }
    /**
     * Get current branch name
     * This replaces: git branch --show-current, git symbolic-ref --short HEAD, git rev-parse --abbrev-ref HEAD
     * @param directory The directory to check
     * @returns Current branch name or null if not on a branch
     */
    static async getCurrentBranch(directory) {
        try {
            const git = this.getClient(directory);
            const status = await git.status();
            return status.current || null;
        }
        catch (error) {
            console.log(`[GitClientFactory] Failed to get current branch for: "${directory}"`);
            return null;
        }
    }
    /**
     * Get all local branches
     * This replaces: git branch
     * @param directory The directory to check
     * @returns Array of local branch names
     */
    static async getLocalBranches(directory) {
        try {
            const git = this.getClient(directory);
            const branches = await git.branchLocal();
            return branches.all;
        }
        catch (error) {
            console.log(`[GitClientFactory] Failed to get local branches for: "${directory}"`);
            return [];
        }
    }
    /**
     * Get all remote branches
     * This replaces: git branch -r
     * @param directory The directory to check
     * @returns Array of remote branch names
     */
    static async getRemoteBranches(directory) {
        try {
            const git = this.getClient(directory);
            const branches = await git.branch(['-r']);
            return branches.all.filter(branch => branch !== 'remotes/origin/HEAD');
        }
        catch (error) {
            console.log(`[GitClientFactory] Failed to get remote branches for: "${directory}"`);
            return [];
        }
    }
    /**
     * Get current commit hash
     * This replaces: git rev-parse HEAD
     * @param directory The directory to check
     * @returns Current commit hash or null if no commits
     */
    static async getCurrentCommit(directory) {
        try {
            const git = this.getClient(directory);
            const result = await git.revparse(['HEAD']);
            return result.trim();
        }
        catch (error) {
            console.log(`[GitClientFactory] Failed to get current commit for: "${directory}"`);
            return null;
        }
    }
    /**
     * Get git configuration value
     * This replaces: git config --get <key>
     * @param directory The directory to check
     * @param key The config key to get
     * @returns Config value or null if not set
     */
    static async getConfig(directory, key) {
        try {
            const git = this.getClient(directory);
            const result = await git.getConfig(key);
            return result.value || null;
        }
        catch (error) {
            console.log(`[GitClientFactory] Failed to get config ${key} for: "${directory}"`);
            return null;
        }
    }
}
// Export a singleton instance for convenience
export const gitClientFactory = GitClientFactory;
