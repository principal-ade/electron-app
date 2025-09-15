import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Generic validation result view component
 * Displays validation results in a consistent format
 */
import { useState, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import { ValidationSeverity, getSeverityColor } from '../../types/validation';
// These enums were not in the original types, adding them here
export var ValidationViewMode;
(function (ValidationViewMode) {
    ValidationViewMode["Issues"] = "issues";
    ValidationViewMode["Files"] = "files";
})(ValidationViewMode || (ValidationViewMode = {}));
export var ValidationGroupBy;
(function (ValidationGroupBy) {
    ValidationGroupBy["File"] = "file";
    ValidationGroupBy["Severity"] = "severity";
    ValidationGroupBy["Rule"] = "rule";
    ValidationGroupBy["Category"] = "category";
})(ValidationGroupBy || (ValidationGroupBy = {}));
import { AlertCircle, AlertTriangle, Info, CheckCircle, ChevronRight, ChevronDown, File, Search, X } from 'lucide-react';
export const ValidationResultView = ({ result, viewMode = ValidationViewMode.Issues, groupBy = ValidationGroupBy.File, onIssueSelect, onFileSelect }) => {
    const { theme } = useTheme();
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [severityFilter, setSeverityFilter] = useState(new Set([ValidationSeverity.Error, ValidationSeverity.Warning]));
    // Filter issues based on search and severity
    const filteredIssues = useMemo(() => {
        if (!result)
            return [];
        return result.issues.filter(issue => {
            // Check severity filter
            if (!severityFilter.has(issue.severity)) {
                return false;
            }
            // Check search query
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (issue.file.toLowerCase().includes(query) ||
                    issue.message.toLowerCase().includes(query) ||
                    issue.rule?.toLowerCase().includes(query) ||
                    issue.category?.toLowerCase().includes(query));
            }
            return true;
        });
    }, [result, searchQuery, severityFilter]);
    // Group issues based on groupBy setting
    const groupedIssues = useMemo(() => {
        const groups = new Map();
        for (const issue of filteredIssues) {
            let key;
            switch (groupBy) {
                case ValidationGroupBy.File:
                    key = issue.file;
                    break;
                case ValidationGroupBy.Severity:
                    key = issue.severity;
                    break;
                case ValidationGroupBy.Rule:
                    key = issue.rule || 'No rule';
                    break;
                case ValidationGroupBy.Category:
                    key = issue.category || 'General';
                    break;
                default:
                    key = issue.file;
            }
            const groupIssues = groups.get(key) || [];
            groupIssues.push(issue);
            groups.set(key, groupIssues);
        }
        return groups;
    }, [filteredIssues, groupBy]);
    const toggleGroup = (group) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) {
                next.delete(group);
            }
            else {
                next.add(group);
            }
            return next;
        });
    };
    const getSeverityIcon = (severity) => {
        switch (severity) {
            case ValidationSeverity.Error:
                return _jsx(X, { size: 14, color: getSeverityColor(severity) });
            case ValidationSeverity.Warning:
                return _jsx(AlertTriangle, { size: 14, color: getSeverityColor(severity) });
            case ValidationSeverity.Info:
                return _jsx(Info, { size: 14, color: getSeverityColor(severity) });
            default:
                return _jsx(AlertCircle, { size: 14, color: getSeverityColor(severity) });
        }
    };
    if (!result) {
        return (_jsxs("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '40px',
                color: theme.colors.textSecondary
            }, children: [_jsx(CheckCircle, { size: 48, color: theme.colors.textTertiary, style: { marginBottom: 16 } }), _jsx("div", { style: { fontSize: 16, fontWeight: 600 }, children: "No validation results yet" }), _jsx("div", { style: { fontSize: 14, marginTop: 8 }, children: "Run a validation to see results here" })] }));
    }
    // Show success state if no issues
    if (result.issues.length === 0) {
        return (_jsxs("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '40px'
            }, children: [_jsx(CheckCircle, { size: 48, color: "#10b981", style: { marginBottom: 16 } }), _jsx("div", { style: { fontSize: 18, fontWeight: 600, color: '#10b981' }, children: "All checks passed!" }), _jsxs("div", { style: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 8 }, children: ["No issues found in ", result.scope.filesAnalyzed.total, " files"] })] }));
    }
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: theme.colors.background
        }, children: [_jsxs("div", { style: {
                    padding: '16px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundLight
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 12
                        }, children: [_jsxs("div", { style: { display: 'flex', gap: 16, alignItems: 'center' }, children: [result.summary.bySeverity.errors > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(X, { size: 16, color: "#ef4444" }), _jsx("span", { style: { fontWeight: 600, color: '#ef4444' }, children: result.summary.bySeverity.errors }), _jsx("span", { style: { color: theme.colors.textSecondary, fontSize: 13 }, children: "errors" })] })), result.summary.bySeverity.warnings > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(AlertTriangle, { size: 16, color: "#f59e0b" }), _jsx("span", { style: { fontWeight: 600, color: '#f59e0b' }, children: result.summary.bySeverity.warnings }), _jsx("span", { style: { color: theme.colors.textSecondary, fontSize: 13 }, children: "warnings" })] })), result.summary.bySeverity.info > 0 && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Info, { size: 16, color: "#3b82f6" }), _jsx("span", { style: { fontWeight: 600, color: '#3b82f6' }, children: result.summary.bySeverity.info }), _jsx("span", { style: { color: theme.colors.textSecondary, fontSize: 13 }, children: "info" })] }))] }), _jsxs("div", { style: { fontSize: 12, color: theme.colors.textSecondary }, children: [result.summary.filesWithIssues, " of ", result.summary.totalFilesAnalyzed, " files"] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsxs("div", { style: {
                                    flex: 1,
                                    position: 'relative'
                                }, children: [_jsx(Search, { size: 14, style: {
                                            position: 'absolute',
                                            left: 8,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: theme.colors.textSecondary
                                        } }), _jsx("input", { type: "text", placeholder: "Search issues...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), style: {
                                            width: '100%',
                                            padding: '6px 8px 6px 28px',
                                            borderRadius: 6,
                                            border: `1px solid ${theme.colors.border}`,
                                            backgroundColor: theme.colors.background,
                                            color: theme.colors.text,
                                            fontSize: 13,
                                            outline: 'none'
                                        } })] }), _jsx("div", { style: { display: 'flex', gap: 4 }, children: Object.values(ValidationSeverity).map(severity => (_jsx("button", { onClick: () => {
                                        setSeverityFilter(prev => {
                                            const next = new Set(prev);
                                            if (next.has(severity)) {
                                                next.delete(severity);
                                            }
                                            else {
                                                next.add(severity);
                                            }
                                            return next;
                                        });
                                    }, style: {
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        border: `1px solid ${severityFilter.has(severity)
                                            ? getSeverityColor(severity)
                                            : theme.colors.border}`,
                                        backgroundColor: severityFilter.has(severity)
                                            ? `${getSeverityColor(severity)}20`
                                            : 'transparent',
                                        color: severityFilter.has(severity)
                                            ? getSeverityColor(severity)
                                            : theme.colors.textSecondary,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }, children: severity }, severity))) })] })] }), _jsx("div", { style: {
                    flex: 1,
                    overflow: 'auto',
                    padding: '8px'
                }, children: Array.from(groupedIssues.entries()).map(([group, issues]) => (_jsxs("div", { style: {
                        marginBottom: 8,
                        borderRadius: 8,
                        backgroundColor: theme.colors.backgroundLight,
                        border: `1px solid ${theme.colors.border}`,
                        overflow: 'hidden'
                    }, children: [_jsx("div", { onClick: () => toggleGroup(group), style: {
                                padding: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                backgroundColor: theme.colors.backgroundSecondary,
                                borderBottom: expandedGroups.has(group)
                                    ? `1px solid ${theme.colors.border}`
                                    : 'none'
                            }, children: _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [expandedGroups.has(group)
                                        ? _jsx(ChevronDown, { size: 14 })
                                        : _jsx(ChevronRight, { size: 14 }), groupBy === ValidationGroupBy.File && _jsx(File, { size: 14 }), _jsx("span", { style: { fontWeight: 500, fontSize: 14 }, children: group }), _jsx("span", { style: {
                                            color: theme.colors.textSecondary,
                                            fontSize: 12,
                                            backgroundColor: theme.colors.backgroundTertiary,
                                            padding: '2px 6px',
                                            borderRadius: 4
                                        }, children: issues.length })] }) }), expandedGroups.has(group) && (_jsx("div", { style: { padding: '4px' }, children: issues.map((issue, idx) => (_jsx("div", { onClick: () => {
                                    onIssueSelect?.(issue);
                                    if (groupBy !== ValidationGroupBy.File) {
                                        onFileSelect?.(issue.file);
                                    }
                                }, style: {
                                    padding: '8px 12px',
                                    borderBottom: idx < issues.length - 1
                                        ? `1px solid ${theme.colors.border}`
                                        : 'none',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }, children: _jsxs("div", { style: {
                                        display: 'flex',
                                        alignItems: 'start',
                                        gap: 8
                                    }, children: [getSeverityIcon(issue.severity), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: {
                                                        display: 'flex',
                                                        gap: 8,
                                                        marginBottom: 4,
                                                        alignItems: 'center'
                                                    }, children: [groupBy !== ValidationGroupBy.File && (_jsx("span", { style: {
                                                                fontSize: 11,
                                                                color: theme.colors.textSecondary
                                                            }, children: issue.file })), _jsxs("span", { style: {
                                                                fontSize: 11,
                                                                color: theme.colors.textSecondary
                                                            }, children: ["Line ", issue.line, ":", issue.column] }), issue.rule && (_jsx("span", { style: {
                                                                fontSize: 10,
                                                                padding: '1px 4px',
                                                                borderRadius: 3,
                                                                backgroundColor: `${getSeverityColor(issue.severity)}20`,
                                                                color: getSeverityColor(issue.severity),
                                                                fontWeight: 600
                                                            }, children: issue.rule }))] }), _jsx("div", { style: {
                                                        fontSize: 13,
                                                        color: theme.colors.text,
                                                        lineHeight: 1.4
                                                    }, children: issue.message })] })] }) }, idx))) }))] }, group))) })] }));
};
