import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, GitCompare, Loader2, Share2, Trash2 } from 'lucide-react';
import type { SequenceDiagramIndexEntry } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';

const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const COPY_FEEDBACK_MS = 1500;

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

export interface SequenceDiagramRowProps {
  entry: SequenceDiagramIndexEntry;
  isActive: boolean;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
  /**
   * Per-session shared URL for this id, set by the panel after a successful
   * share. When present the share button switches to a "copy link"
   * affordance and the title gets a small "shared" stamp.
   */
  shareUrl?: string | null;
  /**
   * If supplied, renders the share affordance and invokes this when the
   * user clicks it. The callback owns the IPC call + per-session state
   * update; the row only manages in-flight + error UI.
   */
  onShare?: (id: string) => Promise<void>;
}

export const SequenceDiagramRow: React.FC<SequenceDiagramRowProps> = ({
  entry,
  isActive,
  onActivate,
  onRemove,
  shareUrl,
  onShare,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleActivate = useCallback(() => {
    if (!isActive) onActivate(entry.id);
  }, [entry.id, isActive, onActivate]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const created = new Date(entry.createdAt).getTime();
      const isRecent =
        !Number.isNaN(created) && Date.now() - created < RECENT_THRESHOLD_MS;
      if (
        !isRecent &&
        !window.confirm(
          `Delete "${entry.title || 'Untitled flow'}"? This cannot be undone.`,
        )
      ) {
        return;
      }
      onRemove(entry.id);
    },
    [entry, onRemove],
  );

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onShare || sharing) return;
      // Already shared this session — copy the link instead of re-posting.
      if (shareUrl) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopiedAt(Date.now());
          if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
          copyTimeoutRef.current = setTimeout(
            () => setCopiedAt(null),
            COPY_FEEDBACK_MS,
          );
        } catch (err) {
          setShareError(
            err instanceof Error ? err.message : 'Could not copy link.',
          );
        }
        return;
      }
      setSharing(true);
      setShareError(null);
      try {
        await onShare(entry.id);
      } catch (err) {
        setShareError(
          err instanceof Error ? err.message : 'Sharing failed. Try again.',
        );
      } finally {
        setSharing(false);
      }
    },
    [entry.id, onShare, shareUrl, sharing],
  );

  const title = entry.title?.trim() || `Untitled flow · ${entry.eventCount} events`;
  const showCopied = copiedAt != null;
  const shareButtonTitle = shareError
    ? shareError
    : showCopied
      ? 'Link copied'
      : shareUrl
        ? 'Copy share link'
        : sharing
          ? 'Sharing…'
          : 'Share to web-ade';
  const shareButtonColor = shareError
    ? theme.colors.error ?? theme.colors.textSecondary
    : shareUrl
      ? theme.colors.primary
      : theme.colors.textSecondary;
  const ShareIcon = showCopied ? Check : sharing ? Loader2 : Share2;

  return (
    <div
      role="button"
      tabIndex={0}
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
        cursor: isActive ? 'default' : 'pointer',
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
          <span>{entry.eventCount} events</span>
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
            disabled={sharing}
            title={shareButtonTitle}
            aria-label={shareButtonTitle}
            style={{
              padding: '4px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: shareButtonColor,
              cursor: sharing ? 'wait' : 'pointer',
              opacity: hovered || isActive || shareUrl || sharing ? 1 : 0,
              transition: 'opacity 120ms, color 120ms',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShareIcon
              size={14}
              style={
                sharing
                  ? { animation: 'spin 1s linear infinite' }
                  : undefined
              }
            />
          </button>
        )}
        <button
          type="button"
          onClick={handleRemove}
          title="Delete diagram"
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
