import { useTheme } from '@a24z/industry-theme';
import {
  Github,
  Gitlab,
  GitBranch,
  GitCommitHorizontal,
  FolderOpen,
} from 'lucide-react';
import type {
  Repository,
  LocalClone,
} from '../../../shared/types/repository.types';

interface RepositoryAvatarProps {
  repository?: Repository;
  localClone?: LocalClone;
  customAvatarUrl?: string | null;
  size?: number;
  type: 'owner' | 'repository' | 'clone';
  fallbackIcon?: React.ReactNode;
}

/**
 * Displays repository avatars with semantic shapes:
 * - Circles (50% border radius) for remote/cloud entities (owner, repository)
 * - Rounded squares (8px border radius) for local entities (clones)
 */
export const RepositoryAvatar: React.FC<RepositoryAvatarProps> = ({
  repository,
  localClone,
  customAvatarUrl,
  size = 40,
  type,
  fallbackIcon,
}) => {
  const { theme } = useTheme();

  // Use rounded squares for all types
  const borderRadius = `${Math.min(12, size / 4)}px`;

  // Determine what to display
  const getContent = () => {
    // Custom avatar URL takes priority
    if (customAvatarUrl) {
      return (
        <img
          src={customAvatarUrl}
          alt={type === 'clone' ? 'Clone' : repository?.name || 'Repository'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      );
    }

    // For owner type, use repository's GitHub avatar
    if (type === 'owner' && repository?.avatarUrl) {
      return (
        <img
          src={repository.avatarUrl}
          alt={repository.owner}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      );
    }

    // For repository type without custom, show GitHub avatar or fallback
    if (type === 'repository' && repository?.avatarUrl && !customAvatarUrl) {
      return (
        <img
          src={repository.avatarUrl}
          alt={repository.owner}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      );
    }

    // Fallback icons
    if (fallbackIcon) {
      return fallbackIcon;
    }

    // Default icons based on type and VCS
    if (type === 'clone') {
      return (
        <FolderOpen size={size * 0.4} color={theme.colors.textSecondary} />
      );
    }

    if (repository?.vcsType === 'gitlab') {
      return <Gitlab size={size * 0.5} />;
    } else if (repository?.vcsType === 'bitbucket') {
      return <GitCommitHorizontal size={size * 0.5} />;
    } else if (repository?.vcsType === 'generic') {
      return <GitBranch size={size * 0.5} />;
    }

    return <Github size={size * 0.5} />;
  };

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius,
        backgroundColor: theme.colors.backgroundTertiary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {getContent()}
    </div>
  );
};
