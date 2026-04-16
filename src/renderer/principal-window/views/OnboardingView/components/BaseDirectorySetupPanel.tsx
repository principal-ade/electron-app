import React, { useState } from 'react';
import { FolderOpen, Info, Check } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileSystemService } from '../../../../main-process-api/FileSystemService';

export interface BaseDirectorySetupPanelProps {
  onDirectorySelected: (directory: string) => void;
  onSkip: () => void;
  currentDirectory?: string | null;
}

export const BaseDirectorySetupPanel: React.FC<BaseDirectorySetupPanelProps> = ({
  onDirectorySelected,
  onSkip,
  currentDirectory,
}) => {
  const { theme } = useTheme();
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectDirectory = async () => {
    setIsSelecting(true);
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Base Default Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });

      if (!result || result.canceled || !result.filePaths?.[0]) {
        return;
      }

      const selectedPath = result.filePaths[0];
      onDirectorySelected(selectedPath);
    } catch (error) {
      console.error('[BaseDirectorySetupPanel] Failed to select directory:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        padding: 32,
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            backgroundColor: theme.colors.primary + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FolderOpen size={28} color={theme.colors.primary} />
        </div>
        <div>
          <h1
            style={{
              fontSize: theme.fontSizes[5],
              fontWeight: 700,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            Set Your Base Directory
          </h1>
          <p
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              margin: 0,
            }}
          >
            Choose where Principal will organize your projects
          </p>
        </div>
      </div>

      {/* Info section */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: 12,
          padding: 20,
          marginBottom: 32,
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <Info size={20} color={theme.colors.primary} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h3
              style={{
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                color: theme.colors.text,
                margin: '0 0 8px 0',
              }}
            >
              What is the base directory?
            </h3>
            <p
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              The base directory is the top-level folder where Principal will:
            </p>
            <ul
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                margin: '8px 0 0 0',
                paddingLeft: 20,
                lineHeight: 1.6,
              }}
            >
              <li>Clone repositories when you add new projects</li>
              <li>Discover existing Git repositories automatically</li>
              <li>Organize your workspaces and codebases</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Current directory display */}
      {currentDirectory && (
        <div
          style={{
            backgroundColor: theme.colors.primary + '10',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            border: `1px solid ${theme.colors.primary}40`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Check size={16} color={theme.colors.primary} />
            <span
              style={{
                fontSize: theme.fontSizes[1],
                fontWeight: 600,
                color: theme.colors.primary,
              }}
            >
              Current Directory
            </span>
          </div>
          <p
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
              margin: '4px 0 0 24px',
              fontFamily: theme.fonts.monospace,
            }}
          >
            {currentDirectory}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 'auto',
        }}
      >
        <button
          onClick={handleSelectDirectory}
          disabled={isSelecting}
          style={{
            flex: 1,
            padding: '14px 24px',
            backgroundColor: theme.colors.primary,
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            cursor: isSelecting ? 'not-allowed' : 'pointer',
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            fontFamily: theme.fonts.body,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: isSelecting ? 0.7 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSelecting) {
              e.currentTarget.style.opacity = '0.9';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = isSelecting ? '0.7' : '1';
          }}
        >
          <FolderOpen size={18} />
          {isSelecting ? 'Selecting...' : currentDirectory ? 'Change Directory' : 'Choose Directory'}
        </button>

        <button
          onClick={onSkip}
          disabled={isSelecting}
          style={{
            padding: '14px 24px',
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            cursor: isSelecting ? 'not-allowed' : 'pointer',
            fontSize: theme.fontSizes[2],
            fontWeight: 500,
            fontFamily: theme.fonts.body,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSelecting) {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              e.currentTarget.style.borderColor = theme.colors.textSecondary;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.border;
          }}
        >
          Skip for now
        </button>
      </div>

      {/* Help text */}
      <p
        style={{
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          margin: '16px 0 0 0',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        You can always change this later in your preferences
      </p>
    </div>
  );
};
