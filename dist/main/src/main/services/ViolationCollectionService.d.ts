/**
 * Main process service for collecting TypeScript and ESLint violations
 *
 * This runs in the main process where we have access to Node.js APIs
 * and the TypeScript/ESLint packages.
 */
export interface CodeViolation {
    type: 'typescript' | 'eslint';
    severity: 'error' | 'warning' | 'info';
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
    violations: CodeViolation[];
    errorCount: number;
    warningCount: number;
    infoCount: number;
}
export interface PackageInfo {
    name: string;
    path: string;
    absolutePath?: string;
    hasTypescript: boolean;
    hasEslint: boolean;
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
export interface ViolationCollectionResult {
    timestamp: number;
    rootPath: string;
    packages: PackageViolations[];
    totalPackages: number;
    totalFiles: number;
    totalViolations: number;
    totalErrors: number;
    totalWarnings: number;
    totalInfo: number;
    collectionTime: number;
}
export declare class ViolationCollectionService {
    private tsConfigCache;
    private cliInitialized;
    /**
     * Initialize the electron-cli-bridge
     */
    private ensureCLIInitialized;
    /**
     * Collect violations for packages in a repository
     */
    collectViolations(rootPath: string, packages: PackageInfo[], options?: {
        includeTypescript?: boolean;
        includeEslint?: boolean;
        maxFiles?: number;
    }): Promise<ViolationCollectionResult>;
    /**
     * Get files to process
     */
    private getFilesToProcess;
    /**
     * Collect TypeScript violations
     */
    private collectTypeScriptViolations;
    /**
     * Collect ESLint violations using electron-cli-bridge
     */
    private collectESLintViolations;
    /**
     * Clear caches
     */
    clearCache(rootPath?: string): void;
}
export declare const violationCollectionService: ViolationCollectionService;
//# sourceMappingURL=ViolationCollectionService.d.ts.map