import React, { useState, useEffect } from 'react';
import { Layout, Layers } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarSourceSelector } from './TitlebarSourceSelector';
import { TitlebarModeSelector } from './TitlebarModeSelector';
import { TitlebarForkBadge } from './TitlebarForkBadge';
import { TitlebarOpenInIDE } from './TitlebarOpenInIDE';
import { TitlebarButton } from './TitlebarButton';
import type { Repository } from '../../../shared/types/repository.types';
import type { FileTreeSource } from '../../types/file-tree-source';
import type { RepositoryMode } from '../../repo-manager/shared/SimpleModeSelector';
import { ViewSidebarControls } from '../../principal-window/components/ViewSidebarControls/ViewSidebarControls';
import { WindowService } from '../../main-process-api/WindowService';

export interface RepositoryTitlebarProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  hasUpdateAvailable?: boolean;
  selectedSource?: FileTreeSource | null;
  onSourceSelect?: (source: FileTreeSource) => void;
  onSecretsClick?: () => void;
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
}

export const RepositoryTitlebar: React.FC<RepositoryTitlebarProps> = ({
  repository,
  repositoryOwner,
  repositoryName,
  hasUpdateAvailable,
  selectedSource,
  onSourceSelect,
  onSecretsClick,
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
}) => {
  const { theme } = useTheme();
  const [mainWindowMinimized, setMainWindowMinimized] = useState(false);

  // Listen for main window minimize state changes from other repo windows
  useEffect(() => {
    WindowService.onMainWindowMinimizeStateChange(setMainWindowMinimized);
  }, []);

  // Toggle main window minimized state
  const handleToggleMainWindow = async () => {
    await WindowService.toggleMainWindowMinimize(!mainWindowMinimized);
  };
  return (
    <BaseTitlebar>
      {/* Center: Repository info and mode selector */}
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
        {repository && (
          <>
            <TitlebarForkBadge
              repository={repository}
              position="left"
              onClick={onForkBadgeClick}
            />
            <TitlebarSourceSelector
              position="left"
              repository={repository}
              selectedSource={selectedSource}
              onSourceSelect={onSourceSelect}
              onSecretsClick={onSecretsClick}
              onHelpClick={onHelpClick}
            />
          </>
        )}
        {mode && (
          <TitlebarModeSelector
            position="center"
            mode={mode}
            onModeChange={onModeChange}
            hasLocalClones={!!repository?.localClones?.length}
          />
        )}
        <TitlebarOpenInIDE repository={repository} />
      </div>

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
        {/* Minimize main window toggle */}
        <button
          onClick={handleToggleMainWindow}
          title={mainWindowMinimized ? 'Restore main window' : 'Minimize main window'}
          style={{
            WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
            background: mainWindowMinimized ? theme.colors.backgroundTertiary : 'transparent',
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
            e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            if (!mainWindowMinimized) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.muted;
            } else {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
              e.currentTarget.style.color = theme.colors.text;
            }
          }}
        >
          <Layers size={14} />
        </button>
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
        {onConfigurePanels && (
          <button
            onClick={onConfigurePanels}
            title="Configure panel layout"
            style={{
              WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
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
              e.currentTarget.style.backgroundColor = '#374151';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <Layout size={14} />
          </button>
        )}
      </div>
    </BaseTitlebar>
  );
};