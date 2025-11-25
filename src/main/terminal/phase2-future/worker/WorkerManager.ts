/**
 * Worker Manager
 *
 * Manages the PTY worker process lifecycle and communication.
 * For now, this is a placeholder that will be replaced with utilityProcess
 * once we have the infrastructure ready. Initially, we'll keep PTY in the main process
 * but use MessageChannels for communication to test the architecture.
 */

import { WorkerControlMessage, WorkerEventMessage } from './types';

export type WorkerEventCallback = (event: WorkerEventMessage) => void;

export class WorkerManager {
  private eventCallbacks: Set<WorkerEventCallback> = new Set();
  private isReady = false;

  constructor() {}

  /**
   * Start the PTY worker process
   * For phase 1, this just marks the worker as ready since we're keeping PTY in main process
   */
  async start(): Promise<void> {
    console.log('[WorkerManager] Phase 1: PTY stays in main process, MessageChannels enabled');
    this.isReady = true;

    // Emit WORKER_READY event
    this.eventCallbacks.forEach((callback) =>
      callback({ type: 'WORKER_READY' }),
    );

    return Promise.resolve();
  }

  /**
   * Stop the PTY worker process
   */
  async stop(): Promise<void> {
    console.log('[WorkerManager] Stopping worker manager');
    this.isReady = false;
    return Promise.resolve();
  }

  /**
   * Register a callback for worker events
   */
  onWorkerEvent(callback: WorkerEventCallback): () => void {
    this.eventCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  /**
   * Emit an event to all callbacks
   */
  emitEvent(event: WorkerEventMessage): void {
    this.eventCallbacks.forEach((callback) => callback(event));
  }

  /**
   * Check if worker is ready
   */
  isWorkerReady(): boolean {
    return this.isReady;
  }
}
