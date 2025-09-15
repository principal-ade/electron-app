/**
 * Default exclusion patterns for file system adapters
 * These directories and files should be excluded from search indexing across all platforms
 */
export const DEFAULT_FILE_EXCLUSIONS = [
    // Dependency directories
    '**/node_modules/**',
    '**/vendor/**',
    '**/venv/**',
    '**/env/**',
    '**/.env/**',
    // Build output directories
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/target/**',
    '**/public/build/**',
    '**/public/dist/**',
    // Framework-specific directories
    '**/.next/**',
    '**/.nuxt/**',
    // Cache directories
    '**/.cache/**',
    '**/coverage/**',
    '**/tmp/**',
    '**/temp/**',
    // Version control and IDE directories
    '**/.git/**',
    '**/.vscode/**',
    '**/.idea/**',
    // Language-specific cache/build directories
    '**/__pycache__/**',
    '**/.pytest_cache/**',
    // Log files and lock files
    '**/logs/**',
    '**/*.log',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
];
/**
 * Utility function to merge user-provided exclusions with defaults
 * This ensures defaults are always applied and can't be overridden
 */
export function mergeExclusions(userExclusions) {
    const userExcludes = userExclusions || [];
    return [...DEFAULT_FILE_EXCLUSIONS, ...userExcludes];
}
/**
 * Create a single exclusion pattern string for tools that need it
 * (like VS Code's findFiles or glob patterns)
 */
export function createExclusionPattern(userExclusions) {
    const allExcludes = mergeExclusions(userExclusions);
    return allExcludes.length === 1 ? allExcludes[0] : `{${allExcludes.join(',')}}`;
}
/**
 * Get default include patterns for markdown files
 */
export function getDefaultIncludePatterns() {
    return ['**/*.{md,markdown}'];
}
/**
 * Create a single include pattern string
 */
export function createIncludePattern(userIncludes) {
    const includePatterns = userIncludes || getDefaultIncludePatterns();
    return includePatterns.length === 1 ? includePatterns[0] : `{${includePatterns.join(',')}}`;
}
