/**
 * Main process service for collecting test coverage using Jest
 *
 * This runs in the main process where we have access to Node.js APIs
 * and can spawn Jest with coverage collection.
 */
export interface FileCoverage {
    path: string;
    relativePath: string;
    statementCoverage: number;
    branchCoverage: number;
    functionCoverage: number;
    lineCoverage: number;
    uncoveredLines: number[];
}
export interface PackageCoverage {
    packageName: string;
    packagePath: string;
    fileCoverage: Map<string, FileCoverage>;
    totalStatements: number;
    coveredStatements: number;
    totalBranches: number;
    coveredBranches: number;
    totalFunctions: number;
    coveredFunctions: number;
    totalLines: number;
    coveredLines: number;
    testsPassed: number;
    testsFailed: number;
    testsSkipped: number;
}
export interface TestCoverageResult {
    timestamp: number;
    rootPath: string;
    packages: PackageCoverage[];
    totalPackages: number;
    totalFiles: number;
    overallCoverage: {
        statements: number;
        branches: number;
        functions: number;
        lines: number;
    };
    testSummary: {
        passed: number;
        failed: number;
        skipped: number;
        total: number;
    };
    collectionTime: number;
}
export declare class TestCoverageService {
    private cliInitialized;
    /**
     * Initialize the electron-cli-bridge
     */
    private ensureCLIInitialized;
    /**
     * Collect test coverage for packages in a repository
     */
    collectCoverage(rootPath: string, packages: Array<{
        name: string;
        path: string;
    }>, options?: {
        watchMode?: boolean;
        updateSnapshot?: boolean;
        bail?: boolean;
        maxWorkers?: number;
    }): Promise<TestCoverageResult>;
    /**
     * Run Jest with coverage for a specific package
     */
    private runJestWithCoverage;
    /**
     * Calculate coverage percentage
     */
    private calculatePercentage;
    /**
     * Calculate package-level coverage totals
     */
    private calculatePackageTotals;
    /**
     * Calculate overall coverage across all packages
     */
    private calculateOverallCoverage;
    /**
     * Cancel running coverage collection for a package
     * Note: With electron-cli-bridge, processes run synchronously so cancellation
     * is not currently supported. This method is kept for API compatibility.
     */
    cancelCoverage(packageName: string): void;
    /**
     * Cancel all running coverage collections
     * Note: With electron-cli-bridge, processes run synchronously so cancellation
     * is not currently supported. This method is kept for API compatibility.
     */
    cancelAllCoverage(): void;
}
export declare const testCoverageService: TestCoverageService;
//# sourceMappingURL=TestCoverageService.d.ts.map