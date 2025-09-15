/**
 * Standardized validation system types
 * Integrates with the core layer system for visualization
 */
import { BaseLayer, FileSet } from '@principal-ai/codebase-composition';
export declare enum ValidationTool {
    ESLint = "eslint",
    TypeScript = "typescript",
    Knip = "knip",
    Jest = "jest",
    Vitest = "vitest",
    Prettier = "prettier",
    Stylelint = "stylelint",
    Ruff = "ruff",
    Pylint = "pylint",
    Mypy = "mypy",
    Clippy = "clippy",
    Custom = "custom"
}
export declare enum ValidationCategory {
    CodeQuality = "code-quality",// ESLint, Prettier, Ruff, etc.
    TypeSafety = "type-safety",// TypeScript, Flow, Mypy, etc.
    UnusedCode = "unused-code",// Knip, tree-shaking analysis
    TestCoverage = "test-coverage",// Jest, Vitest, pytest coverage
    Security = "security",// Security scanners, vulnerability checks
    Performance = "performance",// Bundle size, performance analysis
    Accessibility = "accessibility",// a11y checks
    Dependencies = "dependencies",// Outdated, vulnerable, unused deps
    Formatting = "formatting"
}
export declare enum ValidationConfigSource {
    Default = "default",
    Local = "local",
    Custom = "custom"
}
export declare enum ValidationSeverity {
    Error = "error",
    Warning = "warning",
    Info = "info",
    Suggestion = "suggestion"
}
export declare enum ValidationStatus {
    Success = "success",
    Error = "error",
    Partial = "partial"
}
export declare enum ValidationViewMode {
    Issues = "issues",
    Files = "files",
    Summary = "summary"
}
export declare enum ValidationGroupBy {
    File = "file",
    Severity = "severity",
    Rule = "rule",
    Category = "category"
}
export interface ValidationScope {
    packagePath: string;
    packageName: string;
    filesAnalyzed: {
        total: number;
        included: string[];
        excluded?: string[];
        patterns?: string[];
    };
    config?: {
        source: ValidationConfigSource;
        configPath?: string;
        rules?: Record<string, string | number | boolean | object>;
    };
}
export interface ValidationIssue {
    file: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    severity: ValidationSeverity;
    message: string;
    rule?: string;
    category?: string;
    code?: string;
    suggestion?: string;
    documentation?: string;
}
export interface CoverageData {
    file: string;
    lines: {
        total: number;
        covered: number;
        percentage: number;
    };
    statements: {
        total: number;
        covered: number;
        percentage: number;
    };
    branches: {
        total: number;
        covered: number;
        percentage: number;
    };
    functions: {
        total: number;
        covered: number;
        percentage: number;
    };
    lineHits?: Map<number, number>;
    uncoveredRanges?: Array<{
        start: number;
        end: number;
    }>;
}
export interface ValidationSummary {
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
    duration?: number;
    timestamp: Date;
}
export interface ValidationResult {
    id: string;
    tool: ValidationTool;
    category: ValidationCategory;
    status: ValidationStatus;
    scope: ValidationScope;
    summary: ValidationSummary;
    issues: ValidationIssue[];
    coverage?: {
        overall: {
            lines: number;
            statements: number;
            branches: number;
            functions: number;
        };
        files: CoverageData[];
        threshold?: {
            lines?: number;
            statements?: number;
            branches?: number;
            functions?: number;
        };
        belowThreshold?: string[];
    };
    raw?: Record<string, unknown>;
    error?: {
        message: string;
        details?: string;
    };
}
export interface ValidationLayer extends BaseLayer {
    type: 'validation';
    validationData: {
        tool: ValidationTool;
        category: ValidationCategory;
        result: ValidationResult;
        stats: {
            totalIssues: number;
            filesAffected: number;
            severity: {
                errors: number;
                warnings: number;
                info: number;
                suggestions: number;
            };
        };
        affectedFiles: Set<string>;
    };
    derivedFrom: {
        fileSets: FileSet[];
        derivationType: 'aggregation';
        description: string;
    };
}
export interface ValidationUIState {
    activeValidation: ValidationResult | null;
    isRunning: boolean;
    progress?: {
        message: string;
        percent?: number;
    };
    history: ValidationResult[];
    viewMode: ValidationViewMode;
    groupBy: ValidationGroupBy;
    filters: {
        severity: Set<ValidationSeverity>;
        files: Set<string>;
        rules: Set<string>;
        searchQuery: string;
    };
    selectedIssue: ValidationIssue | null;
    hoveredFile: string | null;
}
export interface ValidationRunner {
    run(packagePath: string, packageName: string, options?: {
        configPath?: string;
        includePatterns?: string[];
        excludePatterns?: string[];
    }): Promise<ValidationResult>;
    isAvailable(packagePath: string): Promise<boolean>;
    getConfig(packagePath: string): Promise<Record<string, unknown>>;
    cancel?(): void;
}
export interface ValidationViewProps {
    result: ValidationResult | null;
    isRunning: boolean;
    progress?: {
        message: string;
        percent?: number;
    };
    onRun: () => void;
    onCancel?: () => void;
    onIssueSelect?: (issue: ValidationIssue) => void;
    onFileSelect?: (filePath: string) => void;
    onHighlightChange?: (files: string[]) => void;
}
