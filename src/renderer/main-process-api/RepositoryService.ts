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
export class RepositoryService {
  static async getRepositories(): Promise<Repository[]> {
    if (window.mainProcess?.repository?.getRepositories) {
      return window.mainProcess.repository.getRepositories();
    }
    console.warn('repository.getRepositories not available');
    return [];
  }

  static async getRepository(remoteUrl: string): Promise<Repository | undefined> {
    if (window.mainProcess?.repository?.getRepository) {
      return window.mainProcess.repository.getRepository(remoteUrl);
    }
    console.warn('repository.getRepository not available');
    return undefined;
  }

  static async addRepository(params: {
    remoteUrl: string;
    owner: string;
    name: string;
    localPath?: string;
    description?: string;
    avatarUrl?: string;
    metadata?: Repository['metadata'];
  }): Promise<Repository> {
    if (window.mainProcess?.repository?.addRepository) {
      return window.mainProcess.repository.addRepository(params);
    }
    console.warn('repository.addRepository not available');
    throw new Error('repository.addRepository not available');
  }

  static async updateRepository(
    remoteUrl: string,
    updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name'>>
  ): Promise<Repository | undefined> {
    if (window.mainProcess?.repository?.updateRepository) {
      return window.mainProcess.repository.updateRepository(remoteUrl, updates);
    }
    console.warn('repository.updateRepository not available');
    return undefined;
  }

  static async updateRepositoryAccess(remoteUrl: string): Promise<void> {
    if (window.mainProcess?.repository?.updateRepositoryAccess) {
      return window.mainProcess.repository.updateRepositoryAccess(remoteUrl);
    }
    console.warn('repository.updateRepositoryAccess not available');
  }

  static async removeRepository(remoteUrl: string): Promise<boolean> {
    if (window.mainProcess?.repository?.removeRepository) {
      return window.mainProcess.repository.removeRepository(remoteUrl);
    }
    console.warn('repository.removeRepository not available');
    return false;
  }

  static async getRecentRepositories(limit?: number): Promise<Repository[]> {
    if (window.mainProcess?.repository?.getRecentRepositories) {
      return window.mainProcess.repository.getRecentRepositories(limit);
    }
    console.warn('repository.getRecentRepositories not available');
    return [];
  }

  static async addLocalClone(remoteUrl: string, localPath: string): Promise<Repository | undefined> {
    if (window.mainProcess?.repository?.addLocalClone) {
      return window.mainProcess.repository.addLocalClone(remoteUrl, localPath);
    }
    console.warn('repository.addLocalClone not available');
    return undefined;
  }

  static async removeLocalClone(remoteUrl: string, localPath: string): Promise<boolean> {
    if (window.mainProcess?.repository?.removeLocalClone) {
      return window.mainProcess.repository.removeLocalClone(remoteUrl, localPath);
    }
    console.warn('repository.removeLocalClone not available');
    return false;
  }

  static async updateLocalCloneAccess(remoteUrl: string, localPath: string): Promise<void> {
    if (window.mainProcess?.repository?.updateLocalCloneAccess) {
      return window.mainProcess.repository.updateLocalCloneAccess(remoteUrl, localPath);
    }
    console.warn('repository.updateLocalCloneAccess not available');
  }

  static async getRepositoryByLocalPath(localPath: string): Promise<Repository | undefined> {
    if (window.mainProcess?.repository?.getRepositoryByLocalPath) {
      return window.mainProcess.repository.getRepositoryByLocalPath(localPath);
    }
    console.warn('repository.getRepositoryByLocalPath not available');
    return undefined;
  }

  static async getLocalRepositories(): Promise<Repository[]> {
    if (window.mainProcess?.repository?.getLocalRepositories) {
      return window.mainProcess.repository.getLocalRepositories();
    }
    console.warn('repository.getLocalRepositories not available');
    return [];
  }

  static async refreshRepositoryMetadata(remoteUrl: string): Promise<Repository | undefined> {
    if (window.mainProcess?.repository?.refreshRepositoryMetadata) {
      return window.mainProcess.repository.refreshRepositoryMetadata(remoteUrl);
    }
    console.warn('repository.refreshRepositoryMetadata not available');
    return undefined;
  }
  static async openInEditor(params: { editor: EditorId; dir: string }): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.shell.openInEditor(params);
  }

  static async setRepositoryAvatar(remoteUrl: string, avatarBlob: Blob): Promise<{ success: boolean; avatarPath?: string; error?: string }> {
    if (window.mainProcess?.repository?.setRepositoryAvatar) {
      // Convert blob to base64 for IPC transfer
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(avatarBlob);
      });
      return window.mainProcess.repository.setRepositoryAvatar(remoteUrl, base64);
    }
    console.warn('repository.setRepositoryAvatar not available');
    return { success: false, error: 'setRepositoryAvatar not available' };
  }

  static async setCloneAvatar(remoteUrl: string, clonePath: string, avatarBlob: Blob): Promise<{ success: boolean; avatarPath?: string; error?: string }> {
    if (window.mainProcess?.repository?.setCloneAvatar) {
      // Convert blob to base64 for IPC transfer
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(avatarBlob);
      });
      return window.mainProcess.repository.setCloneAvatar(remoteUrl, clonePath, base64);
    }
    console.warn('repository.setCloneAvatar not available');
    return { success: false, error: 'setCloneAvatar not available' };
  }

  static async removeRepositoryAvatar(remoteUrl: string): Promise<{ success: boolean; error?: string }> {
    if (window.mainProcess?.repository?.removeRepositoryAvatar) {
      return window.mainProcess.repository.removeRepositoryAvatar(remoteUrl);
    }
    console.warn('repository.removeRepositoryAvatar not available');
    return { success: false, error: 'removeRepositoryAvatar not available' };
  }

  static async removeCloneAvatar(remoteUrl: string, clonePath: string): Promise<{ success: boolean; error?: string }> {
    if (window.mainProcess?.repository?.removeCloneAvatar) {
      return window.mainProcess.repository.removeCloneAvatar(remoteUrl, clonePath);
    }
    console.warn('repository.removeCloneAvatar not available');
    return { success: false, error: 'removeCloneAvatar not available' };
  }

  static async getAvatarUrl(avatarPath: string): Promise<string | null> {
    if (window.mainProcess?.repository?.getAvatarUrl) {
      return window.mainProcess.repository.getAvatarUrl(avatarPath);
    }
    console.warn('repository.getAvatarUrl not available');
    return null;
  }

  /**
   * Search GitHub repositories
   * @param query - Search query string
   * @param options - Optional search parameters
   * @returns Promise with search results
   */
  static async searchGitHubRepositories(
    query: string, 
    options?: { 
      sort?: 'stars' | 'forks' | 'updated'; 
      order?: 'asc' | 'desc';
      perPage?: number;
    }
  ): Promise<{ 
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
  }> {
    if (window.mainProcess?.repository?.searchGitHubRepositories) {
      return window.mainProcess.repository.searchGitHubRepositories(query, options);
    }
    console.warn('repository.searchGitHubRepositories not available');
    return { items: [], total_count: 0 };
  }
};