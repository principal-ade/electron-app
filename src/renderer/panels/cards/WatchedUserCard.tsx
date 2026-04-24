import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';

export interface WatchedUserCardData {
  login: string;
  avatarUrl?: string;
  isOrganization?: boolean;
}

export interface WatchedUserCardProps {
  user: WatchedUserCardData;
  onClick?: () => void;
}

export const WatchedUserCard: React.FC<WatchedUserCardProps> = ({ user, onClick }) => {
  const { theme } = useTheme();
  const spacing = { md: 16 };
  const radius = theme.radii?.[1] || 4;
  const avatarRadius = user.isOrganization ? radius : '50%';
  const avatarSrc = user.avatarUrl ?? `https://github.com/${user.login}.png?size=120`;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        padding: spacing.md,
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: radius,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src={avatarSrc}
          alt={user.login}
          style={{
            width: 40,
            height: 40,
            borderRadius: avatarRadius,
            flexShrink: 0,
            display: 'block',
          }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 1,
            transform: 'translateY(-2px)',
          }}
        >
          <div
            style={{
              fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
              fontSize: theme.fontSizes[2],
              fontWeight: 600,
              color: theme.colors.text,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.login}
          </div>
          <div
            style={{
              fontFamily: theme.fonts?.body,
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              lineHeight: 1.2,
            }}
          >
            {user.isOrganization ? 'Organization' : 'User'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchedUserCard;
