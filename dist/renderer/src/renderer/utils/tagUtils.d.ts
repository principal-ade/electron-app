import type { Repository } from '../../shared/types/repository.types';
import type { GitStatus } from '../../shared/main-process-api-interfaces/GitWatcherAPI';
export type TagType = 'auto' | 'manual';
export interface Tag {
    name: string;
    type: TagType;
    color?: string;
}
export declare const AUTO_TAGS: {
    readonly LOCAL: "#local";
    readonly REMOTE: "#remote";
    readonly ACTIVE: "#active";
    readonly STALE: "#stale";
    readonly DIRTY: "#dirty";
    readonly CLEAN: "#clean";
    readonly FORK: "#fork";
    readonly FORK_PARENT: "#fork-parent";
    readonly ARCHIVED: "#archived";
    readonly PRIVATE: "#private";
    readonly PUBLIC: "#public";
};
export declare const TAG_COLORS: Record<string, string>;
/**
 * Generate automatic tags for a repository based on its state
 */
export declare function generateAutoTags(repo: Repository, gitStatuses?: Record<string, GitStatus>): string[];
/**
 * Get color for a tag
 */
export declare function getTagColor(tagName: string): string;
/**
 * Parse tag string to determine if it's an exclusion
 */
export declare function parseTagFilter(tagFilter: string): {
    tag: string;
    exclude: boolean;
};
/**
 * Filter repositories by tags
 */
export declare function filterReposByTags(repos: Repository[], includeTags: string[], excludeTags: string[]): Repository[];
/**
 * Get count of repos for a specific tag
 */
export declare function getRepoCountForTag(repos: Repository[], tag: string): number;
/**
 * Get all unique tags from repositories
 */
export declare function getAllUniqueTags(repos: Repository[]): string[];
//# sourceMappingURL=tagUtils.d.ts.map