// Code City module exports
export { THEMES, getBuildingColor } from './types/themes';
export { DEFAULT_IMPORTANCE_LEVELS } from './types/importanceTypes';
// Builder functionality
export { GridLayoutManager, SizingPresets, } from './builder';
// UI Metadata types and helpers
export { hasUIMetadata, getUIMetadata, setUIMetadata, getCellUIMetadata, setCellUIMetadata, DEFAULT_UI_METADATA, mergeWithDefaults, } from './types/ui-metadata';
// Utilities
export { getFilesFromGitHubTree } from './builder/FileTreeBuilder';
export { filterCityDataForSelectiveRender, filterCityDataForSubdirectory, filterCityDataForMultipleDirectories, } from './builder/cityDataUtils';
// React components
export { ArchitectureMapHighlightLayers, } from './react/ArchitectureMapHighlightLayers';
export { useCodeCityData, } from './react/hooks/useCodeCityData';
// Multiversion approach
export { MultiVersionCityBuilder, buildMultiVersionCity, } from './builder';
// Client-side rendering
export { drawLayeredBuildings, drawLayeredDistricts, drawGrid, drawLegend, } from './render/client/drawLayeredBuildings';
// File color highlight layers
export { createFileColorHighlightLayers, getDefaultFileColorConfig, getFileColorMapping, } from './utils/fileColorHighlightLayers';
// Server-side rendering (separate namespace for tree-shaking)
// Note: Only import these in Node.js environments as they depend on canvas
export { createDrawContext, clearCanvas } from './render/server/drawingUtils';
export { RenderMode, drawBuildings, drawDistricts } from './render/server/renderUtils';
// Utilities
export { calculateImportance, getStarCount, shouldShowImportance } from './utils/importanceUtils';
// Configuration Validation
export { validateCodebaseViewConfig, autoFixGridConfig, } from './builder/GridLayoutConfigValidator';
// Pattern Matching Utilities
export { createPatternMatcher, matchesPattern, matchesAnyPattern, testPatterns, getMatchingPaths, PatternMatcherCache, } from './builder/PatternMatcher';
// Configuration Builder Components
export { CityConfigBuilder, GroupSelector, GroupNaming, GridPositioner, GroupsList, } from './react/config-builder';
