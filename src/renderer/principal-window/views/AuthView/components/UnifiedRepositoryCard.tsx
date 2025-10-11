import { useTheme } from '@a24z/industry-theme';
import {
  Cloud,
  HardDrive,
  ExternalLink,
  Lock,
  FolderOpen,
  Download,
  GitFork,
} from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { EnhancedAlexandriaEntry } from '../../../../../shared/types/repository.types';
import type { GitHubRepository } from '../../../../../shared/main-process-api-interfaces/GitHubAPI';

interface UnifiedRepositoryCardProps {
  repository: AlexandriaEntry | EnhancedAlexandriaEntry | GitHubRepository;
  isRemote: boolean;
  onOpen: (
    repo: AlexandriaEntry | EnhancedAlexandriaEntry | GitHubRepository,
  ) => void;
}

export const UnifiedRepositoryCard: React.FC<UnifiedRepositoryCardProps> = ({
  repository,
  isRemote,
  onOpen,
}) => {
  const { theme } = useTheme();

  // Helper to determine if it's a GitHub repository type
  const isGitHubRepo = (repo: unknown): repo is GitHubRepository => {
    return (
      typeof repo === 'object' &&
      repo !== null &&
      'clone_url' in repo &&
      'owner' in repo
    );
  };

  // Extract common properties
  const getName = () => {
    if (isGitHubRepo(repository)) {
      return repository.name;
    }
    return repository.name;
  };

  const getDescription = () => {
    if (isGitHubRepo(repository)) {
      return repository.description;
    }
    return repository.github?.description;
  };

  const isPrivate = () => {
    if (isGitHubRepo(repository)) {
      return repository.private;
    }
    return false; // Local repos don't have privacy indicator
  };

  const isFork = () => {
    if (isGitHubRepo(repository)) {
      return repository.fork;
    }
    // Check local repo's GitHub metadata
    return false;
  };

  const isDirty = () => {
    if (!isRemote) {
      const enhanced = repository as EnhancedAlexandriaEntry;
      return enhanced.isDirty;
    }
    return false;
  };

  const getDirtyCount = () => {
    if (!isRemote) {
      const enhanced = repository as EnhancedAlexandriaEntry;
      return enhanced.dirtyFileCount || 0;
    }
    return 0;
  };

  const handleClick = () => {
    onOpen(repository);
  };

  const handleOpenInGitHub = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGitHubRepo(repository)) {
      window.open(repository.html_url, '_blank');
    } else if (repository.remoteUrl) {
      // Try to construct GitHub URL from remote URL
      const match = repository.remoteUrl.match(
        /github\.com[:/]([^/]+)\/(.+?)(\.git)?$/,
      );
      if (match) {
        const [, owner, repo] = match;
        window.open(
          `https://github.com/${owner}/${repo.replace('.git', '')}`,
          '_blank',
        );
      }
    }
  };

  const hasGitHubLink = () => {
    if (isGitHubRepo(repository)) return true;
    if (repository.remoteUrl?.includes('github.com')) return true;
    return false;
  };

  return (
    <div
      onClick={handleClick}
      style={{
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.colors.primary;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 4px 12px rgba(0, 0, 0, 0.2)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.colors.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Status badges */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          gap: '6px',
        }}
      >
        {/* Dirty indicator for local repos - shown first */}
        {isDirty() && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: `${theme.colors.warning}20`,
              color: theme.colors.warning,
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            {getDirtyCount()} uncommitted
          </div>
        )}

        {/* Local/Remote indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: isRemote
              ? `${theme.colors.info}20`
              : `${theme.colors.success}20`,
            color: isRemote ? theme.colors.info : theme.colors.success,
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          {isRemote ? <Cloud size={12} /> : <HardDrive size={12} />}
          {isRemote ? 'Remote' : 'Local'}
        </div>
      </div>

      {/* Repository name and description */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            {getName()}
          </h3>
          {isFork() && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
                backgroundColor: `${theme.colors.textSecondary}20`,
                color: theme.colors.textSecondary,
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: 500,
              }}
              title="This is a forked repository"
            >
              <GitFork size={10} />
              Fork
            </div>
          )}
          {isPrivate() && <Lock size={14} color={theme.colors.textSecondary} />}
        </div>
        <p
          style={{
            fontSize: '13px',
            color: theme.colors.textSecondary,
            margin: '4px 0 0 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            fontStyle: getDescription() ? 'normal' : 'italic',
            opacity: getDescription() ? 1 : 0.7,
          }}
        >
          {getDescription() || 'No description'}
        </p>
      </div>

      {/* Action button */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: 'auto',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          {isRemote ? (
            <>
              <Download size={14} />
              Clone
            </>
          ) : (
            <>
              <FolderOpen size={14} />
              Open in Editor
            </>
          )}
        </button>

        {/* GitHub link if available */}
        {hasGitHubLink() && (
          <button
            onClick={handleOpenInGitHub}
            style={{
              padding: '8px 12px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
          >
            <ExternalLink size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
