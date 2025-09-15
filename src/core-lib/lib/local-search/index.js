"use strict";
/**
 * Local Search Module - Core search functionality without UI dependencies
 *
 * Exports will be added here as they are needed by consumers.
 * This module provides search capabilities for local document indexing and searching.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodeFileSystemAdapter = exports.VSCodeStorageAdapter = exports.FlexSearchAdapter = exports.SlideIndexer = exports.SearchEngineFactory = exports.SlideSearchEngine = void 0;
// Core search engine - needed for VSCode DocsView
var SlideSearchEngine_1 = require("./SlideSearchEngine");
Object.defineProperty(exports, "SlideSearchEngine", { enumerable: true, get: function () { return SlideSearchEngine_1.SlideSearchEngine; } });
var SearchEngineFactory_1 = require("./SearchEngineFactory");
Object.defineProperty(exports, "SearchEngineFactory", { enumerable: true, get: function () { return SearchEngineFactory_1.SearchEngineFactory; } });
var SlideIndexer_1 = require("./SlideIndexer");
Object.defineProperty(exports, "SlideIndexer", { enumerable: true, get: function () { return SlideIndexer_1.SlideIndexer; } });
// Adapters (for direct use if needed)
var FlexSearchAdapter_1 = require("./adapters/implementations/FlexSearchAdapter");
Object.defineProperty(exports, "FlexSearchAdapter", { enumerable: true, get: function () { return FlexSearchAdapter_1.FlexSearchAdapter; } });
// VSCode specific adapters
var vscode_1 = require("./adapters/implementations/vscode");
Object.defineProperty(exports, "VSCodeStorageAdapter", { enumerable: true, get: function () { return vscode_1.VSCodeStorageAdapter; } });
Object.defineProperty(exports, "VSCodeFileSystemAdapter", { enumerable: true, get: function () { return vscode_1.VSCodeFileSystemAdapter; } });
