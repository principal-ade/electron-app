/**
 * Core configuration system
 * Provides consistent config loading across all platforms
 */
// Main exports
export { ConfigLoader } from './ConfigLoader';
export { InMemoryConfigAdapter } from './adapters/ConfigFetchAdapter';
export { LocalConfigAdapter } from './adapters/LocalConfigAdapter';
export { OFFICIAL_CONFIG_SOURCE, CONFIG_FILES } from './types';
// Configuration constants
export { SPECKTOR_GITHUB_CONFIG, DEFAULT_CONFIG_OPTIONS, getGitHubConfigUrl, getAllConfigUrls, } from './constants';
// Processor exports
export { ScanFilterProcessor } from './processors/ScanFilterProcessor';
// Note: Use FileSystemFilterLayer from layers/types instead of FilterLayer
// Validator exports
export { ConfigValidator } from './validators/ConfigValidator';
// Default configs
export { DEFAULT_SCAN_FILTERS, DEFAULT_LAYERS, DEFAULT_LAYER_TEMPLATES, getDefaultConfig, } from './defaults';
// Config JSON exports
import universalGitignorePatterns from './local/universal-gitignore-patterns.json';
export { universalGitignorePatterns };
// Note: Example adapters are available in ./adapters/examples/ directory
// but not exported here to avoid platform-specific dependencies in bundles
