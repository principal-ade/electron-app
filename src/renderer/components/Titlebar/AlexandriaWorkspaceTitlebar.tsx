import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  PanelCollapseButton,
  type PanelLayout,
} from '@principal-ade/panel-layouts';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { Bot, Bug, FilePlus2, FolderGit2, Route } from 'lucide-react';
import { CreateRepositoryInWorkspaceModal } from '../../panels/components/CreateRepositoryInWorkspaceModal';
import { WorkspaceThemeDropdown } from './WorkspaceThemeDropdown';
import {
  PanelSelectorDropdown,
  type PanelOption,
} from './PanelSelectorDropdown';
import { BriefAgentButton } from './BriefAgentButton';

// Available panels for Alexandria workspace
// Ordered to match dev workspace panel options
const AVAILABLE_PANELS: PanelOption[] = [
  { id: 'principal-view', label: 'Architecture' },
  { id: 'alexandria-docs', label: 'Documentation' },
  { id: 'file-city', label: 'File City' },
  { id: 'localhost-browser', label: 'Localhost Browser' },
];

/**
 * Left-panel segments. The left side is restricted to two views — the
 * workspace's repositories and its trails — so we render a two-segment
 * switch instead of the generic panel dropdown.
 */
const LEFT_PANEL_SEGMENTS = [
  { id: 'workspace-repos', label: 'Projects', Icon: FolderGit2 },
  { id: 'trails', label: 'Trails', Icon: Route },
  { id: 'sessions', label: 'Sessions', Icon: Bot },
  { id: 'hook-debug', label: 'Hook Debug', Icon: Bug },
] as const;

export interface AlexandriaWorkspaceTitlebarProps {
  workspace: Workspace;
  selectedRepository?: { name: string; path: string };
  // Panel controls
  collapsed?: { left: boolean; right: boolean };
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  // Layout controls
  layout?: PanelLayout;
  onLayoutChange?: (layout: PanelLayout) => void;
}

export const AlexandriaWorkspaceTitlebar: React.FC<
  AlexandriaWorkspaceTitlebarProps
> = ({
  workspace,
  selectedRepository,
  collapsed,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onCollapsedChange,
  layout,
  onLayoutChange,
}) => {
  const { theme } = useTheme();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isTitlebarHovered, setIsTitlebarHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Show buttons if titlebar is hovered OR if dropdown is open
  const showHoverButtons = isTitlebarHovered || isDropdownOpen;

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

        {/* Left Panel Switch — Projects ↔ Trails */}
        {layout && onLayoutChange && typeof layout.left === 'string' && (
          <div
            style={{
              display: 'flex',
              padding: '2px',
              borderRadius: '6px',
              background: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              // @ts-ignore - WebkitAppRegion is not in CSSProperties
              WebkitAppRegion: 'no-drag',
            }}
          >
            {LEFT_PANEL_SEGMENTS.map(({ id, label, Icon }) => {
              const isActive = layout.left === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    handleLeftPanelChange(id);
                    handleExpandLeftPanel();
                  }}
                  title={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    border: 'none',
                    borderRadius: '4px',
                    background: isActive
                      ? theme.colors.background
                      : 'transparent',
                    color: isActive
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontWeight: isActive
                      ? theme.fontWeights.semibold
                      : theme.fontWeights.medium,
                    fontFamily: theme.fonts.body,
                    transition: 'all 0.15s',
                    boxShadow: isActive
                      ? '0 1px 2px rgba(0, 0, 0, 0.15)'
                      : 'none',
                  }}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
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

        </div>

        {/* Brief Agent — always visible. Draggable; drop on a terminal to
            link its Claude session to the current topic. */}
        <BriefAgentButton topicId={workspace.topicIds?.[0]} />

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

      {/* Create Repository Modal */}
      <CreateRepositoryInWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        workspace={workspace}
      />
    </div>
  );
};
