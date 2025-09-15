/**
 * Secrets API Interface
 * Manages encrypted environment variables and secrets for repositories
 */
export interface RepositorySecrets {
    [key: string]: string;
}
export interface SecretMetadata {
    repoId: string;
    repoPath: string;
    createdAt: number;
    updatedAt: number;
    secretCount: number;
}
export interface SecretOperationResult {
    success: boolean;
    error?: string;
    metadata?: SecretMetadata;
}
export interface SecretStoreRequest {
    repoId: string;
    repoPath: string;
    secrets: RepositorySecrets;
}
/**
 * IPC event channels for secrets management
 */
export declare enum SecretsEvents {
    STORE = "secrets:store",
    GET = "secrets:get",
    DELETE = "secrets:delete",
    EXISTS = "secrets:exists",
    LIST = "secrets:list",
    UPDATE = "secrets:update",
    REMOVE_KEYS = "secrets:remove-keys",
    CLEAR_CACHE = "secrets:clear-cache"
}
/**
 * Secrets management API
 */
export interface SecretsAPI {
    /**
     * Store secrets for a repository
     */
    store: (request: SecretStoreRequest) => Promise<SecretOperationResult>;
    /**
     * Get secrets for a repository
     */
    get: (repoId: string) => Promise<RepositorySecrets | null>;
    /**
     * Delete all secrets for a repository
     */
    delete: (repoId: string) => Promise<SecretOperationResult>;
    /**
     * Check if secrets exist for a repository
     */
    exists: (repoId: string) => Promise<boolean>;
    /**
     * List metadata for all stored secrets
     */
    list: () => Promise<SecretMetadata[]>;
    /**
     * Update existing secrets (merge with existing)
     */
    update: (request: SecretStoreRequest) => Promise<SecretOperationResult>;
    /**
     * Remove specific secret keys from a repository
     */
    removeKeys: (repoId: string, keys: string[]) => Promise<SecretOperationResult>;
    /**
     * Clear all in-memory caches
     */
    clearCache: () => Promise<void>;
}
//# sourceMappingURL=SecretsAPI.d.ts.map