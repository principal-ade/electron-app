import React from 'react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarSourceSelector } from './TitlebarSourceSelector';
import { TitlebarModeSelector } from './TitlebarModeSelector';
import { TitlebarForkBadge } from './TitlebarForkBadge';
import { TitlebarOpenInIDE } from './TitlebarOpenInIDE';
import type { Repository } from '../../../shared/types/repository.types';
import type { FileTreeSource } from '../../types/file-tree-source';
import type { RepositoryMode } from '../../pages/RepoManager/shared/SimpleModeSelector';
import { ViewSidebarControls } from '../../principal-window/components/ViewSidebarControls/ViewSidebarControls';

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
}) => {
  return (
    <BaseTitlebar>
      {showSidebarControls && onToggleSidebar && (
        <ViewSidebarControls
          position="left"
          isCollapsed={sidebarCollapsed}
          onToggle={onToggleSidebar}
        />
      )}
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
    </BaseTitlebar>
  );
};