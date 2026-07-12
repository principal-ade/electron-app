import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { LIST_AVATAR_SIZE } from './listCardLayout';
import { FolderGit2, Star } from 'lucide-react';

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
  // Fall back to a folder glyph when the avatar URL is missing or fails to load
  // (e.g. untracked local clones with no GitHub owner).
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = Boolean(repo.ownerAvatarUrl) && !avatarFailed;

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px',
        backgroundColor: 'transparent',
        borderRadius: theme.radii?.[1] || 4,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showAvatar ? (
            <img
              src={repo.ownerAvatarUrl}
              alt={repo.owner}
              style={{
                width: LIST_AVATAR_SIZE,
                height: LIST_AVATAR_SIZE,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'block',
              }}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div
              style={{
                width: LIST_AVATAR_SIZE,
                height: LIST_AVATAR_SIZE,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
              }}
              aria-hidden
            >
              <FolderGit2 size={16} color={theme.colors.textSecondary} />
            </div>
          )}
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
                fontSize: theme.fontSizes[2],
                fontWeight: 600,
                fontFamily: theme.fonts?.heading ?? theme.fonts?.body,
                color: theme.colors.text,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
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

        {/* Meta row only when language and/or star count are provided — callers
            that want a compact identity-only row (e.g. Cloned Projects) omit both. */}
        {(repo.language || repo.stargazersCount != null) && (
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
            {repo.stargazersCount != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <Star size={12} fill="#f5c542" color="#f5c542" />
                <span>{repo.stargazersCount.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StarredRepoCard;
