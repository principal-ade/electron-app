import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';

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
  const spacing = { md: 16 };
  const radius = theme.radii?.[1] || 4;
  const avatarSrc = repo.ownerAvatarUrl ?? `https://github.com/${repo.owner}.png?size=120`;

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
          alt={repo.owner}
          style={{
            width: 40,
            height: 40,
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
