import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { LIST_AVATAR_SIZE } from './listCardLayout';

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
  const radius = theme.radii?.[1] || 4;
  const avatarRadius = user.isOrganization ? radius : '50%';
  const avatarSrc = user.avatarUrl ?? `https://github.com/${user.login}.png?size=120`;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        padding: '8px 10px',
        backgroundColor: 'transparent',
        borderRadius: radius,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src={avatarSrc}
          alt={user.login}
          style={{
            width: LIST_AVATAR_SIZE,
            height: LIST_AVATAR_SIZE,
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
            height: LIST_AVATAR_SIZE,
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
