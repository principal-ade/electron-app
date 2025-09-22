import React from 'react';
import { BaseTitlebar } from './BaseTitlebar';
import { TitlebarSettings } from './TitlebarSettings';

export interface RepositoryTitlebarProps {
  repositoryOwner?: string;
  repositoryName?: string;
  onSettingsClick?: () => void;
  hasUpdateAvailable?: boolean;
}

export const RepositoryTitlebar: React.FC<RepositoryTitlebarProps> = ({
  repositoryOwner,
  repositoryName,
  onSettingsClick,
  hasUpdateAvailable,
}) => {
  const titleText =
    repositoryOwner && repositoryName
      ? `${repositoryName} by ${repositoryOwner}`
      : 'Repository Manager';

  return (
    <BaseTitlebar title={titleText}>
      <TitlebarSettings
        onSettingsClick={onSettingsClick}
        hasUpdateAvailable={hasUpdateAvailable}
      />
    </BaseTitlebar>
  );
};