import { PackageValidation, ValidationRunRequest, ValidationRunResponse, ValidationResult, ValidationTemplate, DetectedTool } from '../../shared/tool-validation-types';
export declare class ValidationService {
    private validations;
    /**
     * Load configured validations for a workspace
     * This only loads validations that the user has explicitly configured
     */
    loadConfiguredValidations(workspaceRoot: string): Promise<PackageValidation[]>;
    /**
     * Detect available validations for a workspace (for configuration UI)
     * This detects all possible validations but doesn't load them
     */
    detectAvailableValidations(workspaceRoot: string, useAI?: boolean): Promise<{
        packagePath: string;
        packageName: string;
        availableTemplates: ValidationTemplate[];
        detectedTools: DetectedTool[];
    }[]>;
    /**
     * Get all validations
     */
    getValidations(): PackageValidation[];
    /**
     * Get validations for a specific directory
     */
    getValidationsForDirectory(directory: string): PackageValidation[];
    /**
     * Run validation actions
     */
    runValidation(request: ValidationRunRequest): Promise<ValidationRunResponse>;
    /**
     * Find packages in workspace
     */
    findPackages(workspaceRoot: string): Promise<Array<{
        path: string;
        name: string;
        hasPackageJson: boolean;
    }>>;
    /**
     * Test run a single validation action without persisting results
     */
    testRunAction(packagePath: string, templateId: string, actionId: string, detectedTool: DetectedTool, workingDirectory: string, selectedLayers?: string[]): Promise<ValidationResult>;
    /**
     * Find action in template
     */
    private findAction;
}
export declare const validationService: ValidationService;
//# sourceMappingURL=ValidationService.d.ts.map