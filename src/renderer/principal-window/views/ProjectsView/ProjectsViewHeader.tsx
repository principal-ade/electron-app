import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Github, Star, Folder, FilePlus2 } from 'lucide-react';
import type { LeftPanelView } from './ProjectsView';

interface ProjectsViewHeaderProps {
  mode: LeftPanelView;
  onCreateRepository?: () => void;
}

// Map mode to display info
const modeConfig: Record<LeftPanelView, { icon: React.ReactNode; label: string }> = {
  local: { icon: <Folder size={16} />, label: 'Local Projects' },
  remote: { icon: <Github size={16} />, label: 'Github Projects' },
  starred: { icon: <Star size={16} />, label: 'Starred Projects' },
};

export const ProjectsViewHeader: React.FC<ProjectsViewHeaderProps> = ({
  mode,
  onCreateRepository,
}) => {
  const { theme } = useTheme();
  const config = modeConfig[mode];

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
      {/* Left: View Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 24px',
          color: theme.colors.text,
          fontSize: theme.fontSizes[2],
          fontWeight: theme.fontWeights.semibold,
        }}
      >
        {config.icon}
        {config.label}
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
