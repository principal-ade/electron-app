import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Bot, Link2, RefreshCw, Terminal as TerminalIcon } from 'lucide-react';
import { topicClient, type Topic } from '../../tipc/topicClient';
import { terminalClient, onSessionsChanged } from '../../tipc/terminalClient';
import type { TerminalSessionInfo } from '../../../shared/tipc/terminalRouterTypes';
import { WindowService } from '../../main-process-api/WindowService';

/**
 * Sessions panel — shows the union of two session sources:
 *   1. Topic links: `~/.alexandria/topics-sync.json` `sessionLinks` entries
 *      whose topicId matches this workspace's topic. Written by the event
 *      server when a briefed agent fetches its topic URL.
 *   2. Terminal binds: live `TerminalSession`s in THIS window whose
 *      `agentSessionId` is set. Written by the SessionStart sidecar when
 *      a Claude session attaches to a freshly-created terminal.
 *
 * Each session id appears once; the row labels which source(s) produced
 * it. Terminal binds are scoped to the current window via
 * `ownedByWindowId` — sessions bound in sibling windows don't appear here.
 */
export interface SessionsPanelProps {
  /**
   * Topic this panel is scoped to. `undefined` for workspaces with no
   * topic — only terminal-bound sessions appear in that case.
   */
  topicId: string | undefined;
}

type SessionSource = 'topic' | 'terminal';

interface SessionRow {
  sessionId: string;
  sources: SessionSource[];
  /** Populated when the session is bound to a live terminal in this window. */
  terminal?: TerminalSessionInfo;
}

export const SessionsPanel: React.FC<SessionsPanelProps> = ({ topicId }) => {
  const { theme } = useTheme();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [topicSessionIds, setTopicSessionIds] = useState<string[]>([]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSessionInfo[]>(
    [],
  );
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-row in-flight state for the "Link to topic" button so a click
  // disables only the affected row instead of every action button at once.
  const [linkingIds, setLinkingIds] = useState<Set<string>>(new Set());

  // Capture the current window's id once. Used to filter terminal-bound
  // sessions down to terminals owned by this window — sibling Alexandria
  // windows shouldn't surface each other's bound terminals here.
  useEffect(() => {
    WindowService.getWindowId()
      .then((id) => setCurrentWindowId(id))
      .catch((err) => {
        console.error('[SessionsPanel] failed to read current window id', err);
      });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, links, terms] = await Promise.all([
        topicId ? topicClient.getTopic({ id: topicId }) : Promise.resolve(null),
        topicId
          ? topicClient.getSessionLinks()
          : Promise.resolve({} as Record<string, string>),
        terminalClient.listTerminalSessions(),
      ]);
      setTopic(t);
      const matching = topicId
        ? Object.entries(links)
            .filter(([, tid]) => tid === topicId)
            .map(([sid]) => sid)
        : [];
      setTopicSessionIds(matching);
      setTerminalSessions(terms);
    } catch (err) {
      console.error('[SessionsPanel] refresh failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    refresh();
    // Topic-link side: re-fetch live when the hook pipeline records a new
    // session→topic link. Cheap to refresh unconditionally; the filter
    // drops irrelevant events on the floor.
    const offLink = topicClient.onSessionLinked((event) => {
      if (event.topicId !== topicId) return;
      refresh();
    });
    // Terminal-bind side: the SessionStart sidecar triggers
    // `broadcastTerminalSessionsChanged`, which fans the updated list out
    // on this channel. Take it as our source of truth instead of
    // re-listing — avoids a round-trip per bind.
    const offSessions = onSessionsChanged((sessions) => {
      setTerminalSessions(sessions);
    });
    return () => {
      offLink();
      offSessions();
    };
  }, [refresh, topicId]);

  // Merge topic-linked + terminal-bound sessions, deduped by sessionId.
  // Terminal binds are filtered to this window's owned terminals. Topic
  // links carry no window association, so they always show up (they're
  // already topic-scoped, which is window-equivalent here — one topic per
  // workspace window).
  const rows = useMemo<SessionRow[]>(() => {
    const byId = new Map<string, SessionRow>();

    for (const sid of topicSessionIds) {
      byId.set(sid, { sessionId: sid, sources: ['topic'] });
    }

    for (const term of terminalSessions) {
      if (!term.agentSessionId) continue;
      if (currentWindowId !== null && term.ownedByWindowId !== currentWindowId) {
        continue;
      }
      const existing = byId.get(term.agentSessionId);
      if (existing) {
        existing.sources.push('terminal');
        existing.terminal = term;
      } else {
        byId.set(term.agentSessionId, {
          sessionId: term.agentSessionId,
          sources: ['terminal'],
          terminal: term,
        });
      }
    }

    return Array.from(byId.values());
  }, [topicSessionIds, terminalSessions, currentWindowId]);

  const total = rows.length;
  const headerLabel = topic?.title ?? 'No topic';

  // User-initiated link from a terminal-bound (but not yet topic-linked)
  // session to this workspace's topic. Idempotent server-side; on success
  // the SESSION_LINKED broadcast triggers our `onSessionLinked` handler,
  // which calls `refresh()` — so we don't need to mutate local state here.
  const handleLinkToTopic = useCallback(
    async (sessionId: string) => {
      if (!topicId) return;
      setLinkingIds((prev) => {
        const next = new Set(prev);
        next.add(sessionId);
        return next;
      });
      try {
        await topicClient.linkSession({ topicId, sessionId });
      } catch (err) {
        console.error('[SessionsPanel] linkSession failed', err);
        setError(
          err instanceof Error ? err.message : 'Failed to link session',
        );
      } finally {
        setLinkingIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
    },
    [topicId],
  );

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
          {total} {total === 1 ? 'session' : 'sessions'} · {headerLabel}
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

        {!loading && !error && total === 0 && (
          <div
            style={{
              padding: '24px 16px',
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              lineHeight: 1.5,
            }}
          >
            No agent sessions yet. Start a Claude session in a terminal in this
            window, or drag the{' '}
            <strong style={{ color: theme.colors.text }}>Brief Agent</strong>{' '}
            button onto a terminal — its SessionStart hook (or first fetch of
            the topic URL) will populate this list.
          </div>
        )}

        {rows.map((row) => {
          const hasTerminal = row.sources.includes('terminal');
          const hasTopic = row.sources.includes('topic');
          return (
            <div
              key={row.sessionId}
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
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={row.sessionId}
              >
                {row.sessionId}
              </code>
              {hasTerminal && (
                <span
                  title={
                    row.terminal?.directory
                      ? `Bound to terminal in ${row.terminal.directory}`
                      : 'Bound to a terminal in this window'
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: theme.colors.backgroundTertiary,
                    color: theme.colors.textSecondary,
                    fontSize: `${theme.fontSizes[0]}px`,
                  }}
                >
                  <TerminalIcon size={10} />
                  Terminal
                </span>
              )}
              {hasTopic && (
                <span
                  title="Linked to this workspace's topic"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: theme.colors.backgroundTertiary,
                    color: theme.colors.textSecondary,
                    fontSize: `${theme.fontSizes[0]}px`,
                  }}
                >
                  Topic
                </span>
              )}
              {!hasTopic && topicId && (
                <button
                  onClick={() => handleLinkToTopic(row.sessionId)}
                  disabled={linkingIds.has(row.sessionId)}
                  title={`Link to topic: ${topic?.title ?? topicId}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'transparent',
                    border: `1px solid ${theme.colors.border}`,
                    color: theme.colors.textSecondary,
                    cursor: linkingIds.has(row.sessionId)
                      ? 'wait'
                      : 'pointer',
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontFamily: theme.fonts.body,
                  }}
                >
                  <Link2 size={10} />
                  {linkingIds.has(row.sessionId) ? 'Linking…' : 'Link to topic'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
