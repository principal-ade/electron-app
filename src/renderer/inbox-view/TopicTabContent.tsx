/**
 * TopicTabContent
 *
 * Renders a topic published to web-ade, opened from an inbox row. A topic is a
 * curated bundle of trails on one subject; this is the desktop counterpart to
 * web-ade's `/topic/{id}` page, and is modeled on that page's interaction flow.
 *
 * Mirrors `SharedTrailTabContent`'s shape: self-fetches the topic by id via
 * `TopicService.fetchSharedById`, then resolves each of the topic's `trailIds`
 * through `TrailShareService.fetchSharedById`. No trail is selected by default —
 * the tab opens on the topic *overview*: title, curator, a row of repo cards
 * (one per `owner/repo`), and a markdown description. A repo card with a single
 * trail opens that trail directly; a multi-trail card expands an inline trail
 * list below the cards. Only once a trail is chosen does the `SharedTrailViewer`
 * dock into the right column (the overview shrinks to a left rail), reusing the
 * payload we already fetched so there's no second round-trip.
 *
 * Read access is public-by-link, so a signed-out user can open a topic; the
 * individual trails still require GitHub sign-in to hydrate, so a trail that
 * can't be loaded simply doesn't surface as a card (matching the web page).
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { IndustryMarkdownSlide } from 'themed-markdown';
import { Route, ChevronDown } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type {
  AlexandriaEntry,
  Topic,
} from '@principal-ai/alexandria-core-library/types';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { TopicService } from '../main-process-api/TopicService';
import { TrailShareService } from '../services/TrailShareService';
import { TrailShareError } from '../../shared/main-process-api-interfaces/FileCityTrailAPI';
import { SharedTrailViewer } from '../projects-view/SharedTrailTabContent';

/** Per-trail fetch state, keyed by trail id. */
type TrailState =
  | { status: 'loading' }
  | { status: 'ok'; payload: TrailPayload; owner: string; repo: string }
  | { status: 'error'; message: string };

/** A repo group in the overview — `key` is `owner/repo`. */
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
  // No trail is selected by default — the tab opens on the overview.
  const [selectedTrailId, setSelectedTrailId] = React.useState<string | null>(
    null,
  );
  // Which multi-trail repo card is expanded (its trail list is shown inline).
  // Single-trail cards skip the expansion and open their trail directly.
  const [expandedRepoKey, setExpandedRepoKey] = React.useState<string | null>(
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
    setExpandedRepoKey(null);
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
  // lazily on click) because the repo cards need each trail's origin to group,
  // and the titles to label; the payloads are then reused by the viewer.
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
  // by first appearance. A trail still loading or errored doesn't surface as a
  // card (it has no resolved origin to group under) — matching the web page.
  const groups = React.useMemo(() => {
    if (!topic) return [] as RepoGroup[];
    // Map preserves insertion order, so the first-seen repo stays first.
    const byKey = new Map<string, RepoGroup>();
    for (const trailId of topic.trailIds) {
      const state = trailStates[trailId];
      if (state?.status !== 'ok') continue;
      const key = `${state.owner}/${state.repo}`;
      let group = byKey.get(key);
      if (!group) {
        group = { key, owner: state.owner, repo: state.repo, trailIds: [] };
        byKey.set(key, group);
      }
      group.trailIds.push(trailId);
    }
    return Array.from(byKey.values());
  }, [topic, trailStates]);

  // If the expanded repo disappears (e.g. all its trails errored out of the
  // grouping), collapse so we don't render against a stale key.
  React.useEffect(() => {
    if (!expandedRepoKey) return;
    if (!groups.some((g) => g.key === expandedRepoKey)) {
      setExpandedRepoKey(null);
    }
  }, [groups, expandedRepoKey]);

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
    return 'Untitled trail';
  };

  const openTrail = (trailId: string) => setSelectedTrailId(trailId);
  const closeTrail = () => setSelectedTrailId(null);

  // A repo card was clicked. Single-trail cards open their only trail directly
  // (re-click closes it); multi-trail cards toggle their inline expansion,
  // closing any open viewer first.
  const onRepoCardClick = (group: RepoGroup) => {
    if (group.trailIds.length === 1) {
      const only = group.trailIds[0];
      setExpandedRepoKey(null);
      if (selectedTrailId === only) closeTrail();
      else openTrail(only);
      return;
    }
    if (selectedTrailId) closeTrail();
    setExpandedRepoKey((prev) => (prev === group.key ? null : group.key));
  };

  const anyLoading = topic
    ? topic.trailIds.some((id) => trailStates[id]?.status === 'loading')
    : false;

  // ── Error / loading shells ────────────────────────────────────────────────
  if (topicError) {
    return <div style={centeredMessage(theme)}>{topicError}</div>;
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
      {/* Body: overview is full-width until a trail is selected, then it
          shrinks to a left rail and the viewer docks on the right. All-fr
          grid tracks so the column split animates instead of snapping. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: selected ? '1fr 2fr' : '1fr 0fr',
          transition: 'grid-template-columns 360ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Overview column */}
        <div
          style={{
            minWidth: 0,
            overflowY: 'auto',
            borderRight: selected
              ? `1px solid ${theme.colors.border}`
              : 'none',
            fontFamily: theme.fonts.body,
          }}
        >
          <div
            style={{
              maxWidth: selected ? 'none' : 760,
              margin: selected ? 0 : '0 auto',
              padding: '20px 24px 28px',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: theme.fontSizes[selected ? 3 : 4],
                fontWeight: 700,
                color: theme.colors.primary,
                lineHeight: 1.2,
              }}
            >
              {topic.title}
            </h1>
            {topic.createdBy?.githubLogin && (
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                }}
              >
                <span>by</span>
                <img
                  src={`https://github.com/${topic.createdBy.githubLogin}.png?size=48`}
                  alt=""
                  width={24}
                  height={24}
                  style={{
                    borderRadius: '50%',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                />
                <span style={{ fontWeight: 600, color: theme.colors.text }}>
                  @{topic.createdBy.githubLogin}
                </span>
              </div>
            )}

            {/* Repo cards — one per unique owner/repo across the topic's
                trails. Clicking opens (single trail) or expands (multiple). */}
            <div style={{ marginTop: 20 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: theme.fontSizes[0],
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: theme.colors.textSecondary,
                }}
              >
                Project Trails
              </h2>

              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {groups.map((group) => {
                  const multi = group.trailIds.length > 1;
                  const isSelected =
                    expandedRepoKey === group.key ||
                    (selectedTrailId !== null &&
                      group.trailIds.includes(selectedTrailId));
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => onRepoCardClick(group)}
                      aria-pressed={isSelected}
                      aria-label={`Show trails for ${group.key}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: isSelected
                          ? theme.colors.backgroundSecondary
                          : 'transparent',
                        border: `1px solid ${
                          isSelected ? theme.colors.primary : theme.colors.border
                        }`,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                      }}
                    >
                      <img
                        src={`https://github.com/${group.owner}.png?size=64`}
                        alt=""
                        width={28}
                        height={28}
                        style={{
                          borderRadius: '50%',
                          flexShrink: 0,
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      />
                      <span
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          lineHeight: 1.25,
                        }}
                      >
                        <span
                          style={{
                            fontSize: theme.fontSizes[1],
                            fontWeight: 600,
                          }}
                        >
                          {group.repo}
                        </span>
                        <span
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {group.owner}
                          {multi ? ` · ${group.trailIds.length} trails` : ''}
                        </span>
                      </span>
                      {multi && (
                        <ChevronDown
                          size={14}
                          style={{
                            flexShrink: 0,
                            opacity: 0.7,
                            transition: 'transform 200ms ease',
                            transform:
                              expandedRepoKey === group.key
                                ? 'rotate(180deg)'
                                : 'none',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {groups.length === 0 && (
                <p
                  style={{
                    marginTop: 12,
                    fontStyle: 'italic',
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                  }}
                >
                  {topic.trailIds.length === 0
                    ? 'No trails attached yet.'
                    : anyLoading
                      ? 'Loading trails…'
                      : 'No trails available.'}
                </p>
              )}

              {/* Inline expansion — the selected multi-trail repo's trails. */}
              {expandedRepoKey && (
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {(
                    groups.find((g) => g.key === expandedRepoKey)?.trailIds ?? []
                  ).map((trailId) => {
                    const isSelected = trailId === selectedTrailId;
                    return (
                      <button
                        key={trailId}
                        type="button"
                        onClick={() => openTrail(trailId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected
                            ? theme.colors.backgroundSecondary
                            : 'transparent',
                          border: `1px solid ${
                            isSelected
                              ? theme.colors.primary
                              : theme.colors.border
                          }`,
                          color: theme.colors.text,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        <Route
                          size={14}
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
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description */}
            {topic.description && topic.description.trim().length > 0 && (
              <div style={{ marginTop: 20 }}>
                <IndustryMarkdownSlide
                  content={topic.description}
                  slideIdPrefix={`topic-${topic.id}`}
                  slideIndex={0}
                  isVisible
                  theme={theme}
                  transparentBackground
                  disableScroll
                  disableBasePadding={{ horizontal: true }}
                  enableKeyboardScrolling={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* Viewer column — only mounted once a trail is selected. */}
        <div style={{ minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          {selected && (
            <SharedTrailViewer
              key={selected.id}
              trailId={selected.id}
              payload={selected.payload}
              owner={selected.owner}
              repo={selected.repo}
              events={events}
              repositories={repositories}
              briefSide="leading"
              showBanner={false}
            />
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
