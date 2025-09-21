/**
 * EventQueue - Serializes operations per key to prevent race conditions
 *
 * This class ensures that operations for the same key (e.g., session ID)
 * are executed sequentially, preventing concurrent writes that could lead
 * to data loss or corruption.
 */
export class EventQueue {
  private queues: Map<string, Promise<void>> = new Map();
  private pendingCounts: Map<string, number> = new Map();

  /**
   * Enqueue an operation for a specific key
   * Operations for the same key will be executed sequentially
   * Operations for different keys can execute in parallel
   */
  async enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Get the current queue for this key (or Promise.resolve() if none exists)
    const currentQueue = this.queues.get(key) || Promise.resolve();

    // Increment pending count for this key
    const currentCount = this.pendingCounts.get(key) || 0;
    this.pendingCounts.set(key, currentCount + 1);

    // Create new queue entry that waits for the current queue, then executes
    const resultPromise = currentQueue
      .then(() => operation())
      .catch((error) => {
        // Log error but don't stop the queue
        console.error(
          `[EventQueue] Error in queued operation for key ${key}:`,
          error,
        );
        throw error;
      });

    // Create a void promise for queue tracking
    const queuePromise = resultPromise
      .then(() => {})
      .catch(() => {})
      .finally(() => {
        // Decrement pending count
        const count = this.pendingCounts.get(key) || 1;
        if (count <= 1) {
          // No more pending operations, clean up
          this.pendingCounts.delete(key);
          this.queues.delete(key);
        } else {
          this.pendingCounts.set(key, count - 1);
        }
      });

    // Update the queue for this key with the void promise
    this.queues.set(key, queuePromise);

    // Return the result promise
    return resultPromise;
  }

  /**
   * Get the number of pending operations for a key
   */
  getPendingCount(key: string): number {
    return this.pendingCounts.get(key) || 0;
  }

  /**
   * Get total number of keys with pending operations
   */
  getActiveQueueCount(): number {
    return this.queues.size;
  }

  /**
   * Check if a specific key has pending operations
   */
  hasPendingOperations(key: string): boolean {
    return this.queues.has(key);
  }

  /**
   * Wait for all operations for a specific key to complete
   */
  async waitForKey(key: string): Promise<void> {
    const queue = this.queues.get(key);
    if (queue) {
      await queue.catch(() => {
        // Ignore errors, just wait for completion
      });
    }
  }

  /**
   * Wait for all queued operations to complete
   */
  async waitForAll(): Promise<void> {
    const allQueues = Array.from(this.queues.values());
    await Promise.allSettled(allQueues);
  }

  /**
   * Get statistics about the queue
   */
  getStats(): {
    activeQueues: number;
    totalPending: number;
    queueDetails: Array<{ key: string; pending: number }>;
  } {
    const queueDetails = Array.from(this.pendingCounts.entries()).map(
      ([key, count]) => ({
        key,
        pending: count,
      }),
    );

    return {
      activeQueues: this.queues.size,
      totalPending: Array.from(this.pendingCounts.values()).reduce(
        (sum, count) => sum + count,
        0,
      ),
      queueDetails,
    };
  }
}
