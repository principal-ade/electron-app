import React, { useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { Task } from '../../../../../shared/main-process-api-interfaces/PalaceTasksAPI';
import { RepositoryNotesPanel } from './RepositoryNotesPanel';
import { TasksPanel } from '../../../../panels/components/TasksPanel';

interface RepositoryTasksAndNotesPanelProps {
  repositoryPath: string;
  isLoading?: boolean;
  onTaskClick?: (task: Task) => void;
}

export const RepositoryTasksAndNotesPanel: React.FC<RepositoryTasksAndNotesPanelProps> = ({
  repositoryPath,
  isLoading: externalLoading = false,
  onTaskClick,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');

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
          Tasks
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
          <TasksPanel
            repositoryPath={repositoryPath}
            isLoading={externalLoading}
            onTaskClick={onTaskClick}
          />
        </div>
      ) : (
        <RepositoryNotesPanel repositoryPath={repositoryPath} isLoading={externalLoading} />
      )}
    </div>
  );
};
