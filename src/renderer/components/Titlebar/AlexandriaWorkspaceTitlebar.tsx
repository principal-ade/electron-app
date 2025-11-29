import React, { useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelControls } from '@principal-ade/panel-layouts';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { Plus, Keyboard } from 'lucide-react';
import { AddRepositoryToWorkspaceModal } from '../../panels/components/AddRepositoryToWorkspaceModal';
import { WorkspaceThemeDropdown } from './WorkspaceThemeDropdown';

export interface AlexandriaWorkspaceTitlebarProps {
  workspace: Workspace;
  workspaceRepositoryIds?: string[];
  enableKeyboardShortcuts?: boolean;
  onToggleKeyboardShortcuts?: () => void;
  // Panel controls
  collapsed?: { left: boolean; right: boolean };
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onSwitchLeftMiddlePanels?: () => void;
  onSwitchRightMiddlePanels?: () => void;
}

export const AlexandriaWorkspaceTitlebar: React.FC<
  AlexandriaWorkspaceTitlebarProps
> = ({
  workspace,
  workspaceRepositoryIds = [],
  enableKeyboardShortcuts = false,
  onToggleKeyboardShortcuts,
  collapsed,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onSwitchLeftMiddlePanels,
  onSwitchRightMiddlePanels,
}) => {
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
        justifyContent: 'space-between',
        fontFamily: theme.fonts.body,
        position: 'relative',
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'drag',
      }}
    >
      {/* Left spacer for traffic lights on macOS */}
      <div style={{ width: '80px', flexShrink: 0 }} />

      {/* Center: Workspace name */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
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
              fontSize: `${theme.fontSizes[0]}px`,
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
        {/* Panel Controls */}
        {(onToggleLeftSidebar || onToggleRightSidebar || onSwitchLeftMiddlePanels || onSwitchRightMiddlePanels) && (
          <PanelControls
            leftSidebarCollapsed={collapsed?.left ?? false}
            onToggleLeftSidebar={onToggleLeftSidebar}
            showLeftSidebarControl={!!onToggleLeftSidebar}
            rightSidebarCollapsed={collapsed?.right ?? false}
            onToggleRightSidebar={onToggleRightSidebar}
            showRightSidebarControl={!!onToggleRightSidebar}
            onSwitchLeftMiddlePanels={onSwitchLeftMiddlePanels}
            showSwitchLeftMiddle={!!onSwitchLeftMiddlePanels}
            onSwitchRightMiddlePanels={onSwitchRightMiddlePanels}
            showSwitchRightMiddle={!!onSwitchRightMiddlePanels}
            iconSize={16}
          />
        )}

        {/* Theme Toggle */}
        <WorkspaceThemeDropdown
          workspaceId={workspace.id}
          currentTheme={workspace.theme}
        />

        {/* Keyboard Shortcuts Toggle */}
        {onToggleKeyboardShortcuts && (
          <button
            onClick={onToggleKeyboardShortcuts}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: enableKeyboardShortcuts ? theme.colors.primary : 'transparent',
              border: `1px solid ${enableKeyboardShortcuts ? theme.colors.primary : theme.colors.border}`,
              color: enableKeyboardShortcuts ? theme.colors.background : theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: `${theme.fontSizes[0]}px`,
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!enableKeyboardShortcuts) {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                e.currentTarget.style.borderColor = theme.colors.border;
              }
            }}
            onMouseLeave={(e) => {
              if (!enableKeyboardShortcuts) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = theme.colors.border;
              }
            }}
            title={enableKeyboardShortcuts ? 'Disable keyboard shortcuts (Alt+1/2/3)' : 'Enable keyboard shortcuts (Alt+1/2/3)'}
          >
            <Keyboard size={14} />
            {enableKeyboardShortcuts ? 'On' : 'Off'}
          </button>
        )}

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
            e.currentTarget.style.color = theme.colors.background;
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
