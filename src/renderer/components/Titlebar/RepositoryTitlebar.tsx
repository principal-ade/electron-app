import React, { useState, useEffect } from 'react';
import { Layout, Layers, Key, ExternalLink, Link2, NotebookPen, ArrowLeftRight } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarOpenInIDE } from './TitlebarOpenInIDE';
import { WorkspaceSelector } from './WorkspaceSelector';
import type { Repository } from '../../../shared/types/repository.types';
import type { FileTreeSource } from '../../types/file-tree-source';
import type { RepositoryMode } from '../../repo-manager/shared/SimpleModeSelector';
import type { WorkspaceLayout } from '../../../shared/types/userPreferences.types';
import { ViewSidebarControls } from '../../principal-window/components/ViewSidebarControls/ViewSidebarControls';
import { WindowService } from '../../main-process-api/WindowService';
import { SaveWorkspaceModal } from '../../repo-manager/shared/SaveWorkspaceModal';
import { DevSidecarService } from '../../main-process-api/DevSidecarService';

export interface RepositoryTitlebarProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  hasUpdateAvailable?: boolean;
  selectedSource?: FileTreeSource | null;
  onSourceSelect?: (source: FileTreeSource) => void;
  onSecretsClick?: () => void;
  onLinksClick?: () => void;
  onAddNoteClick?: () => void;
  onHelpClick?: () => void;
  onForkBadgeClick?: () => void;
  mode?: RepositoryMode;
  onModeChange?: (mode: RepositoryMode) => void;
  showSidebarControls?: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  rightSidebarCollapsed?: boolean;
  onToggleRightSidebar?: () => void;
  onConfigurePanels?: () => void;
  onSwitchPanels?: () => void;
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
  hasUpdateAvailable,
  selectedSource,
  onSourceSelect,
  onSecretsClick,
  onLinksClick,
  onAddNoteClick,
  onHelpClick,
  onForkBadgeClick,
  mode,
  onModeChange,
  showSidebarControls = false,
  sidebarCollapsed = false,
  onToggleSidebar,
  rightSidebarCollapsed = false,
  onToggleRightSidebar,
  onConfigurePanels,
  onSwitchPanels,
  availableWorkspaces,
  currentWorkspaceId,
  onWorkspaceSelect,
  onSaveWorkspace,
  hasStateDeviation,
  onUpdateWorkspaceDefaults,
  onResetToWorkspaceDefaults,
}) => {
  const { theme } = useTheme();
  const [mainWindowMinimized, setMainWindowMinimized] = useState(false);
  const [showSaveWorkspaceModal, setShowSaveWorkspaceModal] = useState(false);
  const [devSidecarSessionId, setDevSidecarSessionId] = useState<string | null>(
    null,
  );

  // Listen for main window minimize state changes from other repo windows
  useEffect(() => {
    WindowService.onMainWindowMinimizeStateChange(setMainWindowMinimized);
  }, []);

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

  // Toggle main window minimized state
  const handleToggleMainWindow = async () => {
    await WindowService.toggleMainWindowMinimize(!mainWindowMinimized);
  };

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

  const displayName = repositoryName || repository?.name || 'Repository';
  const hasLocalClone = selectedSource?.type === 'local';

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
        <span
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: theme.colors.text,
          }}
        >
          {displayName}
        </span>

        {/* Open in IDE button */}
        <TitlebarOpenInIDE repository={repository} />
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
            title="Switch left and right panels"
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
        {showSidebarControls && onToggleSidebar && (
          <ViewSidebarControls
            position="left"
            isCollapsed={sidebarCollapsed}
            onToggle={onToggleSidebar}
          />
        )}
        {onToggleRightSidebar && (
          <ViewSidebarControls
            position="right"
            side="right"
            isCollapsed={rightSidebarCollapsed}
            onToggle={onToggleRightSidebar}
          />
        )}
        {/* Minimize main window toggle */}
        <button
          onClick={handleToggleMainWindow}
          title={
            mainWindowMinimized ? 'Restore main window' : 'Minimize main window'
          }
          style={{
            WebkitAppRegion:
              'no-drag' as React.CSSProperties['WebkitAppRegion'],
            background: mainWindowMinimized
              ? theme.colors.backgroundTertiary
              : 'transparent',
            border: 'none',
            color: mainWindowMinimized ? theme.colors.text : theme.colors.muted,
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
            if (!mainWindowMinimized) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.muted;
            } else {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.text;
            }
          }}
        >
          <Layers size={14} />
        </button>
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
