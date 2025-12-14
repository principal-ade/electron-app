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

  static async getRepository(
    remoteUrl: string,
  ): Promise<Repository | undefined> {
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
  }): Promise<Repository> {
    if (window.mainProcess?.repository?.addRepository) {
      return window.mainProcess.repository.addRepository(params);
    }
    console.warn('repository.addRepository not available');
    throw new Error('repository.addRepository not available');
  }

  static async updateRepository(
    remoteUrl: string,
    updates: Partial<Omit<Repository, 'remoteUrl' | 'owner' | 'name'>>,
  ): Promise<Repository | undefined> {
    if (window.mainProcess?.repository?.updateRepository) {
      return window.mainProcess.repository.updateRepository(remoteUrl, updates);
    }
    console.warn('repository.updateRepository not available');
    return undefined;
  }

  static async removeRepository(remoteUrl: string): Promise<boolean> {
    if (window.mainProcess?.repository?.removeRepository) {
      return window.mainProcess.repository.removeRepository(remoteUrl);
    }
    console.warn('repository.removeRepository not available');
    return false;
  }

  static async addLocalClone(
    remoteUrl: string,
    localPath: string,
  ): Promise<Repository | undefined> {
    if (window.mainProcess?.repository?.addLocalClone) {
      return window.mainProcess.repository.addLocalClone(remoteUrl, localPath);
    }
    console.warn('repository.addLocalClone not available');
    return undefined;
  }

  static async removeLocalClone(
    remoteUrl: string,
    localPath: string,
  ): Promise<boolean> {
    if (window.mainProcess?.repository?.removeLocalClone) {
      return window.mainProcess.repository.removeLocalClone(
        remoteUrl,
        localPath,
      );
    }
    console.warn('repository.removeLocalClone not available');
    return false;
  }

  static async getRepositoryByLocalPath(
    localPath: string,
  ): Promise<Repository | undefined> {
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

  static async openInEditor(params: {
    editor: EditorId;
    dir: string;
  }): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.shell.openInEditor(params);
  }
}
