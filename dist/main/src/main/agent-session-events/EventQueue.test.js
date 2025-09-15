import { EventQueue } from './EventQueue';
/**
 * Test suite for EventQueue
 * Demonstrates that the queue prevents race conditions by serializing operations
 */
describe('EventQueue', () => {
    let queue;
    beforeEach(() => {
        queue = new EventQueue();
    });
    test('should serialize operations for the same key', async () => {
        const results = [];
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        // Queue multiple operations for the same key
        const promises = [
            queue.enqueue('session1', async () => {
                await delay(50);
                results.push(1);
                return 1;
            }),
            queue.enqueue('session1', async () => {
                await delay(30);
                results.push(2);
                return 2;
            }),
            queue.enqueue('session1', async () => {
                await delay(10);
                results.push(3);
                return 3;
            })
        ];
        const values = await Promise.all(promises);
        // Results should be in order despite different delays
        expect(results).toEqual([1, 2, 3]);
        expect(values).toEqual([1, 2, 3]);
    });
    test('should allow parallel execution for different keys', async () => {
        const startTime = Date.now();
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        // Queue operations for different keys
        const promises = [
            queue.enqueue('session1', async () => {
                await delay(100);
                return 'session1';
            }),
            queue.enqueue('session2', async () => {
                await delay(100);
                return 'session2';
            }),
            queue.enqueue('session3', async () => {
                await delay(100);
                return 'session3';
            })
        ];
        const results = await Promise.all(promises);
        const elapsed = Date.now() - startTime;
        // Should complete in ~100ms (parallel), not ~300ms (serial)
        expect(elapsed).toBeLessThan(200);
        expect(results).toEqual(['session1', 'session2', 'session3']);
    });
    test('should track pending operations correctly', async () => {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        expect(queue.getPendingCount('session1')).toBe(0);
        expect(queue.hasPendingOperations('session1')).toBe(false);
        // Start an operation
        const promise1 = queue.enqueue('session1', async () => {
            await delay(50);
            return 1;
        });
        expect(queue.getPendingCount('session1')).toBe(1);
        expect(queue.hasPendingOperations('session1')).toBe(true);
        // Add another operation
        const promise2 = queue.enqueue('session1', async () => {
            await delay(50);
            return 2;
        });
        expect(queue.getPendingCount('session1')).toBe(2);
        await Promise.all([promise1, promise2]);
        expect(queue.getPendingCount('session1')).toBe(0);
        expect(queue.hasPendingOperations('session1')).toBe(false);
    });
    test('should handle errors without breaking the queue', async () => {
        const results = [];
        const promises = [
            queue.enqueue('session1', async () => {
                results.push('op1');
                return 'op1';
            }),
            queue.enqueue('session1', async () => {
                results.push('op2-error');
                throw new Error('Test error');
            }).catch(err => err.message),
            queue.enqueue('session1', async () => {
                results.push('op3');
                return 'op3';
            })
        ];
        const values = await Promise.all(promises);
        // All operations should execute despite the error
        expect(results).toEqual(['op1', 'op2-error', 'op3']);
        expect(values).toEqual(['op1', 'Test error', 'op3']);
    });
    test('should provide accurate statistics', async () => {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        // Start operations for multiple sessions
        queue.enqueue('session1', () => delay(100));
        queue.enqueue('session1', () => delay(100));
        queue.enqueue('session2', () => delay(100));
        const stats = queue.getStats();
        expect(stats.activeQueues).toBe(2);
        expect(stats.totalPending).toBe(3);
        expect(stats.queueDetails).toContainEqual({ key: 'session1', pending: 2 });
        expect(stats.queueDetails).toContainEqual({ key: 'session2', pending: 1 });
    });
    test('waitForKey should wait for specific key operations', async () => {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        let completed = false;
        queue.enqueue('session1', async () => {
            await delay(100);
            completed = true;
        });
        expect(completed).toBe(false);
        await queue.waitForKey('session1');
        expect(completed).toBe(true);
    });
    test('waitForAll should wait for all operations', async () => {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        const completed = { session1: false, session2: false };
        queue.enqueue('session1', async () => {
            await delay(50);
            completed.session1 = true;
        });
        queue.enqueue('session2', async () => {
            await delay(100);
            completed.session2 = true;
        });
        expect(completed.session1).toBe(false);
        expect(completed.session2).toBe(false);
        await queue.waitForAll();
        expect(completed.session1).toBe(true);
        expect(completed.session2).toBe(true);
    });
});
/**
 * Example demonstrating the race condition problem and solution
 */
describe('EventQueue - Race Condition Prevention', () => {
    test('demonstrates race condition without queue', async () => {
        // Simulated storage
        let storage = { events: [] };
        // Simulate concurrent writes without queue (RACE CONDITION)
        const unsafeWrite = async (value) => {
            // Read
            const current = storage.events;
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            // Write - may overwrite concurrent changes!
            storage.events = [...current, value];
        };
        // Fire off multiple concurrent writes
        await Promise.all([
            unsafeWrite(1),
            unsafeWrite(2),
            unsafeWrite(3),
            unsafeWrite(4),
            unsafeWrite(5)
        ]);
        // Due to race conditions, we might lose some events
        // This test will likely fail, demonstrating the problem
        console.log('Without queue - events stored:', storage.events.length, 'Expected: 5');
        // Often results in fewer than 5 events due to overwrites
    });
    test('prevents race condition with queue', async () => {
        const queue = new EventQueue();
        // Simulated storage
        let storage = { events: [] };
        // Safe write using queue
        const safeWrite = async (value) => {
            return queue.enqueue('session1', async () => {
                // Read
                const current = storage.events;
                // Simulate processing delay
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                // Write - safe because operations are serialized
                storage.events = [...current, value];
            });
        };
        // Fire off multiple concurrent writes
        await Promise.all([
            safeWrite(1),
            safeWrite(2),
            safeWrite(3),
            safeWrite(4),
            safeWrite(5)
        ]);
        // With queue serialization, all events are preserved
        expect(storage.events).toHaveLength(5);
        expect(storage.events).toEqual([1, 2, 3, 4, 5]);
        console.log('With queue - events stored:', storage.events.length, 'Expected: 5');
    });
});
