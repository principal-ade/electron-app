/**
 * Validation system exports
 */
// Re-export validation enums (which are values)
export { ValidationTool, ValidationCategory, ValidationConfigSource, ValidationSeverity, ValidationStatus, ValidationViewMode, ValidationGroupBy, } from './types';
// Re-export validation utilities functions
export { getValidationColor, getCategoryColor, getValidationPriority, getSeverityLevel, getSeverityColor, validationToHighlightLayer, createSummaryHighlightLayer, getCoverageColor, coverageToHighlightLayer, createValidationLayer, validationLayerToHighlight, } from './layer-utils';
