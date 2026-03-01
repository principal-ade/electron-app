import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Cloud,
  CloudOff,
  Terminal,
  Check,
  Copy,
  BookOpen,
  ChevronDown,
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
import { findAvailablePort, waitForPortReady } from '../utils/portDetection';
import { StorybookService, type StorybookPackage } from '../services/StorybookService';
import type { PackageLayer } from '@principal-ai/codebase-composition';

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
  // Panel event emitter for inter-panel communication
  events?: {
    emit: (event: {
      type: string;
      source: string;
      payload: unknown;
      timestamp: number;
    }) => void;
  };
  // Packages data from codebase-composition
  packages?: PackageLayer[];
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
  collapsed,
  onOpenAlexandriaWorkspace,
  currentLayout,
  onLayoutChange,
  onCollapsedChange,
  onPanelSizesChange,
  repositoryPath,
  events,
  packages,
  traceSourceServiceName,
  availableServiceNames,
  onTraceSourceServiceNameChange,
  sidebarsHidden,
  onSidebarsHiddenChange,
}) => {
  const { theme } = useTheme();
  const [copiedPath, setCopiedPath] = useState(false);

  // Storybook state
  const [storybookStatus, setStorybookStatus] = useState<
    'idle' | 'starting' | 'running' | 'error'
  >('idle');
  const [storybookSessionId, setStorybookSessionId] = useState<string | null>(
    null,
  );
  const [storybookPort, setStorybookPort] = useState<number | null>(null);
  const [storybookPackages, setStorybookPackages] = useState<StorybookPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<StorybookPackage | null>(null);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const storybookDropdownRef = useRef<HTMLDivElement>(null);

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

  // Detect Storybook packages from codebase-composition data
  useEffect(() => {
    console.info('[DevWorkspaceTitlebar] Packages data:', packages);
    console.info('[DevWorkspaceTitlebar] Repository path:', repositoryPath);

    if (repositoryPath && packages) {
      const foundPackages = StorybookService.findStorybookPackages(
        packages,
        repositoryPath,
      );
      console.info('[DevWorkspaceTitlebar] Found Storybook packages:', foundPackages);
      setStorybookPackages(foundPackages);

      // Auto-select first package if only one exists
      if (foundPackages.length === 1) {
        setSelectedPackage(foundPackages[0]);
      } else if (foundPackages.length > 1) {
        // If multiple packages, default to first but allow user to change
        setSelectedPackage(foundPackages[0]);
      } else {
        setSelectedPackage(null);
      }
    } else {
      console.info('[DevWorkspaceTitlebar] No packages or repositoryPath');
      setStorybookPackages([]);
      setSelectedPackage(null);
    }
  }, [repositoryPath, packages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPackageDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        storybookDropdownRef.current &&
        !storybookDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPackageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPackageDropdown]);

  // Handler for Storybook button click (or dropdown item click)
  const handleStorybookClick = async (packageToStart?: StorybookPackage) => {
    // Use provided package or selected package
    const targetPackage = packageToStart || selectedPackage;

    if (!targetPackage) {
      console.error('[DevWorkspaceTitlebar] No Storybook package selected');
      return;
    }

    if (storybookStatus === 'running' && storybookSessionId) {
      // Stop Storybook
      try {
        await window.mainProcess.terminal.destroy(storybookSessionId);
        setStorybookStatus('idle');
        setStorybookSessionId(null);
        setStorybookPort(null);

        // Switch right panel back to file-city
        if (currentLayout && onLayoutChange) {
          console.info('[DevWorkspaceTitlebar] Switching right panel back to file-city');
          onLayoutChange({ ...currentLayout, right: 'fileCity' });
        }

        // Expand left panel back
        if (collapsed?.left && onCollapsedChange) {
          console.info('[DevWorkspaceTitlebar] Expanding left panel');
          onCollapsedChange({ left: false, right: collapsed?.right ?? false });
        }
      } catch (error) {
        console.error(
          '[DevWorkspaceTitlebar] Failed to stop Storybook:',
          error,
        );
      }
      return;
    }

    try {
      setStorybookStatus('starting');
      setSelectedPackage(targetPackage); // Update selected package

      console.info('[DevWorkspaceTitlebar] Starting Storybook for package:', targetPackage.name);
      console.info('[DevWorkspaceTitlebar] Package path:', targetPackage.path);

      // Find available port
      const port = await findAvailablePort(6006, 6020);
      console.info('[DevWorkspaceTitlebar] Found available port:', port);
      setStorybookPort(port);

      // Get command for this specific package
      const command = StorybookService.getStorybookCommand(targetPackage, port);
      console.info('[DevWorkspaceTitlebar] Command to execute:', command);

      // Create terminal session with storybook context in the package directory
      // Use the same context pattern as TerminalProvider: terminal:owner/repo:storybook
      const terminalContext = `terminal:${repositoryOwner}/${repositoryName}:storybook`;
      console.info('[DevWorkspaceTitlebar] Creating terminal session with context:', terminalContext);

      const sessionId = await window.mainProcess.terminal.createWithCommand(
        targetPackage.path, // Use package path instead of repository path
        command,
        terminalContext,
      );
      console.info('[DevWorkspaceTitlebar] Terminal session created:', sessionId);
      setStorybookSessionId(sessionId || null);

      // Emit custom event to notify TerminalProvider to refresh
      window.dispatchEvent(
        new CustomEvent('terminal-session-created', {
          detail: { sessionId, context: terminalContext },
        }),
      );

      // Give the terminal panel a moment to detect the new session
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set panel sizes to 50/50 split between middle and right
      // Note: This is stored as pending and applied after collapse completes
      if (onPanelSizesChange) {
        console.info('[DevWorkspaceTitlebar] Setting panel sizes to 50/50 split (pending)');
        onPanelSizesChange({ left: 0, middle: 50, right: 50 });
      }

      // Collapse left panel - sizes will be applied when collapse completes
      if (!collapsed?.left && onCollapsedChange) {
        console.info('[DevWorkspaceTitlebar] Collapsing left panel');
        onCollapsedChange({ left: true, right: collapsed?.right ?? false });
      }

      // Switch right panel to localhost browser
      if (currentLayout && onLayoutChange) {
        console.info('[DevWorkspaceTitlebar] Switching right panel to localhost browser');
        onLayoutChange({ ...currentLayout, right: 'localhostBrowser' });
      }

      // Expand right panel if collapsed
      if (collapsed?.right && onCollapsedChange) {
        console.info('[DevWorkspaceTitlebar] Expanding right panel');
        onCollapsedChange({ left: true, right: false });
      }

      // Give the panel time to mount and subscribe to events
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Wait for port to become responsive (30s timeout)
      console.info('[DevWorkspaceTitlebar] Waiting for Storybook to become responsive on port', port);
      await waitForPortReady(port, 30000, 1000);
      console.info('[DevWorkspaceTitlebar] Storybook is now responsive!');

      // Navigate browser panel to Storybook port using existing event
      // Emit multiple times to ensure the panel receives it
      if (events) {
        console.info('[DevWorkspaceTitlebar] Navigating browser panel to port', port);
        const navigatePayload = {
          type: 'principal-ade.localhost-browser:navigate' as const,
          source: 'dev-workspace-titlebar',
          payload: { port, path: '/' },
          timestamp: Date.now(),
        };

        // Emit immediately
        events.emit(navigatePayload);

        // Emit again after a short delay to catch any late subscribers
        setTimeout(() => {
          events.emit({
            ...navigatePayload,
            timestamp: Date.now(),
          });
        }, 100);
      }

      setStorybookStatus('running');
      console.info('[DevWorkspaceTitlebar] ✅ Storybook started successfully!');
    } catch (error) {
      console.error('[DevWorkspaceTitlebar] ❌ Failed to start Storybook:', error);
      console.error('[DevWorkspaceTitlebar] Error details:', {
        package: targetPackage.name,
        path: targetPackage.path,
        port: storybookPort,
        sessionId: storybookSessionId,
      });
      setStorybookStatus('error');
      // TODO: Show error notification to user
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

            {/* Storybook Button/Dropdown */}
            {storybookPackages.length > 0 && (
              <div ref={storybookDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (storybookPackages.length === 1) {
                      handleStorybookClick();
                    } else {
                      setShowPackageDropdown(!showPackageDropdown);
                    }
                  }}
                  disabled={storybookStatus === 'starting'}
                  title={
                    storybookStatus === 'running'
                      ? 'Stop Storybook'
                      : storybookPackages.length === 1
                        ? `Start Storybook (${selectedPackage?.name})`
                        : 'Start Storybook (select package)'
                  }
                  style={{
                    // @ts-ignore - WebkitAppRegion is not in CSSProperties
                    WebkitAppRegion: 'no-drag',
                    background:
                      storybookStatus === 'running'
                        ? theme.colors.success + '20'
                        : theme.colors.backgroundTertiary,
                    border: `1px solid ${
                      storybookStatus === 'running'
                        ? theme.colors.success
                        : theme.colors.border
                    }`,
                    color:
                      storybookStatus === 'running'
                        ? theme.colors.success
                        : theme.colors.textSecondary,
                    cursor:
                      storybookStatus === 'starting'
                        ? 'not-allowed'
                        : 'pointer',
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
                    if (storybookStatus !== 'starting') {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundSecondary;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                      e.currentTarget.style.color = theme.colors.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      storybookStatus === 'running'
                        ? theme.colors.success + '20'
                        : theme.colors.backgroundTertiary;
                    e.currentTarget.style.borderColor =
                      storybookStatus === 'running'
                        ? theme.colors.success
                        : theme.colors.border;
                    e.currentTarget.style.color =
                      storybookStatus === 'running'
                        ? theme.colors.success
                        : theme.colors.textSecondary;
                  }}
                >
                  <BookOpen size={14} />
                  <span>
                    {storybookStatus === 'starting' && 'Starting...'}
                    {storybookStatus === 'running' && 'Stop SB'}
                    {storybookStatus === 'idle' && 'Storybook'}
                    {storybookStatus === 'error' && 'Error'}
                  </span>
                  {storybookPackages.length > 1 && (
                    <ChevronDown size={12} />
                  )}
                </button>

                {/* Dropdown for multiple packages */}
                {showPackageDropdown && storybookPackages.length > 1 && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      zIndex: 1000,
                      minWidth: '200px',
                    }}
                  >
                    {storybookPackages.map((pkg) => (
                      <button
                        key={pkg.path}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPackageDropdown(false);
                          handleStorybookClick(pkg);
                        }}
                        style={{
                          // @ts-ignore - WebkitAppRegion is not in CSSProperties
                          WebkitAppRegion: 'no-drag',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background:
                            selectedPackage?.path === pkg.path
                              ? theme.colors.primary + '20'
                              : 'transparent',
                          color: theme.colors.text,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: `${theme.fontSizes[1]}px`,
                          borderBottom:
                            storybookPackages[storybookPackages.length - 1] !== pkg
                              ? `1px solid ${theme.colors.border}`
                              : 'none',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedPackage?.path !== pkg.path) {
                            e.currentTarget.style.backgroundColor =
                              theme.colors.backgroundTertiary;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedPackage?.path !== pkg.path) {
                            e.currentTarget.style.backgroundColor =
                              'transparent';
                          }
                        }}
                      >
                        <div style={{ fontWeight: theme.fontWeights.medium }}>
                          {pkg.name}
                        </div>
                        <div
                          style={{
                            fontSize: `${theme.fontSizes[0]}px`,
                            color: theme.colors.textTertiary,
                            marginTop: '2px',
                          }}
                        >
                          {pkg.path.replace(repositoryPath || '', '').replace(/^\//, '') || '/'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
