import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';
import { RefreshCw, Search, X } from 'lucide-react';
import { TopicsIcon } from '../../components/TopicsIcon';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import { useTopicLibrary } from './useTopicLibrary';
import { TopicRow } from './TopicRow';
import { TOPIC_EVENT, type TopicOpenEvent } from './topic-events';
import { getPrincipalBridgeUrl } from '../../../shared/config/appBranding';

type TopicView = 'thisRepo' | 'all';

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

  const hasRepo = Boolean(repositoryPath);

  const thisRepoCount = useMemo(
    () => library.topics.filter((topic) => library.isInThisRepo(topic)).length,
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

  const isMultiRepo = useCallback((topic: Topic): boolean => {
    return (topic.repos?.length ?? 0) > 1;
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped =
      view === 'thisRepo'
        ? library.topics.filter((topic) => library.isInThisRepo(topic))
        : library.topics;
    return scoped
      .filter((topic) => {
        if (!q) return true;
        return (
          topic.title.toLowerCase().includes(q) ||
          (topic.description ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [library, view, query]);

  const ready = !library.loading || library.topics.length > 0;

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
          <TopicsIcon size={18} strokeWidth={1.5} />
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
            onClick={() => void library.refresh({ refresh: true })}
            title="Refresh — rescan topic files"
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
            allCount={library.topics.length}
          />
        )}

        {/* Text search */}
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
            filtered={query.trim().length > 0}
            totalTopics={library.topics.length}
            onShowAll={() => setView('all')}
          />
        )}
        {ready &&
          visible.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              multiRepo={isMultiRepo(topic)}
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
        Create a topic brief and scope it to one or more projects:
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
  -d '{ "title": "My topic", "repos": [] }'`}
      </pre>
    </div>
  );
};
