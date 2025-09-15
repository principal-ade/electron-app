"use strict";
/**
 * Utilities for converting validation data to highlight layers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidationColor = getValidationColor;
exports.getCategoryColor = getCategoryColor;
exports.getValidationPriority = getValidationPriority;
exports.getSeverityLevel = getSeverityLevel;
exports.getSeverityColor = getSeverityColor;
exports.validationToHighlightLayer = validationToHighlightLayer;
exports.createSummaryHighlightLayer = createSummaryHighlightLayer;
exports.getCoverageColor = getCoverageColor;
exports.coverageToHighlightLayer = coverageToHighlightLayer;
exports.createValidationLayer = createValidationLayer;
exports.validationLayerToHighlight = validationLayerToHighlight;
const types_1 = require("./types");
// Get color for validation tool
function getValidationColor(tool) {
    const colors = {
        [types_1.ValidationTool.ESLint]: '#4b32c3', // Purple
        [types_1.ValidationTool.TypeScript]: '#3178c6', // TypeScript blue
        [types_1.ValidationTool.Knip]: '#ff4444', // Red for unused code
        [types_1.ValidationTool.Jest]: '#c21325', // Jest red
        [types_1.ValidationTool.Vitest]: '#729b1b', // Vitest green
        [types_1.ValidationTool.Prettier]: '#1a2b34', // Dark blue
        [types_1.ValidationTool.Stylelint]: '#263238', // Dark gray
        [types_1.ValidationTool.Ruff]: '#d33682', // Magenta
        [types_1.ValidationTool.Pylint]: '#3776ab', // Python blue
        [types_1.ValidationTool.Mypy]: '#2a7fff', // Bright blue
        [types_1.ValidationTool.Clippy]: '#dea584', // Rust orange
        [types_1.ValidationTool.Custom]: '#6b7280', // Gray
    };
    return colors[tool] || '#6b7280';
}
// Get color for validation category
function getCategoryColor(category) {
    const colors = {
        [types_1.ValidationCategory.CodeQuality]: '#f59e0b', // Orange
        [types_1.ValidationCategory.TypeSafety]: '#3b82f6', // Blue
        [types_1.ValidationCategory.UnusedCode]: '#ef4444', // Red
        [types_1.ValidationCategory.TestCoverage]: '#10b981', // Green
        [types_1.ValidationCategory.Security]: '#dc2626', // Dark red
        [types_1.ValidationCategory.Performance]: '#8b5cf6', // Purple
        [types_1.ValidationCategory.Accessibility]: '#06b6d4', // Cyan
        [types_1.ValidationCategory.Dependencies]: '#f97316', // Dark orange
        [types_1.ValidationCategory.Formatting]: '#6b7280', // Gray
    };
    return colors[category] || '#6b7280';
}
// Get priority for validation (higher renders on top)
function getValidationPriority(tool) {
    const priorities = {
        [types_1.ValidationTool.TypeScript]: 90, // Type errors are most important
        [types_1.ValidationTool.ESLint]: 85,
        [types_1.ValidationTool.Knip]: 80,
        [types_1.ValidationTool.Jest]: 75,
        [types_1.ValidationTool.Vitest]: 75,
        [types_1.ValidationTool.Prettier]: 60,
        [types_1.ValidationTool.Stylelint]: 60,
        [types_1.ValidationTool.Ruff]: 85,
        [types_1.ValidationTool.Pylint]: 85,
        [types_1.ValidationTool.Mypy]: 90,
        [types_1.ValidationTool.Clippy]: 85,
        [types_1.ValidationTool.Custom]: 70,
    };
    return priorities[tool] || 70;
}
// Get severity level for comparison
function getSeverityLevel(severity) {
    const levels = {
        [types_1.ValidationSeverity.Error]: 3,
        [types_1.ValidationSeverity.Warning]: 2,
        [types_1.ValidationSeverity.Info]: 1,
        [types_1.ValidationSeverity.Suggestion]: 0,
    };
    return levels[severity] || 0;
}
// Convert severity to color
function getSeverityColor(severity) {
    const colors = {
        [types_1.ValidationSeverity.Error]: '#ef4444', // Red
        [types_1.ValidationSeverity.Warning]: '#f59e0b', // Orange
        [types_1.ValidationSeverity.Info]: '#3b82f6', // Blue
        [types_1.ValidationSeverity.Suggestion]: '#6b7280', // Gray
    };
    return colors[severity] || '#6b7280';
}
// Convert ValidationLayer to HighlightLayer for visualization
function validationToHighlightLayer(validation, options = {}) {
    // Group issues by file
    const fileIssueMap = new Map();
    for (const issue of validation.validationData.result.issues) {
        // Filter by severity if specified
        if (options.minSeverity &&
            getSeverityLevel(issue.severity) < getSeverityLevel(options.minSeverity)) {
            continue;
        }
        if (options.showOnlyErrors && issue.severity !== types_1.ValidationSeverity.Error) {
            continue;
        }
        const issues = fileIssueMap.get(issue.file) || [];
        issues.push(issue);
        fileIssueMap.set(issue.file, issues);
    }
    // Create layer items with severity-based coloring
    const items = Array.from(fileIssueMap.entries()).map(([file, issues]) => {
        // Calculate severity stats for this file
        const errorCount = issues.filter(i => i.severity === types_1.ValidationSeverity.Error).length;
        const warningCount = issues.filter(i => i.severity === types_1.ValidationSeverity.Warning).length;
        const hasErrors = errorCount > 0;
        // Determine color based on options and severity
        let backgroundColor;
        if (options.useToolColor) {
            backgroundColor = getValidationColor(validation.validationData.tool);
        }
        else {
            backgroundColor = hasErrors
                ? getSeverityColor(types_1.ValidationSeverity.Error)
                : warningCount > 0
                    ? getSeverityColor(types_1.ValidationSeverity.Warning)
                    : getSeverityColor(types_1.ValidationSeverity.Info);
        }
        return {
            path: file,
            type: 'file',
            renderStrategy: 'fill',
            coverOptions: {
                // Intensity based on issue count
                opacity: Math.min(0.3 + errorCount * 0.1, 0.8),
                backgroundColor,
                text: options.showCounts ? `${issues.length}` : undefined,
                textSize: 10,
            },
        };
    });
    // Build layer name with stats
    const stats = validation.validationData.stats;
    const nameParts = [validation.name];
    if (stats.totalIssues > 0) {
        nameParts.push(`(${stats.totalIssues} issues)`);
    }
    return {
        id: `validation-${validation.validationData.tool}-${validation.id}`,
        name: nameParts.join(' '),
        enabled: true,
        color: options.useToolColor
            ? getValidationColor(validation.validationData.tool)
            : getCategoryColor(validation.validationData.category),
        priority: getValidationPriority(validation.validationData.tool),
        items,
        dynamic: false,
    };
}
// Create a summary highlight layer for multiple validations
function createSummaryHighlightLayer(validations, options = {}) {
    // Aggregate all issues across validations
    const fileIssueMap = new Map();
    for (const validation of validations) {
        for (const issue of validation.validationData.result.issues) {
            // Filter by severity
            if (options.minSeverity &&
                getSeverityLevel(issue.severity) < getSeverityLevel(options.minSeverity)) {
                continue;
            }
            const fileData = fileIssueMap.get(issue.file) || {
                issues: [],
                tools: new Set(),
            };
            fileData.issues.push(issue);
            fileData.tools.add(validation.validationData.tool);
            fileIssueMap.set(issue.file, fileData);
        }
    }
    // Create items
    const items = Array.from(fileIssueMap.entries()).map(([file, data]) => {
        const errorCount = data.issues.filter(i => i.severity === types_1.ValidationSeverity.Error).length;
        const hasErrors = errorCount > 0;
        return {
            path: file,
            type: 'file',
            renderStrategy: 'fill',
            coverOptions: {
                opacity: Math.min(0.3 + errorCount * 0.05, 0.8),
                backgroundColor: hasErrors ? '#ef4444' : '#f59e0b',
                text: options.showCounts ? `${data.issues.length}` : undefined,
                textSize: 10,
            },
        };
    });
    const totalIssues = Array.from(fileIssueMap.values()).reduce((sum, data) => sum + data.issues.length, 0);
    return {
        id: 'validation-summary',
        name: `All Validations (${totalIssues} issues in ${fileIssueMap.size} files)`,
        enabled: true,
        color: '#6b7280',
        priority: 100, // Highest priority
        items,
        dynamic: false,
    };
}
// Get coverage color based on percentage
function getCoverageColor(percentage) {
    if (percentage >= 80)
        return '#10b981'; // Green - good coverage
    if (percentage >= 60)
        return '#f59e0b'; // Orange - moderate coverage
    if (percentage >= 40)
        return '#f97316'; // Dark orange - poor coverage
    return '#ef4444'; // Red - very poor coverage
}
// Convert coverage data to highlight layer
function coverageToHighlightLayer(validation, options = {}) {
    const coverage = validation.validationData.result.coverage;
    if (!coverage) {
        return {
            id: `coverage-${validation.id}`,
            name: 'No coverage data',
            enabled: false,
            color: '#6b7280',
            priority: 75,
            items: [],
            dynamic: false,
        };
    }
    const items = coverage.files
        .filter(file => {
        if (options.showUncoveredOnly) {
            return file.lines.percentage < (options.threshold || 80);
        }
        return true;
    })
        .map(file => {
        const percentage = file.lines.percentage;
        const color = getCoverageColor(percentage);
        return {
            path: file.file,
            type: 'file',
            renderStrategy: 'fill',
            coverOptions: {
                opacity: options.showUncoveredOnly
                    ? 0.8 // Full opacity for uncovered files
                    : 0.3 + 0.5 * (percentage / 100), // Scale opacity with coverage
                backgroundColor: color,
                text: options.showPercentages ? `${Math.round(percentage)}%` : undefined,
                textSize: 10,
            },
        };
    });
    const overallCoverage = coverage.overall.lines;
    return {
        id: `coverage-${validation.validationData.tool}-${validation.id}`,
        name: `Test Coverage (${Math.round(overallCoverage)}% overall)`,
        enabled: true,
        color: getCoverageColor(overallCoverage),
        priority: 75,
        items,
        dynamic: false,
    };
}
// Create ValidationLayer from ValidationResult
function createValidationLayer(result, fileSets) {
    // Calculate affected files
    const affectedFiles = new Set();
    // For issue-based validations
    for (const issue of result.issues) {
        affectedFiles.add(issue.file);
    }
    // For coverage-based validations
    if (result.coverage) {
        for (const file of result.coverage.files) {
            affectedFiles.add(file.file);
        }
    }
    // Calculate detailed stats
    const stats = {
        totalIssues: result.summary.totalIssues,
        filesAffected: affectedFiles.size,
        severity: {
            errors: result.summary.bySeverity.errors,
            warnings: result.summary.bySeverity.warnings,
            info: result.summary.bySeverity.info,
            suggestions: result.summary.bySeverity.suggestions,
        },
    };
    return {
        id: `validation-${result.tool}-${result.id}`,
        name: `${result.tool} Validation`,
        type: 'validation',
        enabled: true,
        derivedFrom: {
            fileSets,
            derivationType: 'aggregation',
            description: `${result.tool} validation of ${result.scope.filesAnalyzed.total} files`,
        },
        validationData: {
            tool: result.tool,
            category: result.category,
            result,
            stats,
            affectedFiles,
        },
    };
}
// Enhanced conversion that handles both issues and coverage
function validationLayerToHighlight(validation, options = {}) {
    // If this is a coverage validation, use coverage-specific logic
    if (validation.validationData.category === types_1.ValidationCategory.TestCoverage &&
        validation.validationData.result.coverage) {
        return coverageToHighlightLayer(validation, options);
    }
    // Otherwise use issue-based logic
    return validationToHighlightLayer(validation, options);
}
