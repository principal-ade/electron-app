import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderOpen, Github, Star, Folder } from 'lucide-react';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import type { LeftPanelView } from './ProjectsView';

interface ProjectsViewHeaderProps {
  leftPanelView: LeftPanelView;
  onLeftPanelViewChange: (view: LeftPanelView) => void;
  isAuthenticated: boolean;
}

export const ProjectsViewHeader: React.FC<ProjectsViewHeaderProps> = ({
  leftPanelView,
  onLeftPanelViewChange,
  isAuthenticated,
}) => {
  const { theme } = useTheme();
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);

  useEffect(() => {
    const loadBaseDirectory = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };

    loadBaseDirectory();

    // Listen for preference updates
    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      (preferences) => {
        setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
      },
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handleSelectBaseDirectory = async () => {
    const result = await FileSystemService.selectDirectory({
      title: 'Select Base Default Directory',
      buttonLabel: 'Select Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (!result || result.canceled || !result.filePaths?.[0]) {
      return;
    }

    const selectedPath = result.filePaths[0];
    await UserPreferencesService.updatePreferences({
      baseDefaultDirectory: selectedPath,
    });
    setBaseDefaultDirectory(selectedPath);
  };

  const getDirectoryDisplayName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  const getButtonStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: isActive
      ? theme.colors.primary
      : theme.colors.backgroundSecondary,
    color: isActive ? theme.colors.background : theme.colors.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none',
    fontSize: theme.fontSizes[1],
    fontWeight: theme.fontWeights.medium,
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '0 24px',
        height: '64px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        flexShrink: 0,
      }}
    >
      {/* Left: Panel View Toggle Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => onLeftPanelViewChange('local')}
          style={getButtonStyle(leftPanelView === 'local')}
          onMouseEnter={(e) => {
            if (leftPanelView !== 'local') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (leftPanelView !== 'local') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }
          }}
        >
          <Folder size={16} />
          Local
        </button>
        <button
          onClick={() => onLeftPanelViewChange('remote')}
          style={getButtonStyle(leftPanelView === 'remote')}
          onMouseEnter={(e) => {
            if (leftPanelView !== 'remote') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (leftPanelView !== 'remote') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }
          }}
        >
          <Github size={16} />
          Remote
        </button>
        <button
          onClick={() => onLeftPanelViewChange('starred')}
          style={getButtonStyle(leftPanelView === 'starred')}
          onMouseEnter={(e) => {
            if (leftPanelView !== 'starred') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (leftPanelView !== 'starred') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }
          }}
        >
          <Star size={16} />
          Starred
        </button>
      </div>

      {/* Right: Home Folder */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}
      >
        <span
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
          }}
        >
          Home Folder:
        </span>
        <div
          onClick={handleSelectBaseDirectory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: theme.colors.backgroundSecondary,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundTertiary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
          }}
          title={baseDefaultDirectory || 'Click to set base directory'}
        >
          <FolderOpen size={16} color={theme.colors.textSecondary} />
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.monospace,
            }}
          >
            {baseDefaultDirectory
              ? getDirectoryDisplayName(baseDefaultDirectory)
              : 'Set Directory'}
          </span>
        </div>
      </div>
    </div>
  );
};
