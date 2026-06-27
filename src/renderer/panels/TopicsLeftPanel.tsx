/**
 * TopicsLeftPanel
 *
 * Left panel for the Topics surface. Lists all LOCAL topics (from the on-disk
 * topic store via `TopicService.getTopics`), most-recently-updated first.
 * Clicking a row emits a `topic:open` intent on the portal bus; the
 * always-mounted PortalIntentBridge opens it as a tab (hosted by the persistent
 * WorkspaceShell) that renders the markdown description on the right.
 *
 * Unlike the inbox lists, this is not auth-gated — topics are read from the
 * local store, so there's no sign-in state. The list live-refreshes on any
 * `TopicService.onTopicChange` event.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Layers,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  Check,
  ListFilter,
  Plus,
} from 'lucide-react';
import type { Topic } from '@principal-ai/alexandria-core-library/types';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { NewTopicModal } from '../components/NewTopicModal';
import { TopicService } from '../main-process-api/TopicService';
import { emitTopicOpen } from '../events/portalIntents';
import { useTopicsTabs } from '../principal-window/contexts/TopicsTabsContext';
import {
  STATES,
  normalizeState,
  stateColor,
  type TopicStatusState,
} from '../alexandria-workspace/topic-description-tab/topicStatusModel';
import { getPrincipalBridgeUrl } from '../../shared/config/appBranding';

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

const stateLabel = (state: string): string =>
  STATES.find((s) => s.value === state)?.label ?? 'New Thought';

export const TopicsLeftPanel: React.FC<{ events: PanelEventEmitter }> = ({
  events,
}) => {
  const { theme } = useTheme();
  // `activeTabId` (read-only highlight) still comes from the tab context; the
  // open path is decoupled — clicking a row emits `topic:open` on the bus and
  // the framework turns it into a tab (portal-unification Increment 1).
  const { activeTabId } = useTopicsTabs();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Status filter — empty set means "all statuses". Multi-select (OR).
  const [statusFilter, setStatusFilter] = useState<Set<TopicStatusState>>(
    () => new Set(),
  );
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await TopicService.getTopics();
      // Most-recently-updated first. `updatedAt` is an ISO 8601 string.
      const sorted = [...all].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      setTopics(sorted);
    } catch (err) {
      console.error('[TopicsLeftPanel] Failed to load topics:', err);
      setError('Could not load topics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Refetch on any topic add/update/remove — simplest correct refresh.
    const off = TopicService.onTopicChange(() => {
      void load();
    });
    return off;
  }, [load]);

  // Filter by status (multi-select) and by title/description text.
  const visibleTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((t) => {
      if (
        statusFilter.size > 0 &&
        !statusFilter.has(normalizeState(t.status?.state))
      ) {
        return false;
      }
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [topics, query, statusFilter]);

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

  const statusTriggerLabel =
    statusFilter.size === 0
      ? 'All statuses'
      : statusFilter.size === 1
        ? stateLabel([...statusFilter][0])
        : `${statusFilter.size} statuses`;

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
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

  const renderList = () => {
    if (loading && topics.length === 0) return emptyState('Loading…');
    if (error) return emptyState(error);
    if (topics.length === 0) {
      return emptyState('No topics yet. Topics you create appear here.');
    }
    if (visibleTopics.length === 0) {
      return emptyState('No topics match the current filters.');
    }
    return visibleTopics.map((topic) => {
      const state = normalizeState(topic.status?.state);
      const color = stateColor(state, theme);
      const trailCount = topic.trailIds.length;
      const hovered = hoveredId === topic.id;
      const active = activeTabId === `local-topic-${topic.id}`;
      const trailText = `${trailCount} ${trailCount === 1 ? 'trail' : 'trails'}`;
      const statusName = topic.status?.label || stateLabel(state);
      // Drag the topic into a terminal as an agent prompt that hydrates it
      // from the local bridge — mirrors the dev-workspace Topics panel.
      const handleDragStart = (e: React.DragEvent) => {
        if (!e.dataTransfer) return;
        const title = topic.title || 'Untitled topic';
        const payload = `Use topic "${title}" (id: ${topic.id}) as context — fetch via:\ncurl -s ${getPrincipalBridgeUrl()}/api/topics/${topic.id}`;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', payload);
      };
      return (
        <button
          key={topic.id}
          draggable
          onDragStart={handleDragStart}
          onClick={() =>
            emitTopicOpen(events, 'topics-left-panel', {
              topicId: topic.id,
              surface: 'topics',
              title: topic.title,
            })
          }
          onMouseEnter={() => setHoveredId(topic.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing.sm,
            width: '100%',
            padding: `${spacing.sm * 1.5}px ${spacing.sm * 2}px`,
            backgroundColor:
              active || hovered
                ? theme.colors.backgroundSecondary
                : 'transparent',
            border: 'none',
            borderBottom: `1px solid ${theme.colors.border}`,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'background-color 0.15s ease',
          }}
        >
          {/* Status dot — the topic's "aliveness" axis color. */}
          <div
            style={{
              width: 8,
              height: 8,
              marginTop: 6,
              borderRadius: '50%',
              flexShrink: 0,
              backgroundColor: color,
            }}
            title={statusName}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[2],
                fontWeight: active ? 700 : 500,
                color: theme.colors.text,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {topic.title || 'Untitled topic'}
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
                {trailText}
              </span>
              <span style={{ flexShrink: 0 }}>{timeAgo(topic.updatedAt)}</span>
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
        <Layers size={16} color={theme.colors.text} />
        <span
          style={{
            flex: 1,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Topics
        </span>
        <button
          onClick={() => setIsNewTopicOpen(true)}
          title="New topic"
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
          <Plus size={16} />
        </button>
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

      {/* Filters: text search (left) + status (right) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: `0 ${spacing.sm}px ${spacing.sm}px`,
        }}
      >
        {/* Text filter */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: 30,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `0 ${spacing.sm}px`,
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

        {/* Status filter */}
        <div
          ref={statusMenuRef}
          style={{ position: 'relative', flexShrink: 0 }}
        >
          <button
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
              gap: spacing.xs,
              padding: `0 ${spacing.sm}px`,
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
                      gap: spacing.sm,
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

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto' }}>{renderList()}</div>

      <NewTopicModal
        isOpen={isNewTopicOpen}
        onClose={() => setIsNewTopicOpen(false)}
      />
    </div>
  );
};

export default TopicsLeftPanel;
