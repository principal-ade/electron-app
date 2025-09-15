/**
 * ConfigValidator - Validates configuration structures
 * Ensures configs match expected schemas
 */
import { ConfigType, ScanFilterConfig, DefaultLayersConfig, LayerTemplateConfig } from '../types';
export declare class ConfigValidator {
    /**
     * Validate a configuration against its schema
     */
    static validate(configType: ConfigType, data: unknown): boolean;
    /**
     * Validate scan filters configuration
     */
    static validateScanFilters(data: unknown): data is ScanFilterConfig;
    /**
     * Validate default layers configuration
     */
    static validateDefaultLayers(data: unknown): data is DefaultLayersConfig;
    /**
     * Validate layer templates configuration
     */
    static validateLayerTemplates(data: unknown): data is LayerTemplateConfig;
    private static validateLayerDefinition;
    private static validateLayerSection;
}
