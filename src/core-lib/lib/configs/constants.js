"use strict";
/**
 * Configuration constants for Specktor configuration files
 * These are used across the monorepo for fetching and loading configurations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG_OPTIONS = exports.SPECKTOR_GITHUB_CONFIG = void 0;
exports.getGitHubConfigUrl = getGitHubConfigUrl;
exports.getAllConfigUrls = getAllConfigUrls;
exports.SPECKTOR_GITHUB_CONFIG = {
    owner: 'a24z-ai',
    repo: 'specktor-configurations',
    branch: 'main',
    files: {
        scanFilters: 'scan-filters.json',
        layerTemplates: 'layer-templates.json',
        defaultLayers: 'default-layers.json',
    },
};
/**
 * Build a raw GitHub URL for a configuration file
 */
function getGitHubConfigUrl(filename) {
    const { owner, repo, branch } = exports.SPECKTOR_GITHUB_CONFIG;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filename}`;
}
/**
 * Get all configuration URLs
 */
function getAllConfigUrls() {
    const urls = {};
    for (const [key, filename] of Object.entries(exports.SPECKTOR_GITHUB_CONFIG.files)) {
        urls[key] = getGitHubConfigUrl(filename);
    }
    return urls;
}
/**
 * Default configuration options
 */
exports.DEFAULT_CONFIG_OPTIONS = {
    preferGitHub: true,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    fallbackToLocal: true,
};
