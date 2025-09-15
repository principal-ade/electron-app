import { DetectedTool, ValidationTemplate, PackageValidation, ToolDetectionResult, PackageManager } from '../../../shared/tool-validation-types';
export declare class ToolDetectionService {
    /**
     * Scan a package directory and detect available tools
     */
    detectTools(packagePath: string): Promise<ToolDetectionResult>;
    /**
     * Match templates to detected tools
     */
    matchTemplates(detectedTools: DetectedTool[]): ValidationTemplate[];
    /**
     * Generate executable validations for a package
     */
    generateValidations(packagePath: string, templates: ValidationTemplate[], detectedTools: DetectedTool[], currentDirectory: string): PackageValidation[];
    /**
     * Detect package manager for a package
     */
    private detectPackageManager;
    /**
     * Find matching packages based on patterns
     */
    private findMatchingPackages;
    /**
     * Find config files in a directory
     */
    private findConfigFiles;
    /**
     * Detect active layers for a package (simplified version)
     */
    detectActiveLayers(packagePath: string): Promise<string[]>;
    /**
     * Generate context-aware command
     */
    generateCommand(command: string, packageManager: PackageManager, packagePath: string, currentDirectory: string, action?: ValidationAction, selectedLayers?: string[]): Promise<string>;
    /**
     * Read and parse ignore file patterns
     */
    readIgnorePatterns(packagePath: string, ignoreFileName: string): Promise<string[]>;
    /**
     * Check if a file path matches ignore patterns
     */
    private isPathIgnored;
    /**
     * Count files by extension patterns in a directory
     */
    countFilesByExtensions(packagePath: string, extensions: string[], ignorePatterns?: string[]): Promise<number>;
    /**
     * Get layer file information for a package
     */
    getLayerFileInfo(packagePath: string, layers: string[], ignorePatterns?: string[]): Promise<Record<string, {
        extensions: string[];
        count: number;
    }>>;
    /**
     * Get relative path from current to target directory
     */
    private getRelativePath;
    /**
     * Detect tools with AI assistance for better script categorization
     */
    detectToolsWithAI(packagePath: string, useLocalModel?: boolean): Promise<ToolDetectionResult>;
}
export declare const toolDetectionService: ToolDetectionService;
//# sourceMappingURL=ToolDetectionService.d.ts.map