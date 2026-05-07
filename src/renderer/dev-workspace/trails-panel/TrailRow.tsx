import React, { useCallback, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, GitCompare, Share2, Trash2 } from 'lucide-react';
import type { TrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';

const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export interface TrailRowProps {
  entry: TrailIndexEntry;
  isActive: boolean;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
  /**
   * Per-session shared URL for this id, set by the panel after a successful
   * share. Drives the "shared" pill on the row; the modal handles the
   * actual copy-link affordance.
   */
  shareUrl?: string | null;
  /**
   * If supplied, renders the share button on this row. Clicking it opens
   * the share modal (handled by the parent panel); this row doesn't run
   * the IPC itself.
   */
  onShare?: (id: string) => void | Promise<void>;
}

export const TrailRow: React.FC<TrailRowProps> = ({
  entry,
  isActive,
  onActivate,
  onRemove,
  shareUrl,
  onShare,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  // Always re-activate. Re-activating a current active trail is a cheap
  // idempotent re-broadcast that surfaces the trail tab in case the user
  // closed it — which is the main reason a user re-clicks an active row.
  const handleActivate = useCallback(() => {
    onActivate(entry.id);
  }, [entry.id, onActivate]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const created = new Date(entry.createdAt).getTime();
      const isRecent =
        !Number.isNaN(created) && Date.now() - created < RECENT_THRESHOLD_MS;
      if (
        !isRecent &&
        !window.confirm(
          `Delete "${entry.title || 'Untitled trail'}"? This cannot be undone.`,
        )
      ) {
        return;
      }
      onRemove(entry.id);
    },
    [entry, onRemove],
  );

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShare?.(entry.id);
    },
    [entry.id, onShare],
  );

  const title =
    entry.title?.trim() || `Untitled trail · ${entry.markerCount} markers`;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer) return;
      const payload = `Use file-city trail "${title}" (id: ${entry.id}) as context — fetch via:\ncurl -s http://localhost:3054/api/file-city/trail/${entry.id}`;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', payload);
    },
    [entry.id, title],
  );
  const shareButtonTitle = shareUrl
    ? 'Open share dialog (copy link)'
    : 'Share to web-ade';
  const shareButtonColor = shareUrl
    ? theme.colors.primary
    : theme.colors.textSecondary;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: `1px solid ${
          isActive ? theme.colors.primary : theme.colors.border
        }`,
        background: isActive
          ? theme.colors.backgroundSecondary
          : hovered
            ? theme.colors.backgroundSecondary
            : theme.colors.background,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <div
        aria-hidden
        style={{
          width: '3px',
          borderRadius: '2px',
          background: isActive ? theme.colors.primary : 'transparent',
        }}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0,
          }}
        >
          {isActive && (
            <Check
              size={12}
              strokeWidth={2.5}
              color={theme.colors.primary}
              aria-label="Active"
            />
          )}
          <span
            style={{
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              color: theme.colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
            title={title}
          >
            {title}
          </span>
          {shareUrl && (
            <span
              title="Shared to web-ade this session"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                fontSize: theme.fontSizes[0],
                color: theme.colors.primary,
                border: `1px solid ${theme.colors.primary}`,
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}
            >
              <Share2 size={10} />
              shared
            </span>
          )}
          {entry.repoNames.length > 1 && (
            <span
              title={`Multi-repo trail: ${entry.repoNames.join(', ')}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '1px 6px',
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.repoNames.length} repos
            </span>
          )}
          {entry.hasDiffSnippets && (
            <span
              title="Includes diff snippets"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '1px 6px',
                fontSize: theme.fontSizes[0],
                color: theme.colors.textSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}
            >
              <GitCompare size={10} />
              diff
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          <span>{entry.markerCount} markers</span>
          <span aria-hidden>·</span>
          <span title={entry.createdAt}>{relativeTime(entry.createdAt)}</span>
        </div>
        {entry.summaryPreview && (
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {entry.summaryPreview}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '4px',
          alignSelf: 'flex-start',
        }}
      >
        {onShare && (
          <button
            type="button"
            onClick={handleShare}
            title={shareButtonTitle}
            aria-label={shareButtonTitle}
            style={{
              padding: '4px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: shareButtonColor,
              cursor: 'pointer',
              opacity: hovered || isActive || shareUrl ? 1 : 0,
              transition: 'opacity 120ms, color 120ms',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={handleRemove}
          title="Delete trail"
          aria-label={`Delete ${title}`}
          style={{
            padding: '4px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            opacity: hovered || isActive ? 1 : 0,
            transition: 'opacity 120ms',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
