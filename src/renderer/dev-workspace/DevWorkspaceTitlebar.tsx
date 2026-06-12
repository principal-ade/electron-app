import React, { useState } from 'react';
import {
  Cloud,
  CloudOff,
  Terminal,
  Columns3,
  Square,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Building2,
  RefreshCw,
  Settings,
  StickyNote,
  GitBranch,
} from 'lucide-react';
import { FileSystemService } from '../main-process-api/FileSystemService';
import {
  DevWorkspaceConfigModal,
  type DevWorkspaceConfig,
} from './DevWorkspaceConfigModal';
import { useTheme } from '@principal-ade/industry-theme';
import { BaseTitlebar } from '../components/Titlebar/BaseTitlebar';
import { GitSyncStatusIndicator } from '../components/Titlebar/GitSyncStatusIndicator';
import { StorybookHeaderButton } from '../components/Titlebar/StorybookHeaderButton';
import { RepositoryAvatar } from '../components/repository-maps/RepositoryAvatar';
import { ThemeSelector } from '../principal-window/components/IntegratedShell/ThemeSelector';
import type { StorybookManager } from '../hooks/useStorybookManager';
import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
import { useRepositoryGitStatus } from '../hooks/useRepositoryGitStatus';

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
  panelSizes?: {
    left: number;
    middle: number;
    right: number;
  };
}

export const DEFAULT_PANEL_PRESETS: PanelPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Kanban, Terminal, File City',
    layout: {
      left: 'kanban',
      middle: 'terminal',
      right: 'fileCity',
    },
  },
  {
    id: 'canvas-editor',
    name: 'Canvas Editor',
    description: 'Canvas Editor, Terminal, File City',
    layout: { left: 'canvasEditor', middle: 'terminal', right: 'fileCity' },
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
    description: 'File City, Terminal, Canvas Editor',
    layout: { left: 'fileCity', middle: 'terminal', right: 'canvasEditor' },
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
    panelSizes: { left: 0, middle: 50, right: 50 },
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
  {
    id: 'agent-skills',
    name: 'Agent Skills',
    description: 'Skills List, Terminal, Skill Detail',
    layout: {
      left: 'skillsList',
      middle: 'terminal',
      right: 'skillDetail',
    },
  },
  {
    id: 'agents',
    name: 'Agents & Subagents',
    description: 'Agents List, Terminal, Agent Detail',
    layout: {
      left: 'agentsList',
      middle: 'terminal',
      right: 'agentDetail',
    },
  },
  {
    id: 'canvas-viewer',
    name: 'Canvas Viewer',
    description: 'Architecture, Terminal, Canvas Editor',
    layout: {
      left: 'canvasList',
      middle: 'terminal',
      right: 'canvasEditor',
    },
  },
];

export interface DevWorkspaceTitlebarProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  selectedSource?: FileTreeSource | null;
  onShowGitChanges?: () => void;
  /** Callback to open FileCity 3D visualization as a tab */
  onOpenFileCity3D?: () => void;
  /** Callback to open the parallel File City Trail panel as a tab */
  onOpenFileCityTrail?: () => void;
  // Terminal implementation toggle
  terminalImplementation?: 'xterm' | 'ghostty';
  onToggleTerminalImplementation?: () => void;
  // Panel collapse/expand - imperative approach
  isLeftCollapsed?: boolean;
  isRightCollapsed?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  // Panel configuration
  currentLayout?: { left: string; middle: string; right: string };
  onLayoutChange?: (layout: {
    left: string;
    middle: string;
    right: string;
  }) => void;
  // Repository path for copy
  repositoryPath?: string;
  // Open in Finder
  onOpenInFinder?: () => void;
  // Service names and trace counts
  availableServiceNames?: string[];
  serviceTraceCounts?: Map<string, number>;
  lastActiveService?: string | null;
  // Sidebar visibility toggle
  sidebarsHidden?: boolean;
  onSidebarsHiddenChange?: (hidden: boolean) => void;
  // Workspace sync to otel-events-manager
  onSyncWorkspace?: () => void;
  isSyncingWorkspace?: boolean;
  // Dev workspace config (titlebar button + sidebar icon visibility)
  config: DevWorkspaceConfig;
  onConfigChange: (next: DevWorkspaceConfig) => void;
  // Storybook lifecycle manager (start/stop button in header)
  storybook?: StorybookManager;
}

export const DevWorkspaceTitlebar: React.FC<DevWorkspaceTitlebarProps> = ({
  repository,
  repositoryOwner,
  repositoryName,
  selectedSource,
  onShowGitChanges,
  onOpenFileCity3D,
  onOpenFileCityTrail,
  terminalImplementation,
  onToggleTerminalImplementation,
  isLeftCollapsed = false,
  isRightCollapsed = false,
  onToggleLeftPanel,
  onToggleRightPanel,
  currentLayout: _currentLayout,
  onLayoutChange,
  repositoryPath,
  onOpenInFinder,
  availableServiceNames,
  serviceTraceCounts,
  lastActiveService,
  sidebarsHidden,
  onSidebarsHiddenChange,
  onSyncWorkspace,
  isSyncingWorkspace = false,
  config,
  onConfigChange,
  storybook,
}) => {
  const { theme } = useTheme();
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  // Open Notes panel (creates .principal/notes.md if missing)
  const handleOpenNotes = async () => {
    if (!repositoryPath || !_currentLayout || !onLayoutChange) return;
    const notesPath = `${repositoryPath}/.principal/notes.md`;
    const existing = await FileSystemService.readFile(notesPath);
    if (!existing) {
      try {
        await FileSystemService.writeFile(notesPath, '# Notes\n\n');
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        return;
      }
    }
    onLayoutChange({ ..._currentLayout, right: 'notes' });
  };

  // Open Git Config panel
  const handleOpenGitConfig = () => {
    if (!_currentLayout || !onLayoutChange) return;
    onLayoutChange({ ..._currentLayout, right: 'gitConfig' });
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
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.preventDefault();
      }}
      style={{ display: 'contents' }}
    >
      <BaseTitlebar confirmBeforeClose={true}>
        {/* Left sidebar collapse button */}
        {onToggleLeftPanel && (
          <button
            onClick={onToggleLeftPanel}
            title={isLeftCollapsed ? 'Expand left panel' : 'Collapse left panel'}
            style={{
              position: 'absolute',
              left: '80px',
              // @ts-ignore - WebkitAppRegion is not in CSSProperties
              WebkitAppRegion: 'no-drag',
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            {isLeftCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        )}

        {/* Left: Configuration button */}
        {onLayoutChange && (
          <div
            style={{
              position: 'absolute',
              left: '115px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              // @ts-ignore - WebkitAppRegion is not in CSSProperties
              WebkitAppRegion: 'no-drag',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {/* File City 3D Button */}
              {onOpenFileCity3D && config.titlebar.fileCity3D && (
                <button
                  onClick={onOpenFileCity3D}
                  title="Open File City 3D visualization"
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
                  <Building2 size={14} />
                  <span>3D City</span>
                </button>
              )}

              {/* File City Trail Button */}
              {onOpenFileCityTrail && config.titlebar.trail && (
                <button
                  onClick={onOpenFileCityTrail}
                  title="Open File City Trail explorer"
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
                  <Building2 size={14} />
                  <span>Trail</span>
                </button>
              )}

              {/* Service Trace Counts Display */}
              {config.titlebar.traces && availableServiceNames && availableServiceNames.length > 0 && (
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <button
                    onClick={() => setServicesExpanded(!servicesExpanded)}
                    style={{
                      // @ts-ignore - WebkitAppRegion is not in CSSProperties
                      WebkitAppRegion: 'no-drag',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: theme.colors.backgroundTertiary,
                      borderRadius: '6px',
                      border: `1px solid ${theme.colors.border}`,
                      cursor: 'pointer',
                      fontSize: `${theme.fontSizes[1]}px`,
                      fontWeight: theme.fontWeights.medium,
                      fontFamily: theme.fonts.body,
                      color: theme.colors.textSecondary,
                    }}
                    title={servicesExpanded ? 'Click to collapse' : 'Click to expand all services'}
                  >
                    <span style={{ color: theme.colors.textTertiary }}>Traces:</span>
                    {lastActiveService ? (
                      <>
                        <span style={{ color: theme.colors.success }}>{lastActiveService}</span>
                        <span
                          style={{
                            background: theme.colors.success,
                            color: '#fff',
                            padding: '0 5px',
                            borderRadius: '8px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          {serviceTraceCounts?.get(lastActiveService) || 0}
                        </span>
                      </>
                    ) : availableServiceNames.length === 1 ? (
                      <span style={{ color: theme.colors.textSecondary }}>{availableServiceNames[0]}</span>
                    ) : availableServiceNames.length > 1 ? (
                      <span style={{ color: theme.colors.textSecondary }}>
                        {availableServiceNames.length} services registered
                      </span>
                    ) : (
                      <span style={{ color: theme.colors.textTertiary }}>no services</span>
                    )}
                    {availableServiceNames.length > 1 && (
                      <span style={{ color: theme.colors.textTertiary, marginLeft: '2px' }}>
                        {servicesExpanded ? '▲' : '▼'}
                      </span>
                    )}
                  </button>

                  {/* Expanded dropdown */}
                  {servicesExpanded && availableServiceNames.length > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        background: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        padding: '4px',
                        zIndex: 1000,
                        minWidth: '200px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      {availableServiceNames.map((serviceName) => {
                        const count = serviceTraceCounts?.get(serviceName) || 0;
                        const isActive = serviceName === lastActiveService;
                        return (
                          <div
                            key={serviceName}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              background: isActive ? theme.colors.success + '15' : 'transparent',
                            }}
                          >
                            <span
                              style={{
                                color: count > 0 ? theme.colors.text : theme.colors.textTertiary,
                                fontSize: `${theme.fontSizes[1]}px`,
                                fontWeight: theme.fontWeights.medium,
                                fontFamily: theme.fonts.body,
                              }}
                            >
                              {serviceName}
                              {isActive && (
                                <span style={{ color: theme.colors.success, marginLeft: '4px' }}>●</span>
                              )}
                            </span>
                            <span
                              style={{
                                background: count > 0 ? theme.colors.success : theme.colors.backgroundTertiary,
                                color: count > 0 ? '#fff' : theme.colors.textTertiary,
                                padding: '2px 8px',
                                borderRadius: '8px',
                                fontSize: `${theme.fontSizes[0]}px`,
                                fontWeight: 600,
                              }}
                            >
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Workspace Sync Button */}
              {onSyncWorkspace && config.titlebar.sync && (
                <button
                  onClick={onSyncWorkspace}
                  disabled={isSyncingWorkspace}
                  title="Sync workspace to OTEL Events Manager"
                  style={{
                    // @ts-ignore - WebkitAppRegion is not in CSSProperties
                    WebkitAppRegion: 'no-drag',
                    background: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    color: theme.colors.textSecondary,
                    cursor: isSyncingWorkspace ? 'wait' : 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    fontSize: `${theme.fontSizes[1]}px`,
                    fontWeight: theme.fontWeights.medium,
                    opacity: isSyncingWorkspace ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSyncingWorkspace) {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                >
                  <RefreshCw
                    size={14}
                    style={{
                      animation: isSyncingWorkspace ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                  <span>{isSyncingWorkspace ? 'Syncing...' : 'Sync'}</span>
                </button>
              )}

              {/* Git Config Button */}
              {config.titlebar.gitConfig && (
                <button
                  onClick={handleOpenGitConfig}
                  title="Open Git Config"
                  style={{
                    // @ts-ignore - WebkitAppRegion is not in CSSProperties
                    WebkitAppRegion: 'no-drag',
                    background:
                      _currentLayout?.right === 'gitConfig'
                        ? theme.colors.primary + '20'
                        : theme.colors.backgroundTertiary,
                    border: `1px solid ${
                      _currentLayout?.right === 'gitConfig'
                        ? theme.colors.primary
                        : theme.colors.border
                    }`,
                    color:
                      _currentLayout?.right === 'gitConfig'
                        ? theme.colors.primary
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
                >
                  <GitBranch size={14} />
                  <span>Git Config</span>
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
                color: theme.colors.primary,
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
                      color: theme.colors.primary,
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
          {/* Per-repo theme selector + customization (scoped via ThemeService) */}
          <ThemeSelector />

          {/* Hover-reveal buttons: Notes, Git Config, Alexandria, Terminal toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Notes Button */}
            {config.titlebar.notes && repositoryPath && onLayoutChange && (
              <button
                onClick={handleOpenNotes}
                title="Open Notes"
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background:
                    _currentLayout?.right === 'notes'
                      ? theme.colors.primary + '20'
                      : theme.colors.backgroundTertiary,
                  border: `1px solid ${
                    _currentLayout?.right === 'notes'
                      ? theme.colors.primary
                      : theme.colors.border
                  }`,
                  color:
                    _currentLayout?.right === 'notes'
                      ? theme.colors.primary
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
              >
                <StickyNote size={14} />
                <span>Notes</span>
              </button>
            )}

            {/* Storybook Start/Stop Button */}
            {storybook && config.titlebar.storybook && (
              <StorybookHeaderButton
                theme={theme}
                storybook={storybook}
                repositoryPath={repositoryPath}
              />
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

            {/* Focus Mode Toggle - Hide/Show both icon sidebars */}
            {onSidebarsHiddenChange && config.titlebar.focus && (
              <button
                onClick={() => onSidebarsHiddenChange(!sidebarsHidden)}
                title={
                  sidebarsHidden
                    ? 'Show sidebars'
                    : 'Hide sidebars (Focus mode)'
                }
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: sidebarsHidden
                    ? theme.colors.primary + '20'
                    : theme.colors.backgroundTertiary,
                  border: `1px solid ${
                    sidebarsHidden ? theme.colors.primary : theme.colors.border
                  }`,
                  color: sidebarsHidden
                    ? theme.colors.primary
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
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = sidebarsHidden
                    ? theme.colors.primary + '20'
                    : theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = sidebarsHidden
                    ? theme.colors.primary
                    : theme.colors.border;
                  e.currentTarget.style.color = sidebarsHidden
                    ? theme.colors.primary
                    : theme.colors.textSecondary;
                }}
              >
                {sidebarsHidden ? (
                  <Columns3 size={14} />
                ) : (
                  <Square size={14} />
                )}
                <span>{sidebarsHidden ? 'Sidebars' : 'Focus'}</span>
              </button>
            )}

            {/* Right sidebar collapse button */}
            {onToggleRightPanel && (
              <button
                onClick={onToggleRightPanel}
                title={
                  isRightCollapsed ? 'Expand right panel' : 'Collapse right panel'
                }
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                {isRightCollapsed ? (
                  <PanelRightOpen size={18} />
                ) : (
                  <PanelRightClose size={18} />
                )}
              </button>
            )}

            {/* Configuration gear button (always visible) */}
            <button
              onClick={() => setConfigModalOpen(true)}
              title="Configure dev workspace"
              aria-label="Configure dev workspace"
              style={{
                // @ts-ignore - WebkitAppRegion is not in CSSProperties
                WebkitAppRegion: 'no-drag',
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <Settings size={18} />
            </button>
          </div>

        </div>
      </BaseTitlebar>
      <DevWorkspaceConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        config={config}
        onChange={onConfigChange}
        repositoryPath={repositoryPath}
        onOpenInFinder={onOpenInFinder}
      />
    </div>
  );
};
