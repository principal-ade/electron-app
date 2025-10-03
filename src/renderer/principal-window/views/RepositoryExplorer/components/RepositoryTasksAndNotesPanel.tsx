import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, XCircle, Calendar, AlertCircle } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { PalaceTasksService } from '../../../../main-process-api/PalaceTasksService';
import type { Task, TaskStatus } from '../../../../../shared/main-process-api-interfaces/PalaceTasksAPI';
import { RepositoryNotesPanel } from './RepositoryNotesPanel';

interface RepositoryTasksAndNotesPanelProps {
  repositoryPath: string;
  isLoading?: boolean;
}

export const RepositoryTasksAndNotesPanel: React.FC<RepositoryTasksAndNotesPanelProps> = ({
  repositoryPath,
  isLoading: externalLoading = false,
}) => {
  const { theme } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');

  const loadTasks = async () => {
    try {
      setIsLoadingTasks(true);
      setError(null);
      const response = await PalaceTasksService.getTasks(repositoryPath, {
        status: 'pending', // Only show pending tasks by default
      });
      setTasks(response.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks');
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (repositoryPath) {
      loadTasks();
    }
  }, [repositoryPath]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
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
    const titleLine = lines.find(line => line.trim().startsWith('#'));
    if (titleLine) {
      return titleLine.replace(/^#+\s*/, '').trim();
    }
    return content.substring(0, 50) + (content.length > 50 ? '...' : '');
  };

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Tab Header */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'tasks' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            color: activeTab === 'tasks' ? theme.colors.primary : theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Tasks {tasks.length > 0 && `(${tasks.length})`}
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'notes' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            color: activeTab === 'notes' ? theme.colors.primary : theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Notes
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tasks' ? (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            maxHeight: '400px',
          }}
        >
          {isLoadingTasks || externalLoading ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
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
              }}
            >
              <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                <CheckCircle2 size={32} style={{ opacity: 0.5 }} />
              </div>
              <div>No pending tasks</div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    padding: '12px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {/* Task Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ color: getStatusColor(task.status), marginTop: '2px' }}>
                      {getStatusIcon(task.status)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.text,
                          fontWeight: 500,
                          marginBottom: '4px',
                        }}
                      >
                        {getTaskTitle(task.content)}
                      </div>
                      {task.senderId && (
                        <div
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textSecondary,
                          }}
                        >
                          From: {task.senderId}
                        </div>
                      )}
                    </div>
                    {task.priority && (
                      <span
                        style={{
                          padding: '2px 8px',
                          backgroundColor: `${getPriorityColor(task.priority)}15`,
                          color: getPriorityColor(task.priority),
                          borderRadius: '10px',
                          fontSize: theme.fontSizes[0],
                          fontWeight: 500,
                          textTransform: 'uppercase',
                        }}
                      >
                        {task.priority}
                      </span>
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
                            fontSize: theme.fontSizes[0],
                            fontWeight: 500,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div
                    style={{
                      fontSize: '10px',
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Calendar size={10} />
                      {getRelativeTime(task.receivedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <RepositoryNotesPanel repositoryPath={repositoryPath} isLoading={externalLoading} />
      )}
    </div>
  );
};
