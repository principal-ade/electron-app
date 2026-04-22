import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { X, FolderPlus, Plus } from 'lucide-react';

export type ViewMode = 'installed' | 'browse';

export interface DetectedDirectory {
  id: string;
  path: string;
  displayName: string;
  icon: string;
  skillCount: number;
  skills: string[];
}

interface SkillBrowserViewHeaderProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  currentRepo?: {
    owner: string;
    repo: string;
    branch: string;
  } | null;
  onClearRepo?: () => void;
  hasDetectedDirectories?: boolean;
  onOpenSetup?: () => void;
  detectedDirectories?: DetectedDirectory[];
}

export const SkillBrowserViewHeader: React.FC<SkillBrowserViewHeaderProps> = ({
  viewMode = 'installed',
  onViewModeChange,
  currentRepo,
  onClearRepo,
  hasDetectedDirectories = true,
  onOpenSetup,
  detectedDirectories = [],
}) => {
  const { theme } = useTheme();

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '0 24px',
          height: '64px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          flexShrink: 0,
        }}
      >
      {/* Left: Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              margin: 0,
            }}
          >
            Skill Browser
          </h2>
        </div>

        {/* View Mode Toggle */}
        <div
          style={{
            display: 'flex',
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            padding: '2px',
            gap: '2px',
          }}
        >
          <button
            onClick={() => onViewModeChange?.('installed')}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: viewMode === 'installed' ? theme.colors.primary : 'transparent',
              color: viewMode === 'installed' ? theme.colors.background : theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            My Skills
          </button>
          <button
            onClick={() => onViewModeChange?.('browse')}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: viewMode === 'browse' ? theme.colors.primary : 'transparent',
              color: viewMode === 'browse' ? theme.colors.background : theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            Browse
          </button>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Setup button when no directories detected in Installed mode */}
      {viewMode === 'installed' && !hasDetectedDirectories && onOpenSetup && (
        <button
          onClick={onOpenSetup}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            cursor: 'pointer',
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.medium,
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.85';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <FolderPlus size={16} />
          Set Up Agent Skills
        </button>
      )}

      {/* Detected directories info when in Installed mode */}
      {viewMode === 'installed' && hasDetectedDirectories && detectedDirectories.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            whiteSpace: 'nowrap',
          }}>
            <span>Identified Agent Skills:</span>
            <span style={{
              color: theme.colors.text,
              fontWeight: theme.fontWeights.medium,
            }}>
              {detectedDirectories
                .filter(dir => dir.id !== 'agent-universal')
                .map(dir => dir.displayName)
                .join(', ')}
            </span>
          </div>
          {onOpenSetup && (
            <button
              onClick={onOpenSetup}
              title="Add more agent directories"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      )}

      {/* Clear button when in Browse mode with a repo loaded */}
      {viewMode === 'browse' && currentRepo && onClearRepo && (
        <button
          onClick={onClearRepo}
          title="Clear repository"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            e.currentTarget.style.borderColor = theme.colors.error;
            e.currentTarget.style.color = theme.colors.error;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <X size={16} />
        </button>
      )}
      </div>
    </>
  );
};
