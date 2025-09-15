/**
 * Storage adapter interface for persisting search indexes across platforms
 */
import { type IndexMetadata, type SerializedIndexData } from './types';
export interface SearchStorageAdapter {
    /**
     * Save index data to persistent storage
     */
    saveIndex(key: string, data: SerializedIndexData): Promise<void>;
    /**
     * Load index data from persistent storage
     */
    loadIndex(key: string): Promise<SerializedIndexData | null>;
    /**
     * Delete index data from persistent storage
     */
    deleteIndex(key: string): Promise<void>;
    /**
     * Check if index exists in storage
     */
    hasIndex(key: string): Promise<boolean>;
    /**
     * Get index metadata without loading the full index
     */
    getIndexMetadata(key: string): Promise<IndexMetadata | null>;
}
//# sourceMappingURL=StorageAdapter.d.ts.map