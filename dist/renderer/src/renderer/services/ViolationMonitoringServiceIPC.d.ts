/**
 * Renderer-side violation monitoring service that uses IPC
 * to communicate with the main process
 */
import { FileTreeSource } from '../types/file-tree-source';
export type ViolationType = 'typescript' | 'eslint';
export type ViolationSeverity = 'error' | 'warning' | 'info';
export interface Violation {
    type: ViolationType;
    severity: ViolationSeverity;
    message: string;
    rule?: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
}
export interface FileViolations {
    filePath: string;
    relativePath: string;
    violations: Violation[];
    errorCount: number;
    warningCount: number;
    infoCount: number;
}
export interface PackageViolations {
    packageName: string;
    packagePath: string;
    absolutePath?: string;
    fileViolations: Map<string, FileViolations>;
    totalFiles: number;
    totalViolations: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
}
export interface ViolationMonitoringResult {
    timestamp: number;
    source: FileTreeSource;
    packages: PackageViolations[];
    totalPackages: number;
    totalFiles: number;
    totalViolations: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    collectionTime: number;
}
export interface MonitoringOptions {
    includeTypescript?: boolean;
    includeEslint?: boolean;
    filePatterns?: string[];
    excludePatterns?: string[];
    maxFilesToProcess?: number;
    useCache?: boolean;
}
declare class ViolationMonitoringServiceIPC {
    private cache;
    private activeMonitoring;
    monitorViolations(source: FileTreeSource, packageLayers: any[], // PackageLayer[] from core
    options?: MonitoringOptions): Promise<ViolationMonitoringResult>;
    /**
     * Cancel monitoring for a source
     * Since the actual monitoring happens in the main process,
     * this just cleans up local state
     */
    cancelMonitoring(sourceId: string): void;
    clearCache(sourceId?: string): Promise<void>;
    toHighlightLayer(result: ViolationMonitoringResult): Map<string, {
        color: string;
        intensity: number;
    }>;
    getFileSummary(result: ViolationMonitoringResult, filePath: string): string | null;
    private emptyResult;
}
export declare const violationMonitoringService: ViolationMonitoringServiceIPC;
export {};
//# sourceMappingURL=ViolationMonitoringServiceIPC.d.ts.map