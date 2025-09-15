import { ConfiguredValidation, WorkspaceValidationConfig } from '../../../shared/validation-config-types';
import { PackageValidation, ValidationTemplate, DetectedTool } from '../../../shared/tool-validation-types';
export declare class ConfiguredValidationService {
    private static instance;
    private constructor();
    static getInstance(): ConfiguredValidationService;
    /**
     * Get all configured validations for a workspace
     */
    getConfiguredValidations(workspaceRoot: string): Promise<ConfiguredValidation[]>;
    /**
     * Get workspace configuration
     */
    getWorkspaceConfig(workspaceRoot: string): Promise<WorkspaceValidationConfig | null>;
    /**
     * Configure a validation for a package
     */
    configureValidation(workspaceRoot: string, packagePath: string, templateId: string, enabledActions?: string[]): Promise<ConfiguredValidation>;
    /**
     * Remove a configured validation
     */
    removeValidation(workspaceRoot: string, validationId: string): Promise<void>;
    /**
     * Update validation settings
     */
    updateValidation(workspaceRoot: string, validationId: string, updates: Partial<ConfiguredValidation>): Promise<void>;
    /**
     * Update workspace settings
     */
    updateWorkspaceSettings(workspaceRoot: string, settings: Partial<WorkspaceValidationConfig['settings']>): Promise<void>;
    /**
     * Convert detected tools to PackageValidations based on configured validations
     */
    buildValidationsFromConfig(workspaceRoot: string, detectedTools: Map<string, DetectedTool[]>, templates: Map<string, ValidationTemplate>): Promise<PackageValidation[]>;
    /**
     * Check if a validation is configured
     */
    isValidationConfigured(workspaceRoot: string, packagePath: string, templateId: string): Promise<boolean>;
    /**
     * Load store from storage
     */
    private loadStore;
    /**
     * Save store to storage
     */
    private saveStore;
    /**
     * Clear all configurations for a workspace
     */
    clearWorkspaceConfig(workspaceRoot: string): Promise<void>;
    /**
     * Export workspace configuration
     */
    exportWorkspaceConfig(workspaceRoot: string): Promise<WorkspaceValidationConfig | null>;
    /**
     * Import workspace configuration
     */
    importWorkspaceConfig(config: WorkspaceValidationConfig): Promise<void>;
}
export declare const configuredValidationService: ConfiguredValidationService;
//# sourceMappingURL=ConfiguredValidationService.d.ts.map