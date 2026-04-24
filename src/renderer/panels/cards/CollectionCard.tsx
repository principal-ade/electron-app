import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderGit2 } from 'lucide-react';

type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}>;

export interface CollectionCardData {
  name: string;
  description?: string | null;
  icon?: IconComponent;
  ownerLogin?: string;
  isOrgOwned?: boolean;
  repoCount?: number;
  userCount?: number;
}

export interface CollectionCardProps {
  collection: CollectionCardData;
  onClick?: () => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onClick }) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };
  const radius = theme.radii?.[1] || 4;
  const Icon = collection.icon ?? FolderGit2;

  const repoCount = collection.repoCount ?? 0;
  const userCount = collection.userCount ?? 0;
  const itemCount = repoCount + userCount;
  const secondary =
    collection.isOrgOwned && collection.ownerLogin ? collection.ownerLogin : 'Personal Collection';

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius,
              backgroundColor: theme.colors.backgroundTertiary,
            }}
          >
            <Icon size={20} color={theme.colors.primary} />
          </div>

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
              {collection.name}
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
              {secondary}
            </div>
          </div>
        </div>

        {collection.description && (
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
            {collection.description}
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
          {repoCount > 0 && (
            <span>
              {repoCount} {repoCount === 1 ? 'repository' : 'repositories'}
            </span>
          )}
          {userCount > 0 && (
            <span>
              {userCount} {userCount === 1 ? 'user' : 'users'}
            </span>
          )}
          {itemCount === 0 && <span>Empty collection</span>}
        </div>
      </div>
    </div>
  );
};

export default CollectionCard;
