/**
 * A24z coverage calculation implementation
 */
import { FileTree } from '@principal-ai/repository-abstraction';
import { StoredAnchoredNote, A24zCoverageStats, A24zIndex, A24zCoverageOptions, A24zCoverageReport } from './types';
/**
 * Build a reverse index from a24z notes to files
 */
export declare function buildA24zIndex(notes: StoredAnchoredNote[]): A24zIndex;
/**
 * Calculate overall coverage statistics
 */
export declare function calculateA24zCoverage(fileTree: FileTree, notes: StoredAnchoredNote[], options?: A24zCoverageOptions): A24zCoverageStats;
/**
 * Generate a complete coverage report
 */
export declare function generateA24zCoverageReport(fileTree: FileTree, notes: StoredAnchoredNote[], repositoryPath: string, options?: A24zCoverageOptions): A24zCoverageReport;
//# sourceMappingURL=coverage.d.ts.map