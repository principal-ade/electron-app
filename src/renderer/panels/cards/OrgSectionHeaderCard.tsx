import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronDown, ChevronRight, FolderGit2 } from 'lucide-react';

export interface OrgSectionHeaderCardData {
  /** Human-facing section label: an org/user display name when known, else the login. */
  orgName: string;
  /**
   * Owner login. Used for the avatar fallback (`https://github.com/{login}.png`)
   * and shown as a hover title when the label is a display name. Defaults to
   * `orgName`.
   */
  login?: string;
  avatarUrl?: string;
  badge?: 'you' | 'member';
  repoCount: number;
  isUntracked?: boolean;
}

export interface OrgSectionHeaderCardProps {
  header: OrgSectionHeaderCardData;
  /** Edge-to-edge heading with its spacing inside the hover target. */
  flush?: boolean;
  showTooltips?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  /** Open the owner profile instead of making this a collapsible section. */
  onOpen?: () => void;
}

/**
 * "Quiet list" section header: a lightweight, uppercase text label (avatar +
 * org name + badge, with the repo count and a collapse chevron on the right)
 * sitting above a hairline divider. No filled box or border of its own —
 * hierarchy comes from type and whitespace, not nested rectangles.
 */
export const OrgSectionHeaderCard: React.FC<OrgSectionHeaderCardProps> = ({
  header,
  flush = false,
  showTooltips = true,
  isCollapsed = false,
  onToggle,
  onOpen,
}) => {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const login = header.login ?? header.orgName;
  const avatarSrc =
    header.avatarUrl ??
    (!header.isUntracked
      ? `https://github.com/${login}.png?size=48`
      : undefined);
  const Chevron = isCollapsed ? ChevronRight : ChevronDown;
  const onActivate = onOpen ?? onToggle;
  const badgeLabel =
    header.badge === 'you'
      ? 'you'
      : header.badge === 'member'
        ? 'member'
        : null;

  return (
    <div>
      <div
        onClick={onActivate}
        role={onActivate ? 'button' : undefined}
        tabIndex={onActivate ? 0 : undefined}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault();
            onActivate?.();
          }
        }}
        aria-expanded={!onOpen && onToggle ? !isCollapsed : undefined}
        title={showTooltips && login !== header.orgName ? login : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: flush ? '12px 10px 10px' : '5px 10px',
          borderRadius: flush ? 0 : 6,
          cursor: onActivate ? 'pointer' : 'default',
          backgroundColor: hover
            ? theme.colors.backgroundSecondary
            : 'transparent',
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
              alt={login}
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
        {!onOpen && onToggle && (
          <Chevron
            size={13}
            color={theme.colors.textSecondary}
            style={{ flexShrink: 0 }}
          />
        )}
      </div>

      <div
        style={{
          height: 1,
          backgroundColor: theme.colors.border,
          margin: flush ? '0 10px' : '5px 10px 0',
        }}
      />
    </div>
  );
};

export default OrgSectionHeaderCard;
