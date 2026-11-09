import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  History,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { agentSessionBookmarkTabId } from '../../shared/agentSessionBookmark';
import type { AgentSessionBookmarkProvider } from '../../shared/types/userPreferences.types';
import { extractLocalClones } from '../events/repositorySelected';
import { SessionHistoryService } from '../main-process-api/SessionHistoryService';
import { AgentSessionIcon } from './AgentSessionIcon';
import { sessionBookmarkKey, useSessionBookmarks } from './useSessionBookmarks';

type Theme = ReturnType<typeof useTheme>['theme'];

interface SessionsLeftPanelProps {
  repositories: AlexandriaEntry[];
}

interface SessionHistoryEntry {
  id: string;
  title: string;
  directory: string;
  createdAt: number;
  updatedAt: number;
  agent: AgentSessionBookmarkProvider;
  canResume: boolean;
}

function projectName(directory: string): string {
  return directory.split(/[\\/]/).filter(Boolean).at(-1) || 'Unknown project';
}

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
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

const useSpacing = (theme: Theme) => ({
  xs: theme.space?.[1] || 4,
  sm: theme.space?.[2] || 8,
});

const EmptyState: React.FC<{ text: string }> = ({ text }) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  return (
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
};

const FilterBar: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.sm,
        height: 30,
        boxSizing: 'border-box',
        padding: `0 ${spacing.sm}px`,
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        flexShrink: 0,
      }}
    >
      <Search
        size={14}
        color={theme.colors.textSecondary}
        style={{ display: 'block', flexShrink: 0 }}
      />
      <input
        type="text"
        placeholder="Search sessions"
        aria-label="Search agent sessions"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Clear search"
          aria-label="Clear search"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

const SessionRow: React.FC<{
  session: SessionHistoryEntry;
  resuming: boolean;
  bookmarked: boolean;
  onResume: () => void;
  onToggleBookmark: () => void;
}> = ({ session, resuming, bookmarked, onResume, onToggleBookmark }) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  const [hovered, setHovered] = useState(false);
  const timestamp =
    session.updatedAt > 0 ? session.updatedAt : session.createdAt;
  const timeLabel = timestamp > 0 ? timeAgo(timestamp) : '';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: hovered
          ? theme.colors.backgroundSecondary
          : 'transparent',
        borderBottom: `1px solid ${theme.colors.border}`,
        color: theme.colors.text,
        transition: 'background-color 0.15s ease',
      }}
    >
      <button
        type="button"
        onClick={onResume}
        disabled={resuming || !session.canResume}
        aria-label={
          session.canResume
            ? `Open ${session.agent} session: ${session.title}`
            : `${session.agent} IDE session: ${session.title} (cannot resume from CLI)`
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          flex: 1,
          minWidth: 0,
          padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
          boxSizing: 'border-box',
          background: 'transparent',
          border: 'none',
          color: theme.colors.text,
          cursor: resuming ? 'wait' : 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[2],
              fontWeight: 500,
              marginBottom: 2,
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
              {session.title}
            </span>
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
              {projectName(session.directory)}
            </span>
            {timeLabel && <span style={{ flexShrink: 0 }}>{timeLabel}</span>}
          </div>
        </div>
      </button>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          gap: spacing.xs,
          paddingTop: spacing.sm * 1.5,
          paddingRight: spacing.sm * 2,
        }}
      >
        <button
          type="button"
          aria-label={`${bookmarked ? 'Remove bookmark from' : 'Bookmark'} ${session.agent} session: ${session.title}`}
          aria-pressed={bookmarked}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark session'}
          onClick={onToggleBookmark}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: spacing.xs,
            background: 'transparent',
            border: 'none',
            color: bookmarked
              ? theme.colors.primary
              : theme.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            color: hovered ? theme.colors.text : theme.colors.textSecondary,
          }}
        >
          {resuming ? 'Opening…' : <AgentSessionIcon agent={session.agent} />}
        </span>
      </div>
    </div>
  );
};

export const SessionsLeftPanel: React.FC<SessionsLeftPanelProps> = ({
  repositories,
}) => {
  const { theme } = useTheme();
  const spacing = useSpacing(theme);
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const { isBookmarked, toggleSessionBookmark, syncBookmarkDetails } =
    useSessionBookmarks();

  const directories = useMemo(
    () =>
      Array.from(
        new Set(
          repositories.flatMap(
            (repository) =>
              extractLocalClones(repository)?.map((clone) => clone.path) ?? [],
          ),
        ),
      ),
    [repositories],
  );

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(
      () => {
        const searchQuery = query.trim();
        const openCodeRequest = searchQuery
          ? SessionHistoryService.openCode.searchProjects(
              directories,
              searchQuery,
            )
          : SessionHistoryService.openCode.listProjects(directories);
        const claudeRequest = searchQuery
          ? SessionHistoryService.claude.search(searchQuery)
          : SessionHistoryService.claude.list();
        const cursorRequest = searchQuery
          ? SessionHistoryService.cursor.search(searchQuery)
          : SessionHistoryService.cursor.list();

        void Promise.allSettled([
          openCodeRequest,
          claudeRequest,
          cursorRequest,
        ]).then(([openCodeResult, claudeResult, cursorResult]) => {
          if (!current) return;
          const combined: SessionHistoryEntry[] = [];
          const errors: string[] = [];
          if (openCodeResult.status === 'fulfilled') {
            combined.push(
              ...openCodeResult.value.map((session) => ({
                ...session,
                agent: 'OpenCode' as const,
                canResume: true,
              })),
            );
          } else {
            errors.push(
              openCodeResult.reason instanceof Error
                ? openCodeResult.reason.message
                : String(openCodeResult.reason),
            );
          }
          if (claudeResult.status === 'fulfilled') {
            combined.push(
              ...claudeResult.value.map((session) => ({
                ...session,
                agent: 'Claude Code' as const,
                canResume: true,
              })),
            );
          } else {
            errors.push(
              claudeResult.reason instanceof Error
                ? claudeResult.reason.message
                : String(claudeResult.reason),
            );
          }
          if (cursorResult.status === 'fulfilled') {
            combined.push(
              ...cursorResult.value
                .filter((session) => session.resumable)
                .map((session) => ({
                  ...session,
                  agent: 'Cursor' as const,
                  canResume: true,
                })),
            );
          } else {
            errors.push(
              cursorResult.reason instanceof Error
                ? cursorResult.reason.message
                : String(cursorResult.reason),
            );
          }
          combined.sort(
            (a, b) =>
              b.updatedAt - a.updatedAt || a.title.localeCompare(b.title),
          );
          setSessions(combined);
          setError(combined.length === 0 ? errors.join('\n') || null : null);
          setLoading(false);
        });
      },
      query.trim() ? 250 : 0,
    );

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [directories, query, refreshToken]);

  useEffect(() => {
    if (sessions.length > 0) syncBookmarkDetails(sessions);
  }, [sessions, syncBookmarkDetails]);

  const resume = useCallback(
    async (session: SessionHistoryEntry) => {
      setResumingId(session.id);
      setError(null);
      const tabId = isBookmarked(sessionBookmarkKey(session))
        ? agentSessionBookmarkTabId(session)
        : undefined;
      try {
        if (session.agent === 'OpenCode') {
          if (tabId) {
            await SessionHistoryService.openCode.resume(
              session.directory,
              session.id,
              tabId,
            );
          } else {
            await SessionHistoryService.openCode.resume(
              session.directory,
              session.id,
            );
          }
        } else if (session.agent === 'Claude Code') {
          if (tabId) {
            await SessionHistoryService.claude.resume(
              session.directory,
              session.id,
              tabId,
            );
          } else {
            await SessionHistoryService.claude.resume(
              session.directory,
              session.id,
            );
          }
        } else {
          if (tabId) {
            await SessionHistoryService.cursor.resume(
              session.directory,
              session.id,
              tabId,
            );
          } else {
            await SessionHistoryService.cursor.resume(
              session.directory,
              session.id,
            );
          }
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setResumingId(null);
      }
    },
    [isBookmarked],
  );

  const renderContent = () => {
    if (loading && sessions.length === 0) return <EmptyState text="Loading…" />;
    if (error) return <EmptyState text={error} />;
    if (sessions.length === 0) {
      return (
        <EmptyState
          text={
            query.trim()
              ? 'No sessions match your search.'
              : 'No Claude Code, Cursor, or OpenCode sessions found.'
          }
        />
      );
    }
    return [...sessions]
      .sort((a, b) => {
        const bookmarkOrder =
          Number(isBookmarked(sessionBookmarkKey(b))) -
          Number(isBookmarked(sessionBookmarkKey(a)));
        return (
          bookmarkOrder ||
          b.updatedAt - a.updatedAt ||
          a.title.localeCompare(b.title)
        );
      })
      .map((session) => {
        const bookmarkKey = sessionBookmarkKey(session);
        const bookmarked = isBookmarked(bookmarkKey);
        return (
          <SessionRow
            key={`${session.directory}:${session.id}`}
            session={session}
            resuming={resumingId === session.id}
            bookmarked={bookmarked}
            onResume={() => void resume(session)}
            onToggleBookmark={() => toggleSessionBookmark(session)}
          />
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          height: 40,
          boxSizing: 'border-box',
          padding: `0 ${spacing.sm}px`,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <History
          size={16}
          color={theme.colors.text}
          style={{ marginLeft: 4 }}
        />
        <span
          style={{
            flex: 1,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Sessions
        </span>
        <span
          title="Local agent session history"
          style={{
            color: theme.colors.textMuted,
            fontFamily: theme.fonts.monospace,
            fontSize: theme.fontSizes[0],
          }}
        >
          Local history
        </span>
        <button
          type="button"
          title="Refresh sessions"
          aria-label="Refresh sessions"
          onClick={() => setRefreshToken((value) => value + 1)}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xs,
            background: 'transparent',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <FilterBar value={query} onChange={setQuery} />
      <div style={{ flex: 1, overflowY: 'auto' }}>{renderContent()}</div>
    </div>
  );
};
