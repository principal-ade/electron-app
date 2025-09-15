export declare class AvatarStorageService {
    private avatarsDir;
    constructor();
    private ensureDirectoryExists;
    /**
     * Generate a hash-based filename for a repository avatar
     */
    private getRepositoryAvatarFilename;
    /**
     * Generate a hash-based filename for a clone avatar
     */
    private getCloneAvatarFilename;
    /**
     * Save a repository avatar from base64 data
     */
    saveRepositoryAvatar(remoteUrl: string, imageBase64: string): Promise<{
        success: boolean;
        avatarPath?: string;
        error?: string;
    }>;
    /**
     * Save a clone avatar from base64 data
     */
    saveCloneAvatar(clonePath: string, imageBase64: string): Promise<{
        success: boolean;
        avatarPath?: string;
        error?: string;
    }>;
    /**
     * Remove a repository avatar
     */
    removeRepositoryAvatar(remoteUrl: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Remove a clone avatar
     */
    removeCloneAvatar(clonePath: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get the full path to an avatar file, or convert to data URL
     */
    getAvatarUrl(avatarFilename: string): Promise<string | null>;
}
export declare const avatarStorageService: AvatarStorageService;
//# sourceMappingURL=avatarStorageService.d.ts.map