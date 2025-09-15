"use strict";
/**
 * Export VS Code platform adapters
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodeFileSystemAdapter = exports.VSCodeStorageAdapter = void 0;
var VSCodeStorageAdapter_1 = require("./VSCodeStorageAdapter");
Object.defineProperty(exports, "VSCodeStorageAdapter", { enumerable: true, get: function () { return VSCodeStorageAdapter_1.VSCodeStorageAdapter; } });
var VSCodeFileSystemAdapter_1 = require("./VSCodeFileSystemAdapter");
Object.defineProperty(exports, "VSCodeFileSystemAdapter", { enumerable: true, get: function () { return VSCodeFileSystemAdapter_1.VSCodeFileSystemAdapter; } });
