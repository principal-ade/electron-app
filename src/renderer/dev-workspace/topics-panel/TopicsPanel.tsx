import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Check,
  ChevronDown,
  Layers,
  ListFilter,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { LocalTopicRecord } from '../../../shared/main-process-api-interfaces/TopicAPI';
import {
  STATES,
  normalizeState,
  stateColor,
  type TopicStatusState,
} from '../../alexandria-workspace/topic-description-tab/topicStatusModel';
import { useTopicLibrary } from './useTopicLibrary';
import { TopicRow } from './TopicRow';
import { TOPIC_EVENT, type TopicOpenEvent } from './topic-events';
import { getPrincipalBridgeUrl } from '../../../shared/config/appBranding';

type TopicView = 'thisRepo' | 'all';

const stateLabel = (state: string): string =>
  STATES.find((s) => s.value === state)?.label ?? 'New Thought';

export interface TopicsPanelProps {
  repositoryPath?: string;
  /**
   * Renderer-local event bus. Opening a topic emits {@link TOPIC_EVENT.open}
   * so the panel framework can open (or focus) a topic tab in the center
   * editor area without round-tripping through main.
   */
  events?: PanelEventEmitter;
}

export const TopicsPanel: React.FC<TopicsPanelProps> = ({
  repositoryPath,
  events,
}) => {
  const { theme } = useTheme();
  const library = useTopicLibrary(repositoryPath ?? null);
  const [view, setView] = useState<TopicView>('thisRepo');
  const [query, setQuery] = useState('');
  // Status filter — empty set means "all statuses". Multi-select (OR).
  const [statusFilter, setStatusFilter] = useState<Set<TopicStatusState>>(
    () => new Set(),
  );
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const hasRepo = Boolean(repositoryPath);

  const thisRepoCount = useMemo(
    () => library.records.filter((r) => library.isInThisRepo(r)).length,
    [library],
  );

  // Default to "This repo" when a repo is open and at least one topic matches;
  // otherwise fall back to "All". Re-evaluated only while the user hasn't yet
  // interacted (initial load can arrive after first render).
  const pickedView = useRef(false);
  useEffect(() => {
    if (pickedView.current) return;
    if (library.loading) return;
    pickedView.current = true;
    setView(hasRepo && thisRepoCount > 0 ? 'thisRepo' : 'all');
  }, [library.loading, hasRepo, thisRepoCount]);

  const handleOpen = useCallback(
    (topicId: string, title?: string) => {
      events?.emit<TopicOpenEvent>({
        type: TOPIC_EVENT.open,
        source: 'topics-panel',
        timestamp: Date.now(),
        payload: { topicId, title },
      });
    },
    [events],
  );

  const toggleStatus = useCallback((state: TopicStatusState) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  }, []);

  // Close the status menu on an outside click.
  useEffect(() => {
    if (!statusMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [statusMenuOpen]);

  const isMultiRepo = useCallback(
    (record: LocalTopicRecord): boolean => {
      if (library.repoTrailIds.size === 0) return false;
      const ids = record.topic.trailIds;
      const inRepo = ids.filter((id) => library.repoTrailIds.has(id)).length;
      return inRepo > 0 && inRepo < ids.length;
    },
    [library.repoTrailIds],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped =
      view === 'thisRepo'
        ? library.records.filter((r) => library.isInThisRepo(r))
        : library.records;
    return scoped
      .filter((r) => {
        if (
          statusFilter.size > 0 &&
          !statusFilter.has(normalizeState(r.topic.status?.state))
        ) {
          return false;
        }
        if (!q) return true;
        return (
          r.topic.title.toLowerCase().includes(q) ||
          (r.topic.description ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.topic.updatedAt.localeCompare(a.topic.updatedAt));
  }, [library, view, query, statusFilter]);

  const statusTriggerLabel =
    statusFilter.size === 0
      ? 'All statuses'
      : statusFilter.size === 1
        ? stateLabel([...statusFilter][0])
        : `${statusFilter.size} statuses`;

  const ready = !library.loading || library.records.length > 0;

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
      }}
    >
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '14px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Layers size={18} strokeWidth={1.5} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                lineHeight: 1.2,
              }}
            >
              Topics
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void library.refresh()}
            title="Refresh"
            aria-label="Refresh"
            disabled={library.loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              background: 'transparent',
              color: theme.colors.textSecondary,
              cursor: library.loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {hasRepo && (
          <ViewToggle
            theme={theme}
            value={view}
            onChange={setView}
            thisRepoCount={thisRepoCount}
            allCount={library.records.length}
          />
        )}

        {/* Filters: text search (left) + status (right) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              height: 30,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 8px',
              borderRadius: 6,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
            <Search size={14} color={theme.colors.textSecondary} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter topics"
              aria-label="Filter topics"
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
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Clear filter"
                aria-label="Clear filter"
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

          <div
            ref={statusMenuRef}
            style={{ position: 'relative', flexShrink: 0 }}
          >
            <button
              type="button"
              onClick={() => setStatusMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={statusMenuOpen}
              title={
                statusFilter.size === 0
                  ? 'Filter by status'
                  : `Status: ${statusTriggerLabel}`
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 30,
                boxSizing: 'border-box',
                gap: '4px',
                padding: '0 8px',
                borderRadius: 6,
                border: `1px solid ${
                  statusFilter.size > 0
                    ? theme.colors.primary
                    : theme.colors.border
                }`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                cursor: 'pointer',
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
            >
              <ListFilter
                size={14}
                color={
                  statusFilter.size > 0
                    ? theme.colors.primary
                    : theme.colors.textSecondary
                }
              />
              {statusFilter.size > 0 && (
                <>
                  <span
                    style={{
                      maxWidth: 96,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusTriggerLabel}
                  </span>
                  <span
                    role="button"
                    aria-label="Clear status filter"
                    title="Clear status filter"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusFilter(new Set());
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <X size={14} />
                  </span>
                </>
              )}
              <ChevronDown
                size={14}
                style={{
                  flexShrink: 0,
                  color: theme.colors.textSecondary,
                  transition: 'transform 200ms ease',
                  transform: statusMenuOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {statusMenuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 2,
                  zIndex: 30,
                  minWidth: 200,
                  padding: 4,
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.background,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
                }}
              >
                {STATES.map((s) => {
                  const selected = statusFilter.has(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={selected}
                      onClick={() => toggleStatus(s.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: theme.colors.text,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          theme.colors.backgroundSecondary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          backgroundColor: stateColor(s.value, theme),
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>{s.label}</span>
                      {selected && (
                        <Check size={14} color={theme.colors.primary} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!ready && <Loading theme={theme} />}
        {ready && visible.length === 0 && (
          <EmptyState
            theme={theme}
            view={view}
            hasRepo={hasRepo}
            filtered={query.trim().length > 0 || statusFilter.size > 0}
            totalTopics={library.records.length}
            onShowAll={() => setView('all')}
          />
        )}
        {ready &&
          visible.map((record) => (
            <TopicRow
              key={record.topic.id}
              record={record}
              multiRepo={isMultiRepo(record)}
              onOpen={handleOpen}
            />
          ))}
      </div>
    </div>
  );
};

const ViewToggle: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  value: TopicView;
  onChange: (value: TopicView) => void;
  thisRepoCount: number;
  allCount: number;
}> = ({ theme, value, onChange, thisRepoCount, allCount }) => {
  const options: Array<{ key: TopicView; label: string; count: number }> = [
    { key: 'thisRepo', label: 'This repo', count: thisRepoCount },
    { key: 'all', label: 'All', count: allCount },
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter topics"
      style={{
        display: 'flex',
        gap: '4px',
        padding: '3px',
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.backgroundSecondary,
      }}
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1,
              padding: '5px 10px',
              borderRadius: '6px',
              border: 'none',
              background: active ? theme.colors.background : 'transparent',
              color: active ? theme.colors.text : theme.colors.textSecondary,
              fontSize: theme.fontSizes[0],
              fontWeight: active
                ? theme.fontWeights.semibold
                : theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              cursor: 'pointer',
              transition: 'background 120ms, color 120ms',
            }}
          >
            {opt.label}
            <span style={{ opacity: 0.6 }}> {opt.count}</span>
          </button>
        );
      })}
    </div>
  );
};

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

const EmptyState: React.FC<{
  theme: ReturnType<typeof useTheme>['theme'];
  view: TopicView;
  hasRepo: boolean;
  filtered: boolean;
  totalTopics: number;
  onShowAll: () => void;
}> = ({ theme, view, hasRepo, filtered, totalTopics, onShowAll }) => {
  if (filtered) {
    return (
      <div
        style={{
          padding: '20px 4px',
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes[1],
        }}
      >
        No topics match the current filters.
      </div>
    );
  }

  if (view === 'thisRepo' && hasRepo && totalTopics > 0) {
    return (
      <div
        style={{
          padding: '20px 4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes[1],
        }}
      >
        <div>No topics reference this repository yet.</div>
        <button
          type="button"
          onClick={onShowAll}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.text,
            cursor: 'pointer',
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
          }}
        >
          Show all topics ({totalTopics})
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '20px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: theme.colors.textSecondary,
        fontSize: theme.fontSizes[1],
      }}
    >
      <div>No topics yet.</div>
      <div style={{ fontSize: theme.fontSizes[0] }}>
        Bundle trails into a topic to get started:
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[0],
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          overflowX: 'auto',
          whiteSpace: 'pre',
          color: theme.colors.text,
        }}
      >
        {`curl -XPOST ${getPrincipalBridgeUrl()}/api/topics \\
  -H 'content-type: application/json' \\
  -d '{ "title": "My topic", "trailIds": [] }'`}
      </pre>
    </div>
  );
};
