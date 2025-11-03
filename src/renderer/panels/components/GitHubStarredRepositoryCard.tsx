import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@a24z/industry-theme';
import { ExternalLink, FolderOpen, Download } from 'lucide-react';

import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { useSelectedRepository } from '../../contexts/SelectedRepositoryContext';
import { WindowService } from '../../main-process-api/WindowService';
import { GitCloneModal } from '../../principal-window/views/RepositoryExplorer/components/GitCloneModal';
import type { EnhancedAlexandriaEntry } from '../../../shared/types/repository.types';
import type { RepositoryCacheData } from '../../services/RepositoryDataCache';

interface GitHubStarredRepositoryCardProps {
  repository: GitHubRepository;
  localRepo?: RepositoryCacheData;
}

export const GitHubStarredRepositoryCard: React.FC<
  GitHubStarredRepositoryCardProps
> = ({ repository, localRepo }) => {
  const { theme } = useTheme();
  const { selectedRepository, setSelectedRepository } = useSelectedRepository();
  const isReadmeSelected = selectedRepository?.id === repository.id;
  const [showCloneModal, setShowCloneModal] = useState(false);

  const badgeColor = theme.colors.warning || '#f59e0b';

  const handleOpenInGitHub = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(repository.html_url, '_blank');
  };

  const handleToggleSelection = () => {
    // Set as selected repository to show README
    setSelectedRepository(repository);
  };

  const handleOpenOrClone = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (localRepo) {
      // Repository exists locally - open dashboard
      try {
        await WindowService.openRepositoryDashboard(localRepo.repository);
      } catch (error) {
        console.error('Error opening repository dashboard:', error);
      }
    } else {
      // Repository not cloned - trigger clone
      setShowCloneModal(true);
    }
  };

  const handleRepositoryCloned = async (
    repo: EnhancedAlexandriaEntry,
  ): Promise<void> => {
    // Close the modal
    setShowCloneModal(false);

    // Automatically open the newly cloned repository
    // Note: The localRepo will be updated automatically via useAllRepositories cache subscription
    try {
      await WindowService.openRepositoryDashboard(repo);
    } catch (error) {
      console.error('Error opening cloned repository dashboard:', error);
    }
  };

  const isHighlighted = isReadmeSelected;
  const highlightColor = theme.colors.primary;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        borderRadius: '4px',
        backgroundColor: isHighlighted ? `${highlightColor}15` : 'transparent',
        border: isHighlighted
          ? `1px solid ${highlightColor}40`
          : '1px solid transparent',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
      onClick={handleToggleSelection}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = isHighlighted
          ? `${highlightColor}20`
          : theme.colors.backgroundTertiary || theme.colors.backgroundSecondary;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = isHighlighted
          ? `${highlightColor}15`
          : 'transparent';
      }}
    >
      {/* Owner avatar */}
      <div style={{ flexShrink: 0 }}>
        <img
          src={`https://github.com/${repository.owner.login}.png`}
          alt={repository.owner.login}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.medium,
              color: localRepo
                ? theme.colors.success || '#10b981'
                : theme.colors.text,
            }}
          >
            {repository.name}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: `${theme.fontSizes[0]}px`,
            color: theme.colors.textSecondary,
          }}
        >
          {repository.language && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: getLanguageColor(repository.language),
                }}
              />
              {repository.language}
            </div>
          )}
          {repository.description && (
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {repository.description}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleOpenOrClone}
          title={localRepo ? 'Open locally' : 'Clone repository'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 10px',
            gap: '4px',
            borderRadius: '4px',
            border: `1px solid ${localRepo ? badgeColor : theme.colors.border}`,
            backgroundColor: localRepo
              ? `${badgeColor}15`
              : theme.colors.background,
            color: localRepo ? badgeColor : theme.colors.text,
            fontSize: `${theme.fontSizes[0]}px`,
            fontWeight: theme.fontWeights.medium,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = localRepo
              ? `${badgeColor}25`
              : theme.colors.backgroundTertiary ||
                theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = localRepo
              ? `${badgeColor}15`
              : theme.colors.background;
          }}
        >
          {localRepo ? <FolderOpen size={12} /> : <Download size={12} />}
          {localRepo ? 'Open' : 'Clone'}
        </button>
        <button
          type="button"
          onClick={handleOpenInGitHub}
          title="View on GitHub"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '4px',
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor =
              theme.colors.backgroundTertiary ||
              theme.colors.backgroundSecondary;
            event.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = theme.colors.background;
            event.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <ExternalLink size={12} />
        </button>
      </div>

      {/* Clone Modal */}
      {showCloneModal &&
        createPortal(
          <GitCloneModal
            isOpen={showCloneModal}
            onClose={() => setShowCloneModal(false)}
            onRepositoryAdded={handleRepositoryCloned}
            initialUrl={repository.clone_url}
          />,
          document.body,
        )}
    </div>
  );
};

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3776ab',
    Java: '#b07219',
    Go: '#00add8',
    Rust: '#dea584',
    Ruby: '#cc342d',
    PHP: '#777bb4',
    'C++': '#00599c',
    C: '#555555',
    'C#': '#239120',
    Swift: '#fa7343',
    Kotlin: '#7f52ff',
    Dart: '#0175c2',
    Vue: '#4fc08d',
    HTML: '#e34c26',
    CSS: '#1572b6',
    Shell: '#89e051',
    PowerShell: '#012456',
  };

  return colors[language] || '#6e7681';
}
