/**
 * Event Migration Helper
 *
 * Utilities for converting between old NormalizedAgentSessionEvent format
 * and new UniversalAgentSessionEvent/RepoNormalizedUniversalAgentSessionEvent formats.
 *
 * This helper enables gradual migration by providing bidirectional conversion.
 */

import {
  NormalizedAgentSessionEvent,
  UniversalAgentSessionEvent,
  RepoNormalizedUniversalAgentSessionEvent,
  NormalizedPathInfo,
  PathContext,
  FileOperation,
  getFileOperation,
} from '@principal-ai/agent-monitoring';

export class EventMigrationHelper {
  /**
   * Convert old format to universal format
   * Note: This is lossy as the old format has normalized paths, not raw paths
   */
  static toUniversalFormat(
    old: NormalizedAgentSessionEvent
  ): UniversalAgentSessionEvent {
    // Extract raw file paths from normalized paths (best effort)
    const rawFilePaths = old.files?.map(f => f.originalPath || f.absolutePath) || [];

    // Determine operation from tool name
    let operation: FileOperation | undefined;
    if (old.toolName) {
      operation = getFileOperation(old.toolName);
    }

    const universal: UniversalAgentSessionEvent = {
      // Core fields (direct mapping)
      eventType: old.eventType,
      sessionId: old.sessionId,
      workingDirectory: old.workingDirectory,
      timestamp: old.timestamp,
      provider: old.provider,

      // Tool information (direct mapping)
      toolName: old.toolName,
      toolInput: old.toolInput,
      toolOutput: old.toolOutput,

      // Raw file paths (extracted from normalized)
      rawFilePaths: rawFilePaths.length > 0 ? rawFilePaths : undefined,

      // Operation (inferred)
      operation,

      // Event data
      data: old.data,

      // Original raw data
      raw: old.raw,

      // Optional fields
      transcriptPath: old.transcriptPath,
    };

    return universal;
  }

  /**
   * Convert universal format back to old normalized format
   * Note: This requires path normalization to have been done
   */
  static fromUniversalFormat(
    universal: UniversalAgentSessionEvent | RepoNormalizedUniversalAgentSessionEvent
  ): NormalizedAgentSessionEvent {
    // Check if this is already repo-normalized
    const isRepoNormalized = 'files' in universal && !('rawFilePaths' in universal);

    let files: NormalizedPathInfo[] | undefined;

    if (isRepoNormalized) {
      // Already has normalized files
      const repoNormalized = universal as RepoNormalizedUniversalAgentSessionEvent;
      files = repoNormalized.files;
    } else {
      // Create minimal normalized path info from raw paths
      const rawPaths = (universal as UniversalAgentSessionEvent).rawFilePaths || [];
      if (rawPaths.length > 0) {
        files = rawPaths.map(path => ({
          originalPath: path,
          absolutePath: path, // Can't determine without normalization
          displayPath: path,
          context: PathContext.USER_FILE, // Default context when we can't determine
        }));
      }
    }

    const normalized: NormalizedAgentSessionEvent = {
      // Core fields
      eventType: universal.eventType,
      sessionId: universal.sessionId,
      workingDirectory: universal.workingDirectory,
      timestamp: universal.timestamp,
      provider: universal.provider,

      // Tool information
      toolName: universal.toolName,
      toolInput: universal.toolInput,
      toolOutput: universal.toolOutput,

      // Normalized paths
      files,

      // Event data
      data: universal.data,

      // Raw data
      raw: universal.raw,

      // Optional fields
      transcriptPath: universal.transcriptPath,
    };

    // Add normalizedWorkingDirectory if available
    if (isRepoNormalized) {
      const repoNormalized = universal as RepoNormalizedUniversalAgentSessionEvent;
      if (repoNormalized.normalizedWorkingDirectory) {
        normalized.normalizedWorkingDirectory = repoNormalized.normalizedWorkingDirectory;
      }
    }

    return normalized;
  }

  /**
   * Convert a repo-normalized event to old format with full path information
   */
  static fromRepoNormalizedFormat(
    repoNormalized: RepoNormalizedUniversalAgentSessionEvent
  ): NormalizedAgentSessionEvent {
    // Convert new NormalizedPathInfo to old format
    const files = repoNormalized.files?.map(file => {
      // Determine context based on repository info
      let context = PathContext.USER_FILE;
      if (file.repository) {
        context = PathContext.REPO_FILE;
      } else if (file.absolutePath?.includes('/tmp/') || file.absolutePath?.includes('\\Temp\\')) {
        context = PathContext.TEMP_FILE;
      } else if (file.absolutePath?.includes('node_modules')) {
        context = PathContext.SYSTEM_FILE;
      }

      const normalizedPath: NormalizedPathInfo = {
        originalPath: file.originalPath,
        absolutePath: file.absolutePath,
        displayPath: file.displayPath,
        context,
        repository: file.repository,
      };

      return normalizedPath;
    });

    return {
      eventType: repoNormalized.eventType,
      sessionId: repoNormalized.sessionId,
      workingDirectory: repoNormalized.workingDirectory,
      normalizedWorkingDirectory: repoNormalized.normalizedWorkingDirectory,
      timestamp: repoNormalized.timestamp,
      provider: repoNormalized.provider,
      toolName: repoNormalized.toolName,
      toolInput: repoNormalized.toolInput,
      toolOutput: repoNormalized.toolOutput,
      files,
      data: repoNormalized.data,
      raw: repoNormalized.raw,
      transcriptPath: repoNormalized.transcriptPath,
    };
  }

  /**
   * Check if an event is in the old format
   */
  static isOldFormat(event: any): event is NormalizedAgentSessionEvent {
    return (
      event &&
      typeof event === 'object' &&
      'eventType' in event &&
      'sessionId' in event &&
      'provider' in event &&
      ('files' in event || !('rawFilePaths' in event)) &&
      !('normalizedWorkingDirectory' in event && 'files' in event && !('rawFilePaths' in event))
    );
  }

  /**
   * Check if an event is in the universal format
   */
  static isUniversalFormat(event: any): event is UniversalAgentSessionEvent {
    return (
      event &&
      typeof event === 'object' &&
      'eventType' in event &&
      'sessionId' in event &&
      'provider' in event &&
      'rawFilePaths' in event
    );
  }

  /**
   * Check if an event is in the repo-normalized format
   */
  static isRepoNormalizedFormat(event: any): event is RepoNormalizedUniversalAgentSessionEvent {
    return (
      event &&
      typeof event === 'object' &&
      'eventType' in event &&
      'sessionId' in event &&
      'provider' in event &&
      'files' in event &&
      !('rawFilePaths' in event) &&
      ('normalizedWorkingDirectory' in event || event.files?.some((f: any) => f.repository))
    );
  }

  /**
   * Convert any event format to the old format (for UI compatibility)
   */
  static ensureOldFormat(event: any): NormalizedAgentSessionEvent {
    if (this.isOldFormat(event)) {
      return event;
    } else if (this.isRepoNormalizedFormat(event)) {
      return this.fromRepoNormalizedFormat(event);
    } else if (this.isUniversalFormat(event)) {
      return this.fromUniversalFormat(event);
    } else {
      throw new Error('Unknown event format');
    }
  }

  /**
   * Batch convert events to old format
   */
  static batchToOldFormat(
    events: Array<NormalizedAgentSessionEvent | UniversalAgentSessionEvent | RepoNormalizedUniversalAgentSessionEvent>
  ): NormalizedAgentSessionEvent[] {
    return events.map(event => this.ensureOldFormat(event));
  }

  /**
   * Create a compatibility adapter for gradual migration
   */
  static createCompatibilityAdapter() {
    return {
      /**
       * Wrap a function that expects old format
       */
      wrapOldFormatConsumer<T>(
        fn: (event: NormalizedAgentSessionEvent) => T
      ): (event: any) => T {
        return (event: any) => {
          const oldFormat = EventMigrationHelper.ensureOldFormat(event);
          return fn(oldFormat);
        };
      },

      /**
       * Wrap a function that produces old format
       */
      wrapOldFormatProducer<T extends any[]>(
        fn: (...args: T) => NormalizedAgentSessionEvent
      ): (...args: T) => UniversalAgentSessionEvent {
        return (...args: T) => {
          const oldFormat = fn(...args);
          return EventMigrationHelper.toUniversalFormat(oldFormat);
        };
      },

      /**
       * Create a bidirectional proxy for storage
       */
      createStorageProxy(
        store: {
          get: () => Promise<NormalizedAgentSessionEvent[]>;
          set: (events: NormalizedAgentSessionEvent[]) => Promise<void>;
        }
      ) {
        return {
          async get(): Promise<UniversalAgentSessionEvent[]> {
            const oldEvents = await store.get();
            return oldEvents.map(e => EventMigrationHelper.toUniversalFormat(e));
          },

          async set(events: UniversalAgentSessionEvent[]): Promise<void> {
            const oldEvents = events.map(e => EventMigrationHelper.fromUniversalFormat(e));
            return store.set(oldEvents);
          },
        };
      },
    };
  }

  /**
   * Migrate a stored session data structure
   */
  static migrateSessionData(sessionData: any): any {
    if (!sessionData.events || !Array.isArray(sessionData.events)) {
      return sessionData;
    }

    // Check format of first event
    if (sessionData.events.length === 0) {
      return sessionData;
    }

    const firstEvent = sessionData.events[0];

    // If already in new format, return as-is
    if (this.isUniversalFormat(firstEvent) || this.isRepoNormalizedFormat(firstEvent)) {
      return sessionData;
    }

    // Convert all events to new format
    const migratedEvents = sessionData.events.map((e: NormalizedAgentSessionEvent) =>
      this.toUniversalFormat(e)
    );

    return {
      ...sessionData,
      events: migratedEvents,
      _migrated: true,
      _migrationDate: new Date().toISOString(),
    };
  }
}