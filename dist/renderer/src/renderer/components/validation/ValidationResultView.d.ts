/**
 * Generic validation result view component
 * Displays validation results in a consistent format
 */
import React from 'react';
import { ValidationResult, ValidationIssue } from '../../types/validation';
export declare enum ValidationViewMode {
    Issues = "issues",
    Files = "files"
}
export declare enum ValidationGroupBy {
    File = "file",
    Severity = "severity",
    Rule = "rule",
    Category = "category"
}
interface ValidationResultViewProps {
    result: ValidationResult | null;
    viewMode?: ValidationViewMode;
    groupBy?: ValidationGroupBy;
    onIssueSelect?: (issue: ValidationIssue) => void;
    onFileSelect?: (filePath: string) => void;
}
export declare const ValidationResultView: React.FC<ValidationResultViewProps>;
export {};
//# sourceMappingURL=ValidationResultView.d.ts.map