/**
 * Thread types for ephemeral multi-repository sessions
 *
 * A Thread is a repository-first working session that:
 * - Starts from any repository without pre-registration
 * - Can expand to include additional repositories
 * - Is ephemeral by default (no persistence required)
 * - Can optionally be saved as a workspace for future use
 */

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

/**
 * A repository within a thread
 */
export interface ThreadRepository {
  /** Local filesystem path to the repository */
  path: string;
  /** Display name (extracted from path or AlexandriaEntry) */
  name: string;
  /** When this repository was added to the thread */
  addedAt: number;
  /** Full AlexandriaEntry if available (for rich metadata) */
  alexandriaEntry?: AlexandriaEntry;
}

/**
 * Thread represents an ephemeral multi-repository session
 */
export interface Thread {
  /** Unique thread identifier (format: `thread-${timestamp}`) */
  id: string;
  /** Repositories in this thread (first one is the anchor) */
  repositories: ThreadRepository[];
  /** When the thread was created */
  createdAt: number;
  /** If saved, the workspace ID this thread was persisted to */
  savedAsWorkspaceId?: string;
}

/**
 * Event payload for thread repository changes
 */
export interface ThreadRepositoriesChangedEvent {
  /** Current list of repository paths in the thread */
  repositoryPaths: string[];
  /** The repository that was added (if applicable) */
  addedPath?: string;
  /** The repository that was removed (if applicable) */
  removedPath?: string;
}

/**
 * Options for adding a repository to a thread
 */
export interface AddRepositoryToThreadOptions {
  /** Window ID of the thread window */
  windowId: number;
  /** Path to the repository to add */
  repositoryPath: string;
}

/**
 * Options for removing a repository from a thread
 */
export interface RemoveRepositoryFromThreadOptions {
  /** Window ID of the thread window */
  windowId: number;
  /** Path to the repository to remove */
  repositoryPath: string;
}

/**
 * Result of a thread operation
 */
export interface ThreadOperationResult {
  success: boolean;
  error?: string;
}

/**
 * Generate a unique thread ID
 */
export function generateThreadId(): string {
  return `thread-${Date.now()}`;
}

/**
 * Extract repository name from path
 */
export function extractRepositoryName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || 'Repository';
}

/**
 * Create a ThreadRepository from a path
 */
export function createThreadRepository(
  path: string,
  alexandriaEntry?: AlexandriaEntry,
): ThreadRepository {
  return {
    path,
    name: alexandriaEntry?.name || extractRepositoryName(path),
    addedAt: Date.now(),
    alexandriaEntry,
  };
}
