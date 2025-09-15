/**
 * SecretManager - Secure management of repository secrets and environment variables
 *
 * Features:
 * - Encrypts secrets at rest using Electron's safeStorage
 * - Just-in-time creation/destruction of .env files
 * - In-memory secret storage with automatic cleanup
 * - Repository-scoped secret isolation
 * - Audit logging without exposing sensitive values
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
export interface EnvFileOptions {
    mode?: number;
    encoding?: BufferEncoding;
    autoCleanup?: boolean;
}
export declare class SecretManager {
    private static instance;
    private memoryCache;
    private locks;
    private activeEnvFiles;
    private secretsDir;
    private auditLog;
    private cleanupInterval;
    private initPromise;
    private initialized;
    constructor();
    static getInstance(): SecretManager;
    private ensureSecretsDirectory;
    private startCleanupInterval;
    private cleanupStaleLocks;
    private cleanupOrphanedEnvFiles;
    /**
     * Generate a storage key for a repository
     */
    private getStorageKey;
    /**
     * Store secrets for a repository
     */
    storeSecrets(repoId: string, repoPath: string, secrets: RepositorySecrets): Promise<SecretOperationResult>;
    /**
     * Retrieve secrets for a repository
     */
    getSecrets(repoId: string): Promise<RepositorySecrets | null>;
    /**
     * Delete secrets for a repository
     */
    deleteSecrets(repoId: string): Promise<SecretOperationResult>;
    /**
     * Execute a function with environment variables temporarily available
     */
    withEnvFile<T>(repoId: string, workDir: string, callback: () => Promise<T>, options?: EnvFileOptions): Promise<T>;
    /**
     * Create a temporary .env file
     */
    private createEnvFile;
    /**
     * Remove an .env file
     */
    private removeEnvFile;
    /**
     * Acquire a lock for a repository
     */
    private acquireLock;
    /**
     * Release a lock for a repository
     */
    private releaseLock;
    /**
     * Validate repository ID
     */
    private validateRepoId;
    /**
     * Validate secrets object
     */
    private validateSecrets;
    /**
     * Log audit events without exposing sensitive data
     */
    private logAudit;
    /**
     * Get metadata for all stored secrets
     */
    getAllMetadata(): Promise<SecretMetadata[]>;
    /**
     * Clear all in-memory caches
     */
    clearCache(): void;
    /**
     * Cleanup on shutdown
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=SecretManager.d.ts.map