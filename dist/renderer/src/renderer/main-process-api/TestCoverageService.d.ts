import { TestCoverageResult, PackageCoverage, FileCoverage, CoverageCollectionOptions } from '../../shared/main-process-api-interfaces/TestCoverageAPI';
/**
 * Service layer for test coverage functionality
 * ALL window.mainProcess.testCoverage calls MUST be encapsulated here
 */
export declare class TestCoverageService {
    private static cache;
    private static cacheTimeout;
    /**
     * Collect test coverage for specified packages
     */
    static collectCoverage(rootPath: string, packages: Array<{
        name: string;
        path: string;
    }>, options?: CoverageCollectionOptions & {
        useCache?: boolean;
    }): Promise<TestCoverageResult>;
    /**
     * Cancel coverage collection for a specific package
     */
    static cancelCoverage(packageName: string): Promise<void>;
    /**
     * Cancel all running coverage collections
     */
    static cancelAllCoverage(): Promise<void>;
    /**
     * Clear the cache
     */
    static clearCache(): void;
    /**
     * Get coverage summary for a file path
     */
    static getCoverageForFile(result: TestCoverageResult, filePath: string): FileCoverage | null;
    /**
     * Get coverage class for percentage (for styling)
     */
    static getCoverageClass(percentage: number): 'high' | 'medium' | 'low';
    /**
     * Format coverage percentage for display
     */
    static formatCoverage(percentage: number): string;
}
export type { TestCoverageResult, PackageCoverage, FileCoverage, CoverageCollectionOptions, };
//# sourceMappingURL=TestCoverageService.d.ts.map