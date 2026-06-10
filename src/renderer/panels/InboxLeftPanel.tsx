/**
 * InboxLeftPanel
 *
 * Left panel for the InboxView. Lists behind a segmented control:
 * - Inbox: shared trails sent to the signed-in user (with unread markers).
 * - Topics: topics sent to the signed-in user (with unread markers).
 * - Sent: trails the signed-in user has shared with others.
 * - Recently Visited: trails the user has opened, newest first.
 *
 * All are fetched from web-ade via the renderer WebAdeService. Clicking a trail
 * row opens it through InboxTabsContext.openSharedTrail; a topic row opens
 * through openTopic.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Inbox, Route, RefreshCw, Send, Layers } from 'lucide-react';
import { SegmentedControl } from '../components/SegmentedControl';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { useInboxTabs } from '../principal-window/contexts/InboxTabsContext';
import type {
  InboxIndexEntry,
  OutboxIndexEntry,
  TrailRecentlyVisitedEntry,
  TopicInboxIndexEntry,
} from '../../shared/tipc/webAdeRouterTypes';

type InboxMode = 'inbox' | 'topics' | 'sent' | 'recent';

/** "to @a", "to @a, @b", "to @a, @b +3" — compact recipient summary. */
function formatRecipients(recipients: OutboxIndexEntry['recipients']): string {
  if (recipients.length === 0) return 'sent';
  const shown = recipients.slice(0, 2).map((r) => `@${r.githubLogin}`);
  const extra = recipients.length - shown.length;
  return `to ${shown.join(', ')}${extra > 0 ? ` +${extra}` : ''}`;
}

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
  const { openSharedTrail, openTopic } = useInboxTabs();

  const [mode, setMode] = useState<InboxMode>('inbox');

  const [inboxEntries, setInboxEntries] = useState<InboxIndexEntry[]>([]);
  const [topicEntries, setTopicEntries] = useState<TopicInboxIndexEntry[]>([]);
  const [sentEntries, setSentEntries] = useState<OutboxIndexEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<
    TrailRecentlyVisitedEntry[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [topicUnreadCount, setTopicUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [inboxResult, topicResult, sentResult, recentResult] =
      await Promise.allSettled([
        WebAdeService.getInbox({ limit: 100 }),
        WebAdeService.getTopicInbox({ limit: 100 }),
        WebAdeService.getSent({ limit: 100 }),
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

    if (topicResult.status === 'fulfilled') {
      setTopicEntries(topicResult.value.entries);
      setTopicUnreadCount(topicResult.value.unreadCount);
    } else {
      setTopicEntries([]);
      setTopicUnreadCount(0);
    }

    if (sentResult.status === 'fulfilled') {
      setSentEntries(sentResult.value.entries);
    } else {
      setSentEntries([]);
    }

    if (recentResult.status === 'fulfilled') {
      setRecentEntries(recentResult.value.entries);
    } else {
      setRecentEntries([]);
    }

    if (
      inboxResult.status === 'rejected' &&
      topicResult.status === 'rejected' &&
      sentResult.status === 'rejected' &&
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

  const renderTopicInbox = () => {
    if (loading) return emptyState('Loading…');
    if (error) return emptyState(error);
    if (topicEntries.length === 0) {
      return emptyState('No topics yet. Topics sent to you appear here.');
    }
    return topicEntries.map((entry) => {
      const unread = entry.readAt === null;
      const title = entry.snapshot?.title || 'Topic';
      const trailCount = entry.snapshot?.trailCount ?? 0;
      return (
        <button
          key={entry.topicId}
          style={rowBaseStyle}
          onClick={() => openTopic(entry.topicId, title)}
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
          <Layers
            size={14}
            color={theme.colors.textSecondary}
            style={{ marginTop: 3, flexShrink: 0 }}
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
                {trailCount > 0
                  ? ` · ${trailCount} trail${trailCount === 1 ? '' : 's'}`
                  : ''}
              </span>
              <span style={{ flexShrink: 0 }}>{timeAgo(entry.sentAt)}</span>
            </div>
          </div>
        </button>
      );
    });
  };

  const renderSent = () => {
    if (loading) return emptyState('Loading…');
    if (error) return emptyState(error);
    if (sentEntries.length === 0) {
      return emptyState('Nothing sent yet. Trails you share appear here.');
    }
    return sentEntries.map((entry) => {
      const title = entry.snapshot?.title || `${entry.owner}/${entry.repo}`;
      return (
        <button
          key={entry.trailId}
          style={{ ...rowBaseStyle, alignItems: 'center' }}
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
          <Send
            size={14}
            color={theme.colors.textSecondary}
            style={{ flexShrink: 0 }}
          />
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
                title={entry.recipients
                  .map((r) => `@${r.githubLogin}`)
                  .join(', ')}
              >
                {formatRecipients(entry.recipients)}
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
            {
              value: 'topics',
              label:
                topicUnreadCount > 0 ? `Topics ${topicUnreadCount}` : 'Topics',
            },
            { value: 'sent', label: 'Sent' },
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
        {mode === 'inbox'
          ? renderInbox()
          : mode === 'topics'
            ? renderTopicInbox()
            : mode === 'sent'
              ? renderSent()
              : renderRecent()}
      </div>
    </div>
  );
};

export default InboxLeftPanel;
