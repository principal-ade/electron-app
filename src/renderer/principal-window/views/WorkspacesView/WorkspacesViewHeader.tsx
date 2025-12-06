import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { LayoutGrid, FolderOpen } from 'lucide-react';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';

export const WorkspacesViewHeader: React.FC = () => {
  const { theme } = useTheme();
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);

  useEffect(() => {
    const loadBaseDirectory = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };

    loadBaseDirectory();

    // Listen for preference updates
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((preferences) => {
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    });

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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '20px 24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        flexShrink: 0,
      }}
    >
      {/* Left: Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <LayoutGrid size={20} color={theme.colors.text} />
        <h2 style={{ fontSize: theme.fontSizes[4], fontWeight: theme.fontWeights.semibold, margin: 0 }}>
          Workspaces
        </h2>
      </div>

      {/* Right: Base Default Directory */}
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
          e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
        }}
        title={baseDefaultDirectory || 'Click to set base directory'}
      >
        <FolderOpen size={16} color={theme.colors.textSecondary} />
        <span
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.mono,
          }}
        >
          {baseDefaultDirectory ? getDirectoryDisplayName(baseDefaultDirectory) : 'Set base directory'}
        </span>
      </div>
    </div>
  );
};
