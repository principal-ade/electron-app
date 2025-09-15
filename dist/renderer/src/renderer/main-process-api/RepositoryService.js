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
    static async getRepositories() {
        if (window.mainProcess?.repository?.getRepositories) {
            return window.mainProcess.repository.getRepositories();
        }
        console.warn('repository.getRepositories not available');
        return [];
    }
    static async getRepository(remoteUrl) {
        if (window.mainProcess?.repository?.getRepository) {
            return window.mainProcess.repository.getRepository(remoteUrl);
        }
        console.warn('repository.getRepository not available');
        return undefined;
    }
    static async addRepository(params) {
        if (window.mainProcess?.repository?.addRepository) {
            return window.mainProcess.repository.addRepository(params);
        }
        console.warn('repository.addRepository not available');
        throw new Error('repository.addRepository not available');
    }
    static async updateRepository(remoteUrl, updates) {
        if (window.mainProcess?.repository?.updateRepository) {
            return window.mainProcess.repository.updateRepository(remoteUrl, updates);
        }
        console.warn('repository.updateRepository not available');
        return undefined;
    }
    static async updateRepositoryAccess(remoteUrl) {
        if (window.mainProcess?.repository?.updateRepositoryAccess) {
            return window.mainProcess.repository.updateRepositoryAccess(remoteUrl);
        }
        console.warn('repository.updateRepositoryAccess not available');
    }
    static async removeRepository(remoteUrl) {
        if (window.mainProcess?.repository?.removeRepository) {
            return window.mainProcess.repository.removeRepository(remoteUrl);
        }
        console.warn('repository.removeRepository not available');
        return false;
    }
    static async getRecentRepositories(limit) {
        if (window.mainProcess?.repository?.getRecentRepositories) {
            return window.mainProcess.repository.getRecentRepositories(limit);
        }
        console.warn('repository.getRecentRepositories not available');
        return [];
    }
    static async addLocalClone(remoteUrl, localPath) {
        if (window.mainProcess?.repository?.addLocalClone) {
            return window.mainProcess.repository.addLocalClone(remoteUrl, localPath);
        }
        console.warn('repository.addLocalClone not available');
        return undefined;
    }
    static async removeLocalClone(remoteUrl, localPath) {
        if (window.mainProcess?.repository?.removeLocalClone) {
            return window.mainProcess.repository.removeLocalClone(remoteUrl, localPath);
        }
        console.warn('repository.removeLocalClone not available');
        return false;
    }
    static async updateLocalCloneAccess(remoteUrl, localPath) {
        if (window.mainProcess?.repository?.updateLocalCloneAccess) {
            return window.mainProcess.repository.updateLocalCloneAccess(remoteUrl, localPath);
        }
        console.warn('repository.updateLocalCloneAccess not available');
    }
    static async getRepositoryByLocalPath(localPath) {
        if (window.mainProcess?.repository?.getRepositoryByLocalPath) {
            return window.mainProcess.repository.getRepositoryByLocalPath(localPath);
        }
        console.warn('repository.getRepositoryByLocalPath not available');
        return undefined;
    }
    static async getLocalRepositories() {
        if (window.mainProcess?.repository?.getLocalRepositories) {
            return window.mainProcess.repository.getLocalRepositories();
        }
        console.warn('repository.getLocalRepositories not available');
        return [];
    }
    static async refreshRepositoryMetadata(remoteUrl) {
        if (window.mainProcess?.repository?.refreshRepositoryMetadata) {
            return window.mainProcess.repository.refreshRepositoryMetadata(remoteUrl);
        }
        console.warn('repository.refreshRepositoryMetadata not available');
        return undefined;
    }
    static async openInEditor(params) {
        return window.mainProcess.shell.openInEditor(params);
    }
    static async setRepositoryAvatar(remoteUrl, avatarBlob) {
        if (window.mainProcess?.repository?.setRepositoryAvatar) {
            // Convert blob to base64 for IPC transfer
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(avatarBlob);
            });
            return window.mainProcess.repository.setRepositoryAvatar(remoteUrl, base64);
        }
        console.warn('repository.setRepositoryAvatar not available');
        return { success: false, error: 'setRepositoryAvatar not available' };
    }
    static async setCloneAvatar(remoteUrl, clonePath, avatarBlob) {
        if (window.mainProcess?.repository?.setCloneAvatar) {
            // Convert blob to base64 for IPC transfer
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(avatarBlob);
            });
            return window.mainProcess.repository.setCloneAvatar(remoteUrl, clonePath, base64);
        }
        console.warn('repository.setCloneAvatar not available');
        return { success: false, error: 'setCloneAvatar not available' };
    }
    static async removeRepositoryAvatar(remoteUrl) {
        if (window.mainProcess?.repository?.removeRepositoryAvatar) {
            return window.mainProcess.repository.removeRepositoryAvatar(remoteUrl);
        }
        console.warn('repository.removeRepositoryAvatar not available');
        return { success: false, error: 'removeRepositoryAvatar not available' };
    }
    static async removeCloneAvatar(remoteUrl, clonePath) {
        if (window.mainProcess?.repository?.removeCloneAvatar) {
            return window.mainProcess.repository.removeCloneAvatar(remoteUrl, clonePath);
        }
        console.warn('repository.removeCloneAvatar not available');
        return { success: false, error: 'removeCloneAvatar not available' };
    }
    static async getAvatarUrl(avatarPath) {
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
    static async searchGitHubRepositories(query, options) {
        if (window.mainProcess?.repository?.searchGitHubRepositories) {
            return window.mainProcess.repository.searchGitHubRepositories(query, options);
        }
        console.warn('repository.searchGitHubRepositories not available');
        return { items: [], total_count: 0 };
    }
}
;
