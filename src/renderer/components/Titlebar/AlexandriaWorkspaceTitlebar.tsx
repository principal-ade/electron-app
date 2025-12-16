import React, { useState, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  PanelCollapseButton,
  PanelSwitchButton,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { Plus, Keyboard, FilePlus2, Github } from 'lucide-react';
import { AddRepositoryToWorkspaceModal } from '../../panels/components/AddRepositoryToWorkspaceModal';
import { CreateRepositoryInWorkspaceModal } from '../../panels/components/CreateRepositoryInWorkspaceModal';
import { CloneFromGitHubModal } from '../../panels/components/CloneFromGitHubModal';
import { WorkspaceThemeDropdown } from './WorkspaceThemeDropdown';
import {
  PanelSelectorDropdown,
  type PanelOption,
} from './PanelSelectorDropdown';

// Available panels for Alexandria workspace
const AVAILABLE_PANELS: PanelOption[] = [
  { id: 'workspace-repos', label: 'Repositories' },
  { id: 'local-projects', label: 'Local Projects' },
  { id: 'alexandria-docs', label: 'Documentation' },
  { id: 'file-city', label: 'File City' },
  { id: 'localhost-browser', label: 'Localhost Browser' },
  { id: 'terminal', label: 'Terminal' },
];

export interface AlexandriaWorkspaceTitlebarProps {
  workspace: Workspace;
  workspaceRepositoryIds?: string[];
  selectedRepository?: { name: string; path: string };
  enableKeyboardShortcuts?: boolean;
  onToggleKeyboardShortcuts?: () => void;
  // Panel controls
  collapsed?: { left: boolean; right: boolean };
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onSwitchLeftMiddlePanels?: () => void;
  onSwitchRightMiddlePanels?: () => void;
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  // Layout controls
  layout?: PanelLayout;
  onLayoutChange?: (layout: PanelLayout) => void;
}

export const AlexandriaWorkspaceTitlebar: React.FC<
  AlexandriaWorkspaceTitlebarProps
> = ({
  workspace,
  workspaceRepositoryIds = [],
  selectedRepository,
  enableKeyboardShortcuts = false,
  onToggleKeyboardShortcuts,
  collapsed,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onSwitchLeftMiddlePanels,
  onSwitchRightMiddlePanels,
  onCollapsedChange,
  layout,
  onLayoutChange,
}) => {
  const { theme } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [isTitlebarHovered, setIsTitlebarHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Show buttons if titlebar is hovered OR if dropdown is open
  const showHoverButtons = isTitlebarHovered || isDropdownOpen;

  // Memoize the repository IDs for the modal
  const currentRepositoryIds = useMemo(() => {
    return workspaceRepositoryIds.filter((id): id is string => id != null);
  }, [workspaceRepositoryIds]);

  // Handler for changing the left panel
  const handleLeftPanelChange = (panelId: string) => {
    if (layout && onLayoutChange) {
      onLayoutChange({ ...layout, left: panelId });
    }
  };

  // Handler for changing the right panel
  const handleRightPanelChange = (panelId: string) => {
    if (layout && onLayoutChange) {
      onLayoutChange({ ...layout, right: panelId });
    }
  };

  // Handler to expand left panel if collapsed
  const handleExpandLeftPanel = () => {
    if (collapsed?.left && onCollapsedChange) {
      onCollapsedChange({ ...collapsed, left: false });
    }
  };

  // Handler to expand right panel if collapsed
  const handleExpandRightPanel = () => {
    if (collapsed?.right && onCollapsedChange) {
      onCollapsedChange({ ...collapsed, right: false });
    }
  };

  return (
    <div
      onMouseEnter={() => setIsTitlebarHovered(true)}
      onMouseLeave={() => setIsTitlebarHovered(false)}
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
      {/* Left section: traffic lights spacer + left panel dropdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginLeft: '16px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Traffic lights spacer on macOS */}
        <div style={{ width: '64px', flexShrink: 0 }} />

        {/* Left Collapse Button - outside the panel selector */}
        {onToggleLeftSidebar && (
          <PanelCollapseButton
            isCollapsed={collapsed?.left ?? false}
            onToggle={onToggleLeftSidebar}
            side="left"
            iconSize={16}
            style={{
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              padding: '6px 8px',
              minHeight: '34px',
              boxSizing: 'border-box',
            }}
          />
        )}

        {/* Left Panel Selector */}
        {layout && onLayoutChange && typeof layout.left === 'string' && (
          <PanelSelectorDropdown
            side="left"
            currentPanelId={layout.left}
            availablePanels={AVAILABLE_PANELS}
            onPanelChange={handleLeftPanelChange}
            onExpand={handleExpandLeftPanel}
          />
        )}

        {/* Left-Middle Switch Button */}
        {onSwitchLeftMiddlePanels && (
          <PanelSwitchButton
            onSwitch={onSwitchLeftMiddlePanels}
            variant="left-middle"
            iconSize={16}
            style={{
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              padding: '6px 8px',
              minHeight: '34px',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* Center: Workspace name and selected repository */}
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

        {/* Selected repository or description */}
        {selectedRepository ? (
          <span
            style={{
              fontSize: `${theme.fontSizes[0]}px`,
              color: theme.colors.accent,
              fontFamily: theme.fonts.body,
              maxWidth: '300px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={selectedRepository.path}
          >
            {selectedRepository.name}
          </span>
        ) : workspace.description ? (
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
        ) : null}
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
        {/* Hover-reveal buttons: Theme, Create, Add */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            opacity: showHoverButtons ? 1 : 0,
            visibility: showHoverButtons ? 'visible' : 'hidden',
            transition: 'opacity 0.2s ease, visibility 0.2s ease',
          }}
        >
          {/* Theme Toggle */}
          <WorkspaceThemeDropdown
            workspaceId={workspace.id}
            currentTheme={workspace.theme}
            onOpenChange={setIsDropdownOpen}
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
                backgroundColor: enableKeyboardShortcuts
                  ? theme.colors.primary
                  : 'transparent',
                border: `1px solid ${enableKeyboardShortcuts ? theme.colors.primary : theme.colors.border}`,
                color: enableKeyboardShortcuts
                  ? theme.colors.background
                  : theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: `${theme.fontSizes[0]}px`,
                fontWeight: theme.fontWeights.medium,
                fontFamily: theme.fonts.body,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!enableKeyboardShortcuts) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                }
              }}
              onMouseLeave={(e) => {
                if (!enableKeyboardShortcuts) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = theme.colors.border;
                }
              }}
              title={
                enableKeyboardShortcuts
                  ? 'Disable keyboard shortcuts (Alt+1/2/3)'
                  : 'Enable keyboard shortcuts (Alt+1/2/3)'
              }
            >
              <Keyboard size={14} />
              {enableKeyboardShortcuts ? 'On' : 'Off'}
            </button>
          )}

          {/* Create Repository Button - only show if workspace has a clone path */}
          {workspace.suggestedClonePath && (
            <button
              onClick={() => setShowCreateModal(true)}
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
              title="Create new GitHub repository"
            >
              <FilePlus2 size={14} />
              Create
            </button>
          )}

          {/* Clone from GitHub Button - only show if workspace has a clone path */}
          {workspace.suggestedClonePath && (
            <button
              onClick={() => setShowCloneModal(true)}
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
              title="Clone repository from GitHub"
            >
              <Github size={14} />
              Clone
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
            title="Add existing repository to workspace"
          >
            <Plus size={14} />
            Add
          </button>
        </div>

        {/* Right-Middle Switch Button */}
        {onSwitchRightMiddlePanels && (
          <PanelSwitchButton
            onSwitch={onSwitchRightMiddlePanels}
            variant="right-middle"
            iconSize={16}
            style={{
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              padding: '6px 8px',
              minHeight: '34px',
              boxSizing: 'border-box',
            }}
          />
        )}

        {/* Right Panel Selector */}
        {layout && onLayoutChange && typeof layout.right === 'string' && (
          <PanelSelectorDropdown
            side="right"
            currentPanelId={layout.right}
            availablePanels={AVAILABLE_PANELS}
            onPanelChange={handleRightPanelChange}
            onExpand={handleExpandRightPanel}
          />
        )}

        {/* Right Collapse Button - outside the panel selector */}
        {onToggleRightSidebar && (
          <PanelCollapseButton
            isCollapsed={collapsed?.right ?? false}
            onToggle={onToggleRightSidebar}
            side="right"
            iconSize={16}
            style={{
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              padding: '6px 8px',
              minHeight: '34px',
              boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {/* Add Repository Modal */}
      <AddRepositoryToWorkspaceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        workspace={workspace}
        currentRepositoryIds={currentRepositoryIds}
      />

      {/* Create Repository Modal */}
      <CreateRepositoryInWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        workspace={workspace}
      />

      {/* Clone from GitHub Modal */}
      <CloneFromGitHubModal
        isOpen={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        workspace={workspace}
      />
    </div>
  );
};
