/**
 * Local validation types for the electron renderer
 * This is a simplified version of the validation system from core
 */
export declare const ValidationTool: {
    readonly ESLint: "eslint";
    readonly TypeScript: "typescript";
    readonly Knip: "knip";
    readonly Jest: "jest";
};
export type ValidationTool = typeof ValidationTool[keyof typeof ValidationTool];
export declare const ValidationCategory: {
    readonly CodeQuality: "code-quality";
    readonly TypeSafety: "type-safety";
    readonly UnusedCode: "unused-code";
    readonly Testing: "testing";
};
export type ValidationCategory = typeof ValidationCategory[keyof typeof ValidationCategory];
export declare const ValidationSeverity: {
    readonly Error: "error";
    readonly Warning: "warning";
    readonly Info: "info";
};
export type ValidationSeverity = typeof ValidationSeverity[keyof typeof ValidationSeverity];
export declare const ValidationStatus: {
    readonly Success: "success";
    readonly Warning: "warning";
    readonly Error: "error";
};
export type ValidationStatus = typeof ValidationStatus[keyof typeof ValidationStatus];
export interface ValidationIssue {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    severity: ValidationSeverity;
    message: string;
    rule?: string;
    category?: string;
    suggestion?: string;
    documentation?: string;
}
export interface ValidationResult {
    id: string;
    tool: ValidationTool;
    category: ValidationCategory;
    status: ValidationStatus;
    scope: {
        packagePath: string;
        packageName: string;
        filesAnalyzed: {
            total: number;
            included: string[];
            patterns?: string[];
        };
        config?: {
            source: string;
            configPath?: string;
        };
    };
    summary: {
        totalIssues: number;
        bySeverity: {
            errors: number;
            warnings: number;
            info: number;
            suggestions: number;
        };
        filesWithIssues: number;
        totalFilesAnalyzed: number;
        topIssues?: Array<{
            rule: string;
            count: number;
            severity: ValidationSeverity;
        }>;
        duration: number;
        timestamp: Date;
    };
    issues: ValidationIssue[];
    error?: {
        message: string;
        details?: string;
    };
    raw?: any;
}
export interface ValidationRunner {
    run(packagePath: string, packageName: string, options?: any): Promise<ValidationResult>;
    isAvailable(packagePath: string): Promise<boolean>;
    getConfig(packagePath: string): Promise<any>;
    cancel(): void;
}
export declare function getSeverityColor(severity: ValidationSeverity): string;
export declare function getCategoryColor(category: string): string;
//# sourceMappingURL=validation.d.ts.map