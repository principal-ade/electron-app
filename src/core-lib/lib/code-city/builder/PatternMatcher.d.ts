export interface PatternMatchOptions {
    bash?: boolean;
    dot?: boolean;
    nocase?: boolean;
}
export interface PatternTestResult {
    pattern: string;
    matches: string[];
    matchCount: number;
    isValid: boolean;
    error?: string;
}
/**
 * Create a reusable pattern matcher function
 */
export declare function createPatternMatcher(pattern: string, options?: PatternMatchOptions): (path: string) => boolean;
/**
 * Test if a single path matches a pattern
 */
export declare function matchesPattern(path: string, pattern: string, options?: PatternMatchOptions): boolean;
/**
 * Test if a path matches any of the given patterns
 */
export declare function matchesAnyPattern(path: string, patterns: string[], options?: PatternMatchOptions): boolean;
/**
 * Test multiple patterns against multiple paths
 * Useful for validating pattern configurations
 */
export declare function testPatterns(patterns: string[], paths: string[], options?: PatternMatchOptions): PatternTestResult[];
/**
 * Get all paths from a pattern group that match
 */
export declare function getMatchingPaths(patterns: string[], paths: string[], options?: PatternMatchOptions): string[];
/**
 * Cache for pattern matchers to improve performance
 * Used internally by classes that need to match patterns repeatedly
 */
export declare class PatternMatcherCache {
    private cache;
    private options;
    constructor(options?: PatternMatchOptions);
    getOrCreate(pattern: string): (path: string) => boolean;
    clear(): void;
}
