import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Circle, User } from 'lucide-react';

export interface ProjectRepoCardData {
  repoName: string;
  ownerLogin?: string;
  ownerAvatarUrl?: string;
  timeLabel?: string;
  isDirty?: boolean;
}

export interface ProjectRepoCardProps {
  repo: ProjectRepoCardData;
  onClick?: () => void;
}

export const ProjectRepoCard: React.FC<ProjectRepoCardProps> = ({ repo, onClick }) => {
  const { theme } = useTheme();
  const spacing = { md: 16 };
  const radius = theme.radii?.[1] || 4;
  const avatarSrc =
    repo.ownerAvatarUrl ??
    (repo.ownerLogin ? `https://github.com/${repo.ownerLogin}.png?size=120` : undefined);

  const secondary = [repo.ownerLogin, repo.timeLabel].filter(Boolean).join(' · ');

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
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={repo.ownerLogin ?? repo.repoName}
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
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: theme.colors.backgroundTertiary,
            }}
          >
            <User size={20} color={theme.colors.textSecondary} />
          </div>
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
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
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
              {repo.repoName}
            </div>
            {repo.isDirty && (
              <span
                title="In Progress — has uncommitted changes"
                style={{ flexShrink: 0, display: 'inline-flex' }}
              >
                <Circle size={8} fill={theme.colors.warning} color={theme.colors.warning} />
              </span>
            )}
          </div>
          {secondary && (
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
              {secondary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectRepoCard;
