/**
 * ScanFilterProcessor - Processes scan filter configs for use by filesystem services
 * Converts config format to runtime format needed by various consumers
 */
import { FileSystemFilterLayer } from '@principal-ai/codebase-composition';
import { ScanFilterConfig, ScanFilterDefinition, ScanFilterPattern } from '../types';
/**
 * Mandatory filter format used by FilesystemService
 */
export interface MandatoryFilter {
    pattern: string;
    type: 'glob' | 'regex' | 'exact';
    reason: string;
    generateWarning: boolean;
}
export declare class ScanFilterProcessor {
    /**
     * Convert scan filter config to mandatory filters for FilesystemService
     * Only returns enabled filters marked as mandatory or performance-critical
     */
    static toMandatoryFilters(config: ScanFilterConfig): MandatoryFilter[];
    /**
     * Convert scan filter config to filter layers for layer system
     */
    static toFilterLayers(config: ScanFilterConfig): FileSystemFilterLayer[];
    /**
     * Get only enabled filters
     */
    static getEnabledFilters(config: ScanFilterConfig): ScanFilterDefinition[];
    /**
     * Get filters by purpose
     */
    static getFiltersByPurpose(config: ScanFilterConfig, purpose: 'performance' | 'security' | 'relevance'): ScanFilterDefinition[];
    /**
     * Merge multiple configs (useful for combining default + custom)
     */
    static mergeConfigs(...configs: ScanFilterConfig[]): ScanFilterConfig;
    /**
     * Apply filter overrides (e.g., from user preferences)
     */
    static applyOverrides(config: ScanFilterConfig, overrides: Record<string, {
        enabled?: boolean;
        patterns?: ScanFilterPattern[];
    }>): ScanFilterConfig;
    /**
     * Expand patterns (e.g., convert simplified patterns to full format)
     */
    static expandPatterns(patterns: string[]): ScanFilterPattern[];
    /**
     * Validate that all required filters are present
     */
    static validateRequiredFilters(config: ScanFilterConfig): {
        valid: boolean;
        missing: string[];
    };
}
//# sourceMappingURL=ScanFilterProcessor.d.ts.map