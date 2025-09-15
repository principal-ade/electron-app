import { EditorId } from '../../shared/types/editor.types';
import type { Repository } from '../../shared/types/repository.types';
/**
 * RepositoryService - Renderer process interface for repository management
 *
 * IMPORTANT ARCHITECTURAL NOTE:
 * All API calls (GitHub, GitLab, etc.) MUST be made from the main process,
 * never directly from the renderer. This ensures:
 * - Better security (API keys/tokens stay in main process)
 * - Rate limiting control
 * - Consistent error handling
 * - Potential caching at the main process level
 *
 * Use IPC through this service class to communicate with the main process.
 */
export declare class RepositoryService {
    static getRepositories(): Promise<Repository[]>;
    static getRepository(remoteUrl: string): Promise<Repository | undefined>;
    static addRepository(params: {
        remoteUrl: string;
        owner: string;
        name: string;
        localPath?: string;
        description?: string;
        avatarUrl?: string;
        metadata?: Repository['metadata'];
    }): Promise<Repository>;
    static updateRepository(remoteUrl: string, updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name'>>): Promise<Repository | undefined>;
    static updateRepositoryAccess(remoteUrl: string): Promise<void>;
    static removeRepository(remoteUrl: string): Promise<boolean>;
    static getRecentRepositories(limit?: number): Promise<Repository[]>;
    static addLocalClone(remoteUrl: string, localPath: string): Promise<Repository | undefined>;
    static removeLocalClone(remoteUrl: string, localPath: string): Promise<boolean>;
    static updateLocalCloneAccess(remoteUrl: string, localPath: string): Promise<void>;
    static getRepositoryByLocalPath(localPath: string): Promise<Repository | undefined>;
    static getLocalRepositories(): Promise<Repository[]>;
    static refreshRepositoryMetadata(remoteUrl: string): Promise<Repository | undefined>;
    static openInEditor(params: {
        editor: EditorId;
        dir: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    static setRepositoryAvatar(remoteUrl: string, avatarBlob: Blob): Promise<{
        success: boolean;
        avatarPath?: string;
        error?: string;
    }>;
    static setCloneAvatar(remoteUrl: string, clonePath: string, avatarBlob: Blob): Promise<{
        success: boolean;
        avatarPath?: string;
        error?: string;
    }>;
    static removeRepositoryAvatar(remoteUrl: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    static removeCloneAvatar(remoteUrl: string, clonePath: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    static getAvatarUrl(avatarPath: string): Promise<string | null>;
    /**
     * Search GitHub repositories
     * @param query - Search query string
     * @param options - Optional search parameters
     * @returns Promise with search results
     */
    static searchGitHubRepositories(query: string, options?: {
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
}
//# sourceMappingURL=RepositoryService.d.ts.map