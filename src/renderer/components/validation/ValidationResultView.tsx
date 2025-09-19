/**
 * Generic validation result view component
 * Displays validation results in a consistent format
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import {
  ValidationResult,
  ValidationIssue,
  ValidationSeverity,
  getSeverityColor,
  getCategoryColor,
} from '../../types/validation';

// These enums were not in the original types, adding them here
export enum ValidationViewMode {
  Issues = 'issues',
  Files = 'files',
}

export enum ValidationGroupBy {
  File = 'file',
  Severity = 'severity',
  Rule = 'rule',
  Category = 'category',
}
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  File,
  Filter,
  Search,
  X,
} from 'lucide-react';

interface ValidationResultViewProps {
  result: ValidationResult | null;
  viewMode?: ValidationViewMode;
  groupBy?: ValidationGroupBy;
  onIssueSelect?: (issue: ValidationIssue) => void;
  onFileSelect?: (filePath: string) => void;
}

export const ValidationResultView: React.FC<ValidationResultViewProps> = ({
  result,
  viewMode = ValidationViewMode.Issues,
  groupBy = ValidationGroupBy.File,
  onIssueSelect,
  onFileSelect,
}) => {
  const { theme } = useTheme();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Set<ValidationSeverity>>(
    new Set([ValidationSeverity.Error, ValidationSeverity.Warning]),
  );

  // Filter issues based on search and severity
  const filteredIssues = useMemo(() => {
    if (!result) return [];

    return result.issues.filter((issue) => {
      // Check severity filter
      if (!severityFilter.has(issue.severity)) {
        return false;
      }

      // Check search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          issue.file.toLowerCase().includes(query) ||
          issue.message.toLowerCase().includes(query) ||
          issue.rule?.toLowerCase().includes(query) ||
          issue.category?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [result, searchQuery, severityFilter]);

  // Group issues based on groupBy setting
  const groupedIssues = useMemo(() => {
    const groups = new Map<string, ValidationIssue[]>();

    for (const issue of filteredIssues) {
      let key: string;
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

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const getSeverityIcon = (severity: ValidationSeverity) => {
    switch (severity) {
      case ValidationSeverity.Error:
        return <X size={14} color={getSeverityColor(severity)} />;
      case ValidationSeverity.Warning:
        return <AlertTriangle size={14} color={getSeverityColor(severity)} />;
      case ValidationSeverity.Info:
        return <Info size={14} color={getSeverityColor(severity)} />;
      default:
        return <AlertCircle size={14} color={getSeverityColor(severity)} />;
    }
  };

  if (!result) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
          color: theme.colors.textSecondary,
        }}
      >
        <CheckCircle
          size={48}
          color={theme.colors.textTertiary}
          style={{ marginBottom: 16 }}
        />
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          No validation results yet
        </div>
        <div style={{ fontSize: 14, marginTop: 8 }}>
          Run a validation to see results here
        </div>
      </div>
    );
  }

  // Show success state if no issues
  if (result.issues.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px',
        }}
      >
        <CheckCircle size={48} color="#10b981" style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: '#10b981' }}>
          All checks passed!
        </div>
        <div
          style={{
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginTop: 8,
          }}
        >
          No issues found in {result.scope.filesAnalyzed.total} files
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header with summary */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {result.summary.bySeverity.errors > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={16} color="#ef4444" />
                <span style={{ fontWeight: 600, color: '#ef4444' }}>
                  {result.summary.bySeverity.errors}
                </span>
                <span
                  style={{ color: theme.colors.textSecondary, fontSize: 13 }}
                >
                  errors
                </span>
              </div>
            )}
            {result.summary.bySeverity.warnings > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                  {result.summary.bySeverity.warnings}
                </span>
                <span
                  style={{ color: theme.colors.textSecondary, fontSize: 13 }}
                >
                  warnings
                </span>
              </div>
            )}
            {result.summary.bySeverity.info > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={16} color="#3b82f6" />
                <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                  {result.summary.bySeverity.info}
                </span>
                <span
                  style={{ color: theme.colors.textSecondary, fontSize: 13 }}
                >
                  info
                </span>
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>
            {result.summary.filesWithIssues} of{' '}
            {result.summary.totalFilesAnalyzed} files
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              flex: 1,
              position: 'relative',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.colors.textSecondary,
              }}
            />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px 6px 28px',
                borderRadius: 6,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {Object.values(ValidationSeverity).map((severity) => (
              <button
                key={severity}
                onClick={() => {
                  setSeverityFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(severity)) {
                      next.delete(severity);
                    } else {
                      next.add(severity);
                    }
                    return next;
                  });
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: `1px solid ${
                    severityFilter.has(severity)
                      ? getSeverityColor(severity)
                      : theme.colors.border
                  }`,
                  backgroundColor: severityFilter.has(severity)
                    ? `${getSeverityColor(severity)}20`
                    : 'transparent',
                  color: severityFilter.has(severity)
                    ? getSeverityColor(severity)
                    : theme.colors.textSecondary,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Issues list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}
      >
        {Array.from(groupedIssues.entries()).map(([group, issues]) => (
          <div
            key={group}
            style={{
              marginBottom: 8,
              borderRadius: 8,
              backgroundColor: theme.colors.backgroundLight,
              border: `1px solid ${theme.colors.border}`,
              overflow: 'hidden',
            }}
          >
            <div
              onClick={() => toggleGroup(group)}
              style={{
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: theme.colors.backgroundSecondary,
                borderBottom: expandedGroups.has(group)
                  ? `1px solid ${theme.colors.border}`
                  : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {expandedGroups.has(group) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                {groupBy === ValidationGroupBy.File && <File size={14} />}
                <span style={{ fontWeight: 500, fontSize: 14 }}>{group}</span>
                <span
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: 12,
                    backgroundColor: theme.colors.backgroundTertiary,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {issues.length}
                </span>
              </div>
            </div>

            {expandedGroups.has(group) && (
              <div style={{ padding: '4px' }}>
                {issues.map((issue, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onIssueSelect?.(issue);
                      if (groupBy !== ValidationGroupBy.File) {
                        onFileSelect?.(issue.file);
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      borderBottom:
                        idx < issues.length - 1
                          ? `1px solid ${theme.colors.border}`
                          : 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'start',
                        gap: 8,
                      }}
                    >
                      {getSeverityIcon(issue.severity)}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginBottom: 4,
                            alignItems: 'center',
                          }}
                        >
                          {groupBy !== ValidationGroupBy.File && (
                            <span
                              style={{
                                fontSize: 11,
                                color: theme.colors.textSecondary,
                              }}
                            >
                              {issue.file}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              color: theme.colors.textSecondary,
                            }}
                          >
                            Line {issue.line}:{issue.column}
                          </span>
                          {issue.rule && (
                            <span
                              style={{
                                fontSize: 10,
                                padding: '1px 4px',
                                borderRadius: 3,
                                backgroundColor: `${getSeverityColor(issue.severity)}20`,
                                color: getSeverityColor(issue.severity),
                                fontWeight: 600,
                              }}
                            >
                              {issue.rule}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: theme.colors.text,
                            lineHeight: 1.4,
                          }}
                        >
                          {issue.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
