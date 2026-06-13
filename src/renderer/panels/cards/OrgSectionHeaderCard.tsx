import React, { useState } from 'react';
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

/**
 * "Quiet list" section header: a lightweight, uppercase text label (avatar +
 * org name + badge, with the repo count and a collapse chevron on the right)
 * sitting above a hairline divider. No filled box or border of its own —
 * hierarchy comes from type and whitespace, not nested rectangles.
 */
export const OrgSectionHeaderCard: React.FC<OrgSectionHeaderCardProps> = ({
  header,
  isCollapsed,
  onToggle,
}) => {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const avatarSrc =
    header.avatarUrl ??
    (!header.isUntracked ? `https://github.com/${header.orgName}.png?size=48` : undefined);
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;
  const badgeLabel = header.badge === 'you' ? 'you' : header.badge === 'member' ? 'member' : null;

  return (
    <div>
      <div
        onClick={onToggle}
        role={onToggle ? 'button' : undefined}
        aria-expanded={!isCollapsed}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px',
          borderRadius: 6,
          cursor: onToggle ? 'pointer' : 'default',
          backgroundColor: hover ? theme.colors.backgroundSecondary : 'transparent',
          transition: 'background-color 0.15s ease',
        }}
      >
        {/* Small circular org avatar, with a folder glyph fallback. */}
        <div
          style={{
            width: 18,
            height: 18,
            flexShrink: 0,
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.backgroundTertiary,
          }}
        >
          {avatarSrc && !avatarBroken ? (
            <img
              src={avatarSrc}
              alt={header.orgName}
              width={18}
              height={18}
              style={{ objectFit: 'cover', display: 'block' }}
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <FolderGit2 size={11} color={theme.colors.textSecondary} />
          )}
        </div>

        <span
          style={{
            fontFamily: theme.fonts?.body,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights?.semibold ?? 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: theme.colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {header.orgName}
        </span>

        {badgeLabel && (
          <span
            style={{
              flexShrink: 0,
              fontFamily: theme.fonts?.body,
              fontSize: theme.fontSizes[1],
              color: theme.colors.primary,
            }}
          >
            · {badgeLabel}
          </span>
        )}

        <span style={{ flex: 1 }} />

        <span
          style={{
            flexShrink: 0,
            fontFamily: theme.fonts?.body,
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
          }}
        >
          {header.repoCount}
        </span>
        <Chevron size={13} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />
      </div>

      <div
        style={{
          height: 1,
          backgroundColor: theme.colors.border,
          margin: '5px 10px 0',
        }}
      />
    </div>
  );
};

export default OrgSectionHeaderCard;
