import { type RepositoryAPI } from '../../shared/main-process-api-interfaces/RepositoryAPI';
import { Repository, VCSType } from '../../shared/types/repository.types';
export declare class RepositoryApiEventHandler implements RepositoryAPI {
    private branchService;
    /**
     * Broadcast repository events to all windows
     */
    private broadcastRepositoryEvent;
    /**
     * Generate a storage key for a repository URL
     * Uses hash to avoid electron-store dot notation issues (same as RepositoryCache)
     */
    private getRepositoryKey;
    /**
     * Refresh metadata for a repository (fetch avatar, description, etc.)
     */
    refreshRepositoryMetadata(remoteUrl: string): Promise<Repository | undefined>;
    /**
     * Get all repositories
     */
    getRepositories(): Promise<Repository[]>;
    /**
     * Normalize repository URL based on VCS type
     */
    private normalizeRepoUrl;
    /**
     * Detect VCS type from URL
     */
    private detectVCSType;
    /**
     * Fetch repository metadata from GitHub API
     */
    fetchGitHubMetadata(remoteUrl: string): Promise<{
        name?: string;
        owner?: string;
        description?: string;
        avatarUrl?: string;
        language?: string;
        stars?: number;
        defaultBranch?: string;
        topics?: string[];
        isPrivate?: boolean;
        isFork?: boolean;
        url?: string;
        license?: {
            key: string;
            name: string;
            spdxId: string;
            url: string;
        };
        parentRepo?: {
            owner: string;
            name: string;
            url: string;
        };
    } | null>;
    /**
     * Get repository by remote URL
     */
    getRepository(remoteUrl: string): Promise<Repository | undefined>;
    /**
     * Add a new repository or update existing
     */
    addRepository(params: {
        remoteUrl: string;
        owner: string;
        name: string;
        vcsType?: VCSType;
        localPath?: string;
        description?: string;
        avatarUrl?: string;
        metadata?: Repository['metadata'];
    }): Promise<Repository>;
    /**
     * Add a local clone to an existing repository
     */
    addLocalClone(remoteUrl: string, localPath: string): Promise<Repository | undefined>;
    /**
     * Remove a local clone from a repository
     */
    removeLocalClone(remoteUrl: string, localPath: string): Promise<boolean>;
    /**
     * Update repository metadata
     */
    updateRepository(remoteUrl: string, updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name' | 'vcsType'>>): Promise<Repository | undefined>;
    /**
     * Update repository last accessed time
     */
    updateRepositoryAccess(remoteUrl: string): Promise<void>;
    /**
     * Update local clone last accessed time
     */
    updateLocalCloneAccess(remoteUrl: string, localPath: string): Promise<void>;
    /**
     * Remove repository entirely
     */
    removeRepository(remoteUrl: string): Promise<boolean>;
    /**
     * Get recent repositories (sorted by last accessed)
     */
    getRecentRepositories(limit?: number): Promise<Repository[]>;
    /**
     * Find repository by local path
     */
    getRepositoryByLocalPath(localPath: string): Promise<Repository | undefined>;
    /**
     * Get all repositories with local clones
     */
    getLocalRepositories(): Promise<Repository[]>;
    /**
     * Search GitHub repositories
     * IMPORTANT: API calls should always be made from the main process, never from the renderer.
     * This ensures better security, rate limiting control, and potential token management.
     */
    searchGitHubRepositories(query: string, options?: {
        sort?: 'stars' | 'forks' | 'updated';
        order?: 'asc' | 'desc';
        perPage?: number;
    }): Promise<{
        items: Array<{
            id: number;
            full_name: string;
            html_url: string;
            description: string | null;
            stargazers_count: number;
            forks_count: number;
            language: string | null;
        }>;
        total_count: number;
    }>;
    /**
     * Set a custom avatar for a repository
     */
    setRepositoryAvatar(remoteUrl: string, imageBase64: string): Promise<{
        success: boolean;
        avatarPath?: string;
        error?: string;
    }>;
    /**
     * Set a custom avatar for a clone
     */
    setCloneAvatar(remoteUrl: string, clonePath: string, imageBase64: string): Promise<{
        success: boolean;
        avatarPath?: string;
        error?: string;
    }>;
    /**
     * Remove a custom avatar from a repository
     */
    removeRepositoryAvatar(remoteUrl: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Remove a custom avatar from a clone
     */
    removeCloneAvatar(remoteUrl: string, clonePath: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get the URL/data for an avatar
     */
    getAvatarUrl(avatarPath: string): Promise<string | null>;
    /**
     * Clean up stale repositories (ones that no longer exist or have been renamed)
     * This can be called periodically or when issues are detected
     */
    cleanupStaleRepositories(): Promise<{
        removed: string[];
        updated: string[];
    }>;
}
/**
 * Register IPC handlers for repository operations
 */
export declare function registerRepositoryHandlers(): void;
//# sourceMappingURL=RepositoryApiEventHandler.d.ts.map