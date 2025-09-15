"use strict";
/**
 * Core configuration system
 * Provides consistent config loading across all platforms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.universalGitignorePatterns = exports.getDefaultConfig = exports.DEFAULT_LAYER_TEMPLATES = exports.DEFAULT_LAYERS = exports.DEFAULT_SCAN_FILTERS = exports.ConfigValidator = exports.ScanFilterProcessor = exports.getAllConfigUrls = exports.getGitHubConfigUrl = exports.DEFAULT_CONFIG_OPTIONS = exports.SPECKTOR_GITHUB_CONFIG = exports.CONFIG_FILES = exports.OFFICIAL_CONFIG_SOURCE = exports.LocalConfigAdapter = exports.InMemoryConfigAdapter = exports.ConfigLoader = void 0;
// Main exports
var ConfigLoader_1 = require("./ConfigLoader");
Object.defineProperty(exports, "ConfigLoader", { enumerable: true, get: function () { return ConfigLoader_1.ConfigLoader; } });
var ConfigFetchAdapter_1 = require("./adapters/ConfigFetchAdapter");
Object.defineProperty(exports, "InMemoryConfigAdapter", { enumerable: true, get: function () { return ConfigFetchAdapter_1.InMemoryConfigAdapter; } });
var LocalConfigAdapter_1 = require("./adapters/LocalConfigAdapter");
Object.defineProperty(exports, "LocalConfigAdapter", { enumerable: true, get: function () { return LocalConfigAdapter_1.LocalConfigAdapter; } });
var types_1 = require("./types");
Object.defineProperty(exports, "OFFICIAL_CONFIG_SOURCE", { enumerable: true, get: function () { return types_1.OFFICIAL_CONFIG_SOURCE; } });
Object.defineProperty(exports, "CONFIG_FILES", { enumerable: true, get: function () { return types_1.CONFIG_FILES; } });
// Configuration constants
var constants_1 = require("./constants");
Object.defineProperty(exports, "SPECKTOR_GITHUB_CONFIG", { enumerable: true, get: function () { return constants_1.SPECKTOR_GITHUB_CONFIG; } });
Object.defineProperty(exports, "DEFAULT_CONFIG_OPTIONS", { enumerable: true, get: function () { return constants_1.DEFAULT_CONFIG_OPTIONS; } });
Object.defineProperty(exports, "getGitHubConfigUrl", { enumerable: true, get: function () { return constants_1.getGitHubConfigUrl; } });
Object.defineProperty(exports, "getAllConfigUrls", { enumerable: true, get: function () { return constants_1.getAllConfigUrls; } });
// Processor exports
var ScanFilterProcessor_1 = require("./processors/ScanFilterProcessor");
Object.defineProperty(exports, "ScanFilterProcessor", { enumerable: true, get: function () { return ScanFilterProcessor_1.ScanFilterProcessor; } });
// Note: Use FileSystemFilterLayer from layers/types instead of FilterLayer
// Validator exports
var ConfigValidator_1 = require("./validators/ConfigValidator");
Object.defineProperty(exports, "ConfigValidator", { enumerable: true, get: function () { return ConfigValidator_1.ConfigValidator; } });
// Default configs
var defaults_1 = require("./defaults");
Object.defineProperty(exports, "DEFAULT_SCAN_FILTERS", { enumerable: true, get: function () { return defaults_1.DEFAULT_SCAN_FILTERS; } });
Object.defineProperty(exports, "DEFAULT_LAYERS", { enumerable: true, get: function () { return defaults_1.DEFAULT_LAYERS; } });
Object.defineProperty(exports, "DEFAULT_LAYER_TEMPLATES", { enumerable: true, get: function () { return defaults_1.DEFAULT_LAYER_TEMPLATES; } });
Object.defineProperty(exports, "getDefaultConfig", { enumerable: true, get: function () { return defaults_1.getDefaultConfig; } });
// Config JSON exports
const universal_gitignore_patterns_json_1 = __importDefault(require("./local/universal-gitignore-patterns.json"));
exports.universalGitignorePatterns = universal_gitignore_patterns_json_1.default;
// Note: Example adapters are available in ./adapters/examples/ directory
// but not exported here to avoid platform-specific dependencies in bundles
