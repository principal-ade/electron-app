/**
 * EventQueue - Serializes operations per key to prevent race conditions
 *
 * This class ensures that operations for the same key (e.g., session ID)
 * are executed sequentially, preventing concurrent writes that could lead
 * to data loss or corruption.
 */
export declare class EventQueue {
    private queues;
    private pendingCounts;
    /**
     * Enqueue an operation for a specific key
     * Operations for the same key will be executed sequentially
     * Operations for different keys can execute in parallel
     */
    enqueue<T>(key: string, operation: () => Promise<T>): Promise<T>;
    /**
     * Get the number of pending operations for a key
     */
    getPendingCount(key: string): number;
    /**
     * Get total number of keys with pending operations
     */
    getActiveQueueCount(): number;
    /**
     * Check if a specific key has pending operations
     */
    hasPendingOperations(key: string): boolean;
    /**
     * Wait for all operations for a specific key to complete
     */
    waitForKey(key: string): Promise<void>;
    /**
     * Wait for all queued operations to complete
     */
    waitForAll(): Promise<void>;
    /**
     * Get statistics about the queue
     */
    getStats(): {
        activeQueues: number;
        totalPending: number;
        queueDetails: Array<{
            key: string;
            pending: number;
        }>;
    };
}
//# sourceMappingURL=EventQueue.d.ts.map