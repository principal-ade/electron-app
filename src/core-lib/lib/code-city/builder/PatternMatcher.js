"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternMatcherCache = void 0;
exports.createPatternMatcher = createPatternMatcher;
exports.matchesPattern = matchesPattern;
exports.matchesAnyPattern = matchesAnyPattern;
exports.testPatterns = testPatterns;
exports.getMatchingPaths = getMatchingPaths;
const picomatch_1 = __importDefault(require("picomatch"));
/**
 * Create a reusable pattern matcher function
 */
function createPatternMatcher(pattern, options = {}) {
    const opts = {
        bash: true,
        dot: false,
        ...options,
    };
    return (0, picomatch_1.default)(pattern, opts);
}
/**
 * Test if a single path matches a pattern
 */
function matchesPattern(path, pattern, options) {
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
function matchesAnyPattern(path, patterns, options) {
    return patterns.some(pattern => matchesPattern(path, pattern, options));
}
/**
 * Test multiple patterns against multiple paths
 * Useful for validating pattern configurations
 */
function testPatterns(patterns, paths, options) {
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
function getMatchingPaths(patterns, paths, options) {
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
class PatternMatcherCache {
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
exports.PatternMatcherCache = PatternMatcherCache;
