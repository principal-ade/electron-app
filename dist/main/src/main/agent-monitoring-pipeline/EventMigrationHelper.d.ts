/**
 * Event Migration Helper
 *
 * Utilities for converting between old NormalizedAgentSessionEvent format
 * and new UniversalAgentSessionEvent/RepoNormalizedUniversalAgentSessionEvent formats.
 *
 * This helper enables gradual migration by providing bidirectional conversion.
 */
import { NormalizedAgentSessionEvent, UniversalAgentSessionEvent, RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
export declare class EventMigrationHelper {
    /**
     * Convert old format to universal format
     * Note: This is lossy as the old format has normalized paths, not raw paths
     */
    static toUniversalFormat(old: NormalizedAgentSessionEvent): UniversalAgentSessionEvent;
    /**
     * Convert universal format back to old normalized format
     * Note: This requires path normalization to have been done
     */
    static fromUniversalFormat(universal: UniversalAgentSessionEvent | RepoNormalizedUniversalAgentSessionEvent): NormalizedAgentSessionEvent;
    /**
     * Convert a repo-normalized event to old format with full path information
     */
    static fromRepoNormalizedFormat(repoNormalized: RepoNormalizedUniversalAgentSessionEvent): NormalizedAgentSessionEvent;
    /**
     * Check if an event is in the old format
     */
    static isOldFormat(event: any): event is NormalizedAgentSessionEvent;
    /**
     * Check if an event is in the universal format
     */
    static isUniversalFormat(event: any): event is UniversalAgentSessionEvent;
    /**
     * Check if an event is in the repo-normalized format
     */
    static isRepoNormalizedFormat(event: any): event is RepoNormalizedUniversalAgentSessionEvent;
    /**
     * Convert any event format to the old format (for UI compatibility)
     */
    static ensureOldFormat(event: any): NormalizedAgentSessionEvent;
    /**
     * Batch convert events to old format
     */
    static batchToOldFormat(events: Array<NormalizedAgentSessionEvent | UniversalAgentSessionEvent | RepoNormalizedUniversalAgentSessionEvent>): NormalizedAgentSessionEvent[];
    /**
     * Create a compatibility adapter for gradual migration
     */
    static createCompatibilityAdapter(): {
        /**
         * Wrap a function that expects old format
         */
        wrapOldFormatConsumer<T>(fn: (event: NormalizedAgentSessionEvent) => T): (event: any) => T;
        /**
         * Wrap a function that produces old format
         */
        wrapOldFormatProducer<T extends any[], R>(fn: (...args: T) => NormalizedAgentSessionEvent): (...args: T) => UniversalAgentSessionEvent;
        /**
         * Create a bidirectional proxy for storage
         */
        createStorageProxy(store: {
            get: () => Promise<NormalizedAgentSessionEvent[]>;
            set: (events: NormalizedAgentSessionEvent[]) => Promise<void>;
        }): {
            get(): Promise<UniversalAgentSessionEvent[]>;
            set(events: UniversalAgentSessionEvent[]): Promise<void>;
        };
    };
    /**
     * Migrate a stored session data structure
     */
    static migrateSessionData(sessionData: any): any;
}
//# sourceMappingURL=EventMigrationHelper.d.ts.map