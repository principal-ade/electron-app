import { FileTree } from '@principal-ai/repository-abstraction';
export interface KnipAnalysisResult {
    files: string[];
    issues: {
        file: string;
        type: 'exports' | 'dependencies' | 'devDependencies' | 'unlisted' | 'files';
        symbol?: string;
        severity?: 'error' | 'warning';
    }[];
    dependencies: {
        unused: string[];
        unlisted: string[];
    };
    exports: {
        unused: Array<{
            file: string;
            symbols: string[];
        }>;
    };
}
export interface CleanupSuggestion {
    type: 'remove-export' | 'remove-dependency' | 'remove-file' | 'add-dependency';
    description: string;
    file: string;
    line?: number;
    autoFixAvailable: boolean;
    impact: 'low' | 'medium' | 'high';
    command?: string;
}
export declare class KnipIntegrationService {
    private fileTree;
    private knipAvailable;
    constructor();
    /**
     * Check if Knip is installed in the project or globally
     */
    private checkKnipAvailability;
    /**
     * Perform basic unused code analysis without Knip
     * This provides immediate value without requiring installation
     */
    performBasicAnalysis(fileTree: FileTree): Promise<CleanupSuggestion[]>;
    /**
     * Run full Knip analysis if available
     */
    performFullAnalysis(projectPath: string): Promise<KnipAnalysisResult | null>;
    /**
     * Generate Knip configuration based on project structure
     */
    generateKnipConfig(_fileTree: FileTree): Promise<Record<string, unknown>>;
    /**
     * Provide installation guide for Knip
     */
    getInstallationGuide(): string;
    /**
     * Convert Knip results to cleanup suggestions
     */
    convertToSuggestions(knipResult: KnipAnalysisResult): CleanupSuggestion[];
    private findUnreferencedFiles;
    private findObviousUnusedDependencies;
    private findDuplicateDependencies;
    private detectEntryPoints;
    private detectTestPatterns;
    private detectBuildTools;
    private executeCommand;
}
export declare const knipIntegration: KnipIntegrationService;
//# sourceMappingURL=KnipIntegrationService.d.ts.map