import React, { useState, useRef, useEffect } from 'react';
import { Layers, Cloud, CloudOff, Terminal, Globe, Settings, Check, Eye, EyeOff, RefreshCw, Loader2, Copy, FolderCheck } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { PanelControls } from '@principal-ade/panel-layouts';
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
}

export const DEFAULT_PANEL_PRESETS: PanelPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Documentation, Terminal, Code City',
    layout: { left: 'docs', middle: 'terminal', right: 'codeCity' },
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
  monitoringStatus,
  onRefreshMonitoring,
  repositoryPath,
}) => {
  const { theme } = useTheme();
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const configButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        configButtonRef.current &&
        !configButtonRef.current.contains(event.target as Node)
      ) {
        setShowConfigDropdown(false);
      }
    };

    if (showConfigDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConfigDropdown]);

  // Check if current layout matches a preset
  const currentPresetId = DEFAULT_PANEL_PRESETS.find(
    (preset) =>
      currentLayout &&
      preset.layout.left === currentLayout.left &&
      preset.layout.middle === currentLayout.middle &&
      preset.layout.right === currentLayout.right
  )?.id;

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
          <div style={{ position: 'relative' }}>
            <button
              ref={configButtonRef}
              onClick={() => setShowConfigDropdown(!showConfigDropdown)}
              title="Panel Configuration"
              style={{
                // @ts-ignore - WebkitAppRegion is not in CSSProperties
                WebkitAppRegion: 'no-drag',
                background: showConfigDropdown ? theme.colors.backgroundSecondary : theme.colors.backgroundTertiary,
                border: `1px solid ${showConfigDropdown ? theme.colors.primary : theme.colors.border}`,
                color: showConfigDropdown ? theme.colors.text : theme.colors.textSecondary,
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
                if (!showConfigDropdown) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }
              }}
              onMouseLeave={(e) => {
                if (!showConfigDropdown) {
                  e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }
              }}
            >
              <Settings size={14} />
              <span>Layout</span>
            </button>

            {/* Configuration Dropdown */}
            {showConfigDropdown && (
              <div
                ref={dropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  minWidth: '220px',
                  zIndex: 1000,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    fontSize: `${theme.fontSizes[0]}px`,
                    color: theme.colors.textSecondary,
                    fontWeight: theme.fontWeights.semibold,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Panel Presets
                </div>
                {DEFAULT_PANEL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onLayoutChange(preset.layout);
                      setShowConfigDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      color: theme.colors.text,
                      fontSize: `${theme.fontSizes[1]}px`,
                      textAlign: 'left',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: theme.fontWeights.medium }}>
                        {preset.name}
                      </div>
                      {preset.description && (
                        <div
                          style={{
                            fontSize: `${theme.fontSizes[0]}px`,
                            color: theme.colors.textSecondary,
                            marginTop: '2px',
                          }}
                        >
                          {preset.description}
                        </div>
                      )}
                    </div>
                    {currentPresetId === preset.id && (
                      <Check size={16} style={{ color: theme.colors.success, flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

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
          {/* Repository name and branch */}
          <span
            style={{
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
            }}
          >
            <span
              style={{
                color: theme.colors.text,
                fontWeight: theme.fontWeights.medium,
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

            {/* Branch */}
            {selectedSource?.type === 'local' &&
              selectedSource.metadata?.currentBranch && (
                <>
                  <span
                    style={{
                      color: theme.colors.accent,
                      fontWeight: theme.fontWeights.medium,
                      padding: '0 8px',
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

                    {/* Uncommitted changes indicator */}
                    {hasUncommittedChanges && onShowGitChanges && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowGitChanges();
                        }}
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: theme.colors.warning,
                          marginLeft: '6px',
                          verticalAlign: 'middle',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                        title="Click to view uncommitted changes"
                      />
                    )}
                  </span>
                </>
              )}
          </span>

          {/* Remote sync status - below repo name */}
          {selectedSource?.type === 'local' &&
            selectedSource.metadata?.currentBranch &&
            gitStatus && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: `${theme.fontSizes[0]}px`,
                }}
              >
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

      {/* Right: Panel controls, terminal toggle and mode switch */}
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
        {/* Panel Controls */}
        {(onToggleLeftSidebar || onToggleRightSidebar || onSwitchLeftMiddlePanels || onSwitchRightMiddlePanels) && (
          <PanelControls
            leftSidebarCollapsed={collapsed?.left ?? false}
            onToggleLeftSidebar={onToggleLeftSidebar}
            showLeftSidebarControl={!!onToggleLeftSidebar}
            rightSidebarCollapsed={collapsed?.right ?? true}
            onToggleRightSidebar={onToggleRightSidebar}
            showRightSidebarControl={!!onToggleRightSidebar}
            onSwitchLeftMiddlePanels={onSwitchLeftMiddlePanels}
            showSwitchLeftMiddle={!!onSwitchLeftMiddlePanels}
            onSwitchRightMiddlePanels={onSwitchRightMiddlePanels}
            showSwitchRightMiddle={!!onSwitchRightMiddlePanels}
            iconSize={16}
          />
        )}

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
    </BaseTitlebar>
  );
};
