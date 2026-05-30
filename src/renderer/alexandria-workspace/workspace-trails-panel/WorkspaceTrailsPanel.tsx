import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { AlertCircle, FileText, Search, X } from 'lucide-react';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { TrailLibraryService } from '../../services/TrailLibraryService';
import { TopicService } from '../../main-process-api/TopicService';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';
import type { TrailIndexEntry } from '../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { formatRelativeTime } from '../../principal-window/views/TrailsView/TrailCard';
import { PANEL_FOCUS_SEARCH_EVENT } from '../../components/Sidebar/PanelIconSidebar';
import { APP_BRANDING } from '../../../shared/config/appBranding';

const bridgePort = (): number =>
  process.env.NODE_ENV === 'development'
    ? APP_BRANDING.BRIDGE_PORTS.DEVELOPMENT.PRINCIPAL_MCP
    : APP_BRANDING.BRIDGE_PORTS.PRODUCTION.PRINCIPAL_MCP;

export interface WorkspaceTrailsPanelProps {
  workspace: Workspace;
  /**
   * Fires when a trail row is left-clicked. The layout opens (or focuses) the
   * singleton `file-city-trail` tab and loads this payload into it.
   */
  onTrailActivate?: (payload: TrailPayload, repositoryPath?: string) => void;
  /**
   * Fires when a trail row is right-clicked (two-finger click). The layout
   * force-opens the singleton file-city-trail tab in the middle, bypassing
   * the terminal-routing fallback that `onTrailActivate` applies.
   */
  onTrailOpenInTab?: (payload: TrailPayload, repositoryPath?: string) => void;
  /**
   * Id of the trail currently loaded in the layout (middle tab or right
   * panel). The matching row renders with a selected style.
   */
  activeTrailId?: string | null;
  /**
   * Opens the topic's markdown description in the MDX editor tab. The header
   * "edit description" button only renders when this is provided and the
   * workspace actually has a topic.
   */
  onEditTopicDescription?: () => void;
}

const repoBasename = (repositoryPath?: string): string | null => {
  if (!repositoryPath) return null;
  const trimmed = repositoryPath.replace(/[\\/]+$/, '');
  const idx = trimmed.search(/[\\/](?!.*[\\/])/);
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
};

const REPO_AGNOSTIC_KEY = '__repo_agnostic__';

export const WorkspaceTrailsPanel: React.FC<WorkspaceTrailsPanelProps> = ({
  workspace,
  onTrailActivate,
  onTrailOpenInTab,
  activeTrailId,
  onEditTopicDescription,
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ panelId?: string }>).detail;
      if (detail?.panelId === 'trails') {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      }
    };
    window.addEventListener(PANEL_FOCUS_SEARCH_EVENT, onFocus);
    return () => window.removeEventListener(PANEL_FOCUS_SEARCH_EVENT, onFocus);
  }, []);
  const [busyTrailId, setBusyTrailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // path → github owner login, used to render the section's repo avatar.
  // Repos that aren't registered in alexandria simply don't get an avatar.
  const [ownerByPath, setOwnerByPath] = useState<Map<string, string>>(
    new Map(),
  );

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const repo of repos) {
          const owner = repo.github?.owner;
          if (owner) map.set(repo.path, owner);
        }
        setOwnerByPath(map);
      } catch (err) {
        console.error('[WorkspaceTrailsPanel] owner lookup failed', err);
      }
    };
    load();
    const off = AlexandriaService.onRepositoryChange(() => load());
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const groupedByRepo = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    // Default (no query): show trails attached to this workspace's topic.
    // If the topic has none attached yet, fall back to showing every known
    // trail so users have something to pick from. Typing in the search box
    // always widens the pool to every known trail.
    const showAll = topicTrailIds.size === 0;
    const matches = (e: TrailIndexEntry): boolean => {
      if (q) {
        return Boolean(
          e.title?.toLowerCase().includes(q) ||
          e.purpose?.toLowerCase().includes(q) ||
          e.repositoryPath?.toLowerCase().includes(q),
        );
      }
      return showAll || topicTrailIds.has(e.id);
    };
    const groups = new Map<
      string,
      {
        label: string;
        repositoryPath?: string;
        entries: TrailIndexEntry[];
      }
    >();
    for (const entry of entries) {
      if (!matches(entry)) continue;
      const label = repoBasename(entry.repositoryPath);
      const key = entry.repositoryPath ?? REPO_AGNOSTIC_KEY;
      const existing = groups.get(key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.set(key, {
          label: label ?? 'Repo-agnostic',
          repositoryPath: entry.repositoryPath,
          entries: [entry],
        });
      }
    }
    // Sort: named repos alphabetically by label, repo-agnostic last. Within a
    // group, most recently updated first (title as tiebreaker).
    return Array.from(groups.entries())
      .sort(([a, ga], [b, gb]) => {
        if (a === REPO_AGNOSTIC_KEY) return 1;
        if (b === REPO_AGNOSTIC_KEY) return -1;
        return ga.label.localeCompare(gb.label);
      })
      .map(([key, group]) => ({
        key,
        label: group.label,
        repositoryPath: group.repositoryPath,
        entries: group.entries.sort((x, y) => {
          const xT = x.updatedAt ? Date.parse(x.updatedAt) : 0;
          const yT = y.updatedAt ? Date.parse(y.updatedAt) : 0;
          if (xT !== yT) return yT - xT;
          return (x.title ?? x.id).localeCompare(y.title ?? y.id);
        }),
      }));
  }, [entries, topicTrailIds, searchQuery]);
  const totalMatched = groupedByRepo.reduce((n, g) => n + g.entries.length, 0);

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

  const handleOpenInTab = useCallback(
    async (trailId: string) => {
      if (!onTrailOpenInTab) return;
      const result = await TrailLibraryService.activate(trailId);
      if (!result) return;
      onTrailOpenInTab(result.payload, result.repositoryPath);
    },
    [onTrailOpenInTab],
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
        console.error(
          '[WorkspaceTrailsPanel] removeTrailFromTopic failed',
          err,
        );
      } finally {
        setBusyTrailId(null);
      }
    },
    [topicId],
  );

  const handleDelete = useCallback(
    async (trailId: string) => {
      const entry = entries.find((e) => e.id === trailId);
      const label = entry?.title?.trim() || 'this trail';
      if (
        !window.confirm(
          `Delete "${label}"? This permanently removes the trail from this machine and cannot be undone.`,
        )
      ) {
        return;
      }
      setBusyTrailId(trailId);
      try {
        await TrailLibraryService.remove(trailId);
        // The library-changed broadcast refreshes the list, but refresh
        // eagerly too so the row disappears immediately.
        await refresh();
      } catch (err) {
        console.error('[WorkspaceTrailsPanel] delete failed', err);
      } finally {
        setBusyTrailId(null);
      }
    },
    [entries, refresh],
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
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
            ref={searchInputRef}
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
        {onEditTopicDescription && topicId && (
          <button
            type="button"
            onClick={onEditTopicDescription}
            aria-label="Edit description"
            title="Edit description"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: '6px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.backgroundSecondary,
              color: theme.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <FileText size={14} />
          </button>
        )}
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

        {/* Spinner only on the first load (nothing to show yet). A background
            refresh — e.g. the topic-change fired by saving the description —
            keeps the existing list on screen instead of blanking to a spinner. */}
        {loading && entries.length === 0 && <Loading theme={theme} />}
        {!loading && totalMatched === 0 && (
          <EmptyHint
            theme={theme}
            message={
              searchQuery
                ? 'No trails match your search.'
                : entries.length === 0
                  ? 'No saved trails on this machine yet.'
                  : 'No trails to show.'
            }
          />
        )}
        {totalMatched > 0 &&
          groupedByRepo.map((group) => {
            const owner = group.repositoryPath
              ? ownerByPath.get(group.repositoryPath)
              : undefined;
            return (
              <Section
                key={group.key}
                theme={theme}
                title={group.label}
                count={group.entries.length}
                owner={owner}
              >
                {group.entries.map((entry) => {
                  const inWs = topicTrailIds.has(entry.id);
                  return (
                    <TrailRow
                      key={entry.id}
                      entry={entry}
                      inWorkspace={inWs}
                      busy={busyTrailId === entry.id}
                      isActive={activeTrailId === entry.id}
                      onAction={() =>
                        inWs ? handleRemove(entry.id) : handleAdd(entry.id)
                      }
                      onDelete={() => handleDelete(entry.id)}
                      onActivate={
                        onTrailActivate
                          ? () => handleActivate(entry.id)
                          : undefined
                      }
                      onOpenInTab={
                        onTrailOpenInTab
                          ? () => handleOpenInTab(entry.id)
                          : undefined
                      }
                      disabled={!topicId}
                    />
                  );
                })}
              </Section>
            );
          })}
      </div>
    </div>
  );
};

interface TrailRowProps {
  entry: TrailIndexEntry;
  inWorkspace: boolean;
  busy: boolean;
  disabled: boolean;
  /** Renders selected styling when this row's trail is the active one. */
  isActive: boolean;
  onAction: () => void;
  /** Permanently deletes the trail from this machine. */
  onDelete: () => void;
  /**
   * When provided, clicking the row body (not the action button) opens the
   * trail in the layout's file-city-trail tab. Omitted in contexts where
   * activation isn't wired (e.g. unit tests).
   */
  onActivate?: () => void;
  /**
   * When provided, right-clicking (two-finger click) the row body opens
   * the trail in the layout's file-city-trail tab. The default browser
   * context menu is suppressed.
   */
  onOpenInTab?: () => void;
}

const TrailRow: React.FC<TrailRowProps> = ({
  entry,
  inWorkspace,
  busy,
  disabled,
  isActive,
  onAction,
  onDelete,
  onActivate,
  onOpenInTab,
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const actionLabel = inWorkspace
    ? 'Remove from workspace'
    : 'Add to workspace';
  const membershipColor = theme.colors.primary;
  const deleteColor = theme.colors.error ?? '#e5484d';

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer) return;
      const title = entry.title?.trim() || entry.id;
      const payload = `Use file-city trail "${title}" (id: ${entry.id}) as context — fetch via:\ncurl -s http://localhost:${bridgePort()}/api/file-city/trail/${entry.id}`;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', payload);
    },
    [entry.id, entry.title],
  );

  return (
    <div
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      draggable
      onDragStart={handleDragStart}
      onClick={onActivate}
      onContextMenu={
        onOpenInTab
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenInTab();
            }
          : undefined
      }
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
        border: `1px solid ${
          isActive ? theme.colors.primary : theme.colors.border
        }`,
        boxShadow: isActive
          ? `inset 0 0 0 1px ${theme.colors.primary}`
          : undefined,
        background: isActive
          ? theme.colors.background
          : isHovered
            ? theme.colors.background
            : theme.colors.backgroundSecondary,
        cursor: onActivate ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: theme.fontSizes[2],
            fontWeight: theme.fontWeights.semibold,
            color: theme.colors.text,
            wordBreak: 'break-word',
          }}
          title={entry.title}
        >
          {entry.title || entry.id}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          title={entry.repositoryPath}
        >
          {entry.updatedAt && (
            <span title={new Date(entry.updatedAt).toLocaleString()}>
              {formatRelativeTime(entry.updatedAt)}
            </span>
          )}
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
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
              disabled={busy || disabled}
              title={actionLabel}
              aria-label={actionLabel}
              onMouseEnter={(e) => {
                if (busy || disabled) return;
                e.currentTarget.style.backgroundColor = membershipColor;
                e.currentTarget.style.color = theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = membershipColor;
              }}
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                border: `1px solid ${membershipColor}`,
                background: 'transparent',
                color: membershipColor,
                cursor: busy || disabled ? 'not-allowed' : 'pointer',
                opacity:
                  busy || disabled
                    ? 0.5
                    : isHovered || isActive || inWorkspace
                      ? 1
                      : 0,
                transition: 'opacity 120ms, background 120ms, color 120ms',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                fontWeight: theme.fontWeights.medium,
              }}
            >
              {inWorkspace ? 'Remove' : 'Add'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={busy}
              title="Delete trail"
              aria-label={`Delete ${entry.title || entry.id}`}
              onMouseEnter={(e) => {
                if (busy) return;
                e.currentTarget.style.backgroundColor = deleteColor;
                e.currentTarget.style.color = theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = deleteColor;
              }}
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                border: `1px solid ${deleteColor}`,
                background: 'transparent',
                color: deleteColor,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : isHovered || isActive ? 1 : 0,
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

const SectionAvatar: React.FC<{ owner: string }> = ({ owner }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=48`}
      alt={owner}
      width={20}
      height={20}
      onError={() => setFailed(true)}
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  );
};

const Section: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  title: string;
  count?: number;
  owner?: string;
  children: React.ReactNode;
}> = ({ theme, title, count, owner, children }) => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: theme.fontSizes[2],
        fontWeight: theme.fontWeights.semibold,
        color: theme.colors.text,
        paddingBottom: '4px',
      }}
    >
      {owner && <SectionAvatar owner={owner} />}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={title}
      >
        {title}
      </span>
      {typeof count === 'number' && (
        <span
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
            opacity: 0.7,
          }}
        >
          {count}
        </span>
      )}
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
