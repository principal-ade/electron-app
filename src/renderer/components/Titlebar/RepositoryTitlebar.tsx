import React, { useState, useEffect } from 'react';
import {
  Layout,
  Layers,
  Key,
  ExternalLink,
  Link2,
  NotebookPen,
  ArrowLeftRight,
  ArrowRightLeft,
  FolderOpen,
  Cloud,
  CloudOff,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarOpenInIDE } from './TitlebarOpenInIDE';
import { GitSyncStatusIndicator } from './GitSyncStatusIndicator';
import { WorkspaceSelector } from './WorkspaceSelector';
import { RepositoryAvatar } from '../repository-maps/RepositoryAvatar';
import type { Repository } from '../../../shared/types/repository.types';
import type { FileTreeSource } from '../../types/file-tree-source';
import type {
  WorkspaceLayout,
  UserPreferences,
} from '../../../shared/types/userPreferences.types';
import { ViewSidebarControls } from '../../principal-window/components/ViewSidebarControls/ViewSidebarControls';
import { SaveWorkspaceModal } from '../../repo-manager/shared/SaveWorkspaceModal';
import { DevSidecarService } from '../../main-process-api/DevSidecarService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { ShellService } from '../../main-process-api/ShellService';
import { useRepositoryGitStatus } from '../../hooks/useRepositoryGitStatus';

export interface RepositoryTitlebarProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  selectedSource?: FileTreeSource | null;
  onSecretsClick?: () => void;
  onLinksClick?: () => void;
  onAddNoteClick?: () => void;
  onShowGitChanges?: () => void;
  showSidebarControls?: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  rightSidebarCollapsed?: boolean;
  onToggleRightSidebar?: () => void;
  onConfigurePanels?: () => void;
  onSwitchPanels?: () => void;
  onSwitchLeftMiddlePanels?: () => void;
  // Workspace layout props
  availableWorkspaces?: Record<string, WorkspaceLayout>;
  currentWorkspaceId?: string | null;
  onWorkspaceSelect?: (workspaceId: string) => void;
  onSaveWorkspace?: (
    name: string,
    options?: {
      description?: string;
      includeSizes?: boolean;
      includeCollapsed?: boolean;
    },
  ) => Promise<WorkspaceLayout | void>;
  hasStateDeviation?: boolean;
  onUpdateWorkspaceDefaults?: () => void;
  onResetToWorkspaceDefaults?: () => void;
  // UI Mode toggle
  onSwitchToPanelFramework?: () => void;
}

export const RepositoryTitlebar: React.FC<RepositoryTitlebarProps> = ({
  repository,
  repositoryOwner,
  repositoryName,
  selectedSource,
  onSecretsClick,
  onLinksClick,
  onAddNoteClick,
  onShowGitChanges,
  showSidebarControls = false,
  sidebarCollapsed = false,
  onToggleSidebar,
  rightSidebarCollapsed = false,
  onToggleRightSidebar,
  onConfigurePanels,
  onSwitchPanels,
  onSwitchLeftMiddlePanels,
  availableWorkspaces,
  currentWorkspaceId,
  onWorkspaceSelect,
  onSaveWorkspace,
  hasStateDeviation,
  onUpdateWorkspaceDefaults,
  onResetToWorkspaceDefaults,
  onSwitchToPanelFramework,
}) => {
  const { theme } = useTheme();
  const [showSaveWorkspaceModal, setShowSaveWorkspaceModal] = useState(false);
  const [devSidecarSessionId, setDevSidecarSessionId] = useState<string | null>(
    null,
  );
  const [showOpenInIDE, setShowOpenInIDE] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get local clone path for git status
  const localClonePath = selectedSource?.type === 'local'
    ? selectedSource.location
    : repository?.localClones?.[0]?.path;

  // Subscribe to git status (includes ahead/behind counts)
  const { gitStatus, gitStatusWithFiles, refresh: refreshGitStatus } = useRepositoryGitStatus(localClonePath || null);

  // Check if there are uncommitted changes
  const hasUncommittedChanges = gitStatusWithFiles
    ? gitStatusWithFiles.modifiedFiles.length +
        gitStatusWithFiles.untrackedFiles.length +
        gitStatusWithFiles.stagedFiles.length +
        gitStatusWithFiles.createdFiles.length +
        gitStatusWithFiles.deletedFiles.length >
      0
    : false;

  // Listen for dev sidecar window events
  useEffect(() => {
    const unsubscribeCreated = DevSidecarService.onWindowCreated((info) => {
      setDevSidecarSessionId(info.sessionId);
    });
    const unsubscribeClosed = DevSidecarService.onWindowClosed((sessionId) => {
      if (sessionId === devSidecarSessionId) {
        setDevSidecarSessionId(null);
      }
    });
    return () => {
      unsubscribeCreated();
      unsubscribeClosed();
    };
  }, [devSidecarSessionId]);

  // Load user preferences for titlebar button visibility
  useEffect(() => {
    const loadPreferences = async () => {
      const prefs = await UserPreferencesService.getPreferences();
      // Default to false (hidden) if not set
      setShowOpenInIDE(prefs?.titlebarButtons?.openInIDE ?? false);
    };
    loadPreferences();

    // Listen for preference changes
    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserPreferences>).detail;
      if (detail) {
        setShowOpenInIDE(detail?.titlebarButtons?.openInIDE ?? false);
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  // Handle dev sidecar button click
  const handleDevSidecarClick = async () => {
    if (devSidecarSessionId) {
      // Focus existing window
      await DevSidecarService.focusWindow(devSidecarSessionId);
    } else {
      // Create new window
      try {
        const info = await DevSidecarService.createWindow({
          devServerUrl: 'http://localhost:3000', // Default URL, can be customized
        });
        setDevSidecarSessionId(info.sessionId);
      } catch (error) {
        console.error(
          '[RepositoryTitlebar] Failed to create dev sidecar:',
          error,
        );
      }
    }
  };

  // Handle open in Finder/Explorer button click
  const handleOpenInFinder = async () => {
    if (selectedSource?.type === 'local' && selectedSource.location) {
      try {
        await ShellService.showItemInFolder(selectedSource.location);
      } catch (error) {
        console.error(
          '[RepositoryTitlebar] Failed to open in Finder:',
          error,
        );
      }
    }
  };

  // Handle copy path to clipboard
  const handleCopyPath = async () => {
    if (selectedSource?.type === 'local' && selectedSource.location) {
      try {
        await navigator.clipboard.writeText(selectedSource.location);
        setPathCopied(true);
        setTimeout(() => setPathCopied(false), 2000);
      } catch (error) {
        console.error(
          '[RepositoryTitlebar] Failed to copy path to clipboard:',
          error,
        );
      }
    }
  };

  // Handle refresh git status button click
  const handleRefreshGitStatus = async () => {
    if (isRefreshing) return; // Prevent multiple concurrent refreshes

    setIsRefreshing(true);
    try {
      await refreshGitStatus();
    } catch (error) {
      console.error('[RepositoryTitlebar] Failed to refresh git status:', error);
    } finally {
      // Keep the spinning animation for at least 500ms for visual feedback
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const displayName = repositoryName || repository?.name || 'Repository';
  const displayOwner = repositoryOwner || repository?.owner;
  const hasLocalClone = selectedSource?.type === 'local';

  // Get avatar URL - use stored avatarUrl or construct from owner
  const avatarUrl = repository?.avatarUrl ||
    (displayOwner ? `https://github.com/${displayOwner}.png` : null);

  return (
    <BaseTitlebar confirmBeforeClose={true}>
      {/* Left: Repository name and actions */}
      <div
        style={{
          position: 'absolute',
          left: '80px', // Position after traffic lights
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
        }}
      >
        {/* Avatar */}
        {repository && (
          <RepositoryAvatar
            repository={repository}
            type="owner"
            size={28}
            customAvatarUrl={avatarUrl}
          />
        )}

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
          {selectedSource?.type === 'local' &&
            selectedSource.metadata?.currentBranch && (
              <>
                <span style={{ color: theme.colors.accent, fontWeight: theme.fontWeights.medium, padding: '0 8px' }}>on</span>
                <span
                  style={{
                    color: theme.colors.text,
                    fontWeight: theme.fontWeights.medium,
                  }}
                >
                  {selectedSource.metadata.currentBranch}
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
                {/* Remote sync status */}
                {gitStatus && (
                  <span
                    style={{
                      marginLeft: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {gitStatus.ahead === 0 && gitStatus.behind === 0 ? (
                      <span
                        onClick={() => setShowSyncModal(true)}
                        style={{
                          color: theme.colors.success,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          transition: 'opacity 0.2s',
                          WebkitAppRegion:
                            'no-drag' as React.CSSProperties['WebkitAppRegion'],
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.7';
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                        title="In sync with remote - click for more info"
                      >
                        <Cloud size={14} />
                        <span style={{ fontSize: `${theme.fontSizes[1]}px` }}>
                          Synced to Github
                        </span>
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
                        <CloudOff size={14} />
                        <span style={{ fontSize: `${theme.fontSizes[1]}px` }}>
                          {gitStatus.ahead > 0 && gitStatus.behind > 0
                            ? 'Local and Remote Diverged'
                            : gitStatus.ahead > 0
                              ? 'Local Version Ahead of Remote'
                              : 'Local Version Behind Remote'}
                        </span>
                      </span>
                    )}
                  </span>
                )}
              </>
            )}
        </span>

        {/* Git-Sync connection status indicator */}
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

        {/* Open in IDE button */}
        {showOpenInIDE && <TitlebarOpenInIDE repository={repository} />}
      </div>

      {/* Center: Workspace selector */}
      {availableWorkspaces && onWorkspaceSelect && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1000,
            // @ts-ignore - WebkitAppRegion is not in CSSProperties
            WebkitAppRegion: 'no-drag',
          }}
        >
          <WorkspaceSelector
            availableWorkspaces={availableWorkspaces}
            currentWorkspaceId={currentWorkspaceId ?? null}
            onWorkspaceSelect={onWorkspaceSelect}
            onSaveWorkspace={() => setShowSaveWorkspaceModal(true)}
            hasStateDeviation={hasStateDeviation ?? false}
            onUpdateWorkspaceDefaults={onUpdateWorkspaceDefaults}
            onResetToWorkspaceDefaults={onResetToWorkspaceDefaults}
          />
        </div>
      )}

      {/* Right: Panel controls and actions */}
      <div
        style={{
          position: 'absolute',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Panel Framework Mode Switch */}
        {onSwitchToPanelFramework && (
          <button
            onClick={onSwitchToPanelFramework}
            title="Switch to Panel Framework mode (Beta)"
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
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
                theme.colors.backgroundTertiary;
              e.currentTarget.style.borderColor = theme.colors.primary;
              e.currentTarget.style.color = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.border;
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
          >
            <Layers size={14} />
            <span>Try Panel Framework</span>
          </button>
        )}

        {/* Refresh git status button - only show for local clones */}
        {hasLocalClone && (
          <button
            onClick={handleRefreshGitStatus}
            disabled={isRefreshing}
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: isRefreshing ? 'default' : 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
              opacity: isRefreshing ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isRefreshing) {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            }}
            title="Refresh git status and check remote"
          >
            <RefreshCw
              size={14}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
          </button>
        )}

        {/* Secrets button - only show for local clones */}
        {hasLocalClone && onSecretsClick && (
          <button
            onClick={onSecretsClick}
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
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
            title="Manage environment secrets"
          >
            <Key size={14} />
          </button>
        )}

        {/* Links button - only show for local clones */}
        {hasLocalClone && onLinksClick && (
          <button
            onClick={onLinksClick}
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
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
            title="Manage repository links"
          >
            <Link2 size={14} />
          </button>
        )}

        {/* Add Note button - only show for local clones */}
        {hasLocalClone && onAddNoteClick && (
          <button
            onClick={onAddNoteClick}
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
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
            title="Add note"
          >
            <NotebookPen size={14} />
          </button>
        )}

        {/* Dev Sidecar button */}
        <button
          onClick={handleDevSidecarClick}
          style={{
            WebkitAppRegion:
              'no-drag' as React.CSSProperties['WebkitAppRegion'],
            background: devSidecarSessionId
              ? theme.colors.backgroundTertiary
              : 'transparent',
            border: 'none',
            color: devSidecarSessionId
              ? theme.colors.primary
              : theme.colors.textSecondary,
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundTertiary;
            e.currentTarget.style.color = theme.colors.primary;
          }}
          onMouseLeave={(e) => {
            if (!devSidecarSessionId) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.textSecondary;
            } else {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.primary;
            }
          }}
          title={
            devSidecarSessionId
              ? 'Focus dev preview window'
              : 'Open dev preview window'
          }
        >
          <ExternalLink size={14} />
        </button>

        {showSidebarControls && onToggleSidebar && (
          <ViewSidebarControls
            position="left"
            isCollapsed={sidebarCollapsed}
            onToggle={onToggleSidebar}
          />
        )}
        {onSwitchLeftMiddlePanels && (
          <button
            onClick={onSwitchLeftMiddlePanels}
            title="Switch left and middle panels"
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
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
            <ArrowLeftRight size={14} />
          </button>
        )}
        {onConfigurePanels && (
          <button
            onClick={onConfigurePanels}
            title="Configure panel layout"
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
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
            <Layout size={14} />
          </button>
        )}
        {onSwitchPanels && (
          <button
            onClick={onSwitchPanels}
            title="Switch right and middle panels"
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
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
            <ArrowRightLeft size={14} />
          </button>
        )}
        {onToggleRightSidebar && (
          <ViewSidebarControls
            position="right"
            side="right"
            isCollapsed={rightSidebarCollapsed}
            onToggle={onToggleRightSidebar}
          />
        )}
        {/* Copy path button - only show for local clones */}
        {hasLocalClone && (
          <button
            onClick={handleCopyPath}
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: pathCopied ? theme.colors.backgroundTertiary : 'transparent',
              border: 'none',
              color: pathCopied ? theme.colors.success : theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
            }}
            onMouseEnter={(e) => {
              if (!pathCopied) {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={(e) => {
              if (!pathCopied) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }
            }}
            title={pathCopied ? 'Path copied!' : 'Copy clone path to clipboard'}
          >
            {pathCopied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
        {/* Open in Finder button - only show for local clones */}
        {hasLocalClone && (
          <button
            onClick={handleOpenInFinder}
            style={{
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              width: '32px',
              height: '32px',
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
            title="Open in Finder"
          >
            <FolderOpen size={14} />
          </button>
        )}
      </div>

      {/* Save Workspace Modal */}
      {onSaveWorkspace && (
        <SaveWorkspaceModal
          isOpen={showSaveWorkspaceModal}
          onClose={() => setShowSaveWorkspaceModal(false)}
          onSave={onSaveWorkspace}
        />
      )}

      {/* Git Sync Status Modal */}
      {showSyncModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            WebkitAppRegion:
              'no-drag' as React.CSSProperties['WebkitAppRegion'],
          }}
          onClick={() => setShowSyncModal(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              border: `1px solid ${theme.colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <Cloud size={24} color={theme.colors.success} />
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Git Sync Status
              </h2>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    marginBottom: '4px',
                  }}
                >
                  Status
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: theme.colors.success,
                  }}
                >
                  In Sync with Remote
                </div>
              </div>

              {selectedSource?.type === 'local' &&
                selectedSource.metadata?.currentBranch && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: theme.colors.backgroundTertiary,
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '14px',
                        color: theme.colors.textSecondary,
                        marginBottom: '4px',
                      }}
                    >
                      Branch
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        color: theme.colors.text,
                      }}
                    >
                      {selectedSource.metadata.currentBranch}
                    </div>
                  </div>
                )}
            </div>

            <div
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '6px',
                marginBottom: '20px',
              }}
            >
              <h3
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                What does "Synced" mean?
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: theme.colors.textSecondary,
                }}
              >
                When your repository is synced, your local branch is up to date
                with the remote repository on GitHub. This means:
              </p>
              <ul
                style={{
                  margin: '8px 0 0 0',
                  paddingLeft: '20px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: theme.colors.textSecondary,
                }}
              >
                <li>You have all the latest commits from GitHub</li>
                <li>
                  Your local commits have been pushed to GitHub (if any)
                </li>
                <li>
                  You can safely push or pull without conflicts (in most cases)
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowSyncModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </BaseTitlebar>
  );
};
