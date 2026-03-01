import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Github, Star, Folder, FilePlus2 } from 'lucide-react';
import type { LeftPanelView } from './ProjectsView';

interface ProjectsViewHeaderProps {
  leftPanelView: LeftPanelView;
  onLeftPanelViewChange: (view: LeftPanelView) => void;
  onCreateRepository?: () => void;
}

export const ProjectsViewHeader: React.FC<ProjectsViewHeaderProps> = ({
  leftPanelView,
  onLeftPanelViewChange,
  onCreateRepository,
}) => {
  const { theme } = useTheme();

  const getButtonStyle = (isActive: boolean, position: 'first' | 'middle' | 'last') => {
    let borderRadius = '0';
    if (position === 'first') {
      borderRadius = '0';
    } else if (position === 'last') {
      borderRadius = '0';
    }

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      padding: '0 32px',
      borderRadius,
      backgroundColor: isActive
        ? theme.colors.accent
        : theme.colors.backgroundSecondary,
      color: isActive ? theme.colors.background : theme.colors.textSecondary,
      cursor: 'pointer',
      transition: 'all 0.2s',
      border: 'none',
      fontSize: theme.fontSizes[1],
      fontWeight: theme.fontWeights.medium,
      height: '100%',
      minWidth: 0,
    };
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '0',
        height: '64px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        flexShrink: 0,
      }}
    >
      {/* Left: Panel View Toggle Buttons */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0', height: '100%' }}>
        <button
          onClick={() => onLeftPanelViewChange('local')}
          style={getButtonStyle(leftPanelView === 'local', 'first')}
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
          style={getButtonStyle(leftPanelView === 'remote', 'middle')}
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
          style={getButtonStyle(leftPanelView === 'starred', 'last')}
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

      {/* Right: Create Button */}
      <div
        style={{ display: 'flex', alignItems: 'stretch', gap: '0', height: '100%' }}
      >
        {/* Create Repository Button */}
        {onCreateRepository && (
          <button
            onClick={onCreateRepository}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 32px',
              borderRadius: '0',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              height: '100%',
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.primary;
              e.currentTarget.style.color = theme.colors.background;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
            title="Create new repository"
          >
            <FilePlus2 size={16} />
            Create
          </button>
        )}
      </div>
    </div>
  );
};
