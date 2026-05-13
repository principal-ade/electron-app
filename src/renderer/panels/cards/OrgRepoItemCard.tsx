import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2, Trash2 } from 'lucide-react';

export interface OrgRepoItemCardData {
  name: string;
  description?: string | null;
}

export interface OrgRepoItemCardProps {
  repo: OrgRepoItemCardData;
  onClick?: () => void;
  /** Hover-revealed action to remove the project from the local registry. */
  onRemove?: () => void;
}

export const OrgRepoItemCard: React.FC<OrgRepoItemCardProps> = ({ repo, onClick, onRemove }) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };
  const radius = theme.radii?.[1] || 4;

  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      onMouseEnter={(e) => {
        setHovered(true);
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        if (!onClick) return;
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
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
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from list (does not delete the folder)"
          aria-label={`Remove ${repo.name} from list`}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            padding: 0,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.colors.error ?? theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

export default OrgRepoItemCard;
