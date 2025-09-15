/**
 * Standardized validation system types
 * Integrates with the core layer system for visualization
 */
// Enums for type safety
export var ValidationTool;
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
})(ValidationTool || (ValidationTool = {}));
export var ValidationCategory;
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
})(ValidationCategory || (ValidationCategory = {}));
export var ValidationConfigSource;
(function (ValidationConfigSource) {
    ValidationConfigSource["Default"] = "default";
    ValidationConfigSource["Local"] = "local";
    ValidationConfigSource["Custom"] = "custom";
})(ValidationConfigSource || (ValidationConfigSource = {}));
export var ValidationSeverity;
(function (ValidationSeverity) {
    ValidationSeverity["Error"] = "error";
    ValidationSeverity["Warning"] = "warning";
    ValidationSeverity["Info"] = "info";
    ValidationSeverity["Suggestion"] = "suggestion";
})(ValidationSeverity || (ValidationSeverity = {}));
export var ValidationStatus;
(function (ValidationStatus) {
    ValidationStatus["Success"] = "success";
    ValidationStatus["Error"] = "error";
    ValidationStatus["Partial"] = "partial";
})(ValidationStatus || (ValidationStatus = {}));
export var ValidationViewMode;
(function (ValidationViewMode) {
    ValidationViewMode["Issues"] = "issues";
    ValidationViewMode["Files"] = "files";
    ValidationViewMode["Summary"] = "summary";
})(ValidationViewMode || (ValidationViewMode = {}));
export var ValidationGroupBy;
(function (ValidationGroupBy) {
    ValidationGroupBy["File"] = "file";
    ValidationGroupBy["Severity"] = "severity";
    ValidationGroupBy["Rule"] = "rule";
    ValidationGroupBy["Category"] = "category";
})(ValidationGroupBy || (ValidationGroupBy = {}));
