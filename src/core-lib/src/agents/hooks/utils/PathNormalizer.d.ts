/**
 * PathNormalizer - Handles path normalization and classification
 * Used by the electron backend to normalize paths with repository context
 */
import { NormalizedPathInfo, RepositoryInfo } from '../types/PathNormalization';
export interface PathNormalizerOptions {
    /**
     * Function to find repository root for a given path
     */
    findRepositoryRoot: (absolutePath: string) => Promise<RepositoryInfo | null>;
    /**
     * User's home directory path (provide from os.homedir() in Node.js environment)
     */
    homeDir?: string;
}
export declare class PathNormalizer {
    private findRepositoryRoot;
    private homeDir;
    constructor(options: PathNormalizerOptions);
    /**
     * Normalize a file path with full context
     */
    normalizePath(filePath: string, workingDirectory: string): Promise<NormalizedPathInfo>;
    /**
     * Normalize multiple paths at once
     */
    normalizePaths(paths: string[], workingDirectory: string): Promise<NormalizedPathInfo[]>;
    /**
     * Classify a path within a repository
     */
    private classifyPathInRepo;
    /**
     * Get system information for a path
     */
    private getSystemInfo;
    /**
     * Format a path for display
     */
    private formatDisplayPath;
    /**
     * Check if a path should be tracked in detail
     * (Some paths like temp files might only need counts)
     */
    shouldTrackInDetail(pathInfo: NormalizedPathInfo): boolean;
}
//# sourceMappingURL=PathNormalizer.d.ts.map