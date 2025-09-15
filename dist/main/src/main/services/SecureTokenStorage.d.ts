/**
 * Secure token storage using Electron's safeStorage API
 * Encrypts tokens using the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
 */
export declare class SecureTokenStorage {
    private static instance;
    private storageFilePath;
    private cache;
    private constructor();
    static getInstance(): SecureTokenStorage;
    /**
     * Store a token securely
     */
    setToken(key: string, token: string, metadata?: any): Promise<void>;
    /**
     * Retrieve a token
     */
    getToken(key: string): Promise<string | null>;
    /**
     * Get token with metadata
     */
    getTokenWithMetadata(key: string): Promise<{
        token: string;
        metadata: any;
    } | null>;
    /**
     * Delete a token
     */
    deleteToken(key: string): Promise<void>;
    /**
     * Check if a token exists
     */
    hasToken(key: string): boolean;
    /**
     * Clear all tokens
     */
    clearAll(): Promise<void>;
    /**
     * Load encrypted tokens from disk
     */
    private loadFromDisk;
    /**
     * Save encrypted tokens to disk
     */
    private saveToDisk;
    /**
     * Migrate from localStorage (one-time migration)
     */
    migrateFromLocalStorage(entries: {
        key: string;
        value: any;
    }[]): Promise<void>;
}
export declare const TOKEN_KEYS: {
    readonly ORBIT_AUTH: "orbit_auth";
    readonly GIT_SYNC_AUTH: "git-sync-auth";
    readonly GITHUB_TOKEN: "github_token";
};
//# sourceMappingURL=SecureTokenStorage.d.ts.map