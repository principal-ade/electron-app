import { TypedMultiStoreWrapper } from '../storage-providers';
/**
 * Initialize the storage system with the new abstraction layer
 */
export declare function initializeStorage(): Promise<void>;
/**
 * Get the typed storage manager instance
 * Ensures storage is initialized before returning
 */
export declare function getTypedStorageManagerInstance(): Promise<TypedMultiStoreWrapper>;
//# sourceMappingURL=initialization.d.ts.map