import picomatch from 'picomatch';
/**
 * Create a reusable pattern matcher function
 */
export function createPatternMatcher(pattern, options = {}) {
    const opts = {
        bash: true,
        dot: false,
        ...options,
    };
    return picomatch(pattern, opts);
}
/**
 * Test if a single path matches a pattern
 */
export function matchesPattern(path, pattern, options) {
    try {
        const matcher = createPatternMatcher(pattern, options);
        return matcher(path);
    }
    catch {
        return false;
    }
}
/**
 * Test if a path matches any of the given patterns
 */
export function matchesAnyPattern(path, patterns, options) {
    return patterns.some(pattern => matchesPattern(path, pattern, options));
}
/**
 * Test multiple patterns against multiple paths
 * Useful for validating pattern configurations
 */
export function testPatterns(patterns, paths, options) {
    return patterns.map(pattern => {
        try {
            const matcher = createPatternMatcher(pattern, options);
            const matches = paths.filter(path => matcher(path));
            return {
                pattern,
                matches,
                matchCount: matches.length,
                isValid: true,
            };
        }
        catch (error) {
            return {
                pattern,
                matches: [],
                matchCount: 0,
                isValid: false,
                error: error instanceof Error ? error.message : 'Invalid pattern',
            };
        }
    });
}
/**
 * Get all paths from a pattern group that match
 */
export function getMatchingPaths(patterns, paths, options) {
    const matchedPaths = new Set();
    for (const pattern of patterns) {
        try {
            const matcher = createPatternMatcher(pattern, options);
            for (const path of paths) {
                if (matcher(path)) {
                    matchedPaths.add(path);
                }
            }
        }
        catch {
            // Skip invalid patterns
        }
    }
    return Array.from(matchedPaths);
}
/**
 * Cache for pattern matchers to improve performance
 * Used internally by classes that need to match patterns repeatedly
 */
export class PatternMatcherCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.options = {
            bash: true,
            dot: false,
            ...options,
        };
    }
    getOrCreate(pattern) {
        let matcher = this.cache.get(pattern);
        if (!matcher) {
            matcher = createPatternMatcher(pattern, this.options);
            this.cache.set(pattern, matcher);
        }
        return matcher;
    }
    clear() {
        this.cache.clear();
    }
}
//# sourceMappingURL=PatternMatcher.js.map