import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot, RefreshCw } from 'lucide-react';
import { topicClient, type Topic } from '../../tipc/topicClient';

/**
 * Sessions panel — shows the agent sessions linked to this workspace's
 * topic. Source of truth is `~/.alexandria/topics-sync.json`'s
 * `sessionLinks` map, populated by the event server when a briefed agent
 * fetches its topic URL.
 *
 * The panel is workspace-scoped: it filters the global links map down to
 * entries whose topicId matches the workspace's single topic. Sessions
 * linked to other topics (other workspace windows, prior workspaces)
 * never appear here.
 */
export interface SessionsPanelProps {
  /**
   * Topic this panel is scoped to. `undefined` for workspaces with no
   * topic — the panel renders an empty/help state in that case.
   */
  topicId: string | undefined;
}

export const SessionsPanel: React.FC<SessionsPanelProps> = ({ topicId }) => {
  const { theme } = useTheme();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!topicId) {
      setTopic(null);
      setSessionIds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [t, links] = await Promise.all([
        topicClient.getTopic({ id: topicId }),
        topicClient.getSessionLinks(),
      ]);
      setTopic(t);
      // Filter the global links map down to just this topic's sessions.
      const matching = Object.entries(links)
        .filter(([, tid]) => tid === topicId)
        .map(([sid]) => sid);
      setSessionIds(matching);
    } catch (err) {
      console.error('[SessionsPanel] refresh failed', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load sessions',
      );
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    refresh();
    // Re-fetch live when the hook pipeline records a new session→topic
    // link. Cheap to refresh unconditionally; the filter drops irrelevant
    // events on the floor.
    const off = topicClient.onSessionLinked((event) => {
      if (event.topicId !== topicId) return;
      refresh();
    });
    return off;
  }, [refresh, topicId]);

  const totalLinks = sessionIds.length;
  const headerLabel = topic?.title ?? 'No topic';

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
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {totalLinks} {totalLinks === 1 ? 'session' : 'sessions'} · {headerLabel}
        </div>
        <button
          onClick={refresh}
          disabled={loading || !topicId}
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
            cursor: loading ? 'wait' : !topicId ? 'not-allowed' : 'pointer',
            opacity: !topicId ? 0.5 : 1,
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

        {!loading && !error && !topicId && (
          <div
            style={{
              padding: '24px 16px',
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            This workspace has no topic. Create one to start linking agent
            sessions to it.
          </div>
        )}

        {!loading && !error && topicId && totalLinks === 0 && (
          <div
            style={{
              padding: '24px 16px',
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            No agent sessions are linked to this topic yet. Drag the{' '}
            <strong style={{ color: theme.colors.text }}>Brief Agent</strong>{' '}
            button onto a terminal to brief its agent — the agent's first
            fetch of the topic URL records the link here.
          </div>
        )}

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
    </div>
  );
};
