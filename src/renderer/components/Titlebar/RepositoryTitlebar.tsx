import React from 'react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarSettings } from './TitlebarSettings';
import { TitlebarAuth } from './TitlebarAuth';
import { TitlebarSourceSelector } from './TitlebarSourceSelector';
import { TitlebarModeSelector } from './TitlebarModeSelector';
import { TitlebarForkBadge } from './TitlebarForkBadge';
import type { Repository } from '../../../shared/types/repository.types';
import type { FileTreeSource } from '../../types/file-tree-source';
import type { RepositoryMode } from '../../pages/RepoManager/shared/SimpleModeSelector';

export interface RepositoryTitlebarProps {
  repository?: Repository;
  repositoryOwner?: string;
  repositoryName?: string;
  onSettingsClick?: () => void;
  hasUpdateAvailable?: boolean;
  selectedSource?: FileTreeSource | null;
  onSourceSelect?: (source: FileTreeSource) => void;
  onSecretsClick?: () => void;
  onHelpClick?: () => void;
  onForkBadgeClick?: () => void;
  mode?: RepositoryMode;
  onModeChange?: (mode: RepositoryMode) => void;
}

export const RepositoryTitlebar: React.FC<RepositoryTitlebarProps> = ({
  repository,
  repositoryOwner,
  repositoryName,
  onSettingsClick,
  hasUpdateAvailable,
  selectedSource,
  onSourceSelect,
  onSecretsClick,
  onHelpClick,
  onForkBadgeClick,
  mode,
  onModeChange,
}) => {
  return (
    <BaseTitlebar>
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
      <TitlebarAuth />
      <TitlebarSettings
        onSettingsClick={onSettingsClick}
        hasUpdateAvailable={hasUpdateAvailable}
      />
    </BaseTitlebar>
  );
};