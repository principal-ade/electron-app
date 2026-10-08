import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Inbox, Layers, RefreshCw } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { WebAdeService } from '../main-process-api/WebAdeService';
import { emitTopicOpen } from '../events/portalIntents';
import { useAuth } from '../hooks/useAuthState';
import type { TopicInboxIndexEntry } from '../../shared/tipc/webAdeRouterTypes';

/** Topic-only inbox for topics shared with the signed-in user. */
export const InboxLeftPanel: React.FC<{ events: PanelEventEmitter }> = ({
  events,
}) => {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  const [entries, setEntries] = useState<TopicInboxIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await WebAdeService.getTopicInbox({ limit: 100 });
      setEntries(result.entries);
    } catch (err) {
      setEntries([]);
      setError(
        isAuthenticated
          ? 'Could not load your topic inbox.'
          : 'Sign in with GitHub to see topics shared with you.',
      );
      console.error('[InboxLeftPanel] Failed to load topic inbox:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTopic = (entry: TopicInboxIndexEntry) => {
    emitTopicOpen(events, 'topic-inbox', {
      topicId: entry.topicId,
      title: entry.snapshot.title,
      surface: 'inbox',
    });
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Inbox size={16} />
          <strong>Topic Inbox</strong>
          {entries.length > 0 && (
            <span style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              {entries.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh topic inbox"
          title="Refresh"
          style={{
            display: 'flex',
            border: 0,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 20, color: theme.colors.textSecondary }}>
          Loading topics…
        </div>
      ) : error ? (
        <div style={{ padding: 20, color: theme.colors.textSecondary }}>
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: 28,
            color: theme.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          <Layers size={22} />
          <span>No shared topics yet.</span>
        </div>
      ) : (
        entries.map((entry) => (
          <button
            key={`${entry.topicId}:${entry.sentAt}`}
            type="button"
            onClick={() => openTopic(entry)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 16px',
              border: 0,
              borderBottom: `1px solid ${theme.colors.border}`,
              background: 'transparent',
              color: theme.colors.text,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: entry.readAt ? 500 : 650,
              }}
            >
              {!entry.readAt && (
                <span
                  aria-label="Unread"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: theme.colors.primary,
                    flex: '0 0 auto',
                  }}
                />
              )}
              <span>{entry.snapshot.title}</span>
            </div>
            <div
              style={{
                marginTop: 5,
                color: theme.colors.textSecondary,
                fontSize: 12,
              }}
            >
              Shared by @{entry.sender.githubLogin}
            </div>
            {entry.snapshot.descriptionPreview && (
              <div
                style={{
                  marginTop: 6,
                  color: theme.colors.textSecondary,
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {entry.snapshot.descriptionPreview}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
};
