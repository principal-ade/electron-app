/**
 * ESLint validation runner
 * Implements the ValidationRunner interface for ESLint
 */
import { ViolationsService } from '../../main-process-api/ViolationsService';
import { ValidationTool, ValidationCategory, ValidationStatus, ValidationSeverity } from '../../types/validation';
import * as path from 'path';
export class ESLintRunner {
    abortController;
    async run(packagePath, packageName, options) {
        const startTime = Date.now();
        const resultId = `eslint-${packageName}-${Date.now()}`;
        try {
            // Create abort controller for cancellation
            this.abortController = new AbortController();
            // Determine config source
            const configSource = 'local';
            // Run ESLint via IPC
            const eslintResult = await this.runESLintIPC(packagePath, [], options?.configPath, this.abortController.signal);
            // Parse and convert results
            return this.convertToValidationResult(resultId, packageName, packagePath, [], eslintResult, configSource, options?.configPath, startTime);
        }
        catch (error) {
            return this.createErrorResult(resultId, packageName, packagePath, error, startTime);
        }
        finally {
            this.abortController = undefined;
        }
    }
    async isAvailable(packagePath) {
        // Always return true for now - we'll let the violation collection service handle availability
        return true;
    }
    async getConfig(packagePath) {
        // Config detection will be handled by the main process
        return {};
    }
    cancel() {
        this.abortController?.abort();
    }
    async getFilesToAnalyze(packagePath, options) {
        // File analysis will be handled by the main process
        return [];
    }
    async runESLintIPC(packagePath, files, configPath, signal) {
        // Use the existing violation collection service
        // The main process ViolationCollectionService handles ESLint execution
        const result = await ViolationsService.collect(packagePath, [{
                name: path.basename(packagePath),
                path: packagePath,
                hasTypescript: false, // We only want ESLint
                hasEslint: true
            }], {
            includeTypescript: false,
            includeEslint: true,
            maxFiles: 1000
        });
        if (!result || result.error) {
            throw new Error(result.error || 'ESLint analysis failed');
        }
        // Extract ESLint results from the violation collection result
        const packageResults = result.packages?.[0];
        if (!packageResults) {
            return { results: [] };
        }
        // Convert to ESLint-like format for compatibility
        const eslintResults = {
            results: Array.from(packageResults.fileViolations.values()).map(fileData => ({
                filePath: fileData.filePath,
                messages: fileData.violations
                    .filter(v => v.type === 'eslint')
                    .map(v => ({
                    severity: v.severity === 'error' ? 2 : v.severity === 'warning' ? 1 : 0,
                    message: v.message,
                    ruleId: v.rule,
                    line: v.line,
                    column: v.column,
                    endLine: v.endLine,
                    endColumn: v.endColumn
                }))
            }))
        };
        return eslintResults;
    }
    convertToValidationResult(id, packageName, packagePath, filesAnalyzed, eslintResult, configSource, configPath, startTime) {
        const issues = [];
        const filesWithIssues = new Set();
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfo = 0;
        // Process ESLint results
        for (const fileResult of eslintResult.results || []) {
            const relativePath = path.relative(packagePath, fileResult.filePath);
            for (const message of fileResult.messages || []) {
                const severity = this.convertESLintSeverity(message.severity);
                issues.push({
                    file: relativePath,
                    line: message.line,
                    column: message.column,
                    endLine: message.endLine,
                    endColumn: message.endColumn,
                    severity,
                    message: message.message,
                    rule: message.ruleId,
                    category: this.categorizeRule(message.ruleId),
                    suggestion: message.fix ? 'Auto-fixable' : undefined,
                    documentation: message.ruleId ?
                        `https://eslint.org/docs/rules/${message.ruleId}` :
                        undefined
                });
                filesWithIssues.add(relativePath);
                if (severity === ValidationSeverity.Error)
                    totalErrors++;
                else if (severity === ValidationSeverity.Warning)
                    totalWarnings++;
                else
                    totalInfo++;
            }
        }
        // Calculate top issues
        const ruleCount = new Map();
        for (const issue of issues) {
            if (issue.rule) {
                ruleCount.set(issue.rule, (ruleCount.get(issue.rule) || 0) + 1);
            }
        }
        const topIssues = Array.from(ruleCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([rule, count]) => ({
            rule,
            count,
            severity: issues.find(i => i.rule === rule)?.severity || ValidationSeverity.Warning
        }));
        return {
            id,
            tool: ValidationTool.ESLint,
            category: ValidationCategory.CodeQuality,
            status: totalErrors > 0 ? ValidationStatus.Error : ValidationStatus.Success,
            scope: {
                packagePath,
                packageName,
                filesAnalyzed: {
                    total: filesAnalyzed.length,
                    included: filesAnalyzed,
                    patterns: ['**/*.{js,jsx,ts,tsx,mjs,cjs}']
                },
                config: {
                    source: configSource,
                    configPath
                }
            },
            summary: {
                totalIssues: issues.length,
                bySeverity: {
                    errors: totalErrors,
                    warnings: totalWarnings,
                    info: totalInfo,
                    suggestions: 0
                },
                filesWithIssues: filesWithIssues.size,
                totalFilesAnalyzed: filesAnalyzed.length,
                topIssues,
                duration: Date.now() - startTime,
                timestamp: new Date()
            },
            issues,
            raw: eslintResult
        };
    }
    convertESLintSeverity(eslintSeverity) {
        switch (eslintSeverity) {
            case 2: return ValidationSeverity.Error;
            case 1: return ValidationSeverity.Warning;
            default: return ValidationSeverity.Info;
        }
    }
    categorizeRule(ruleId) {
        if (!ruleId)
            return 'general';
        // Common ESLint rule categories
        if (ruleId.includes('indent') || ruleId.includes('space') || ruleId.includes('semi')) {
            return 'formatting';
        }
        if (ruleId.includes('no-unused') || ruleId.includes('no-undef')) {
            return 'variables';
        }
        if (ruleId.includes('react/') || ruleId.includes('jsx')) {
            return 'react';
        }
        if (ruleId.includes('@typescript-eslint/')) {
            return 'typescript';
        }
        if (ruleId.includes('import/')) {
            return 'imports';
        }
        if (ruleId.includes('security') || ruleId.includes('xss')) {
            return 'security';
        }
        if (ruleId.includes('a11y') || ruleId.includes('accessibility')) {
            return 'accessibility';
        }
        return 'general';
    }
    createEmptyResult(id, packageName, packagePath, startTime) {
        return {
            id,
            tool: ValidationTool.ESLint,
            category: ValidationCategory.CodeQuality,
            status: ValidationStatus.Success,
            scope: {
                packagePath,
                packageName,
                filesAnalyzed: {
                    total: 0,
                    included: []
                }
            },
            summary: {
                totalIssues: 0,
                bySeverity: {
                    errors: 0,
                    warnings: 0,
                    info: 0,
                    suggestions: 0
                },
                filesWithIssues: 0,
                totalFilesAnalyzed: 0,
                duration: Date.now() - startTime,
                timestamp: new Date()
            },
            issues: []
        };
    }
    createErrorResult(id, packageName, packagePath, error, startTime) {
        return {
            id,
            tool: ValidationTool.ESLint,
            category: ValidationCategory.CodeQuality,
            status: ValidationStatus.Error,
            scope: {
                packagePath,
                packageName,
                filesAnalyzed: {
                    total: 0,
                    included: []
                }
            },
            summary: {
                totalIssues: 0,
                bySeverity: {
                    errors: 0,
                    warnings: 0,
                    info: 0,
                    suggestions: 0
                },
                filesWithIssues: 0,
                totalFilesAnalyzed: 0,
                duration: Date.now() - startTime,
                timestamp: new Date()
            },
            issues: [],
            error: {
                message: error.message || 'Unknown error',
                details: error.stack || JSON.stringify(error)
            }
        };
    }
}
