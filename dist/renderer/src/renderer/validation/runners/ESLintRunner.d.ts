/**
 * ESLint validation runner
 * Implements the ValidationRunner interface for ESLint
 */
import { ValidationRunner, ValidationResult } from '../../types/validation';
export declare class ESLintRunner implements ValidationRunner {
    private abortController?;
    run(packagePath: string, packageName: string, options?: {
        configPath?: string;
        includePatterns?: string[];
        excludePatterns?: string[];
    }): Promise<ValidationResult>;
    isAvailable(packagePath: string): Promise<boolean>;
    getConfig(packagePath: string): Promise<any>;
    cancel(): void;
    private getFilesToAnalyze;
    private runESLintIPC;
    private convertToValidationResult;
    private convertESLintSeverity;
    private categorizeRule;
    private createEmptyResult;
    private createErrorResult;
}
//# sourceMappingURL=ESLintRunner.d.ts.map