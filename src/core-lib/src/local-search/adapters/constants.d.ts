/**
 * Default exclusion patterns for file system adapters
 * These directories and files should be excluded from search indexing across all platforms
 */
export declare const DEFAULT_FILE_EXCLUSIONS: string[];
/**
 * Utility function to merge user-provided exclusions with defaults
 * This ensures defaults are always applied and can't be overridden
 */
export declare function mergeExclusions(userExclusions?: string[]): string[];
/**
 * Create a single exclusion pattern string for tools that need it
 * (like VS Code's findFiles or glob patterns)
 */
export declare function createExclusionPattern(userExclusions?: string[]): string;
/**
 * Get default include patterns for markdown files
 */
export declare function getDefaultIncludePatterns(): string[];
/**
 * Create a single include pattern string
 */
export declare function createIncludePattern(userIncludes?: string[]): string;
//# sourceMappingURL=constants.d.ts.map