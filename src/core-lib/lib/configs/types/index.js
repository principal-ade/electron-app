"use strict";
/**
 * Configuration type definitions for layer system
 * These types define the structure of configs fetched from Voyager-Guides
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_FILES = exports.OFFICIAL_CONFIG_SOURCE = void 0;
// Official Specktor configurations source
exports.OFFICIAL_CONFIG_SOURCE = {
    type: 'github',
    owner: 'a24z-ai',
    repo: 'specktor-configurations',
    branch: 'main',
};
// Configuration file names
exports.CONFIG_FILES = {
    scanFilters: 'scan-filters.json',
    defaultLayers: 'default-layers.json',
    layerTemplates: 'layer-templates.json',
};
