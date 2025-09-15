export interface KnipAnalysisResult {
    unusedFiles?: string[];
    unusedExports?: Array<{
        file: string;
        export: string;
    }>;
    unusedDependencies?: string[];
    unresolvedImports?: Array<{
        file: string;
        import: string;
    }>;
    error?: string;
    hasIssues?: boolean;
    raw?: string;
}
export declare class KnipAnalysisService {
    static runAnalysis(directoryPath: string): Promise<KnipAnalysisResult>;
    private static checkKnipAvailability;
    private static runKnipAnalysis;
    private static parseKnipOutput;
    private static basicFileAnalysis;
}
//# sourceMappingURL=knipAnalysisService.d.ts.map