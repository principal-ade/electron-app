import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot, RefreshCw } from 'lucide-react';
import { topicClient, type Topic } from '../../tipc/topicClient';

/**
 * Sessions panel — shows which agent sessions are linked to which topic.
 * Source of truth is `~/.alexandria/topics-sync.json`'s `sessionLinks` map,
 * populated by the event server when a briefed agent fetches its topic URL.
 */
export const SessionsPanel: React.FC = () => {
  const { theme } = useTheme();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [topicList, sessionLinks] = await Promise.all([
        topicClient.getTopics(),
        topicClient.getSessionLinks(),
      ]);
      setTopics(topicList);
      setLinks(sessionLinks);
    } catch (err) {
      console.error('[SessionsPanel] refresh failed', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load sessions',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Group session ids under their topic. Sessions whose topicId no longer
  // resolves to a known topic land in an "Unknown topic" bucket so they
  // aren't silently swallowed.
  const grouped = new Map<string, { topic: Topic | null; sessionIds: string[] }>();
  for (const topic of topics) {
    grouped.set(topic.id, { topic, sessionIds: [] });
  }
  for (const [sessionId, topicId] of Object.entries(links)) {
    const bucket = grouped.get(topicId);
    if (bucket) {
      bucket.sessionIds.push(sessionId);
    } else {
      const orphan = grouped.get(topicId) ?? { topic: null, sessionIds: [] };
      orphan.sessionIds.push(sessionId);
      grouped.set(topicId, orphan);
    }
  }

  const totalLinks = Object.keys(links).length;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: `${theme.fontSizes[1]}px`,
            fontWeight: theme.fontWeights.medium,
            color: theme.colors.textSecondary,
          }}
        >
          {totalLinks} {totalLinks === 1 ? 'session' : 'sessions'} linked
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          title="Refresh"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            background: 'transparent',
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.textSecondary,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: `${theme.fontSizes[0]}px`,
            fontFamily: theme.fonts.body,
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {error && (
          <div
            style={{
              padding: '12px 16px',
              color: theme.colors.error,
              fontSize: `${theme.fontSizes[1]}px`,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && totalLinks === 0 && (
          <div
            style={{
              padding: '24px 16px',
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            No agent sessions are linked to a topic yet. Drag the{' '}
            <strong style={{ color: theme.colors.text }}>Brief Agent</strong>{' '}
            button onto a terminal to brief its agent — the agent's first
            fetch of the topic URL records the link here.
          </div>
        )}

        {Array.from(grouped.entries()).map(([topicId, { topic, sessionIds }]) => {
          if (sessionIds.length === 0 && topic) return null;
          const title = topic?.title ?? 'Unknown topic';
          return (
            <div key={topicId} style={{ marginBottom: '12px' }}>
              <div
                style={{
                  padding: '6px 16px',
                  fontSize: `${theme.fontSizes[0]}px`,
                  fontWeight: theme.fontWeights.medium,
                  color: theme.colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {title}
                {sessionIds.length > 0 && ` · ${sessionIds.length}`}
              </div>
              {sessionIds.map((sid) => (
                <div
                  key={sid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    fontSize: `${theme.fontSizes[1]}px`,
                    color: theme.colors.text,
                  }}
                >
                  <Bot size={14} color={theme.colors.textSecondary} />
                  <code
                    style={{
                      fontFamily: theme.fonts.monospace,
                      fontSize: `${theme.fontSizes[0]}px`,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {sid}
                  </code>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
