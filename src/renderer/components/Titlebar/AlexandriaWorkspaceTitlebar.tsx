import React, { useState, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { Workspace } from '@a24z/core-library';
import { Plus } from 'lucide-react';
import { AddRepositoryToWorkspaceModal } from '../../panels/components/AddRepositoryToWorkspaceModal';

export interface AlexandriaWorkspaceTitlebarProps {
  workspace: Workspace;
  workspaceRepositoryIds?: string[];
}

export const AlexandriaWorkspaceTitlebar: React.FC<
  AlexandriaWorkspaceTitlebarProps
> = ({ workspace, workspaceRepositoryIds = [] }) => {
  const { theme } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);

  // Memoize the repository IDs for the modal
  const currentRepositoryIds = useMemo(() => {
    return workspaceRepositoryIds.filter((id): id is string => id != null);
  }, [workspaceRepositoryIds]);

  return (
    <div
      style={{
        height: '56px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        fontFamily: theme.fonts.body,
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'drag',
      }}
    >
      {/* Left: Workspace name and color indicator */}
      <div
        style={{
          marginLeft: '80px', // Position after traffic lights on macOS
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Color indicator */}
        {workspace.color && (
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: workspace.color,
            }}
          />
        )}

        {/* Workspace name */}
        <span
          style={{
            fontSize: `${theme.fontSizes[2]}px`,
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
          }}
        >
          {workspace.name}
        </span>

        {/* Description */}
        {workspace.description && (
          <span
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {workspace.description}
          </span>
        )}
      </div>

      {/* Right: Actions will go here */}
      <div
        style={{
          marginLeft: 'auto',
          marginRight: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Add Repository Button */}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            fontSize: `${theme.fontSizes[0]}px`,
            fontWeight: theme.fontWeights.medium,
            fontFamily: theme.fonts.body,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary;
            e.currentTarget.style.borderColor = theme.colors.primary;
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
          title="Add repository to workspace"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {/* Add Repository Modal */}
      <AddRepositoryToWorkspaceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        workspace={workspace}
        currentRepositoryIds={currentRepositoryIds}
      />
    </div>
  );
};
