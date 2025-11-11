import { useTheme } from '@a24z/industry-theme';
import { User } from 'lucide-react';

interface UserAvatarProps {
  avatarUrl?: string | null;
  username: string;
  size?: number;
  fallbackIcon?: React.ReactNode;
}

/**
 * Displays user avatars in a circular format.
 * Used for GitHub users, co-workers, followers, etc.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  username,
  size = 40,
  fallbackIcon,
}) => {
  const { theme } = useTheme();

  const getContent = () => {
    // If avatar URL is provided, show the image
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={username}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      );
    }

    // Fallback: custom icon if provided
    if (fallbackIcon) {
      return fallbackIcon;
    }

    // Default fallback: User icon
    return <User size={size * 0.5} color={theme.colors.textSecondary} />;
  };

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
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
