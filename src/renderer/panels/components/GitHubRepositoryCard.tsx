import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@a24z/industry-theme';
import {
  ExternalLink,
  Star,
  FolderOpen,
  Download,
  Folder,
  Cloud,
} from 'lucide-react';

import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { useSelectedRepository } from '../../contexts/SelectedRepositoryContext';
import { WindowService } from '../../main-process-api/WindowService';
import { GitCloneModal } from '../../principal-window/views/RepositoryExplorer/components/GitCloneModal';
import type { EnhancedAlexandriaEntry } from '../../../shared/types/repository.types';
import type { RepositoryCacheData } from '../../services/RepositoryDataCache';

interface GitHubRepositoryCardProps {
  repository: GitHubRepository;
  variant: 'owned' | 'starred';
  localRepo?: RepositoryCacheData;
}

export const GitHubRepositoryCard: React.FC<GitHubRepositoryCardProps> = ({
  repository,
  variant,
  localRepo,
}) => {
  const { theme } = useTheme();
  const { selectedRepository, setSelectedRepository } = useSelectedRepository();
  const isStarred = variant === 'starred';
  const isReadmeSelected = selectedRepository?.id === repository.id;
  const [showCloneModal, setShowCloneModal] = useState(false);

  const badgeColor = isStarred
    ? theme.colors.warning || '#f59e0b'
    : theme.colors.primary;
  const badgeBackground = `${badgeColor}30`;

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

  const starCount = repository.stargazers_count ?? 0;

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
        border: isHighlighted ? `1px solid ${highlightColor}40` : '1px solid transparent',
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
      {/* Status indicator */}
      <div style={{ flexShrink: 0 }}>
        {localRepo ? (
          <Folder
            size={16}
            color={theme.colors.success || '#10b981'}
          />
        ) : (
          <Cloud
            size={16}
            color={theme.colors.textSecondary}
          />
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: localRepo ? theme.colors.success || '#10b981' : theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repository.name}
          </span>
          {isStarred && (
            <Star
              size={12}
              fill={theme.colors.warning || '#f59e0b'}
              color={theme.colors.warning || '#f59e0b'}
            />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Star size={10} />
            {starCount.toLocaleString()}
          </div>
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
            backgroundColor: localRepo ? `${badgeColor}15` : theme.colors.background,
            color: localRepo ? badgeColor : theme.colors.text,
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = localRepo
              ? `${badgeColor}25`
              : theme.colors.backgroundTertiary || theme.colors.backgroundSecondary;
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
              theme.colors.backgroundTertiary || theme.colors.backgroundSecondary;
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
      {showCloneModal && createPortal(
        <GitCloneModal
          isOpen={showCloneModal}
          onClose={() => setShowCloneModal(false)}
          onRepositoryAdded={handleRepositoryCloned}
          initialUrl={repository.clone_url}
        />,
        document.body
      )}
    </div>
  );
};

function formatRelativeTime(dateInput?: string): string {
  if (!dateInput) {
    return 'unknown';
  }

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

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
