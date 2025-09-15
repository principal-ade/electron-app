/**
 * Types for a24z memory coverage analysis
 *
 * Note: The StoredNote type is imported from the a24z-memory package
 * which provides the standard note format.
 */
export type { StoredAnchoredNote } from 'a24z-memory';
/**
 * File coverage information for a24z notes
 */
export interface A24zFileCoverage {
    path: string;
    covered: boolean;
    noteIds: string[];
    noteCount: number;
    tags: string[];
}
/**
 * Directory coverage information for a24z notes
 */
export interface A24zDirectoryCoverage {
    path: string;
    totalFiles: number;
    coveredFiles: number;
    coveragePercentage: number;
    noteCount: number;
    childCoverage: Map<string, A24zDirectoryCoverage>;
    fileCoverage: Map<string, A24zFileCoverage>;
}
/**
 * Overall a24z coverage statistics
 */
export interface A24zCoverageStats {
    totalFiles: number;
    coveredFiles: number;
    uncoveredFiles: number;
    coveragePercentage: number;
    totalNotes: number;
    averageNotesPerFile: number;
    byFileType: Map<string, {
        extension: string;
        totalFiles: number;
        coveredFiles: number;
        coveragePercentage: number;
        noteCount: number;
    }>;
    topTags: Array<{
        tag: string;
        count: number;
    }>;
    hotspots: Array<{
        path: string;
        noteCount: number;
    }>;
    gaps: string[];
}
/**
 * Reverse index mapping file paths to a24z notes
 */
export interface A24zIndex {
    fileToNotes: Map<string, Set<string>>;
    noteToFiles: Map<string, Set<string>>;
    tagToFiles: Map<string, Set<string>>;
}
/**
 * Options for a24z coverage calculation
 */
export interface A24zCoverageOptions {
    /**
     * File patterns to exclude from coverage (glob patterns)
     */
    excludePatterns?: string[];
    /**
     * File patterns to include in coverage (glob patterns)
     * If specified, only these files will be considered
     */
    includePatterns?: string[];
    /**
     * Whether to include directory-level notes in coverage
     */
    includeDirectoryNotes?: boolean;
    /**
     * File extensions to prioritize in gap analysis
     */
    priorityExtensions?: string[];
}
/**
 * A24z coverage report that can be serialized
 */
export interface A24zCoverageReport {
    timestamp: Date;
    repositoryPath: string;
    stats: A24zCoverageStats;
    directoryTree: A24zDirectoryCoverage;
    uncoveredFiles: Array<{
        path: string;
        extension: string;
        size: number;
        priority: 'high' | 'medium' | 'low';
    }>;
    recommendations: string[];
}
