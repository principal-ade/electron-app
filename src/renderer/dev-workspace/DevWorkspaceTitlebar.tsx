import React, { useState } from 'react';
import { Layers, Cloud, CloudOff, Terminal, Globe, Check, Eye, EyeOff, Loader2, Copy } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelCollapseButton, PanelSwitchButton } from '@principal-ade/panel-layouts';
import { BaseTitlebar } from '../components/Titlebar/BaseTitlebar';
import { GitSyncStatusIndicator } from '../components/Titlebar/GitSyncStatusIndicator';
import { RepositoryAvatar } from '../components/repository-maps/RepositoryAvatar';
import { PanelSelectorDropdown, type PanelOption } from '../components/Titlebar/PanelSelectorDropdown';
import type { Repository } from '../../shared/types/repository.types';
import type { FileTreeSource } from '../types/file-tree-source';
import { useRepositoryGitStatus } from '../hooks/useRepositoryGitStatus';

// Available panels for Dev workspace
const AVAILABLE_PANELS: PanelOption[] = [
  { id: 'docs', label: 'Documentation' },
  { id: 'codeCity', label: 'Code City' },
  { id: 'configLibrary', label: 'Config Library' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'gitChanges', label: 'File Tree' },
  { id: 'localhostBrowser', label: 'Localhost Browser' },
  { id: 'localProjects', label: 'Local Projects' },
  { id: 'visualValidation', label: 'Visual Validation' },
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
    description: 'Dependencies, Terminal, Code City',
    layout: { left: 'dependencies', middle: 'terminal', right: 'codeCity' },
  },
  {
    id: 'visual-validation',
    name: 'Visual Validation',
    description: 'Visual Validation, Terminal, Code City',
    layout: { left: 'visualValidation', middle: 'terminal', right: 'codeCity' },
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
    description: 'Code City, Terminal, Visual Validation',
    layout: { left: 'codeCity', middle: 'terminal', right: 'visualValidation' },
  },
  {
    id: 'storybook',
    name: 'Storybook',
    description: 'Browser, Terminal, Browser (Alt)',
    layout: { left: 'localhostBrowser', middle: 'terminal', right: 'localhostBrowserAlt' },
    collapsed: { left: true, right: false },
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
  // Panel configuration
  currentLayout?: { left: string; middle: string; right: string };
  onLayoutChange?: (layout: { left: string; middle: string; right: string }) => void;
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  // Monitoring status
  monitoringStatus?: {
    registered: boolean;
    gitWatching: boolean;
    loading: boolean;
    error?: string;
  };
  onRefreshMonitoring?: () => void;
  // Repository path for copy
  repositoryPath?: string;
}

export const DevWorkspaceTitlebar: React.FC<
  DevWorkspaceTitlebarProps
> = ({
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
  currentLayout,
  onLayoutChange,
  onCollapsedChange,
  monitoringStatus,
  onRefreshMonitoring,
  repositoryPath,
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
            />
          )}

          {/* Left Panel Selector */}
          {currentLayout && (
            <PanelSelectorDropdown
              side="left"
              currentPanelId={currentLayout.left}
              availablePanels={AVAILABLE_PANELS}
              onPanelChange={handleLeftPanelChange}
            />
          )}

          {/* Left-Middle Switch Button */}
          {onSwitchLeftMiddlePanels && (
            <PanelSwitchButton
              onSwitch={onSwitchLeftMiddlePanels}
              variant="left-middle"
              iconSize={16}
            />
          )}

          {/* Hover-reveal buttons: Monitoring Status & Copy Path */}
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
            {/* Monitoring Status Button */}
            {monitoringStatus && (
              <button
                onClick={onRefreshMonitoring}
                disabled={monitoringStatus.loading}
                title={
                  monitoringStatus.loading
                    ? 'Initializing monitoring...'
                    : monitoringStatus.registered && monitoringStatus.gitWatching
                      ? 'Monitoring active - Click to refresh'
                      : monitoringStatus.error
                        ? `Monitoring error: ${monitoringStatus.error} - Click to retry`
                        : 'Monitoring inactive - Click to retry'
                }
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  color: theme.colors.textSecondary,
                  cursor: monitoringStatus.loading ? 'not-allowed' : 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.medium,
                  opacity: monitoringStatus.loading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!monitoringStatus.loading) {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.text;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                {monitoringStatus.loading ? (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : monitoringStatus.registered && monitoringStatus.gitWatching ? (
                  <Eye size={14} style={{ color: theme.colors.success }} />
                ) : (
                  <EyeOff size={14} style={{ color: theme.colors.warning }} />
                )}
                <span>
                  {monitoringStatus.loading
                    ? 'Starting...'
                    : monitoringStatus.registered && monitoringStatus.gitWatching
                      ? 'Watching'
                      : 'Inactive'}
                </span>
              </button>
            )}

            {/* Copy Path Button */}
            {repositoryPath && (
              <button
                onClick={handleCopyPath}
                title={copiedPath ? 'Copied!' : `Copy path: ${repositoryPath}`}
                style={{
                  // @ts-ignore - WebkitAppRegion is not in CSSProperties
                  WebkitAppRegion: 'no-drag',
                  background: copiedPath ? theme.colors.success : theme.colors.backgroundTertiary,
                  border: `1px solid ${copiedPath ? theme.colors.success : theme.colors.border}`,
                  color: copiedPath ? theme.colors.background : theme.colors.textSecondary,
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
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.text;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!copiedPath) {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
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
                    <span style={{ color: theme.colors.textSecondary }}>·</span>
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
                    onClick={onShowGitChanges ? (e) => {
                      e.stopPropagation();
                      onShowGitChanges();
                    } : undefined}
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: theme.colors.warning,
                      cursor: onShowGitChanges ? 'pointer' : 'default',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={onShowGitChanges ? (e) => {
                      e.currentTarget.style.opacity = '0.7';
                    } : undefined}
                    onMouseLeave={onShowGitChanges ? (e) => {
                      e.currentTarget.style.opacity = '1';
                    } : undefined}
                    title={onShowGitChanges ? "Click to view uncommitted changes" : "Uncommitted changes"}
                  />
                )}
              </span>
            )}
        </div>

        {/* Git-Sync connectivity indicator - right side, mirrors avatar */}
        <div style={{ width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <Globe size={14} />
              <span>Web</span>
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
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
            >
              <Terminal size={14} />
              <span>{terminalImplementation === 'ghostty' ? 'Ghostty' : 'XTerm'}</span>
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
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
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
          />
        )}

        {/* Right Panel Selector */}
        {currentLayout && onLayoutChange && (
          <PanelSelectorDropdown
            side="right"
            currentPanelId={currentLayout.right}
            availablePanels={AVAILABLE_PANELS}
            onPanelChange={handleRightPanelChange}
          />
        )}

        {/* Right Collapse Button - outside the panel selector */}
        {onToggleRightSidebar && (
          <PanelCollapseButton
            isCollapsed={collapsed?.right ?? true}
            onToggle={onToggleRightSidebar}
            side="right"
            iconSize={16}
          />
        )}
      </div>
    </BaseTitlebar>
    </div>
  );
};
