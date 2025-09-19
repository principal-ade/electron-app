/**
 * Test coverage collection types
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
  fileCoverage: Array<[string, FileCoverage]>; // Serialized Map
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

export interface CoverageCollectionOptions {
  watchMode?: boolean;
  updateSnapshot?: boolean;
  bail?: boolean;
  maxWorkers?: number;
}

/**
 * TestCoverageAPI - Handles test coverage collection and management
 */
export interface TestCoverageAPI {
  /**
   * Collect test coverage for specified packages
   */
  collectCoverage(
    rootPath: string,
    packages: Array<{ name: string; path: string }>,
    options?: CoverageCollectionOptions,
  ): Promise<TestCoverageResult>;

  /**
   * Cancel coverage collection for a specific package
   */
  cancelCoverage(packageName: string): Promise<boolean>;

  /**
   * Cancel all running coverage collections
   */
  cancelAllCoverage(): Promise<boolean>;
}
