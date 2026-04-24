import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Star } from 'lucide-react';

export interface StarredRepoCardData {
  owner: string;
  name: string;
  ownerAvatarUrl?: string;
  description?: string | null;
  language?: string | null;
  stargazersCount?: number;
}

export interface StarredRepoCardProps {
  repo: StarredRepoCardData;
  onClick?: () => void;
}

export const StarredRepoCard: React.FC<StarredRepoCardProps> = ({ repo, onClick }) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };

  return (
    <div
      onClick={onClick}
      style={{
        padding: spacing.md,
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii?.[1] || 4,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {repo.ownerAvatarUrl && (
            <img
              src={repo.ownerAvatarUrl}
              alt={repo.owner}
              style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'block' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
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
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                color: theme.colors.text,
                lineHeight: 1.2,
              }}
            >
              {repo.name}
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts?.body,
                color: theme.colors.textSecondary,
                lineHeight: 1.2,
              }}
            >
              {repo.owner}
            </div>
          </div>
        </div>

        {repo.description && (
          <div
            style={{
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts?.body,
              lineHeight: theme.lineHeights?.body ?? 1.5,
              color: theme.colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {repo.description}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.md,
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts?.body,
            color: theme.colors.textSecondary,
          }}
        >
          {repo.language && (
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: theme.colors.primary,
                }}
              />
              <span>{repo.language}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <Star size={12} fill="#f5c542" color="#f5c542" />
            <span>{(repo.stargazersCount ?? 0).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StarredRepoCard;
