/**
 * Utilities for converting validation data to highlight layers
 */
import { FileSet } from '@principal-ai/codebase-composition';
import { HighlightLayer } from '../code-city/render/client/drawLayeredBuildings';
import { ValidationLayer, ValidationSeverity, ValidationTool, ValidationCategory, ValidationResult } from './types';
export declare function getValidationColor(tool: ValidationTool): string;
export declare function getCategoryColor(category: ValidationCategory): string;
export declare function getValidationPriority(tool: ValidationTool): number;
export declare function getSeverityLevel(severity: ValidationSeverity): number;
export declare function getSeverityColor(severity: ValidationSeverity): string;
export interface HighlightOptions {
    minSeverity?: ValidationSeverity;
    showOnlyErrors?: boolean;
    useToolColor?: boolean;
    showCounts?: boolean;
}
export declare function validationToHighlightLayer(validation: ValidationLayer, options?: HighlightOptions): HighlightLayer;
export declare function createSummaryHighlightLayer(validations: ValidationLayer[], options?: HighlightOptions): HighlightLayer;
export declare function getCoverageColor(percentage: number): string;
export declare function coverageToHighlightLayer(validation: ValidationLayer, options?: {
    threshold?: number;
    showUncoveredOnly?: boolean;
    showPercentages?: boolean;
}): HighlightLayer;
export declare function createValidationLayer(result: ValidationResult, fileSets: FileSet[]): ValidationLayer;
export declare function validationLayerToHighlight(validation: ValidationLayer, options?: HighlightOptions & {
    threshold?: number;
    showUncoveredOnly?: boolean;
    showPercentages?: boolean;
}): HighlightLayer;
//# sourceMappingURL=layer-utils.d.ts.map