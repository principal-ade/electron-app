import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Calendar,
  AlertCircle,
  Trash2,
  Copy,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { PalaceTasksService } from '../../main-process-api/PalaceTasksService';
import type {
  Task,
  TaskStatus,
} from '../../../shared/main-process-api-interfaces/PalaceTasksAPI';

interface TasksPanelProps {
  repositoryPath: string;
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
}

export const TasksPanel: React.FC<TasksPanelProps> = ({
  repositoryPath,
  isLoading: externalLoading = false,
  onTaskClick,
}) => {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repositoryPath) {
      return;
    }

    const loadTasks = async () => {
      try {
        setIsLoadingTasks(true);
        setError(null);
        const response = await PalaceTasksService.getTasks(repositoryPath, {
          status: 'pending', // Only show pending tasks by default
          sortBy: 'receivedAt',
          sortDirection: 'desc', // Most recent first
        });
        console.log('[TasksPanel] Loaded tasks:', response.tasks);
        if (response.tasks.length > 0) {
          console.log(
            '[TasksPanel] First task directoryPath:',
            response.tasks[0].directoryPath,
          );
        }
        setTasks(response.tasks);
      } catch (err) {
        console.error('[TasksPanel] Failed to load tasks:', err);
        setError('Failed to load tasks');
        setTasks([]);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();
  }, [repositoryPath]);

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return <Circle size={16} />;
      case 'in_progress':
        return <Clock size={16} />;
      case 'completed':
        return <CheckCircle2 size={16} />;
      case 'failed':
        return <XCircle size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return theme.colors.textSecondary;
      case 'in_progress':
        return theme.colors.warning || '#f59e0b';
      case 'completed':
        return theme.colors.success || '#10b981';
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

  // Extract title from task content (first line with # stripped)
  const getTaskTitle = (content: string): string => {
    const lines = content.split('\n');
    const titleLine = lines.find((line) => line.trim().startsWith('#'));
    if (titleLine) {
      return titleLine.replace(/^#+\s*/, '').trim();
    }
    return content.substring(0, 50) + (content.length > 50 ? '...' : '');
  };

  const handleTaskClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
  };

  const handleDeleteTask = useCallback(
    async (task: Task, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent task click when deleting

      const confirmed = window.confirm(
        `Are you sure you want to delete this task?\n\n${getTaskTitle(task.content)}`,
      );
      if (!confirmed) return;

      try {
        const success = await PalaceTasksService.deleteTask(
          repositoryPath,
          task.id,
        );
        if (success) {
          // Remove the task from the local state
          setTasks((prevTasks) => prevTasks.filter((t) => t.id !== task.id));
        } else {
          setError('Failed to delete task');
        }
      } catch (err) {
        console.error('Failed to delete task:', err);
        setError('Failed to delete task');
      }
    },
    [repositoryPath],
  );

  const handleCompleteTask = useCallback(
    async (task: Task, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent task click when completing

      const confirmed = window.confirm(
        `Mark this task as completed?\n\n${getTaskTitle(task.content)}`,
      );
      if (!confirmed) return;

      try {
        const success = await PalaceTasksService.updateTaskStatus(
          repositoryPath,
          task.id,
          'completed',
        );
        if (success) {
          // Remove the task from the local state (since it's completed and we only show pending)
          setTasks((prevTasks) => prevTasks.filter((t) => t.id !== task.id));
        } else {
          setError('Failed to complete task');
        }
      } catch (err) {
        console.error('Failed to complete task:', err);
        setError('Failed to complete task');
      }
    },
    [repositoryPath],
  );

  const handleCopyPath = useCallback(
    async (task: Task, event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation(); // Prevent task click when copying

      // Capture button reference before async operation
      const button = event.currentTarget;
      const originalColor = button.style.color;

      try {
        // Use the filePath provided by core-library
        const taskFilePath = `${task.repositoryPath}/${task.filePath}`;

        console.log('[TasksPanel] Copying task file path:', taskFilePath);

        await navigator.clipboard.writeText(taskFilePath);

        // Show success feedback by briefly changing the button
        if (button) {
          button.style.color = theme.colors.success || '#10b981';
          button.title = 'Copied!';

          setTimeout(() => {
            if (button) {
              button.style.color = originalColor;
              button.title = 'Copy task file path';
            }
          }, 1000);
        }

        console.info('[TasksPanel] Task file path copied:', taskFilePath);
      } catch (err) {
        console.error('[TasksPanel] Failed to copy path:', err);
        setError('Failed to copy path to clipboard');

        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);
      }
    },
    [theme.colors.success],
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
            Loading tasks...
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
            <div>No pending tasks</div>
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
                key={task.id}
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
                  {/* Priority, From and Time */}
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
                      {task.priority && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: getPriorityColor(task.priority),
                            cursor: 'help',
                          }}
                          title={task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        >
                          {getPriorityIcon(task.priority)}
                        </span>
                      )}
                      {task.senderId && (
                        <span>From: {task.senderId}</span>
                      )}
                    </div>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Calendar size={10} />
                      {getRelativeTime(task.receivedAt)}
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
                    {getTaskTitle(task.content)}
                  </div>
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
                  <button
                    onClick={(e) => handleCompleteTask(task, e)}
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
                      e.currentTarget.style.backgroundColor = `${theme.colors.success || '#10b981'}15`;
                      e.currentTarget.style.color =
                        theme.colors.success || '#10b981';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color =
                        theme.colors.textSecondary;
                    }}
                    title="Mark as completed"
                  >
                    <CheckCircle2 size={14} />
                    <span>Complete</span>
                  </button>
                  <button
                    onClick={(e) => handleCopyPath(task, e)}
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
                      e.currentTarget.style.color =
                        theme.colors.textSecondary;
                    }}
                    title="Copy relative path"
                  >
                    <Copy size={14} />
                    <span>Copy</span>
                  </button>
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
                      e.currentTarget.style.color =
                        theme.colors.textSecondary;
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

export const TasksPanelPreview: React.FC = () => {
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
        <input type="checkbox" style={{ margin: 0 }} />
        <span>Implement feature X</span>
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
        <input type="checkbox" defaultChecked readOnly style={{ margin: 0 }} />
        <span
          style={{
            textDecoration: 'line-through',
            color: theme.colors.textSecondary,
          }}
        >
          Fix bug Y
        </span>
      </div>
    </div>
  );
};
