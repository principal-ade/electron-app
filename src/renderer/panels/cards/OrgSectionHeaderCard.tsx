import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown, ChevronRight, FolderGit2, Plus } from 'lucide-react';

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
  /**
   * When provided, an "add repository" (+) button appears on the right of the
   * header (revealed on hover). Wire this only for owners the user has
   * privileges to add repos to (their own account or a member org).
   */
  onAdd?: () => void;
  /** Tooltip/aria-label for the add button. */
  addLabel?: string;
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
  onAdd,
  addLabel = 'Add a repository',
}) => {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const [addHover, setAddHover] = useState(false);
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
        {/* Small rounded-square org avatar, with a folder glyph fallback. */}
        <div
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            borderRadius: 6,
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
              width={22}
              height={22}
              style={{ objectFit: 'cover', display: 'block' }}
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <FolderGit2 size={13} color={theme.colors.textSecondary} />
          )}
        </div>

        <span
          style={{
            fontFamily: theme.fonts?.body,
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights?.semibold ?? 600,
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

        {onAdd && (
          <button
            type="button"
            onClick={(e) => {
              // Don't let the click bubble up to the header's collapse toggle.
              e.stopPropagation();
              onAdd();
            }}
            title={addLabel}
            aria-label={addLabel}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              // Reveal on header hover to keep the "quiet list" aesthetic.
              opacity: hover ? 1 : 0,
              color: addHover ? theme.colors.primary : theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={() => setAddHover(true)}
            onMouseLeave={() => setAddHover(false)}
          >
            <Plus size={14} />
          </button>
        )}

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
