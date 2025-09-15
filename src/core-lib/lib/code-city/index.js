"use strict";
// Code City module exports
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupsList = exports.GridPositioner = exports.GroupNaming = exports.GroupSelector = exports.CityConfigBuilder = exports.PatternMatcherCache = exports.getMatchingPaths = exports.testPatterns = exports.matchesAnyPattern = exports.matchesPattern = exports.createPatternMatcher = exports.autoFixGridConfig = exports.validateCodebaseViewConfig = exports.shouldShowImportance = exports.getStarCount = exports.calculateImportance = exports.drawDistricts = exports.drawBuildings = exports.RenderMode = exports.clearCanvas = exports.createDrawContext = exports.getFileColorMapping = exports.getDefaultFileColorConfig = exports.createFileColorHighlightLayers = exports.drawLegend = exports.drawGrid = exports.drawLayeredDistricts = exports.drawLayeredBuildings = exports.buildMultiVersionCity = exports.MultiVersionCityBuilder = exports.useCodeCityData = exports.ArchitectureMapHighlightLayers = exports.filterCityDataForMultipleDirectories = exports.filterCityDataForSubdirectory = exports.filterCityDataForSelectiveRender = exports.getFilesFromGitHubTree = exports.mergeWithDefaults = exports.DEFAULT_UI_METADATA = exports.setCellUIMetadata = exports.getCellUIMetadata = exports.setUIMetadata = exports.getUIMetadata = exports.hasUIMetadata = exports.SizingPresets = exports.GridLayoutManager = exports.DEFAULT_IMPORTANCE_LEVELS = exports.getBuildingColor = exports.THEMES = void 0;
var themes_1 = require("./types/themes");
Object.defineProperty(exports, "THEMES", { enumerable: true, get: function () { return themes_1.THEMES; } });
Object.defineProperty(exports, "getBuildingColor", { enumerable: true, get: function () { return themes_1.getBuildingColor; } });
var importanceTypes_1 = require("./types/importanceTypes");
Object.defineProperty(exports, "DEFAULT_IMPORTANCE_LEVELS", { enumerable: true, get: function () { return importanceTypes_1.DEFAULT_IMPORTANCE_LEVELS; } });
// Builder functionality
var builder_1 = require("./builder");
Object.defineProperty(exports, "GridLayoutManager", { enumerable: true, get: function () { return builder_1.GridLayoutManager; } });
Object.defineProperty(exports, "SizingPresets", { enumerable: true, get: function () { return builder_1.SizingPresets; } });
// UI Metadata types and helpers
var ui_metadata_1 = require("./types/ui-metadata");
Object.defineProperty(exports, "hasUIMetadata", { enumerable: true, get: function () { return ui_metadata_1.hasUIMetadata; } });
Object.defineProperty(exports, "getUIMetadata", { enumerable: true, get: function () { return ui_metadata_1.getUIMetadata; } });
Object.defineProperty(exports, "setUIMetadata", { enumerable: true, get: function () { return ui_metadata_1.setUIMetadata; } });
Object.defineProperty(exports, "getCellUIMetadata", { enumerable: true, get: function () { return ui_metadata_1.getCellUIMetadata; } });
Object.defineProperty(exports, "setCellUIMetadata", { enumerable: true, get: function () { return ui_metadata_1.setCellUIMetadata; } });
Object.defineProperty(exports, "DEFAULT_UI_METADATA", { enumerable: true, get: function () { return ui_metadata_1.DEFAULT_UI_METADATA; } });
Object.defineProperty(exports, "mergeWithDefaults", { enumerable: true, get: function () { return ui_metadata_1.mergeWithDefaults; } });
// Utilities
var FileTreeBuilder_1 = require("./builder/FileTreeBuilder");
Object.defineProperty(exports, "getFilesFromGitHubTree", { enumerable: true, get: function () { return FileTreeBuilder_1.getFilesFromGitHubTree; } });
var cityDataUtils_1 = require("./builder/cityDataUtils");
Object.defineProperty(exports, "filterCityDataForSelectiveRender", { enumerable: true, get: function () { return cityDataUtils_1.filterCityDataForSelectiveRender; } });
Object.defineProperty(exports, "filterCityDataForSubdirectory", { enumerable: true, get: function () { return cityDataUtils_1.filterCityDataForSubdirectory; } });
Object.defineProperty(exports, "filterCityDataForMultipleDirectories", { enumerable: true, get: function () { return cityDataUtils_1.filterCityDataForMultipleDirectories; } });
// React components
var ArchitectureMapHighlightLayers_1 = require("./react/ArchitectureMapHighlightLayers");
Object.defineProperty(exports, "ArchitectureMapHighlightLayers", { enumerable: true, get: function () { return ArchitectureMapHighlightLayers_1.ArchitectureMapHighlightLayers; } });
var useCodeCityData_1 = require("./react/hooks/useCodeCityData");
Object.defineProperty(exports, "useCodeCityData", { enumerable: true, get: function () { return useCodeCityData_1.useCodeCityData; } });
// Multiversion approach
var builder_2 = require("./builder");
Object.defineProperty(exports, "MultiVersionCityBuilder", { enumerable: true, get: function () { return builder_2.MultiVersionCityBuilder; } });
Object.defineProperty(exports, "buildMultiVersionCity", { enumerable: true, get: function () { return builder_2.buildMultiVersionCity; } });
// Client-side rendering
var drawLayeredBuildings_1 = require("./render/client/drawLayeredBuildings");
Object.defineProperty(exports, "drawLayeredBuildings", { enumerable: true, get: function () { return drawLayeredBuildings_1.drawLayeredBuildings; } });
Object.defineProperty(exports, "drawLayeredDistricts", { enumerable: true, get: function () { return drawLayeredBuildings_1.drawLayeredDistricts; } });
Object.defineProperty(exports, "drawGrid", { enumerable: true, get: function () { return drawLayeredBuildings_1.drawGrid; } });
Object.defineProperty(exports, "drawLegend", { enumerable: true, get: function () { return drawLayeredBuildings_1.drawLegend; } });
// File color highlight layers
var fileColorHighlightLayers_1 = require("./utils/fileColorHighlightLayers");
Object.defineProperty(exports, "createFileColorHighlightLayers", { enumerable: true, get: function () { return fileColorHighlightLayers_1.createFileColorHighlightLayers; } });
Object.defineProperty(exports, "getDefaultFileColorConfig", { enumerable: true, get: function () { return fileColorHighlightLayers_1.getDefaultFileColorConfig; } });
Object.defineProperty(exports, "getFileColorMapping", { enumerable: true, get: function () { return fileColorHighlightLayers_1.getFileColorMapping; } });
// Server-side rendering (separate namespace for tree-shaking)
// Note: Only import these in Node.js environments as they depend on canvas
var drawingUtils_1 = require("./render/server/drawingUtils");
Object.defineProperty(exports, "createDrawContext", { enumerable: true, get: function () { return drawingUtils_1.createDrawContext; } });
Object.defineProperty(exports, "clearCanvas", { enumerable: true, get: function () { return drawingUtils_1.clearCanvas; } });
var renderUtils_1 = require("./render/server/renderUtils");
Object.defineProperty(exports, "RenderMode", { enumerable: true, get: function () { return renderUtils_1.RenderMode; } });
Object.defineProperty(exports, "drawBuildings", { enumerable: true, get: function () { return renderUtils_1.drawBuildings; } });
Object.defineProperty(exports, "drawDistricts", { enumerable: true, get: function () { return renderUtils_1.drawDistricts; } });
// Utilities
var importanceUtils_1 = require("./utils/importanceUtils");
Object.defineProperty(exports, "calculateImportance", { enumerable: true, get: function () { return importanceUtils_1.calculateImportance; } });
Object.defineProperty(exports, "getStarCount", { enumerable: true, get: function () { return importanceUtils_1.getStarCount; } });
Object.defineProperty(exports, "shouldShowImportance", { enumerable: true, get: function () { return importanceUtils_1.shouldShowImportance; } });
// Configuration Validation
var GridLayoutConfigValidator_1 = require("./builder/GridLayoutConfigValidator");
Object.defineProperty(exports, "validateCodebaseViewConfig", { enumerable: true, get: function () { return GridLayoutConfigValidator_1.validateCodebaseViewConfig; } });
Object.defineProperty(exports, "autoFixGridConfig", { enumerable: true, get: function () { return GridLayoutConfigValidator_1.autoFixGridConfig; } });
// Pattern Matching Utilities
var PatternMatcher_1 = require("./builder/PatternMatcher");
Object.defineProperty(exports, "createPatternMatcher", { enumerable: true, get: function () { return PatternMatcher_1.createPatternMatcher; } });
Object.defineProperty(exports, "matchesPattern", { enumerable: true, get: function () { return PatternMatcher_1.matchesPattern; } });
Object.defineProperty(exports, "matchesAnyPattern", { enumerable: true, get: function () { return PatternMatcher_1.matchesAnyPattern; } });
Object.defineProperty(exports, "testPatterns", { enumerable: true, get: function () { return PatternMatcher_1.testPatterns; } });
Object.defineProperty(exports, "getMatchingPaths", { enumerable: true, get: function () { return PatternMatcher_1.getMatchingPaths; } });
Object.defineProperty(exports, "PatternMatcherCache", { enumerable: true, get: function () { return PatternMatcher_1.PatternMatcherCache; } });
// Configuration Builder Components
var config_builder_1 = require("./react/config-builder");
Object.defineProperty(exports, "CityConfigBuilder", { enumerable: true, get: function () { return config_builder_1.CityConfigBuilder; } });
Object.defineProperty(exports, "GroupSelector", { enumerable: true, get: function () { return config_builder_1.GroupSelector; } });
Object.defineProperty(exports, "GroupNaming", { enumerable: true, get: function () { return config_builder_1.GroupNaming; } });
Object.defineProperty(exports, "GridPositioner", { enumerable: true, get: function () { return config_builder_1.GridPositioner; } });
Object.defineProperty(exports, "GroupsList", { enumerable: true, get: function () { return config_builder_1.GroupsList; } });
