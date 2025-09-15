import { StorageProvider } from '../types';
import { StorageProviderConfig, StorageStats } from '../../../shared/main-process-api-interfaces/StoreAPI';
/**
 * S3 Backend Configuration
 */
export interface S3ProviderConfig extends StorageProviderConfig {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
    prefix?: string;
}
/**
 * S3 Storage Backend Implementation (Stub)
 *
 * This backend will use AWS S3 or S3-compatible storage for remote persistence.
 * Currently a stub implementation - to be completed in future iterations.
 */
export declare class S3RemoteStorageProvider implements StorageProvider {
    readonly name: string;
    private config;
    private isInitialized;
    constructor(name?: string);
    get isAvailable(): boolean;
    /**
     * Initialize the S3 backend
     */
    initialize(config?: StorageProviderConfig): Promise<void>;
    /**
     * Get a value by key
     */
    get<T = any>(key: string, defaultValue?: T): Promise<T | undefined>;
    /**
     * Set a value by key
     */
    set<T = any>(key: string, value: T): Promise<void>;
    /**
     * Delete a key
     */
    delete(key: string): Promise<void>;
    /**
     * Check if a key exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Clear all data (WARNING: This will delete all objects with the configured prefix)
     */
    clear(): Promise<void>;
    /**
     * Get all keys
     */
    keys(): Promise<string[]>;
    /**
     * Get storage statistics
     */
    getStats(): Promise<StorageStats>;
    /**
     * Close the storage backend
     */
    close(): Promise<void>;
    /**
     * Watch for changes (not typically supported by S3)
     */
    watch?(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
    /**
     * Build the S3 key with prefix
     */
    private buildS3Key;
    /**
     * Create a new S3Backend with specific configuration
     */
    static create(name: string, config: S3ProviderConfig): Promise<S3RemoteStorageProvider>;
}
/**
 * Future implementation notes:
 *
 * Dependencies to add when implementing:
 * - @aws-sdk/client-s3
 * - @aws-sdk/credential-providers (if needed)
 *
 * Features to consider:
 * - Connection pooling
 * - Retry logic with exponential backoff
 * - Compression (gzip) for large objects
 * - Client-side encryption
 * - Multipart upload for large objects
 * - Caching layer (Redis/in-memory) for frequently accessed data
 * - Batch operations for better performance
 * - S3 lifecycle policies for data archival
 * - CloudWatch integration for monitoring
 * - VPC endpoint support for enhanced security
 */ 
//# sourceMappingURL=S3RemoteStorageProvider.d.ts.map