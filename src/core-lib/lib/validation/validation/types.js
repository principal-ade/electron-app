"use strict";
/**
 * Standardized validation system types
 * Integrates with the core layer system for visualization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationGroupBy = exports.ValidationViewMode = exports.ValidationStatus = exports.ValidationSeverity = exports.ValidationConfigSource = exports.ValidationCategory = exports.ValidationTool = void 0;
// Enums for type safety
var ValidationTool;
(function (ValidationTool) {
    ValidationTool["ESLint"] = "eslint";
    ValidationTool["TypeScript"] = "typescript";
    ValidationTool["Knip"] = "knip";
    ValidationTool["Jest"] = "jest";
    ValidationTool["Vitest"] = "vitest";
    ValidationTool["Prettier"] = "prettier";
    ValidationTool["Stylelint"] = "stylelint";
    ValidationTool["Ruff"] = "ruff";
    ValidationTool["Pylint"] = "pylint";
    ValidationTool["Mypy"] = "mypy";
    ValidationTool["Clippy"] = "clippy";
    ValidationTool["Custom"] = "custom";
})(ValidationTool || (exports.ValidationTool = ValidationTool = {}));
var ValidationCategory;
(function (ValidationCategory) {
    ValidationCategory["CodeQuality"] = "code-quality";
    ValidationCategory["TypeSafety"] = "type-safety";
    ValidationCategory["UnusedCode"] = "unused-code";
    ValidationCategory["TestCoverage"] = "test-coverage";
    ValidationCategory["Security"] = "security";
    ValidationCategory["Performance"] = "performance";
    ValidationCategory["Accessibility"] = "accessibility";
    ValidationCategory["Dependencies"] = "dependencies";
    ValidationCategory["Formatting"] = "formatting";
})(ValidationCategory || (exports.ValidationCategory = ValidationCategory = {}));
var ValidationConfigSource;
(function (ValidationConfigSource) {
    ValidationConfigSource["Default"] = "default";
    ValidationConfigSource["Local"] = "local";
    ValidationConfigSource["Custom"] = "custom";
})(ValidationConfigSource || (exports.ValidationConfigSource = ValidationConfigSource = {}));
var ValidationSeverity;
(function (ValidationSeverity) {
    ValidationSeverity["Error"] = "error";
    ValidationSeverity["Warning"] = "warning";
    ValidationSeverity["Info"] = "info";
    ValidationSeverity["Suggestion"] = "suggestion";
})(ValidationSeverity || (exports.ValidationSeverity = ValidationSeverity = {}));
var ValidationStatus;
(function (ValidationStatus) {
    ValidationStatus["Success"] = "success";
    ValidationStatus["Error"] = "error";
    ValidationStatus["Partial"] = "partial";
})(ValidationStatus || (exports.ValidationStatus = ValidationStatus = {}));
var ValidationViewMode;
(function (ValidationViewMode) {
    ValidationViewMode["Issues"] = "issues";
    ValidationViewMode["Files"] = "files";
    ValidationViewMode["Summary"] = "summary";
})(ValidationViewMode || (exports.ValidationViewMode = ValidationViewMode = {}));
var ValidationGroupBy;
(function (ValidationGroupBy) {
    ValidationGroupBy["File"] = "file";
    ValidationGroupBy["Severity"] = "severity";
    ValidationGroupBy["Rule"] = "rule";
    ValidationGroupBy["Category"] = "category";
})(ValidationGroupBy || (exports.ValidationGroupBy = ValidationGroupBy = {}));
