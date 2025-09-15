/**
 * Universal gitignore patterns for file tree filtering
 * These patterns are used to exclude common directories that should not be scanned
 */
export declare const universalGitignorePatterns: {
    readonly version: "1.0";
    readonly description: "Universal directory patterns to augment .gitignore files for improved file tree performance";
    readonly enabled: false;
    readonly note: "These are simple directory names that fdir will exclude at ANY level in the tree. Glob patterns are not needed since fdir's exclude() checks directory names at every level during traversal.";
    readonly patterns: {
        readonly dependencies: {
            readonly description: "Package manager dependency directories - highest impact on performance";
            readonly directories: readonly ["node_modules", "vendor", ".pnpm", "bower_components"];
        };
        readonly buildOutputs: {
            readonly description: "Build and compilation output directories";
            readonly directories: readonly ["dist", "build", "out", "target", ".next", ".nuxt", ".output"];
        };
        readonly cache: {
            readonly description: "Cache and temporary directories";
            readonly directories: readonly [".cache", "cache", "tmp", "temp", ".tmp", ".temp"];
        };
        readonly testCoverage: {
            readonly description: "Test coverage and reporting directories";
            readonly directories: readonly ["coverage", ".nyc_output"];
        };
        readonly ideConfig: {
            readonly description: "IDE and editor configuration directories";
            readonly directories: readonly [".idea", ".vscode"];
        };
    };
    readonly excludedPatterns: {
        readonly note: "These patterns from scan-filters.json are NOT included because they require glob matching or are too specific";
        readonly examples: readonly [".git/objects/**", "**/node_modules/**", "fixtures", "*.swp", ".DS_Store"];
    };
    readonly implementation: {
        readonly note: "fdir's exclude() method receives (dirName, dirPath) for each directory during traversal";
        readonly example: "exclude: (dirName, dirPath) => dirName === 'node_modules'";
        readonly behavior: "Will exclude ALL directories with these names at ANY depth in the file tree";
    };
};
//# sourceMappingURL=gitignorePatterns.d.ts.map