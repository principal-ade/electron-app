export interface PackageInfo {
    name: string;
    path: string;
}
export interface ViolationCollectionOptions {
    includeTypescript?: boolean;
    includeEslint?: boolean;
}
export interface ViolationResult {
    packages: any[];
    timestamp: number;
    totalViolations: number;
    totalErrors: number;
    totalWarnings: number;
}
export declare enum ViolationEvents {
    COLLECT = "violations:collect",
    CLEAR_CACHE = "violations:clearCache"
}
export interface ViolationsAPI {
    collect(sourcePath: string, packages: PackageInfo[], options: ViolationCollectionOptions): Promise<ViolationResult>;
    clearCache(sourcePath?: string): Promise<void>;
}
//# sourceMappingURL=ViolationsAPI.d.ts.map