import React, { useState } from 'react';
import {
  Layers,
  Cloud,
  CloudOff,
  Terminal,
  Check,
  Copy,
  Columns3,
  Square,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { BaseTitlebar } from '../components/Titlebar/BaseTitlebar';
import { GitSyncStatusIndicator } from '../components/Titlebar/GitSyncStatusIndicator';
import { RepositoryAvatar } from '../components/repository-maps/RepositoryAvatar';
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
  collapsed?: {
    left: boolean;
    right: boolean;
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
  // Terminal implementation toggle
  terminalImplementation?: 'xterm' | 'ghostty';
  onToggleTerminalImplementation?: () => void;
  // Panel controls
  collapsed?: { left: boolean; right: boolean };
  // Alexandria Workspace
  onOpenAlexandriaWorkspace?: () => void;
  // Panel configuration
  currentLayout?: { left: string; middle: string; right: string };
  onLayoutChange?: (layout: {
    left: string;
    middle: string;
    right: string;
  }) => void;
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  // Panel sizes
  onPanelSizesChange?: (sizes: { left: number; middle: number; right: number }) => void;
  // Repository path for copy
  repositoryPath?: string;
  // Trace source service name configuration
  traceSourceServiceName?: string;
  availableServiceNames?: string[];
  onTraceSourceServiceNameChange?: (serviceName: string) => void;
  // Sidebar visibility toggle
  sidebarsHidden?: boolean;
  onSidebarsHiddenChange?: (hidden: boolean) => void;
}

export const DevWorkspaceTitlebar: React.FC<DevWorkspaceTitlebarProps> = ({
  repository,
  repositoryOwner,
  repositoryName,
  selectedSource,
  onShowGitChanges,
  terminalImplementation,
  onToggleTerminalImplementation,
  collapsed: _collapsed,
  onOpenAlexandriaWorkspace,
  currentLayout: _currentLayout,
  onLayoutChange,
  onCollapsedChange: _onCollapsedChange,
  onPanelSizesChange: _onPanelSizesChange,
  repositoryPath,
  traceSourceServiceName,
  availableServiceNames,
  onTraceSourceServiceNameChange,
  sidebarsHidden,
  onSidebarsHiddenChange,
}) => {
  const { theme } = useTheme();
  const [copiedPath, setCopiedPath] = useState(false);

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
            {/* Hover-reveal button: Copy Path */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
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

              {/* Trace Source Selector */}
              {onTraceSourceServiceNameChange && (
                <div style={{ position: 'relative' }}>
                  <select
                    value={traceSourceServiceName || 'all'}
                    onChange={(e) => onTraceSourceServiceNameChange(e.target.value)}
                    title="Select service for trace routing"
                    style={{
                      // @ts-ignore - WebkitAppRegion is not in CSSProperties
                      WebkitAppRegion: 'no-drag',
                      background: theme.colors.backgroundTertiary,
                      border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: `${theme.fontSizes[1]}px`,
                      fontWeight: theme.fontWeights.medium,
                      outline: 'none',
                    }}
                  >
                    <option value="all">Traces: all services</option>
                    {availableServiceNames && availableServiceNames.length > 0 && (
                      availableServiceNames.map((serviceName) => (
                        <option key={serviceName} value={serviceName}>
                          Traces: {serviceName}
                        </option>
                      ))
                    )}
                  </select>
                </div>
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
          {/* Hover-reveal buttons: Alexandria, Terminal toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Open Alexandria Workspace Button */}
            {onOpenAlexandriaWorkspace && (
              <button
                onClick={onOpenAlexandriaWorkspace}
                title="Open in Alexandria Workspace"
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
                <span>Workspace</span>
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

            {/* Focus Mode Toggle - Hide/Show both icon sidebars */}
            {onSidebarsHiddenChange && (
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
          </div>

        </div>
      </BaseTitlebar>
    </div>
  );
};
