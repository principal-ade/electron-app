import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type {
  Repository,
  LocalClone,
} from '../../../shared/types/repository.types';

interface RepositoryAvatarProps {
  repository?: Repository;
  localClone?: LocalClone;
  customAvatarUrl?: string | null;
  alt?: string;
  size?: number;
  type: 'owner' | 'repository' | 'clone';
  fallbackIcon?: React.ReactNode;
}

/**
 * Displays repository avatars.
 * Priority:
 * 1. customAvatarUrl prop
 * 2. repository.avatarUrl (GitHub avatar)
 */
export const RepositoryAvatar: React.FC<RepositoryAvatarProps> = ({
  repository,
  customAvatarUrl,
  alt,
  size = 40,
  type,
  fallbackIcon,
}) => {
  const { theme } = useTheme();

  // Use rounded squares for all types
  const borderRadius = `${Math.min(12, size / 4)}px`;

  // Determine what to display
  const getContent = () => {
    // Priority 1: Custom avatar URL prop
    if (customAvatarUrl) {
      return (
        <img
          src={customAvatarUrl}
          alt={
            alt ??
            (type === 'clone' ? 'Clone' : repository?.name || 'Repository')
          }
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      );
    }

    // Priority 2: Repository's GitHub avatar
    if (repository?.avatarUrl) {
      return (
        <img
          src={repository.avatarUrl}
          alt={alt ?? repository.owner ?? repository.name ?? 'Repository'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      );
    }

    // Final fallback: custom fallback icon if provided
    if (fallbackIcon) {
      return fallbackIcon;
    }

    // No avatar available - return nothing, parent container will show background
    return null;
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
