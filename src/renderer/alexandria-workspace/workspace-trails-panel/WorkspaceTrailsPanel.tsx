import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  AlertCircle,
  Check,
  Plus,
  RefreshCw,
  Route,
  Search,
  X,
} from 'lucide-react';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { TopicService } from '../../main-process-api/TopicService';
import type { TrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { formatRelativeTime } from '../../principal-window/views/TrailsView/TrailCard';

export interface WorkspaceTrailsPanelProps {
  workspace: Workspace;
  /**
   * Fires when a trail row is clicked. The layout opens (or focuses) the
   * singleton `file-city-trail` tab and loads this payload into it.
   */
  onTrailActivate?: (
    payload: TrailPayload,
    repositoryPath?: string,
  ) => void;
}

const repoBasename = (repositoryPath?: string): string | null => {
  if (!repositoryPath) return null;
  const trimmed = repositoryPath.replace(/[\\/]+$/, '');
  const idx = trimmed.search(/[\\/](?!.*[\\/])/);
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
};

export const WorkspaceTrailsPanel: React.FC<WorkspaceTrailsPanelProps> = ({
  workspace,
  onTrailActivate,
}) => {
  const { theme } = useTheme();
  // v1 single-topic invariant: every workspace has exactly one topic. The
  // panel attaches/detaches against that one. If a legacy workspace has no
  // topic the add/remove buttons no-op and we render a hint instead.
  const topicId = workspace.topicIds?.[0];

  const [entries, setEntries] = useState<TrailIndexEntry[]>([]);
  const [topicTrailIds, setTopicTrailIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyTrailId, setBusyTrailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listing, topic] = await Promise.all([
        TrailLibraryService.list(),
        topicId ? TopicService.getTopic(topicId) : Promise.resolve(null),
      ]);
      setEntries(listing.entries);
      setTopicTrailIds(new Set(topic?.trailIds ?? []));
    } catch (err) {
      console.error('[WorkspaceTrailsPanel] refresh failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load trails');
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    refresh();
    const offLib = TrailLibraryService.onLibraryChanged(() => {
      refresh();
    });
    const offTopic = TopicService.onTopicChange((event) => {
      const changedId = event.topic?.id ?? event.id;
      if (changedId === topicId) refresh();
    });
    return () => {
      offLib();
      offTopic();
    };
  }, [refresh, topicId]);

  const { inWorkspace, available } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matches = (e: TrailIndexEntry): boolean => {
      if (!q) return true;
      return Boolean(
        e.title?.toLowerCase().includes(q) ||
          e.purpose?.toLowerCase().includes(q) ||
          e.repositoryPath?.toLowerCase().includes(q),
      );
    };
    const inWs: TrailIndexEntry[] = [];
    const avail: TrailIndexEntry[] = [];
    for (const entry of entries) {
      if (!matches(entry)) continue;
      if (topicTrailIds.has(entry.id)) inWs.push(entry);
      else avail.push(entry);
    }
    return { inWorkspace: inWs, available: avail };
  }, [entries, topicTrailIds, searchQuery]);

  const handleAdd = useCallback(
    async (trailId: string) => {
      if (!topicId) return;
      setBusyTrailId(trailId);
      try {
        await TopicService.addTrailToTopic(topicId, trailId);
        setTopicTrailIds((prev) => {
          const next = new Set(prev);
          next.add(trailId);
          return next;
        });
      } catch (err) {
        console.error('[WorkspaceTrailsPanel] addTrailToTopic failed', err);
      } finally {
        setBusyTrailId(null);
      }
    },
    [topicId],
  );

  const handleActivate = useCallback(
    async (trailId: string) => {
      if (!onTrailActivate) return;
      const result = await TrailLibraryService.activate(trailId);
      if (!result) return;
      onTrailActivate(result.payload, result.repositoryPath);
    },
    [onTrailActivate],
  );

  const handleRemove = useCallback(
    async (trailId: string) => {
      if (!topicId) return;
      setBusyTrailId(trailId);
      try {
        await TopicService.removeTrailFromTopic(topicId, trailId);
        setTopicTrailIds((prev) => {
          const next = new Set(prev);
          next.delete(trailId);
          return next;
        });
      } catch (err) {
        console.error('[WorkspaceTrailsPanel] removeTrailFromTopic failed', err);
      } finally {
        setBusyTrailId(null);
      }
    },
    [topicId],
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
        background: theme.colors.background,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <Route size={18} strokeWidth={1.5} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
              lineHeight: 1.2,
            }}
          >
            Trails
          </h2>
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={workspace.name}
          >
            {workspace.name}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          title="Refresh"
          aria-label="Refresh"
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={12} />
        </button>
      </header>

      <div
        style={{
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.backgroundSecondary,
          }}
        >
          <Search size={14} color={theme.colors.textSecondary} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all trails…"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontFamily: theme.fonts.body,
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              style={{
                display: 'inline-flex',
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {!topicId && (
          <ErrorRow
            theme={theme}
            message="This workspace has no topic, so trails can't be attached. Open the workspace settings to add one."
          />
        )}
        {error && <ErrorRow theme={theme} message={error} />}

        <Section theme={theme} title="In this workspace">
          {loading && <Loading theme={theme} />}
          {!loading && inWorkspace.length === 0 && (
            <EmptyHint
              theme={theme}
              message={
                topicId
                  ? 'No trails in this workspace yet. Add one from below.'
                  : 'No topic attached to this workspace.'
              }
            />
          )}
          {!loading &&
            inWorkspace.map((entry) => (
              <TrailRow
                key={entry.id}
                entry={entry}
                inWorkspace
                busy={busyTrailId === entry.id}
                onAction={() => handleRemove(entry.id)}
                onActivate={
                  onTrailActivate ? () => handleActivate(entry.id) : undefined
                }
                disabled={!topicId}
              />
            ))}
        </Section>

        <Section theme={theme} title="All trails">
          {loading && <Loading theme={theme} />}
          {!loading && available.length === 0 && (
            <EmptyHint
              theme={theme}
              message={
                searchQuery
                  ? 'No trails match your search.'
                  : entries.length === 0
                    ? 'No saved trails on this machine yet.'
                    : 'All saved trails are already in this workspace.'
              }
            />
          )}
          {!loading &&
            available.map((entry) => (
              <TrailRow
                key={entry.id}
                entry={entry}
                inWorkspace={false}
                busy={busyTrailId === entry.id}
                onAction={() => handleAdd(entry.id)}
                onActivate={
                  onTrailActivate ? () => handleActivate(entry.id) : undefined
                }
                disabled={!topicId}
              />
            ))}
        </Section>
      </div>
    </div>
  );
};

interface TrailRowProps {
  entry: TrailIndexEntry;
  inWorkspace: boolean;
  busy: boolean;
  disabled: boolean;
  onAction: () => void;
  /**
   * When provided, clicking the row body (not the action button) opens the
   * trail in the layout's file-city-trail tab. Omitted in contexts where
   * activation isn't wired (e.g. unit tests).
   */
  onActivate?: () => void;
}

const TrailRow: React.FC<TrailRowProps> = ({
  entry,
  inWorkspace,
  busy,
  disabled,
  onAction,
  onActivate,
}) => {
  const { theme } = useTheme();
  const repoLabel = repoBasename(entry.repositoryPath);
  const ActionIcon = inWorkspace ? Check : Plus;
  const actionLabel = inWorkspace ? 'Remove from workspace' : 'Add to workspace';

  return (
    <div
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.backgroundSecondary,
        cursor: onActivate ? 'pointer' : 'default',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={entry.title}
        >
          {entry.title || entry.id}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            display: 'flex',
            gap: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={entry.repositoryPath}
        >
          {entry.purpose && <span>{entry.purpose}</span>}
          {entry.purpose && repoLabel && <span>·</span>}
          {repoLabel && <span>{repoLabel}</span>}
          {!entry.purpose && !repoLabel && <span>repo-agnostic</span>}
          {entry.updatedAt && (
            <>
              <span>·</span>
              <span title={new Date(entry.updatedAt).toLocaleString()}>
                {formatRelativeTime(entry.updatedAt)}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        disabled={busy || disabled}
        title={actionLabel}
        aria-label={actionLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
          background: inWorkspace ? theme.colors.primary : 'transparent',
          color: inWorkspace
            ? theme.colors.background
            : theme.colors.textSecondary,
          cursor: busy || disabled ? 'not-allowed' : 'pointer',
          opacity: busy || disabled ? 0.5 : 1,
        }}
      >
        <ActionIcon size={14} />
      </button>
    </div>
  );
};

const Section: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  title: string;
  children: React.ReactNode;
}> = ({ theme, title, children }) => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}
  >
    <div
      style={{
        fontSize: theme.fontSizes[0],
        fontWeight: theme.fontWeights.semibold,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.colors.textSecondary,
        paddingBottom: '4px',
      }}
    >
      {title}
    </div>
    {children}
  </section>
);

const Loading: React.FC<{ theme: ReturnType<typeof useTheme>['theme'] }> = ({
  theme,
}) => (
  <div
    style={{
      padding: '12px 0',
      textAlign: 'center',
      color: theme.colors.textSecondary,
      fontSize: theme.fontSizes[1],
    }}
  >
    Loading…
  </div>
);

const EmptyHint: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  message: string;
}> = ({ theme, message }) => (
  <div
    style={{
      padding: '12px 4px',
      fontSize: theme.fontSizes[0],
      color: theme.colors.textSecondary,
    }}
  >
    {message}
  </div>
);

const ErrorRow: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  message: string;
}> = ({ theme, message }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px',
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`,
      background: theme.colors.background,
      color: theme.colors.error ?? theme.colors.textSecondary,
      fontSize: theme.fontSizes[0],
    }}
  >
    <AlertCircle size={14} />
    <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
  </div>
);
