/**
 * Local validation types for the electron renderer
 * This is a simplified version of the validation system from core
 */

export const ValidationTool = {
  ESLint: 'eslint',
  TypeScript: 'typescript',
  Knip: 'knip',
  Jest: 'jest',
} as const;
export type ValidationTool =
  (typeof ValidationTool)[keyof typeof ValidationTool];

export const ValidationCategory = {
  CodeQuality: 'code-quality',
  TypeSafety: 'type-safety',
  UnusedCode: 'unused-code',
  Testing: 'testing',
} as const;
export type ValidationCategory =
  (typeof ValidationCategory)[keyof typeof ValidationCategory];

export const ValidationSeverity = {
  Error: 'error',
  Warning: 'warning',
  Info: 'info',
} as const;
export type ValidationSeverity =
  (typeof ValidationSeverity)[keyof typeof ValidationSeverity];

export const ValidationStatus = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;
export type ValidationStatus =
  (typeof ValidationStatus)[keyof typeof ValidationStatus];

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
  run(
    packagePath: string,
    packageName: string,
    options?: any,
  ): Promise<ValidationResult>;

  isAvailable(packagePath: string): Promise<boolean>;
  getConfig(packagePath: string): Promise<any>;
  cancel(): void;
}

// Utility functions
export function getSeverityColor(severity: ValidationSeverity): string {
  switch (severity) {
    case ValidationSeverity.Error:
      return '#ef4444';
    case ValidationSeverity.Warning:
      return '#f59e0b';
    case ValidationSeverity.Info:
      return '#3b82f6';
    default:
      return '#6b7280';
  }
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case 'formatting':
      return '#8b5cf6';
    case 'variables':
      return '#10b981';
    case 'react':
      return '#06b6d4';
    case 'typescript':
      return '#3b82f6';
    case 'imports':
      return '#f59e0b';
    case 'security':
      return '#ef4444';
    case 'accessibility':
      return '#84cc16';
    default:
      return '#6b7280';
  }
}
