"use strict";
/**
 * Validation system exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationLayerToHighlight = exports.createValidationLayer = exports.coverageToHighlightLayer = exports.getCoverageColor = exports.createSummaryHighlightLayer = exports.validationToHighlightLayer = exports.getSeverityColor = exports.getSeverityLevel = exports.getValidationPriority = exports.getCategoryColor = exports.getValidationColor = exports.ValidationGroupBy = exports.ValidationViewMode = exports.ValidationStatus = exports.ValidationSeverity = exports.ValidationConfigSource = exports.ValidationCategory = exports.ValidationTool = void 0;
// Re-export validation enums (which are values)
var types_1 = require("./types");
Object.defineProperty(exports, "ValidationTool", { enumerable: true, get: function () { return types_1.ValidationTool; } });
Object.defineProperty(exports, "ValidationCategory", { enumerable: true, get: function () { return types_1.ValidationCategory; } });
Object.defineProperty(exports, "ValidationConfigSource", { enumerable: true, get: function () { return types_1.ValidationConfigSource; } });
Object.defineProperty(exports, "ValidationSeverity", { enumerable: true, get: function () { return types_1.ValidationSeverity; } });
Object.defineProperty(exports, "ValidationStatus", { enumerable: true, get: function () { return types_1.ValidationStatus; } });
Object.defineProperty(exports, "ValidationViewMode", { enumerable: true, get: function () { return types_1.ValidationViewMode; } });
Object.defineProperty(exports, "ValidationGroupBy", { enumerable: true, get: function () { return types_1.ValidationGroupBy; } });
// Re-export validation utilities functions
var layer_utils_1 = require("./layer-utils");
Object.defineProperty(exports, "getValidationColor", { enumerable: true, get: function () { return layer_utils_1.getValidationColor; } });
Object.defineProperty(exports, "getCategoryColor", { enumerable: true, get: function () { return layer_utils_1.getCategoryColor; } });
Object.defineProperty(exports, "getValidationPriority", { enumerable: true, get: function () { return layer_utils_1.getValidationPriority; } });
Object.defineProperty(exports, "getSeverityLevel", { enumerable: true, get: function () { return layer_utils_1.getSeverityLevel; } });
Object.defineProperty(exports, "getSeverityColor", { enumerable: true, get: function () { return layer_utils_1.getSeverityColor; } });
Object.defineProperty(exports, "validationToHighlightLayer", { enumerable: true, get: function () { return layer_utils_1.validationToHighlightLayer; } });
Object.defineProperty(exports, "createSummaryHighlightLayer", { enumerable: true, get: function () { return layer_utils_1.createSummaryHighlightLayer; } });
Object.defineProperty(exports, "getCoverageColor", { enumerable: true, get: function () { return layer_utils_1.getCoverageColor; } });
Object.defineProperty(exports, "coverageToHighlightLayer", { enumerable: true, get: function () { return layer_utils_1.coverageToHighlightLayer; } });
Object.defineProperty(exports, "createValidationLayer", { enumerable: true, get: function () { return layer_utils_1.createValidationLayer; } });
Object.defineProperty(exports, "validationLayerToHighlight", { enumerable: true, get: function () { return layer_utils_1.validationLayerToHighlight; } });
