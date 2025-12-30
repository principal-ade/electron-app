import React, { useState } from 'react';
import {
  Layers,
  Cloud,
  CloudOff,
  Terminal,
  Globe,
  Check,
  Copy,
  Play,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  PanelCollapseButton,
  PanelSwitchButton,
} from '@principal-ade/panel-layouts';
import { BaseTitlebar } from '../components/Titlebar/BaseTitlebar';
import { GitSyncStatusIndicator } from '../components/Titlebar/GitSyncStatusIndicator';
import { RepositoryAvatar } from '../components/repository-maps/RepositoryAvatar';
import {
  PanelSelectorDropdown,
  type PanelOption,
} from '../components/Titlebar/PanelSelectorDropdown';
import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
import { useRepositoryGitStatus } from '../hooks/useRepositoryGitStatus';

// Available panels for Dev workspace
const AVAILABLE_PANELS: PanelOption[] = [
  { id: 'principalView', label: 'Architecture' },
  { id: 'codeQuality', label: 'Code Quality' },
  { id: 'docs', label: 'Documentation' },
  { id: 'fileCity', label: 'File City' },
  { id: 'fileEditor', label: 'File Editor' },
  { id: 'gitChanges', label: 'File Tree' },
  { id: 'gitDiff', label: 'Git Diff' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'localhostBrowser', label: 'Localhost Browser' },
  { id: 'localProjects', label: 'Local Projects' },
  { id: 'mdxEditor', label: 'MDX Editor' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'packageComposition', label: 'Package Composition' },
  { id: 'task-detail', label: 'Task Detail' },
  { id: 'terminal', label: 'Terminal' },
];

// Panel configuration presets
export interface PanelPreset {
  id: string;
  name: string;
  description?: string;
  layout: {
    left: string;
    middle: string;
    right: string;
  };
  collapsed?: {
    left: boolean;
    right: boolean;
  };
}

export const DEFAULT_PANEL_PRESETS: PanelPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Local Projects, Terminal, File City',
    layout: {
      left: 'localProjects',
      middle: 'terminal',
      right: 'fileCity',
    },
  },
  {
    id: 'principal-view',
    name: 'Principal View',
    description: 'Principal View, Terminal, File City',
    layout: { left: 'principalView', middle: 'terminal', right: 'fileCity' },
  },
  {
    id: 'docs-focused',
    name: 'Documentation Focus',
    description: 'Documentation, Terminal, Documentation',
    layout: { left: 'docs', middle: 'terminal', right: 'docs' },
  },
  {
    id: 'terminal-focused',
    name: 'Terminal Focus',
    description: 'File City, Terminal, Principal View',
    layout: { left: 'fileCity', middle: 'terminal', right: 'principalView' },
  },
  {
    id: 'storybook',
    name: 'Storybook',
    description: 'Browser, Terminal, Browser (Alt)',
    layout: {
      left: 'localhostBrowser',
      middle: 'terminal',
      right: 'localhostBrowserAlt',
    },
    collapsed: { left: true, right: false },
  },
  {
    id: 'file-editor',
    name: 'File Editor',
    description: 'File Tree, File Editor, Terminal',
    layout: {
      left: 'gitChanges',
      middle: 'fileEditor',
      right: 'terminal',
    },
  },
  {
    id: 'backlog',
    name: 'Backlog.md',
    description: 'Milestones, Kanban, Task Detail',
    layout: {
      left: 'milestones',
      middle: 'kanban',
      right: 'task-detail',
    },
  },
];

export interface DevWorkspaceTitlebarProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  selectedSource?: FileTreeSource | null;
  onShowGitChanges?: () => void;
  // UI Mode toggle
  onSwitchToClassic?: () => void;
  // Terminal implementation toggle
  terminalImplementation?: 'xterm' | 'ghostty';
  onToggleTerminalImplementation?: () => void;
  // Panel controls
  collapsed?: { left: boolean; right: boolean };
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onSwitchLeftMiddlePanels?: () => void;
  onSwitchRightMiddlePanels?: () => void;
  // Web-ADE integration
  onOpenInWebADE?: () => void;
  // GitHub Actions
  onOpenGitHubActions?: () => void;
  // Panel configuration
  currentLayout?: { left: string; middle: string; right: string };
  onLayoutChange?: (layout: {
    left: string;
    middle: string;
    right: string;
  }) => void;
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  // Repository path for copy
  repositoryPath?: string;
  // Panel focus (dim that panel)
  panelFocus?: { left: boolean; right: boolean };
  onFocusLeft?: () => void;
  onFocusRight?: () => void;
}

export const DevWorkspaceTitlebar: React.FC<DevWorkspaceTitlebarProps> = ({
  repository,
  repositoryOwner,
  repositoryName,
  selectedSource,
  onShowGitChanges,
  onSwitchToClassic,
  terminalImplementation,
  onToggleTerminalImplementation,
  collapsed,
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onSwitchLeftMiddlePanels,
  onSwitchRightMiddlePanels,
  onOpenInWebADE,
  onOpenGitHubActions,
  currentLayout,
  onLayoutChange,
  onCollapsedChange,
  repositoryPath,
  panelFocus,
  onFocusLeft,
  onFocusRight,
}) => {
  const { theme } = useTheme();
  const [copiedPath, setCopiedPath] = useState(false);
  const [isTitlebarHovered, setIsTitlebarHovered] = useState(false);

  // Handle copy repository path
  const handleCopyPath = async () => {
    if (!repositoryPath) return;
    try {
      await navigator.clipboard.writeText(repositoryPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (error) {
      console.error('[DevWorkspaceTitlebar] Failed to copy path:', error);
    }
  };

  // Handler for changing the left panel
  const handleLeftPanelChange = (panelId: string) => {
    if (currentLayout && onLayoutChange) {
      onLayoutChange({ ...currentLayout, left: panelId });
    }
  };

  // Handler for changing the right panel
  const handleRightPanelChange = (panelId: string) => {
    if (currentLayout && onLayoutChange) {
      onLayoutChange({ ...currentLayout, right: panelId });
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

  // Get local clone path for git status
  const localClonePath =
    selectedSource?.type === 'local'
      ? selectedSource.location
      : repository?.localClones?.[0]?.path;

  // Subscribe to git status
  const { gitStatus, gitStatusWithFiles } = useRepositoryGitStatus(
    localClonePath || null,
  );

  // Check if there are uncommitted changes
  const hasUncommittedChanges = gitStatusWithFiles
    ? gitStatusWithFiles.modifiedFiles.length +
        gitStatusWithFiles.untrackedFiles.length +
        gitStatusWithFiles.stagedFiles.length +
        gitStatusWithFiles.createdFiles.length +
        gitStatusWithFiles.deletedFiles.length >
      0
    : false;

  const displayName = repositoryName || repository?.name || 'Repository';
  const displayOwner = repositoryOwner || repository?.owner;

  // Get avatar URL
  const avatarUrl =
    repository?.avatarUrl ||
    (displayOwner ? `https://github.com/${displayOwner}.png` : null);

  return (
    <div
      onMouseEnter={() => setIsTitlebarHovered(true)}
      onMouseLeave={() => setIsTitlebarHovered(false)}
      style={{ display: 'contents' }}
    >
      <BaseTitlebar confirmBeforeClose={true}>
        {/* Left: Configuration button */}
        {onLayoutChange && (
          <div
            style={{
              position: 'absolute',
              left: '80px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              // @ts-ignore - WebkitAppRegion is not in CSSProperties
              WebkitAppRegion: 'no-drag',
            }}
          >
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

            {/* Left Focus Button - dim the left panel */}
            {onFocusLeft && !collapsed?.left && (
              <button
                onClick={onFocusLeft}
                title={panelFocus?.left ? 'Show left panel' : 'Dim left panel'}
                style={{
                  background: panelFocus?.left
                    ? theme.colors.primary
                    : theme.colors.backgroundTertiary,
                  border: `1px solid ${panelFocus?.left ? theme.colors.primary : theme.colors.border}`,
                  color: panelFocus?.left
                    ? theme.colors.background
                    : theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '34px',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!panelFocus?.left) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.text;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!panelFocus?.left) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }
                }}
              >
                {panelFocus?.left ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}

            {/* Left Panel Selector */}
            {currentLayout && (
              <PanelSelectorDropdown
                side="left"
                currentPanelId={currentLayout.left}
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

            {/* Hover-reveal button: Copy Path */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isTitlebarHovered ? 1 : 0,
                visibility: isTitlebarHovered ? 'visible' : 'hidden',
                transition: 'opacity 0.2s ease, visibility 0.2s ease',
              }}
            >
              {/* Copy Path Button */}
              {repositoryPath && (
                <button
                  onClick={handleCopyPath}
                  title={
                    copiedPath ? 'Copied!' : `Copy path: ${repositoryPath}`
                  }
                  style={{
                    // @ts-ignore - WebkitAppRegion is not in CSSProperties
                    WebkitAppRegion: 'no-drag',
                    background: copiedPath
                      ? theme.colors.success
                      : theme.colors.backgroundTertiary,
                    border: `1px solid ${copiedPath ? theme.colors.success : theme.colors.border}`,
                    color: copiedPath
                      ? theme.colors.background
                      : theme.colors.textSecondary,
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontWeight: theme.fontWeights.medium,
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedPath) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedPath) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }
                  }}
                >
                  {copiedPath ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedPath ? 'Copied' : 'Path'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Center: Repository info */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            // @ts-ignore - WebkitAppRegion is not in CSSProperties
            WebkitAppRegion: 'no-drag',
          }}
        >
          {/* Avatar - left side */}
          <div style={{ width: '28px', height: '28px', flexShrink: 0 }}>
            {repository && (
              <RepositoryAvatar
                repository={repository}
                type="owner"
                size={28}
                customAvatarUrl={avatarUrl}
              />
            )}
          </div>

          {/* Repository name, branch, and sync status */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            {/* Repository name */}
            <span
              style={{
                fontSize: `${theme.fontSizes[2]}px`,
                fontWeight: theme.fontWeights.medium,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
                cursor: displayOwner ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (displayOwner && displayName) {
                  window.open(
                    `https://github.com/${displayOwner}/${displayName}`,
                    '_blank',
                  );
                }
              }}
              onMouseEnter={(e) => {
                if (displayOwner) {
                  e.currentTarget.style.opacity = '0.7';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              title={
                displayOwner
                  ? `Open ${displayOwner}/${displayName} on GitHub`
                  : undefined
              }
            >
              {displayName}
            </span>

            {/* Remote sync status and branch - second line */}
            {selectedSource?.type === 'local' &&
              selectedSource.metadata?.currentBranch && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: `${theme.fontSizes[0]}px`,
                  }}
                >
                  {/* Remote sync status */}
                  {gitStatus && (
                    <>
                      {gitStatus.ahead === 0 && gitStatus.behind === 0 ? (
                        <span
                          style={{
                            color: theme.colors.success,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Cloud size={12} />
                          <span>Synced</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            color: theme.colors.warning,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CloudOff size={12} />
                          <span>
                            {gitStatus.ahead > 0 && gitStatus.behind > 0
                              ? 'Diverged'
                              : gitStatus.ahead > 0
                                ? 'Ahead'
                                : 'Behind'}
                          </span>
                        </span>
                      )}
                      <span style={{ color: theme.colors.textSecondary }}>
                        ·
                      </span>
                    </>
                  )}

                  {/* Branch info */}
                  <span
                    style={{
                      color: theme.colors.accent,
                      fontWeight: theme.fontWeights.medium,
                    }}
                  >
                    on
                  </span>
                  <span
                    style={{
                      color: theme.colors.text,
                      fontWeight: theme.fontWeights.medium,
                    }}
                  >
                    {selectedSource.metadata.currentBranch}
                  </span>

                  {/* Uncommitted changes indicator */}
                  {hasUncommittedChanges && (
                    <span
                      onClick={
                        onShowGitChanges
                          ? (e) => {
                              e.stopPropagation();
                              onShowGitChanges();
                            }
                          : undefined
                      }
                      style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: theme.colors.warning,
                        cursor: onShowGitChanges ? 'pointer' : 'default',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={
                        onShowGitChanges
                          ? (e) => {
                              e.currentTarget.style.opacity = '0.7';
                            }
                          : undefined
                      }
                      onMouseLeave={
                        onShowGitChanges
                          ? (e) => {
                              e.currentTarget.style.opacity = '1';
                            }
                          : undefined
                      }
                      title={
                        onShowGitChanges
                          ? 'Click to view uncommitted changes'
                          : 'Uncommitted changes'
                      }
                    />
                  )}
                </span>
              )}
          </div>

          {/* Git-Sync connectivity indicator - right side, mirrors avatar */}
          <div
            style={{
              width: '28px',
              height: '28px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GitSyncStatusIndicator
              repositoryPath={
                selectedSource?.type === 'local'
                  ? selectedSource.location
                  : undefined
              }
              branch={
                selectedSource?.type === 'local'
                  ? selectedSource.metadata?.currentBranch
                  : undefined
              }
            />
          </div>
        </div>

        {/* Right: Panel controls, terminal toggle, mode switch, and panel selector */}
        <div
          style={{
            position: 'absolute',
            right: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            // @ts-ignore - WebkitAppRegion is not in CSSProperties
            WebkitAppRegion: 'no-drag',
          }}
        >
          {/* Hover-reveal buttons: Web-ADE, Terminal toggle, Legacy */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isTitlebarHovered ? 1 : 0,
              visibility: isTitlebarHovered ? 'visible' : 'hidden',
              transition: 'opacity 0.2s ease, visibility 0.2s ease',
            }}
          >
            {/* Open in Web-ADE Button */}
            {onOpenInWebADE && (
              <button
                onClick={onOpenInWebADE}
                title="Open in Web-ADE"
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.medium,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <Globe size={14} />
                <span>Web</span>
              </button>
            )}

            {/* Open GitHub Actions Button */}
            {onOpenGitHubActions && (
              <button
                onClick={onOpenGitHubActions}
                title="Open GitHub Actions"
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.medium,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <Play size={14} />
                <span>Actions</span>
              </button>
            )}

            {/* Terminal Implementation Toggle */}
            {onToggleTerminalImplementation && (
              <button
                onClick={onToggleTerminalImplementation}
                title={`Switch to ${terminalImplementation === 'ghostty' ? 'XTerm' : 'Ghostty'} terminal`}
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.medium,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <Terminal size={14} />
                <span>
                  {terminalImplementation === 'ghostty' ? 'Ghostty' : 'XTerm'}
                </span>
              </button>
            )}
            {onSwitchToClassic && (
              <button
                onClick={onSwitchToClassic}
                title="Open Legacy View"
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.medium,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <Layers size={14} />
                <span>Legacy</span>
              </button>
            )}
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
                padding: '6px',
              }}
            />
          )}

          {/* Right Panel Selector */}
          {currentLayout && onLayoutChange && (
            <PanelSelectorDropdown
              side="right"
              currentPanelId={currentLayout.right}
              availablePanels={AVAILABLE_PANELS}
              onPanelChange={handleRightPanelChange}
              onExpand={handleExpandRightPanel}
            />
          )}

          {/* Right Focus Button - dim the right panel */}
          {onFocusRight && !collapsed?.right && (
            <button
              onClick={onFocusRight}
              title={panelFocus?.right ? 'Show right panel' : 'Dim right panel'}
              style={{
                background: panelFocus?.right
                  ? theme.colors.primary
                  : theme.colors.backgroundTertiary,
                border: `1px solid ${panelFocus?.right ? theme.colors.primary : theme.colors.border}`,
                color: panelFocus?.right
                  ? theme.colors.background
                  : theme.colors.textSecondary,
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!panelFocus?.right) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!panelFocus?.right) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }
              }}
            >
              {panelFocus?.right ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}

          {/* Right Collapse Button - outside the panel selector */}
          {onToggleRightSidebar && (
            <PanelCollapseButton
              isCollapsed={collapsed?.right ?? true}
              onToggle={onToggleRightSidebar}
              side="right"
              iconSize={16}
              style={{
                background: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                padding: '6px',
              }}
            />
          )}
        </div>
      </BaseTitlebar>
    </div>
  );
};
