/**
 * Service for analyzing gitignore patterns and their effects
 * Uses bash commands to avoid storing large amounts of data in memory
 */
export interface GitignorePattern {
    pattern: string;
    source: string;
    lineNumber: number;
    isNegated: boolean;
    isDirectory: boolean;
}
export interface PatternAnalysis {
    pattern: GitignorePattern;
    matchedFiles: string[];
    matchCount: number;
    sampleFiles: string[];
    impact: 'low' | 'medium' | 'high';
}
export interface GitignoreFileAnalysis {
    filePath: string;
    relativePath: string;
    patterns: GitignorePattern[];
    totalMatches: number;
    isActive: boolean;
}
export declare class GitignoreAnalysisService {
    private repositoryRoot;
    constructor(repositoryRoot: string);
    /**
     * Get all .gitignore files in the repository
     */
    getGitignoreFiles(): Promise<GitignoreFileAnalysis[]>;
    /**
     * Analyze a specific .gitignore file
     */
    private analyzeGitignoreFile;
    /**
     * Analyze the impact of a specific pattern
     */
    analyzePattern(pattern: GitignorePattern): Promise<PatternAnalysis>;
    /**
     * Get ignored files summary using git commands
     */
    getIgnoredFilesSummary(): Promise<{
        totalIgnored: number;
        byExtension: Record<string, number>;
        topDirectories: Array<{
            path: string;
            count: number;
        }>;
    }>;
}
//# sourceMappingURL=GitignoreAnalysisService.d.ts.map