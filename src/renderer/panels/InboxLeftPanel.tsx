/**
 * InboxLeftPanel
 *
 * Left panel for the InboxView. Two lists behind a segmented control:
 * - Inbox: shared trails sent to the signed-in user (with unread markers).
 * - Recently Visited: trails the user has opened, newest first.
 *
 * Both are fetched from web-ade via the renderer WebAdeService. Clicking a row
 * opens the trail as a tab through InboxTabsContext.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Inbox, Route, RefreshCw } from 'lucide-react';
import { SegmentedControl } from '../components/SegmentedControl';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { useInboxTabs } from '../principal-window/contexts/InboxTabsContext';
import type {
  InboxIndexEntry,
  TrailRecentlyVisitedEntry,
} from '../../shared/tipc/webAdeRouterTypes';

type InboxMode = 'inbox' | 'recent';

/** Compact "x ago" relative time from an ISO timestamp. */
function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export const InboxLeftPanel: React.FC = () => {
  const { theme } = useTheme();
  const { openSharedTrail } = useInboxTabs();

  const [mode, setMode] = useState<InboxMode>('inbox');

  const [inboxEntries, setInboxEntries] = useState<InboxIndexEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<
    TrailRecentlyVisitedEntry[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [inboxResult, recentResult] = await Promise.allSettled([
      WebAdeService.getInbox({ limit: 100 }),
      WebAdeService.getRecentlyVisitedTrails(),
    ]);

    if (inboxResult.status === 'fulfilled') {
      setInboxEntries(inboxResult.value.entries);
      setUnreadCount(inboxResult.value.unreadCount);
    } else {
      // Most likely signed out — leave the inbox empty, not an error.
      setInboxEntries([]);
      setUnreadCount(0);
    }

    if (recentResult.status === 'fulfilled') {
      setRecentEntries(recentResult.value.entries);
    } else {
      setRecentEntries([]);
    }

    if (
      inboxResult.status === 'rejected' &&
      recentResult.status === 'rejected'
    ) {
      setError('Sign in with GitHub to see your inbox and recent trails.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  const rowBaseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: spacing.sm,
    width: '100%',
    padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s ease',
  };

  const emptyState = (text: string) => (
    <div
      style={{
        padding: `${spacing.sm * 3}px ${spacing.sm * 2}px`,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );

  const renderInbox = () => {
    if (loading) return emptyState('Loading…');
    if (error) return emptyState(error);
    if (inboxEntries.length === 0) {
      return emptyState(
        'No shared trails yet. Trails sent to you appear here.',
      );
    }
    return inboxEntries.map((entry) => {
      const unread = entry.readAt === null;
      const title = entry.snapshot?.title || `${entry.owner}/${entry.repo}`;
      return (
        <button
          key={entry.trailId}
          style={rowBaseStyle}
          onClick={() =>
            openSharedTrail(entry.trailId, entry.owner, entry.repo)
          }
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* Unread marker (or spacer to keep alignment) */}
          <div
            style={{
              width: 8,
              height: 8,
              marginTop: 6,
              borderRadius: '50%',
              flexShrink: 0,
              backgroundColor: unread ? theme.colors.primary : 'transparent',
            }}
            title={unread ? 'Unread' : undefined}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: unread ? 700 : 500,
                color: theme.colors.text,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: spacing.sm,
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textMuted,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                from @{entry.sender.githubLogin}
              </span>
              <span style={{ flexShrink: 0 }}>{timeAgo(entry.sentAt)}</span>
            </div>
          </div>
        </button>
      );
    });
  };

  const renderRecent = () => {
    if (loading) return emptyState('Loading…');
    if (recentEntries.length === 0) {
      return emptyState('Trails you open will show up here.');
    }
    return recentEntries.map((entry) => {
      const ownerAvatar = entry.owner
        ? `https://github.com/${entry.owner}.png?size=32`
        : null;
      return (
        <button
          key={entry.id}
          style={{ ...rowBaseStyle, alignItems: 'center' }}
          onClick={() => openSharedTrail(entry.id, entry.owner, entry.repo)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundSecondary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {/* Repo-owner avatar, stretched to the full row height (falls back
              to the trail icon for local-only trails with no GitHub owner). */}
          {ownerAvatar ? (
            <img
              src={ownerAvatar}
              alt={entry.owner}
              title={`${entry.owner}/${entry.repo}`}
              width={40}
              height={40}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
                display: 'block',
              }}
            />
          ) : (
            <Route
              size={14}
              color={theme.colors.textSecondary}
              style={{ marginTop: 3, flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: 500,
                color: theme.colors.text,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.title || `${entry.owner}/${entry.repo}`}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: spacing.sm,
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[1],
                color: theme.colors.textMuted,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.repo}
              </span>
              <span style={{ flexShrink: 0 }}>
                visited {timeAgo(entry.lastVisitedAt)}
              </span>
            </div>
          </div>
        </button>
      );
    });
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Header: title + refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          flexShrink: 0,
        }}
      >
        <Inbox size={16} color={theme.colors.text} />
        <span
          style={{
            flex: 1,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Inbox
          {unreadCount > 0 && (
            <span
              style={{
                marginLeft: spacing.sm,
                padding: '0 6px',
                borderRadius: 8,
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[0],
                fontWeight: 700,
              }}
            >
              {unreadCount}
            </span>
          )}
        </span>
        <button
          onClick={() => void load()}
          title="Refresh"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xs,
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Mode toggle */}
      <div style={{ padding: `0 ${spacing.sm}px ${spacing.sm}px` }}>
        <SegmentedControl
          options={[
            { value: 'inbox', label: 'Inbox' },
            { value: 'recent', label: 'Recently Visited' },
          ]}
          value={mode}
          onChange={(value) => setMode(value as InboxMode)}
          theme={theme}
          variant="pill-flat"
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mode === 'inbox' ? renderInbox() : renderRecent()}
      </div>
    </div>
  );
};

export default InboxLeftPanel;
