/**
 * TopicTabContent
 *
 * Renders a topic published to web-ade, opened from an inbox row. A topic is a
 * curated bundle of trails on one subject; this is the desktop counterpart to
 * web-ade's `/topic/{id}` page.
 *
 * Mirrors `SharedTrailTabContent`'s shape: self-fetches the topic by id via
 * `TopicService.fetchSharedById`, then resolves each of the topic's `trailIds`
 * through `TrailShareService.fetchSharedById`. The left pane shows the title,
 * a markdown description, and the trail list grouped by repo; selecting a trail
 * mounts it in the right pane via the shared `SharedTrailViewer` (reusing the
 * payload we already fetched, so there's no second round-trip).
 *
 * Read access is public-by-link, so a signed-out user can open a topic; the
 * individual trails still require GitHub sign-in to hydrate, so each row
 * surfaces its own error state independently.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { Layers, Route, ExternalLink, AlertCircle } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type {
  AlexandriaEntry,
  Topic,
} from '@principal-ai/alexandria-core-library/types';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { TopicService } from '../main-process-api/TopicService';
import { TrailShareService } from '../services/TrailShareService';
import { TrailShareError } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { SharedTrailViewer } from '../feed-view/SharedTrailTabContent';

/** Per-trail fetch state, keyed by trail id. */
type TrailState =
  | { status: 'loading' }
  | { status: 'ok'; payload: TrailPayload; owner: string; repo: string }
  | { status: 'error'; message: string };

/** A repo group in the trail list — `key` is `owner/repo`. */
interface RepoGroup {
  key: string;
  owner: string;
  repo: string;
  trailIds: string[];
}

export const TopicTabContent: React.FC<{
  topicId: string;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
}> = ({ topicId, events, repositories }) => {
  const { theme } = useTheme();
  const [topic, setTopic] = React.useState<Topic | null>(null);
  const [topicLoading, setTopicLoading] = React.useState(true);
  const [topicError, setTopicError] = React.useState<string | null>(null);
  const [trailStates, setTrailStates] = React.useState<
    Record<string, TrailState>
  >({});
  const [selectedTrailId, setSelectedTrailId] = React.useState<string | null>(
    null,
  );

  // Fetch the topic record.
  React.useEffect(() => {
    let cancelled = false;
    setTopicLoading(true);
    setTopicError(null);
    setTopic(null);
    setTrailStates({});
    setSelectedTrailId(null);
    void (async () => {
      try {
        const { topic: fetched } = await TopicService.fetchSharedById(topicId);
        if (cancelled) return;
        setTopic(fetched);
      } catch (err) {
        if (cancelled) return;
        setTopicError(
          err instanceof TrailShareError
            ? err.message
            : 'Could not load this topic.',
        );
      } finally {
        if (!cancelled) setTopicLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  // Once the topic resolves, hydrate each of its trails. Done up front (not
  // lazily on click) because the list needs titles and the repo grouping
  // needs each trail's origin; the payloads are then reused by the viewer.
  React.useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    setTrailStates(
      Object.fromEntries(
        topic.trailIds.map((id) => [id, { status: 'loading' } as TrailState]),
      ),
    );
    topic.trailIds.forEach((trailId) => {
      void (async () => {
        try {
          const fetched = await TrailShareService.fetchSharedById(trailId);
          if (cancelled) return;
          setTrailStates((prev) => ({
            ...prev,
            [trailId]: {
              status: 'ok',
              payload: fetched.payload,
              owner: fetched.owner,
              repo: fetched.repo,
            },
          }));
          // Auto-select the first trail that resolves so the viewer isn't
          // empty on open.
          setSelectedTrailId((cur) => cur ?? trailId);
        } catch (err) {
          if (cancelled) return;
          setTrailStates((prev) => ({
            ...prev,
            [trailId]: {
              status: 'error',
              message:
                err instanceof TrailShareError
                  ? err.message
                  : 'Could not load this trail.',
            },
          }));
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [topic]);

  // Group resolved trails by `owner/repo`, preserving the topic's trail order
  // by first appearance. Trails still loading or errored are grouped under a
  // synthetic "pending" bucket so the list reflects the full topic even before
  // every trail resolves.
  const { groups, pendingTrailIds } = React.useMemo(() => {
    if (!topic) return { groups: [] as RepoGroup[], pendingTrailIds: [] };
    // Map preserves insertion order, so the first-seen repo stays first.
    const byKey = new Map<string, RepoGroup>();
    const pending: string[] = [];
    for (const trailId of topic.trailIds) {
      const state = trailStates[trailId];
      if (state?.status === 'ok') {
        const key = `${state.owner}/${state.repo}`;
        let group = byKey.get(key);
        if (!group) {
          group = { key, owner: state.owner, repo: state.repo, trailIds: [] };
          byKey.set(key, group);
        }
        group.trailIds.push(trailId);
      } else {
        pending.push(trailId);
      }
    }
    return {
      groups: Array.from(byKey.values()),
      pendingTrailIds: pending,
    };
  }, [topic, trailStates]);

  const selectedState =
    selectedTrailId && trailStates[selectedTrailId]?.status === 'ok'
      ? (trailStates[selectedTrailId] as Extract<TrailState, { status: 'ok' }>)
      : null;
  const selected =
    selectedTrailId && selectedState
      ? { id: selectedTrailId, ...selectedState }
      : null;

  const trailLabel = (trailId: string): string => {
    const state = trailStates[trailId];
    if (state?.status === 'ok') return state.payload.title || 'Untitled trail';
    return trailId;
  };

  const browserUrl = `https://app.principal-ade.com/topic/${topicId}`;

  // ── Error / loading shells ────────────────────────────────────────────────
  if (topicError) {
    return (
      <div style={centeredMessage(theme)}>{topicError}</div>
    );
  }
  if (topicLoading && !topic) {
    return <div style={centeredMessage(theme)}>Loading topic…</div>;
  }
  if (!topic) return null;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Remote/topic banner — the load-bearing cue that this is a published
          topic, not a local bundle. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          flexShrink: 0,
        }}
      >
        <Layers size={13} />
        <span style={{ fontWeight: 600, color: theme.colors.text }}>Topic</span>
        {topic.createdBy?.githubLogin && (
          <span>· by @{topic.createdBy.githubLogin}</span>
        )}
        <a
          href={browserUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            marginLeft: 'auto',
            color: theme.colors.primary,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Open in browser <ExternalLink size={12} />
        </a>
      </div>

      {/* Body: master list on the left, trail viewer on the right. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          style={{
            width: 340,
            flexShrink: 0,
            borderRight: `1px solid ${theme.colors.border}`,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: theme.fonts.body,
          }}
        >
          {/* Title + description */}
          <div
            style={{
              padding: '16px 16px 12px',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: theme.fontSizes[3],
                fontWeight: 700,
                color: theme.colors.primary,
                lineHeight: 1.25,
              }}
            >
              {topic.title}
            </h1>
            {topic.description && topic.description.trim().length > 0 && (
              <div style={{ marginTop: 10 }}>
                <IndustryMarkdownSlide
                  content={topic.description}
                  slideIdPrefix={`topic-${topic.id}`}
                  slideIndex={0}
                  isVisible
                  theme={theme}
                  transparentBackground
                  disableScroll
                  enableKeyboardScrolling={false}
                />
              </div>
            )}
          </div>

          {/* Trail list, grouped by repo */}
          <div style={{ padding: '8px 0' }}>
            {groups.map((group) => (
              <div key={group.key} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    padding: '6px 16px',
                    fontSize: theme.fontSizes[0],
                    fontWeight: 600,
                    color: theme.colors.textSecondary,
                    textTransform: 'none',
                  }}
                >
                  {group.key}
                </div>
                {group.trailIds.map((trailId) => {
                  const isSelected = trailId === selectedTrailId;
                  const state = trailStates[trailId] as Extract<
                    TrailState,
                    { status: 'ok' }
                  >;
                  return (
                    <button
                      key={trailId}
                      onClick={() => setSelectedTrailId(trailId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 16px',
                        border: 'none',
                        cursor: 'pointer',
                        background: isSelected
                          ? theme.colors.backgroundSecondary
                          : 'transparent',
                        color: theme.colors.text,
                        borderLeft: `2px solid ${
                          isSelected ? theme.colors.primary : 'transparent'
                        }`,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                      }}
                    >
                      <Route
                        size={13}
                        style={{ flexShrink: 0, opacity: 0.8 }}
                      />
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {trailLabel(trailId)}
                      </span>
                      {state.payload.purpose &&
                        state.payload.purpose !== 'investigation' && (
                          <span
                            style={{
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.textSecondary,
                              opacity: 0.8,
                            }}
                          >
                            {state.payload.purpose}
                          </span>
                        )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Pending / errored trails — shown so the list mirrors the full
                topic while trails resolve (or when one can't be loaded). */}
            {pendingTrailIds.map((trailId) => {
              const state = trailStates[trailId];
              const isError = state?.status === 'error';
              return (
                <div
                  key={trailId}
                  title={isError ? (state as { message: string }).message : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[1],
                    opacity: 0.75,
                  }}
                >
                  {isError ? (
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  ) : (
                    <Route size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                  )}
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isError ? 'Unavailable trail' : 'Loading trail…'}
                  </span>
                </div>
              );
            })}

            {topic.trailIds.length === 0 && (
              <div
                style={{
                  padding: '12px 16px',
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                }}
              >
                This topic has no trails yet.
              </div>
            )}
          </div>
        </div>

        {/* Viewer pane */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {selected ? (
            <SharedTrailViewer
              key={selected.id}
              trailId={selected.id}
              payload={selected.payload}
              owner={selected.owner}
              repo={selected.repo}
              events={events}
              repositories={repositories}
              briefSide="leading"
            />
          ) : (
            <div style={centeredMessage(theme)}>
              {topic.trailIds.length === 0
                ? 'No trails to show.'
                : 'Select a trail to view it.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function centeredMessage(theme: {
  colors: { background: string; textSecondary: string };
  fonts: { body: string };
  fontSizes: number[];
}): React.CSSProperties {
  return {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    textAlign: 'center',
    backgroundColor: theme.colors.background,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[1],
  };
}

export default TopicTabContent;
