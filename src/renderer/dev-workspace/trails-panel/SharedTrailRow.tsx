import React, { useCallback, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitCompare, Link2, Loader2 } from 'lucide-react';
import type { SharedTrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { getPrincipalBridgeUrl } from '../../../shared/config/appBranding';

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

export interface SharedTrailRowProps {
  entry: SharedTrailIndexEntry;
  /**
   * Hydrate + render the shared trail. The panel implements this by calling
   * `usePublishedTrails.hydrate(id)` and pushing the payload through
   * `TrailShareService.setTransient`.
   */
  onActivate: (id: string) => Promise<void>;
  /**
   * Open the share modal in success state with the trail's web-ade URL
   * pre-filled. Lets users grab the link without re-sharing.
   */
  onCopyLink?: (id: string) => void;
  /**
   * GitHub origin (owner/repo) the share belongs to. Embedded into the
   * drag payload so an agent in a terminal can hydrate the private share
   * via the local bridge endpoint without needing a token.
   */
  origin?: { owner: string; repo: string } | null;
}

export const SharedTrailRow: React.FC<SharedTrailRowProps> = ({
  entry,
  onActivate,
  onCopyLink,
  origin,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopyLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCopyLink?.(entry.id);
    },
    [entry.id, onCopyLink],
  );

  const handleActivate = useCallback(async () => {
    if (activating) return;
    setActivating(true);
    setError(null);
    try {
      await onActivate(entry.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this share.');
    } finally {
      setActivating(false);
    }
  }, [activating, entry.id, onActivate]);

  const title =
    entry.title?.trim() || `Untitled trail · ${entry.markerCount} markers`;
  const author = entry.createdBy?.githubLogin;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer || !origin) return;
      const url = `${getPrincipalBridgeUrl()}/api/file-city/trail/share/${encodeURIComponent(origin.owner)}/${encodeURIComponent(origin.repo)}/${encodeURIComponent(entry.id)}`;
      const payload = `Use file-city trail "${title}" (shared, id: ${entry.id}) as context — fetch via:\ncurl -s ${url}`;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', payload);
    },
    [entry.id, origin, title],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!!origin}
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
        padding: '12px 16px',
        border: 'none',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: hovered
          ? theme.colors.backgroundSecondary
          : 'transparent',
        cursor: activating ? 'wait' : 'pointer',
        position: 'relative',
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <div
        aria-hidden
        style={{
          width: '3px',
          borderRadius: '2px',
          background: 'transparent',
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
          <span
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
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
            fontSize: theme.fontSizes[1],
            color: theme.colors.textMuted,
          }}
        >
          <span>{entry.markerCount} markers</span>
          <span aria-hidden>·</span>
          <span title={entry.updatedAt}>{relativeTime(entry.updatedAt)}</span>
          {author && (
            <>
              <span aria-hidden>·</span>
              <span title={`GitHub: ${author}`}>by {author}</span>
            </>
          )}
        </div>
        {error && (
          <div
            title={error}
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.error ?? theme.colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {error}
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
        {onCopyLink && !activating && (
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy share link"
            aria-label="Copy share link"
            style={{
              padding: '4px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 120ms',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Link2 size={14} />
          </button>
        )}
        {activating && (
          <div
            style={{
              padding: '4px',
              color: theme.colors.textSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Loader2
              size={14}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
