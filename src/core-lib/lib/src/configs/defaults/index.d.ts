/**
 * Default configurations - Fallback when configs can't be fetched
 * These match the structure of configs from Voyager-Guides
 */
import { ScanFilterConfig, DefaultLayersConfig, LayerTemplateConfig, ConfigType } from '../types';
export declare const DEFAULT_SCAN_FILTERS: ScanFilterConfig;
export declare const DEFAULT_LAYERS: DefaultLayersConfig;
export declare const DEFAULT_LAYER_TEMPLATES: LayerTemplateConfig;
/**
 * Get default configuration by type
 */
export declare function getDefaultConfig(configType: ConfigType): unknown;
//# sourceMappingURL=index.d.ts.map