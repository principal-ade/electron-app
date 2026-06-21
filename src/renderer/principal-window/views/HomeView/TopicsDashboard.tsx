import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Library, Plus } from 'lucide-react';
import type { TopicStatus } from '@principal-ai/alexandria-core-library';
import { TopicCard } from './TopicCard';

/** The structured status axis — derived from the core lib's inline union. */
type TopicStatusState = TopicStatus['state'];

// Stored values we recognize. Anything else — including the legacy
// `active` / `needs-attention` / `done` — reads as `new-thought`, the nascent
// default, so the union rename needed no data migration.
const KNOWN_STATES = new Set<TopicStatusState>([
  'new-thought',
  'working',
  'paused',
  'waiting',
  'done-for-now',
  'deprecated',
  'abandoned',
]);
const normalizeTopicState = (raw: string | undefined): TopicStatusState =>
  raw && KNOWN_STATES.has(raw as TopicStatusState)
    ? (raw as TopicStatusState)
    : 'new-thought';
// Terminal "no longer live work" states — never used as the recent fallback so
// the list stays focused on live work.
const TERMINAL_STATES = new Set<TopicStatusState>([
  'done-for-now',
  'deprecated',
  'abandoned',
]);

type ThemeShape = ReturnType<typeof useTheme>['theme'];

export interface TopicsDashboardTopicEntry {
  /** Stable key — topic id. */
  key: string;
  /** Topic title, e.g. "Auth & sessions". */
  title: string;
  /** ISO 8601 — drives the "updated Xd ago" hint. */
  updatedAt: string;
  /** Filesystem folder the topic's workspace lives in, if set. */
  folderPath?: string;
  /**
   * Repos belonging to the topic's workspace. When non-empty, the dashboard
   * row renders an owner-avatar + repo-name chip per entry in place of
   * {@link folderPath}. `ownerLogin` is omitted for local-only repos with
   * no GitHub remote — those render a generic icon fallback.
   */
  projectRepos?: Array<{ name: string; ownerLogin?: string }>;
  /**
   * Whether this topic has been published to web-ade (its sync record carries
   * a `remoteId`). Drives the "Shared" badge on the card.
   */
  published?: boolean;
  /**
   * Number of trails curated into this topic (`topic.trailIds.length`).
   * Drives the trail-count glyph in the card's bottom-right corner. Omitted
   * when unknown; the card hides the count rather than rendering a 0.
   */
  trailCount?: number;
  /**
   * Whether this topic's workspace currently has a window open. Drives the
   * "open" indicator on the card and floats it to the top of the list.
   */
  isOpen?: boolean;
  /**
   * Whether this topic's workspace window is currently being opened (the
   * transient phase between the user clicking and the window first painting).
   * Drives the "Opening…" indicator on the card.
   */
  isOpening?: boolean;
  /**
   * Whether this topic has no local workspace yet — true for topics minted over
   * the bridge or shared to us by someone else. Drives the "New" badge; opening
   * the topic creates its workspace and the badge clears on the next refresh.
   */
  isNew?: boolean;
  /**
   * Optional workflow status (mirrors the canonical `Topic.status`). Drives the
   * status pill on the card and the list's working/paused prioritization.
   */
  status?: TopicStatus;
}

export interface TopicsDashboardProps {
  /**
   * Topics in recency order (newest first). The dashboard re-orders them into
   * the priority list itself (open → working → paused → recent). Ignored when
   * the user is signed out — topics require auth.
   */
  topicEntries: TopicsDashboardTopicEntry[];
  /** Fired when the user clicks a topic row. */
  onSelectTopic: (entry: TopicsDashboardTopicEntry) => void;
  /** Fired by the "New topic" button. Hide the button by omitting. */
  onCreateTopic?: () => void;
  /** Fired when the user clicks the trash icon on a topic card. Hides the icon when omitted. */
  onDeleteTopic?: (entry: TopicsDashboardTopicEntry) => void;
  /**
   * Max topics shown in the "recent" fallback (when nothing is working or
   * paused). Open topics are always shown and never counted against this.
   * Default 10.
   */
  recentLimit?: number;
}

/**
 * Build the prioritized topic list:
 *   - Open topics (a window is open) always lead, uncapped.
 *   - Then the first non-empty of: working topics, paused topics, or the most
 *     recent live topics (capped at {@link recentLimit}).
 * Open topics are excluded from the fallback tiers so a working-and-open topic
 * isn't listed twice.
 */
function prioritizeTopics(
  topicEntries: TopicsDashboardTopicEntry[],
  recentLimit: number,
): TopicsDashboardTopicEntry[] {
  const open = topicEntries.filter((t) => t.isOpen);
  const openKeys = new Set(open.map((t) => t.key));
  const rest = topicEntries.filter((t) => !openKeys.has(t.key));

  const working = rest.filter(
    (t) => normalizeTopicState(t.status?.state) === 'working',
  );
  const paused = rest.filter(
    (t) => normalizeTopicState(t.status?.state) === 'paused',
  );
  const recent = rest
    .filter((t) => !TERMINAL_STATES.has(normalizeTopicState(t.status?.state)))
    .slice(0, recentLimit);

  const fallback =
    working.length > 0 ? working : paused.length > 0 ? paused : recent;
  return [...open, ...fallback];
}

/**
 * Home dashboard: a prioritized list of topics plus the projects you currently
 * have open. Purely presentational; the caller supplies data + handlers.
 */
export function TopicsDashboard({
  topicEntries,
  onSelectTopic,
  onCreateTopic,
  onDeleteTopic,
  recentLimit = 10,
}: TopicsDashboardProps) {
  const { theme } = useTheme();

  const visibleTopics = React.useMemo(
    () => prioritizeTopics(topicEntries, recentLimit),
    [topicEntries, recentLimit],
  );

  return (
    <section
      style={{
        width: '100%',
        padding: '40px 0 0',
        display: 'flex',
        flexDirection: 'column',
        // Fill the (bounded) left column so the topic list scrolls itself
        // instead of growing the page.
        flex: 1,
        minHeight: 0,
      }}
    >
      <Section
        theme={theme}
        fill
        // Larger eyebrow so the "Topics" label + icon stand as tall as the
        // "New topic" button across the header row.
        eyebrowIcon={<Library size={24} color={theme.colors.primary} />}
        eyebrowSize={theme.fontSizes[5]}
        eyebrow="Topics"
        title={topicEntries.length > 0 ? undefined : 'Your topics'}
        subtitle={
          topicEntries.length === 0
            ? 'Curated sets of trails on a shared subject.'
            : undefined
        }
        action={
          onCreateTopic ? (
            <PillButton
              theme={theme}
              onClick={onCreateTopic}
              accent
              icon={<Plus size={14} />}
            >
              New topic
            </PillButton>
          ) : null
        }
      >
        {visibleTopics.length === 0 ? (
          <EmptyHint
            theme={theme}
            text="No topics yet. Bundle related trails together so they're easy to share."
          />
        ) : (
          <TopicList
            topics={visibleTopics}
            theme={theme}
            onSelectTopic={onSelectTopic}
            onDeleteTopic={onDeleteTopic}
          />
        )}
      </Section>
    </section>
  );
}

function Section({
  theme,
  eyebrowIcon,
  eyebrow,
  eyebrowSize,
  title,
  subtitle,
  action,
  fill = false,
  children,
}: {
  theme: ThemeShape;
  eyebrowIcon?: React.ReactNode;
  eyebrow: string;
  /** Eyebrow font size; defaults to the smallest scale step. */
  eyebrowSize?: number;
  /**
   * The prominent line under the eyebrow. Usually a heading string — passing
   * nothing drops the row (e.g. when inline controls live in `action`).
   */
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  /**
   * Fill the parent's height: the header stays put and the children area flexes
   * to take the rest, scrolling its own overflow. Default: natural height.
   */
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...(fill ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: theme.colors.textTertiary,
              fontFamily: theme.fonts.body,
              fontSize: eyebrowSize ?? theme.fontSizes[0],
              // The enlarged heading variant reads as a normal-case title; the
              // small default eyebrow keeps the uppercase tracking.
              textTransform: eyebrowSize ? 'none' : 'uppercase',
              letterSpacing: eyebrowSize ? 'normal' : '0.08em',
            }}
          >
            {eyebrowIcon}
            {eyebrow}
          </div>
          {title != null &&
            (typeof title === 'string' ? (
              <div
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading ?? theme.fonts.body,
                  fontSize: theme.fontSizes[5],
                  fontWeight: theme.fontWeights.bold,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                }}
              >
                {title}
              </div>
            ) : (
              title
            ))}
          {subtitle && (
            <div
              style={{
                color: theme.colors.textTertiary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {action}
      </div>
      {fill ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            // Gutter so the scrollbar clears the cards.
            paddingRight: 4,
          }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function TopicList({
  topics,
  theme,
  onSelectTopic,
  onDeleteTopic,
}: {
  topics: TopicsDashboardTopicEntry[];
  theme: ThemeShape;
  onSelectTopic: (entry: TopicsDashboardTopicEntry) => void;
  onDeleteTopic?: (entry: TopicsDashboardTopicEntry) => void;
}) {
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 12,
      }}
    >
      {topics.map((t) => (
        <TopicCard
          key={t.key}
          topic={t}
          theme={theme}
          onSelect={onSelectTopic}
          onDelete={onDeleteTopic}
        />
      ))}
    </ul>
  );
}

function EmptyHint({ theme, text }: { theme: ThemeShape; text: string }) {
  return (
    <div
      style={{
        padding: '28px 16px',
        textAlign: 'center',
        background: theme.colors.backgroundSecondary,
        border: `1px dashed ${theme.colors.border}`,
        borderRadius: 10,
        color: theme.colors.textTertiary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
      }}
    >
      {text}
    </div>
  );
}

function PillButton({
  theme,
  onClick,
  children,
  accent,
  icon,
}: {
  theme: ThemeShape;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 12,
        background: 'transparent',
        border: `1px solid ${accent ? theme.colors.primary : theme.colors.border}`,
        color: accent ? theme.colors.primary : theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        fontWeight: theme.fontWeights.medium,
        cursor: 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  );
}
