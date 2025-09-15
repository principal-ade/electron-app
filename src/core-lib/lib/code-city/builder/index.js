"use strict";
// Builder exports - City construction logic
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMultiVersionCity = exports.MultiVersionCityBuilder = exports.GridLayoutManager = exports.filterCityDataForMultipleDirectories = exports.filterCityDataForSubdirectory = exports.filterCityDataForSelectiveRender = exports.getFilesFromGitHubTree = exports.SizingPresets = void 0;
// Legacy sizing strategy export (kept for backward compatibility)
var CodeCityBuilder_1 = require("./CodeCityBuilder");
Object.defineProperty(exports, "SizingPresets", { enumerable: true, get: function () { return CodeCityBuilder_1.SizingPresets; } });
var FileTreeBuilder_1 = require("./FileTreeBuilder");
Object.defineProperty(exports, "getFilesFromGitHubTree", { enumerable: true, get: function () { return FileTreeBuilder_1.getFilesFromGitHubTree; } });
var cityDataUtils_1 = require("./cityDataUtils");
Object.defineProperty(exports, "filterCityDataForSelectiveRender", { enumerable: true, get: function () { return cityDataUtils_1.filterCityDataForSelectiveRender; } });
Object.defineProperty(exports, "filterCityDataForSubdirectory", { enumerable: true, get: function () { return cityDataUtils_1.filterCityDataForSubdirectory; } });
Object.defineProperty(exports, "filterCityDataForMultipleDirectories", { enumerable: true, get: function () { return cityDataUtils_1.filterCityDataForMultipleDirectories; } });
// Grid layout manager (no longer exporting deprecated types)
var GridLayoutManager_1 = require("./GridLayoutManager");
Object.defineProperty(exports, "GridLayoutManager", { enumerable: true, get: function () { return GridLayoutManager_1.GridLayoutManager; } });
// Multiversion exports
var multiversion_1 = require("./multiversion");
Object.defineProperty(exports, "MultiVersionCityBuilder", { enumerable: true, get: function () { return multiversion_1.MultiVersionCityBuilder; } });
Object.defineProperty(exports, "buildMultiVersionCity", { enumerable: true, get: function () { return multiversion_1.buildMultiVersionCity; } });
