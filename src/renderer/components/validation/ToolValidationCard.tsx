import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { Sparkles, Wrench } from 'lucide-react';
import {
  PackageValidation,
  ValidationTemplate,
  ActionCategory,
  ValidationAction,
} from '../../../shared/tool-validation-types';

interface ToolValidationCardProps {
  validation: PackageValidation;
  template: ValidationTemplate;
  isRunning: boolean;
  selectedCategory?: ActionCategory;
  onRun: (actionIds?: string[]) => void;
  isConfigured?: boolean;
  onToggleConfiguration?: (enabled: boolean) => void;
  showConfiguration?: boolean;
}

export const ToolValidationCard: React.FC<ToolValidationCardProps> = ({
  validation,
  template,
  isRunning,
  selectedCategory,
  onRun,
  isConfigured = false,
  onToggleConfiguration,
  showConfiguration = false,
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [selectedActions, setSelectedActions] = useState<Set<string>>(
    new Set(),
  );
  const [expandedCategories, setExpandedCategories] = useState<
    Set<ActionCategory>
  >(new Set());

  // Get tool icon based on tool type
  const getToolIcon = (toolName: string): React.ReactNode => {
    const icons: Record<string, React.ReactNode> = {
      eslint: '🔍',
      typescript: '🔷',
      jest: '🧪',
      vitest: '⚡',
      prettier: '✨',
      react: '⚛️',
      nextjs: '▲',
      electron: '🖥️',
    };
    return icons[toolName] || <Wrench size={20} />;
  };

  // Get category color
  const getCategoryColor = (category: ActionCategory): string => {
    const colors: Record<ActionCategory, string> = {
      quality: '#4CAF50',
      correctness: '#2196F3',
      security: '#FF9800',
      performance: '#9C27B0',
      build: '#607D8B',
      custom: '#795548',
    };
    return colors[category] || theme.colors.primary;
  };

  // Filter actions by selected category
  const filteredActionGroups = selectedCategory
    ? template.actions.filter((group) => group.category === selectedCategory)
    : template.actions;

  // Get available actions for filtered groups
  const availableActionsInGroups = filteredActionGroups.flatMap((group) =>
    group.items.filter((action) =>
      validation.availableActions.includes(action.id),
    ),
  );

  const handleToggleAction = (actionId: string) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const toggleCategory = (category: ActionCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Get category icon
  const getCategoryIcon = (category: ActionCategory): React.ReactNode => {
    const icons: Record<ActionCategory, React.ReactNode> = {
      quality: <Sparkles size={18} />,
      correctness: '✓',
      security: '🔒',
      performance: '⚡',
      build: '🔨',
      custom: '⚙️',
    };
    return icons[category] || '📋';
  };

  return (
    <div
      style={{
        backgroundColor: theme.colors.backgroundLight,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: expanded ? `1px solid ${theme.colors.border}` : 'none',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>
            {getToolIcon(template.tool.name)}
          </span>

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: '600',
                  color: theme.colors.text,
                }}
              >
                {template.name}
              </h4>
              <span
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                {validation.detectedTool.version}
              </span>

              {isConfigured && selectedActions.size > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    backgroundColor: `${theme.colors.primary}20`,
                    color: theme.colors.primary,
                    borderRadius: '4px',
                    fontWeight: '500',
                  }}
                >
                  {selectedActions.size} selected
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Remove Button (if configured) */}
            {isConfigured && showConfiguration && onToggleConfiguration && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleConfiguration(false);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                  color: theme.colors.error,
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  opacity: 0.8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.error;
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.error;
                  e.currentTarget.style.opacity = '0.8';
                }}
                title="Remove validation layer"
              >
                Remove
              </button>
            )}

            {isRunning && (
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  color: theme.colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span className="spinner" />
                Running...
              </div>
            )}

            <span
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ padding: '12px 16px' }}>
          {isConfigured && selectedActions.size === 0 && (
            <div
              style={{
                padding: '10px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '12px',
                color: theme.colors.textSecondary,
                textAlign: 'center',
              }}
            >
              Select actions below to include in your validation run
            </div>
          )}

          {filteredActionGroups.map((group) => {
            const availableActions = group.items.filter((action) =>
              validation.availableActions.includes(action.id),
            );

            if (availableActions.length === 0) return null;

            const isExpanded = expandedCategories.has(group.category);
            const selectedInCategory = availableActions.filter((action) =>
              selectedActions.has(action.id),
            ).length;

            return (
              <div key={group.category} style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => toggleCategory(group.category)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s',
                    marginBottom: isExpanded ? '10px' : 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundLight;
                    e.currentTarget.style.borderColor = getCategoryColor(
                      group.category,
                    );
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '18px',
                      }}
                    >
                      {getCategoryIcon(group.category)}
                    </span>
                    <div
                      style={{
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: theme.colors.text,
                          textTransform: 'capitalize',
                        }}
                      >
                        {group.category}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.colors.textSecondary,
                          marginTop: '1px',
                        }}
                      >
                        {availableActions.length} action
                        {availableActions.length !== 1 ? 's' : ''}
                        {selectedInCategory > 0 &&
                          ` • ${selectedInCategory} selected`}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    ▼
                  </span>
                </button>

                {isExpanded && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '8px',
                      marginLeft: '16px',
                      marginRight: '16px',
                    }}
                  >
                    {availableActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleToggleAction(action.id)}
                        style={{
                          padding: '10px',
                          backgroundColor: selectedActions.has(action.id)
                            ? `${getCategoryColor(group.category)}20`
                            : theme.colors.backgroundLight,
                          border: `1px solid ${
                            selectedActions.has(action.id)
                              ? getCategoryColor(group.category)
                              : theme.colors.border
                          }`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          if (!selectedActions.has(action.id)) {
                            e.currentTarget.style.borderColor =
                              getCategoryColor(group.category);
                            e.currentTarget.style.backgroundColor = `${getCategoryColor(group.category)}10`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!selectedActions.has(action.id)) {
                            e.currentTarget.style.borderColor =
                              theme.colors.border;
                            e.currentTarget.style.backgroundColor =
                              theme.colors.backgroundLight;
                          }
                        }}
                      >
                        {selectedActions.has(action.id) && (
                          <span
                            style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              fontSize: '14px',
                              color: getCategoryColor(group.category),
                            }}
                          >
                            ✓
                          </span>
                        )}

                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '500',
                            color: theme.colors.text,
                            marginBottom: '3px',
                          }}
                        >
                          {action.name}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                            lineHeight: 1.3,
                            marginBottom: '6px',
                          }}
                        >
                          {action.description}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                          }}
                        >
                          <code
                            style={{
                              fontSize: '10px',
                              color: theme.colors.textSecondary,
                              backgroundColor: theme.colors.backgroundSecondary,
                              padding: '2px 4px',
                              borderRadius: '2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                            title={action.command}
                          >
                            {action.command}
                          </code>

                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor:
                                action.severity === 'error'
                                  ? 'rgba(244, 67, 54, 0.1)'
                                  : action.severity === 'warning'
                                    ? 'rgba(255, 152, 0, 0.1)'
                                    : 'rgba(33, 150, 243, 0.1)',
                              color:
                                action.severity === 'error'
                                  ? '#f44336'
                                  : action.severity === 'warning'
                                    ? '#ff9800'
                                    : '#2196f3',
                              flexShrink: 0,
                            }}
                          >
                            {action.severity}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {availableActionsInGroups.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
                color: theme.colors.textSecondary,
                fontSize: '13px',
              }}
            >
              No actions available for the selected category
            </div>
          )}
        </div>
      )}
    </div>
  );
};
