import React, { useState, useEffect } from 'react';
import {
  Layout,
  Key,
  ExternalLink,
  Link2,
  NotebookPen,
  ArrowLeftRight,
  ArrowRightLeft,
  FolderOpen,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
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

export interface RepositoryTitlebarProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  selectedSource?: FileTreeSource | null;
  onSecretsClick?: () => void;
  onLinksClick?: () => void;
  onAddNoteClick?: () => void;
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
}

export const RepositoryTitlebar: React.FC<RepositoryTitlebarProps> = ({
  repository,
  repositoryOwner,
  repositoryName,
  selectedSource,
  onSecretsClick,
  onLinksClick,
  onAddNoteClick,
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
}) => {
  const { theme } = useTheme();
  const [showSaveWorkspaceModal, setShowSaveWorkspaceModal] = useState(false);
  const [devSidecarSessionId, setDevSidecarSessionId] = useState<string | null>(
    null,
  );
  const [showOpenInIDE, setShowOpenInIDE] = useState(false);

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
                </span>
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
    </BaseTitlebar>
  );
};
