/**
 * Local validation types for the electron renderer
 * This is a simplified version of the validation system from core
 */
export const ValidationTool = {
    ESLint: 'eslint',
    TypeScript: 'typescript',
    Knip: 'knip',
    Jest: 'jest'
};
export const ValidationCategory = {
    CodeQuality: 'code-quality',
    TypeSafety: 'type-safety',
    UnusedCode: 'unused-code',
    Testing: 'testing'
};
export const ValidationSeverity = {
    Error: 'error',
    Warning: 'warning',
    Info: 'info'
};
export const ValidationStatus = {
    Success: 'success',
    Warning: 'warning',
    Error: 'error'
};
// Utility functions
export function getSeverityColor(severity) {
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
export function getCategoryColor(category) {
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
