/**
 * Tool-based validation system types
 *
 * This system separates validation logic from execution context,
 * allowing tools to be validated regardless of where they're installed.
 */
export type ActionCategory = 'quality' | 'correctness' | 'security' | 'performance' | 'build' | 'custom';
export type ToolType = 'linter' | 'compiler' | 'test-runner' | 'formatter' | 'bundler' | 'framework' | 'package-manager' | 'other';
export type PackageManager = 'npm' | 'yarn' | 'pnpm';
export interface ValidationAction {
    id: string;
    name: string;
    command: string;
    description: string;
    severity: 'error' | 'warning' | 'info';
    requiresScript?: string;
    requiresConfig?: string[];
    timeout?: number;
    exitCodes?: {
        success?: number[];
        warning?: number[];
    };
    targetLayers?: string[];
    layerOverrides?: {
        [layerId: string]: string;
    };
}
export interface ActionGroup {
    category: ActionCategory;
    items: ValidationAction[];
}
export interface ToolInfo {
    name: string;
    type: ToolType;
    packageMatchers: string[];
    configFiles?: string[];
    requiredCommands?: string[];
    requiresIgnoreFile?: string;
    documentationUrl?: string;
}
export interface ValidationTemplate {
    id: string;
    name: string;
    description: string;
    tool: ToolInfo;
    actions: ActionGroup[];
    author?: string;
    version?: string;
    tags?: string[];
}
export interface DetectedTool {
    name: string;
    version: string;
    packages: string[];
    configFiles: string[];
    availableScripts: Record<string, string>;
    packageManager: PackageManager;
    packagePath: string;
    hasIgnoreFile?: boolean;
}
export interface PackageValidation {
    id: string;
    packagePath: string;
    templateId: string;
    detectedTool: DetectedTool;
    availableActions: string[];
    selectedLayers?: string[];
    customOverrides?: Record<string, string>;
    lastRun?: {
        timestamp: number;
        results: ValidationResult[];
    };
}
export interface ValidationResult {
    actionId: string;
    status: 'success' | 'failure' | 'warning' | 'skipped';
    output?: string;
    error?: string;
    duration?: number;
    timestamp: number;
}
export interface ToolDetectionResult {
    packagePath: string;
    packageName: string;
    detectedTools: DetectedTool[];
    suggestedTemplates: ValidationTemplate[];
}
export interface TemplateMatchCriteria {
    toolName?: string;
    toolType?: ToolType;
    hasConfig?: string[];
    hasScript?: string[];
}
export interface ValidationRunRequest {
    validationId: string;
    actionIds?: string[];
    workingDirectory: string;
    timeout?: number;
}
export interface ValidationRunResponse {
    validationId: string;
    results: ValidationResult[];
    summary: {
        total: number;
        success: number;
        failure: number;
        warning: number;
        skipped: number;
    };
}
//# sourceMappingURL=tool-validation-types.d.ts.map