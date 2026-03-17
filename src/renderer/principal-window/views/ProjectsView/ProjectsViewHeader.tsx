import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Github, Star, Folder, FilePlus2, LayoutGrid, PanelLeftClose, Clock } from 'lucide-react';
import type { LeftPanelView } from './ProjectsView';

interface ProjectsViewHeaderProps {
  mode: LeftPanelView;
  onCreateRepository?: () => void;
  /** Whether grid view is currently active */
  isGridView?: boolean;
  /** Callback when grid view toggle is clicked */
  onToggleGridView?: () => void;
  /** Number of stale repos to review */
  staleRepoCount?: number;
  /** Whether to show the stale badge (1 per day limit) */
  showStaleBadge?: boolean;
  /** Callback when stale review button is clicked */
  onReviewStaleRepos?: () => void;
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
  isGridView = false,
  onToggleGridView,
  staleRepoCount = 0,
  showStaleBadge = false,
  onReviewStaleRepos,
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

      {/* Right: Action Buttons */}
      <div
        style={{ display: 'flex', alignItems: 'stretch', gap: '0', height: '100%' }}
      >
        {/* Stale Repo Review Button - Only show for local mode when there are stale repos */}
        {mode === 'local' && staleRepoCount > 0 && onReviewStaleRepos && (
          <button
            onClick={onReviewStaleRepos}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 24px',
              borderRadius: '0',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.warning || '#f59e0b',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              height: '100%',
              minWidth: 0,
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }}
            title={`Review ${staleRepoCount} stale project${staleRepoCount !== 1 ? 's' : ''}`}
          >
            <Clock size={16} />
            Review
            {showStaleBadge && (
              <span
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.warning || '#f59e0b',
                }}
              />
            )}
          </button>
        )}

        {/* Grid/List Toggle Button - Only show for local mode */}
        {mode === 'local' && onToggleGridView && (
          <button
            onClick={onToggleGridView}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 24px',
              borderRadius: '0',
              backgroundColor: isGridView
                ? theme.colors.primary
                : theme.colors.backgroundSecondary,
              color: isGridView
                ? theme.colors.background
                : theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: 'none',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              height: '100%',
              minWidth: 0,
            }}
            onMouseEnter={(e) => {
              if (!isGridView) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isGridView) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              }
            }}
            title={isGridView ? 'Switch to panel view' : 'Switch to grid view'}
          >
            {isGridView ? <PanelLeftClose size={16} /> : <LayoutGrid size={16} />}
            {isGridView ? 'Panels' : 'Grid'}
          </button>
        )}

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
