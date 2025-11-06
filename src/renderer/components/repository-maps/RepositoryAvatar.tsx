import { useTheme } from '@a24z/industry-theme';
import { useEffect, useState } from 'react';
import type {
  Repository,
  LocalClone,
} from '../../../shared/types/repository.types';
import { RepositoryService } from '../../main-process-api/RepositoryService';

interface RepositoryAvatarProps {
  repository?: Repository;
  localClone?: LocalClone;
  customAvatarUrl?: string | null;
  size?: number;
  type: 'owner' | 'repository' | 'clone';
  fallbackIcon?: React.ReactNode;
}

/**
 * Displays repository avatars with automatic loading from storage.
 * Priority:
 * 1. Custom avatar from storage (customAvatarPath)
 * 2. customAvatarUrl prop
 * 3. repository.avatarUrl (cached GitHub avatar)
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
  const [loadedAvatarUrl, setLoadedAvatarUrl] = useState<string | null>(null);

  // Use rounded squares for all types
  const borderRadius = `${Math.min(12, size / 4)}px`;

  // Load custom avatar from storage if available
  useEffect(() => {
    let cancelled = false;

    const loadCustomAvatar = async () => {
      // Determine which custom avatar path to use
      let customAvatarPath: string | undefined;

      if (type === 'clone' && localClone?.customAvatarPath) {
        customAvatarPath = localClone.customAvatarPath;
      } else if (type === 'repository' && repository?.customAvatarPath) {
        customAvatarPath = repository.customAvatarPath;
      } else if (type === 'owner' && repository?.customAvatarPath) {
        // Owner type can also use repository-level custom avatar
        customAvatarPath = repository.customAvatarPath;
      }

      if (customAvatarPath) {
        try {
          const url = await RepositoryService.getAvatarUrl(customAvatarPath);
          if (!cancelled && url) {
            setLoadedAvatarUrl(url);
          }
        } catch (error) {
          console.error('Failed to load custom avatar:', error);
        }
      }
    };

    loadCustomAvatar();

    return () => {
      cancelled = true;
    };
  }, [repository?.customAvatarPath, localClone?.customAvatarPath, type]);

  // Determine what to display
  const getContent = () => {
    // Priority 1: Custom avatar from storage
    if (loadedAvatarUrl) {
      return (
        <img
          src={loadedAvatarUrl}
          alt={type === 'clone' ? 'Clone' : repository?.name || 'Repository'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      );
    }

    // Priority 2: Custom avatar URL prop
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

    // Priority 3: Repository's cached GitHub avatar
    if (repository?.avatarUrl) {
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
