/**
 * Universal gitignore patterns for file tree filtering
 * These patterns are used to exclude common directories that should not be scanned
 */
export const universalGitignorePatterns = {
    version: "1.0",
    description: "Universal directory patterns to augment .gitignore files for improved file tree performance",
    enabled: false,
    note: "These are simple directory names that fdir will exclude at ANY level in the tree. Glob patterns are not needed since fdir's exclude() checks directory names at every level during traversal.",
    patterns: {
        dependencies: {
            description: "Package manager dependency directories - highest impact on performance",
            directories: ["node_modules", "vendor", ".pnpm", "bower_components"]
        },
        buildOutputs: {
            description: "Build and compilation output directories",
            directories: ["dist", "build", "out", "target", ".next", ".nuxt", ".output"]
        },
        cache: {
            description: "Cache and temporary directories",
            directories: [".cache", "cache", "tmp", "temp", ".tmp", ".temp"]
        },
        testCoverage: {
            description: "Test coverage and reporting directories",
            directories: ["coverage", ".nyc_output"]
        },
        ideConfig: {
            description: "IDE and editor configuration directories",
            directories: [".idea", ".vscode"]
        }
    },
    excludedPatterns: {
        note: "These patterns from scan-filters.json are NOT included because they require glob matching or are too specific",
        examples: [".git/objects/**", "**/node_modules/**", "fixtures", "*.swp", ".DS_Store"]
    },
    implementation: {
        note: "fdir's exclude() method receives (dirName, dirPath) for each directory during traversal",
        example: "exclude: (dirName, dirPath) => dirName === 'node_modules'",
        behavior: "Will exclude ALL directories with these names at ANY depth in the file tree"
    }
};
