import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Calendar,
  AlertCircle,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { MCPTasksService } from '../../main-process-api/MCPTasksService';
import type { MCPTaskSubmission } from '../../../shared/types/mcp-tasks.types';

interface MCPTasksPanelProps {
  isLoading?: boolean;
  onTaskClick?: (task: MCPTaskSubmission) => void;
}

export const MCPTasksPanel: React.FC<MCPTasksPanelProps> = ({
  isLoading: externalLoading = false,
  onTaskClick,
}) => {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<MCPTaskSubmission[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setIsLoadingTasks(true);
        setError(null);
        const allTasks = await MCPTasksService.getAllTasks();
        console.info('[MCPTasksPanel] Loaded tasks:', allTasks);
        setTasks(allTasks);
      } catch (err) {
        console.error('[MCPTasksPanel] Failed to load tasks:', err);
        setError('Failed to load tasks');
        setTasks([]);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Circle size={16} />;
      case 'resolved':
        return <CheckCircle2 size={16} />;
      case 'unresolved':
        return <AlertCircle size={16} />;
      case 'failed':
        return <XCircle size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.colors.warning || '#f59e0b';
      case 'resolved':
        return theme.colors.success || '#10b981';
      case 'unresolved':
        return theme.colors.textSecondary;
      case 'failed':
        return theme.colors.error || '#ef4444';
      default:
        return theme.colors.textSecondary;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical':
        return theme.colors.error || '#ef4444';
      case 'high':
        return theme.colors.warning || '#f59e0b';
      case 'normal':
        return theme.colors.primary;
      case 'low':
        return theme.colors.textSecondary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getPriorityIcon = (priority?: string) => {
    const size = 16;
    switch (priority) {
      case 'critical':
        return <AlertTriangle size={size} />;
      case 'high':
        return <ArrowUp size={size} />;
      case 'normal':
        return <Minus size={size} />;
      case 'low':
        return <ArrowDown size={size} />;
      default:
        return <Minus size={size} />;
    }
  };

  const getRelativeTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)} months ago`;
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  const handleTaskClick = (task: MCPTaskSubmission) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  const handleDeleteTask = useCallback(
    async (task: MCPTaskSubmission, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent task click when deleting

      const confirmed = window.confirm(
        `Are you sure you want to delete this task?\n\n${task.taskSummary}`,
      );
      if (!confirmed) return;

      try {
        const success = await MCPTasksService.deleteTask(task.taskId);
        if (success) {
          // Remove the task from the local state
          setTasks((prevTasks) =>
            prevTasks.filter((t) => t.taskId !== task.taskId),
          );
        } else {
          setError('Failed to delete task');
        }
      } catch (err) {
        console.error('Failed to delete task:', err);
        setError('Failed to delete task');
      }
    },
    [],
  );

  const handleOpenTaskLocation = useCallback(
    async (task: MCPTaskSubmission, event: React.MouseEvent) => {
      event.stopPropagation();

      if (task.taskPath) {
        try {
          // Open the file in the default editor
          await window.mainProcess.fileSystem.openPath(task.taskPath);
        } catch (err) {
          console.error('Failed to open task location:', err);
          setError('Failed to open task location');
        }
      } else {
        setError('Task location not available');
      }
    },
    [],
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        {isLoadingTasks || externalLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
            }}
          >
            Loading MCP tasks...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.error || '#ef4444',
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
            }}
          >
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
            }}
          >
            <div
              style={{
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={32} style={{ opacity: 0.5 }} />
            </div>
            <div>No MCP tasks submitted yet</div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {tasks.map((task) => (
              <div
                key={task.taskId}
                onClick={() => handleTaskClick(task)}
                style={{
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  cursor: onTaskClick ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (onTaskClick) {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (onTaskClick) {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }
                }}
              >
                {/* Content Section with Padding */}
                <div style={{ padding: '12px' }}>
                  {/* Task Header */}
                  <div
                    style={{
                      marginBottom: '8px',
                    }}
                  >
                    {/* Status, Priority, Dependency and Time */}
                    <div
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                        fontFamily: theme.fonts.body,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '4px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: getStatusColor(task.resolutionStatus),
                            cursor: 'help',
                          }}
                          title={task.resolutionStatus}
                        >
                          {getStatusIcon(task.resolutionStatus)}
                        </span>
                        {task.priority && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              color: getPriorityColor(task.priority),
                              cursor: 'help',
                            }}
                            title={
                              task.priority.charAt(0).toUpperCase() +
                              task.priority.slice(1)
                            }
                          >
                            {getPriorityIcon(task.priority)}
                          </span>
                        )}
                        <span title={`Dependency: ${task.dependencyId}`}>
                          → {task.dependencyId}
                        </span>
                      </div>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Calendar size={10} />
                        {getRelativeTime(task.submittedAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <div
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.text,
                        fontWeight: theme.fontWeights.medium,
                        fontFamily: theme.fonts.body,
                        marginBottom: '4px',
                      }}
                    >
                      {task.taskSummary}
                    </div>

                    {/* Repository info */}
                    {task.dependencyRepository && (
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.monospace,
                          marginTop: '4px',
                        }}
                        title={task.dependencyRepository}
                      >
                        {task.dependencyRepository.split('/').pop()}
                      </div>
                    )}

                    {/* Error message */}
                    {task.error && (
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.error || '#ef4444',
                          fontFamily: theme.fonts.body,
                          marginTop: '4px',
                          padding: '4px 8px',
                          backgroundColor: `${theme.colors.error || '#ef4444'}15`,
                          borderRadius: '4px',
                        }}
                      >
                        {task.error}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {task.tags && task.tags.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginBottom: '8px',
                      }}
                    >
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '2px 8px',
                            backgroundColor: `${theme.colors.primary}15`,
                            color: theme.colors.primary,
                            borderRadius: '10px',
                            fontSize: theme.fontSizes[1],
                            fontWeight: theme.fontWeights.medium,
                            fontFamily: theme.fonts.body,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0',
                    borderTop: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {task.taskWritten && task.taskPath && (
                    <button
                      onClick={(e) => handleOpenTaskLocation(task, e)}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer',
                        color: theme.colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        transition: 'all 0.2s',
                        fontSize: theme.fontSizes[1],
                        fontFamily: theme.fonts.body,
                        borderRight: `1px solid ${theme.colors.border}`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                        e.currentTarget.style.color = theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = theme.colors.textSecondary;
                      }}
                      title="Open task location"
                    >
                      <ExternalLink size={14} />
                      <span>Open</span>
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeleteTask(task, e)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      padding: '8px',
                      cursor: 'pointer',
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.2s',
                      fontSize: theme.fontSizes[1],
                      fontFamily: theme.fonts.body,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${theme.colors.error}15`;
                      e.currentTarget.style.color =
                        theme.colors.error || '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                    title="Delete task"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const MCPTasksPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: theme.fontSizes[0],
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px',
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '4px',
        }}
      >
        <CheckCircle2 size={16} style={{ color: theme.colors.success }} />
        <span>Fix authentication bug</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px',
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '4px',
        }}
      >
        <Circle size={16} style={{ color: theme.colors.warning }} />
        <span>Add new feature</span>
      </div>
    </div>
  );
};
