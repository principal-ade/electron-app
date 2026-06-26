import React, { useCallback, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Copy, GitCompare, Share2 } from 'lucide-react';
import type { TrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { TrailLibraryService } from '../../services/TrailLibraryService';

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

export interface TrailRowProps {
  entry: TrailIndexEntry;
  isActive: boolean;
  onActivate: (id: string) => void;
  onRemove: (id: string) => void;
  /**
   * Per-session publish URL for this id, set by the panel after a successful
   * publish. Drives the "shared" pill on the row; the modal handles the
   * actual copy-link affordance.
   */
  publishUrl?: string | null;
  /**
   * If supplied, renders the publish button on this row. Clicking it opens
   * the publish modal (handled by the parent panel); this row doesn't run
   * the IPC itself.
   */
  onPublish?: (id: string) => void | Promise<void>;
}

export const TrailRow: React.FC<TrailRowProps> = ({
  entry,
  isActive,
  onActivate,
  onRemove,
  publishUrl,
  onPublish,
}) => {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `entry.sharedAt` is the durable lock marker (survives reload); `publishUrl`
  // covers the just-published-this-session window before the list refresh lands.
  const isPublished = Boolean(entry.sharedAt) || Boolean(publishUrl);

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

  const handlePublish = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPublish?.(entry.id);
    },
    [entry.id, onPublish],
  );

  const handleCopyPath = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const filePath = await TrailLibraryService.getFilePath(entry.id);
      if (!filePath) return;
      try {
        await navigator.clipboard.writeText(filePath);
        setCopiedPath(true);
        if (copyResetRef.current) clearTimeout(copyResetRef.current);
        copyResetRef.current = setTimeout(
          () => setCopiedPath(false),
          COPY_FEEDBACK_MS,
        );
      } catch {
        // navigator.clipboard can reject in restricted webviews; no-op.
      }
    },
    [entry.id],
  );

  const title =
    entry.title?.trim() ||
    (entry.fileCount !== undefined && entry.fileCount > 0
      ? `Untitled trail · ${entry.fileCount} ${entry.fileCount === 1 ? 'file' : 'files'}`
      : 'Untitled trail');

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer) return;
      const payload = `Use file-city trail "${title}" (id: ${entry.id}) as context — fetch via:\ncurl -s http://localhost:3054/api/file-city/trail/${entry.id}`;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', payload);
    },
    [entry.id, title],
  );
  const publishButtonLabel = isPublished ? 'Copy link' : 'Publish';
  const publishButtonColor = theme.colors.primary;
  const deleteButtonColor = theme.colors.error ?? '#e5484d';

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
        padding: '12px 16px',
        border: 'none',
        borderBottom: `1px solid ${theme.colors.border}`,
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
            alignItems: 'flex-start',
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
              style={{ flexShrink: 0, marginTop: '3px' }}
            />
          )}
          <span
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              wordBreak: 'break-word',
              flex: 1,
              minWidth: 0,
            }}
            title={title}
          >
            {title}
          </span>
          {isPublished && (
            <span
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
            fontSize: theme.fontSizes[1],
            color: theme.colors.textMuted,
          }}
        >
          <span title={entry.createdAt}>{relativeTime(entry.createdAt)}</span>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={handleCopyPath}
              title="Copy local file path"
              aria-label={`Copy local file path for ${title}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                background: 'transparent',
                color: copiedPath
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
                cursor: 'pointer',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 120ms, background 120ms, color 120ms',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
              }}
            >
              {copiedPath ? <Check size={12} /> : <Copy size={12} />}
              {copiedPath ? 'Copied' : 'Copy path'}
            </button>
            {onPublish && (
              <button
                type="button"
                onClick={handlePublish}
                aria-label={publishButtonLabel}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = publishButtonColor;
                  e.currentTarget.style.color = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = publishButtonColor;
                }}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${publishButtonColor}`,
                  background: 'transparent',
                  color: publishButtonColor,
                  cursor: 'pointer',
                  opacity: hovered ? 1 : 0,
                  transition: 'opacity 120ms, background 120ms, color 120ms',
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.medium,
                }}
              >
                {publishButtonLabel}
              </button>
            )}
            <button
              type="button"
              onClick={handleRemove}
              title="Delete trail"
              aria-label={`Delete ${title}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = deleteButtonColor;
                e.currentTarget.style.color = theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = deleteButtonColor;
              }}
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                border: `1px solid ${deleteButtonColor}`,
                background: 'transparent',
                color: deleteButtonColor,
                cursor: 'pointer',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 120ms, background 120ms, color 120ms',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
