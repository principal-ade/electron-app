import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { LIST_AVATAR_SIZE } from './listCardLayout';

export interface WatchedRepoCardData {
  owner: string;
  repo: string;
  ownerAvatarUrl?: string;
}

export interface WatchedRepoCardProps {
  repo: WatchedRepoCardData;
  onClick?: () => void;
}

export const WatchedRepoCard: React.FC<WatchedRepoCardProps> = ({ repo, onClick }) => {
  const { theme } = useTheme();
  const radius = theme.radii?.[1] || 4;
  const avatarSrc = repo.ownerAvatarUrl ?? `https://github.com/${repo.owner}.png?size=120`;

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
          alt={repo.owner}
          style={{
            width: LIST_AVATAR_SIZE,
            height: LIST_AVATAR_SIZE,
            borderRadius: '50%',
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
            {repo.repo}
          </div>
          <div
            style={{
              fontFamily: theme.fonts?.body,
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {repo.owner}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchedRepoCard;
