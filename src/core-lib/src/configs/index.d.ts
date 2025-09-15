/**
 * Core configuration system
 * Provides consistent config loading across all platforms
 */
export { ConfigLoader } from './ConfigLoader';
export type { ConfigLoaderOptions } from './ConfigLoader';
export type { ConfigFetchAdapter, ConfigFetchResult } from './adapters/ConfigFetchAdapter';
export { InMemoryConfigAdapter } from './adapters/ConfigFetchAdapter';
export { LocalConfigAdapter } from './adapters/LocalConfigAdapter';
export type { ScanFilterPattern, ScanFilterWarning, ScanFilterDefinition, ScanFilterConfig, LayerPattern, LayerDefinition, LayerSection, DefaultLayersConfig, LayerTemplateMapping, LayerTemplate, LayerTemplateConfig, ConfigSource, ConfigType, } from './types';
export { OFFICIAL_CONFIG_SOURCE, CONFIG_FILES } from './types';
export { SPECKTOR_GITHUB_CONFIG, DEFAULT_CONFIG_OPTIONS, getGitHubConfigUrl, getAllConfigUrls, } from './constants';
export type { ConfigSourceOptions, ConfigFileName } from './constants';
export { ScanFilterProcessor } from './processors/ScanFilterProcessor';
export type { MandatoryFilter } from './processors/ScanFilterProcessor';
export { ConfigValidator } from './validators/ConfigValidator';
export { DEFAULT_SCAN_FILTERS, DEFAULT_LAYERS, DEFAULT_LAYER_TEMPLATES, getDefaultConfig, } from './defaults';
import universalGitignorePatterns from './local/universal-gitignore-patterns.json';
export { universalGitignorePatterns };
//# sourceMappingURL=index.d.ts.map