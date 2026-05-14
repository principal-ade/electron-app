import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';

/** Short relative time ("just now", "2h ago", "3d ago") for trail rows. */
const formatRelativeTime = (iso: string): string => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const deltaSec = Math.max(0, (Date.now() - t) / 1000);
  if (deltaSec < 60) return 'just now';
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
};

export interface TrailCardProps {
  trail: TrailIndexEntry;
  /**
   * 'repo' shows owner avatar + repo label (used in date-grouped views where
   * the section header already carries the date). 'date' shows the relative
   * time (used in project-grouped views where the section header carries
   * the repo).
   */
  metaMode: 'repo' | 'date';
  /** Whether this card is the active preview selection. */
  selected: boolean;
  /** Fired on click. Parent decides between select / toggle-off. */
  onSelect: () => void;
  /** Last-segment repo label (precomputed by parent to keep this card pure). */
  repoLabel: string;
  /** GitHub owner login — drives the avatar URL when present. */
  ownerLogin?: string;
  /**
   * Whether the trail's repo is in the Alexandria registry. Drives the
   * dimmed-disabled look + the tooltip copy.
   */
  owned: boolean;
}

export const TrailCard: React.FC<TrailCardProps> = ({
  trail,
  metaMode,
  selected,
  onSelect,
  repoLabel,
  ownerLogin,
  owned,
}) => {
  const { theme } = useTheme();
  const avatarUrl = ownerLogin
    ? `https://github.com/${ownerLogin}.png?size=32`
    : null;

  // Per upstream schema, an unset purpose is treated as 'investigation'.
  // Colors mirror the eyebrow in `@industry-theme/file-city-panel`'s trail
  // drawer so the list and the drawer use the same visual language. For
  // informative, the drawer splits Verified (green) vs Unverified (gray)
  // by stamp count; we mirror that here using `signOffCount`.
  const effectivePurpose = trail.purpose ?? 'investigation';
  const isInformativeVerified =
    effectivePurpose === 'informative' && (trail.signOffCount ?? 0) > 0;
  const purposeColor =
    effectivePurpose === 'informative'
      ? isInformativeVerified
        ? theme.colors.success ?? '#10b981'
        : theme.colors.textTertiary
      : effectivePurpose === 'changelog'
        ? '#f97316'
        : '#a855f7'; // investigation (default)
  const selectedBg = `color-mix(in srgb, ${purposeColor} 18%, ${theme.colors.background})`;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={
        owned
          ? `Preview ${trail.title} (${effectivePurpose})`
          : "This trail's project isn't in your registry."
      }
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 16,
        borderRadius: 8,
        border: `1px solid ${purposeColor}`,
        background: selected ? selectedBg : theme.colors.background,
        color: theme.colors.text,
        cursor: 'pointer',
        opacity: owned ? 1 : 0.6,
        textAlign: 'left',
        fontFamily: theme.fonts.body,
        transition: 'background-color 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        e.currentTarget.style.backgroundColor =
          theme.colors.backgroundTertiary ?? theme.colors.border;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = selected
          ? selectedBg
          : theme.colors.background;
      }}
    >
      <div
        style={{
          minWidth: 0,
          fontSize: theme.fontSizes[1],
          fontWeight: theme.fontWeights.semibold,
          color: selected ? '#ffffff' : purposeColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {trail.title || 'Untitled trail'}
      </div>
      {metaMode === 'repo' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            minWidth: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
          ) : null}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1,
            }}
          >
            {repoLabel}
          </span>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          {trail.fileCount !== undefined && trail.fileCount > 0 && (
            <>
              <span
                aria-label={`${trail.fileCount} ${trail.fileCount === 1 ? 'file' : 'files'}`}
              >
                {trail.fileCount} {trail.fileCount === 1 ? 'file' : 'files'}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{formatRelativeTime(trail.updatedAt)}</span>
        </div>
      )}
      {metaMode === 'repo' &&
        trail.fileCount !== undefined &&
        trail.fileCount > 0 && (
          <div
            aria-label={`${trail.fileCount} ${trail.fileCount === 1 ? 'file' : 'files'}`}
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            {trail.fileCount} {trail.fileCount === 1 ? 'file' : 'files'}
          </div>
        )}
    </button>
  );
};
