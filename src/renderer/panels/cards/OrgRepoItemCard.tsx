import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';

export interface OrgRepoItemCardData {
  name: string;
  description?: string | null;
}

export interface OrgRepoItemCardProps {
  repo: OrgRepoItemCardData;
  onClick?: () => void;
}

export const OrgRepoItemCard: React.FC<OrgRepoItemCardProps> = ({ repo, onClick }) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };
  const radius = theme.radii?.[1] || 4;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        backgroundColor: 'transparent',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: radius,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <FolderGit2 size={16} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.fonts?.body,
            fontSize: theme.fontSizes[1],
            color: theme.colors.text,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {repo.name}
        </div>
        {repo.description && (
          <div
            style={{
              fontFamily: theme.fonts?.body,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {repo.description}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgRepoItemCard;
