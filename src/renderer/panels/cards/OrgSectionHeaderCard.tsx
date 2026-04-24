import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown, ChevronRight, FolderGit2 } from 'lucide-react';

export interface OrgSectionHeaderCardData {
  orgName: string;
  avatarUrl?: string;
  badge?: 'you' | 'member';
  repoCount: number;
  isUntracked?: boolean;
}

export interface OrgSectionHeaderCardProps {
  header: OrgSectionHeaderCardData;
  isCollapsed: boolean;
  onToggle?: () => void;
}

export const OrgSectionHeaderCard: React.FC<OrgSectionHeaderCardProps> = ({
  header,
  isCollapsed,
  onToggle,
}) => {
  const { theme } = useTheme();
  const spacing = { xs: 4, sm: 8, md: 16 };
  const radius = theme.radii?.[1] || 4;
  const avatarSrc =
    header.avatarUrl ??
    (!header.isUntracked ? `https://github.com/${header.orgName}.png?size=64` : undefined);
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;
  const badgeLabel = header.badge === 'you' ? '(you)' : header.badge === 'member' ? '(member)' : null;

  return (
    <div
      onClick={onToggle}
      role={onToggle ? 'button' : undefined}
      aria-expanded={!isCollapsed}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: radius,
        cursor: onToggle ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!onToggle) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
        e.currentTarget.style.borderColor = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        if (!onToggle) return;
        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
        e.currentTarget.style.borderColor = theme.colors.border;
      }}
    >
      <Chevron size={16} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />

      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
          backgroundColor: theme.colors.backgroundTertiary,
          overflow: 'hidden',
        }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={header.orgName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <FolderGit2 size={16} color={theme.colors.textSecondary} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
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
          {header.orgName}
          {badgeLabel && (
            <span
              style={{
                marginLeft: spacing.xs,
                fontSize: theme.fontSizes[1],
                color: theme.colors.primary,
                fontWeight: 400,
              }}
            >
              {badgeLabel}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          fontFamily: theme.fonts?.body,
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          flexShrink: 0,
        }}
      >
        {header.repoCount} {header.repoCount === 1 ? 'repo' : 'repos'}
      </div>
    </div>
  );
};

export default OrgSectionHeaderCard;
