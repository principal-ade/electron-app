import React from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArrowRight,
  Columns3,
  FolderGit2,
  LayoutGrid,
  Library,
  Plus,
  Rows3,
  X,
} from 'lucide-react';
import type { TopicStatus } from '@principal-ai/alexandria-core-library';

/** The structured status axis — derived from the core lib's inline union. */
type TopicStatusState = TopicStatus['state'];
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import {
  ExploredProjectsGrid,
  type ExploredProjectRepoEntry,
} from './ExploredProjectsGrid';
import { TopicCard, TOPIC_STATUS_DND_MIME } from './TopicCard';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';

type ThemeShape = ReturnType<typeof useTheme>['theme'];

/**
 * Session-level cache of the persisted "All topics" preference. The store read
 * is async, so the first dashboard mount of a session falls back to `false`
 * and reconciles once the read resolves. Subsequent mounts (e.g. switching
 * back to Home) initialize straight from this cache, so the expanded state is
 * restored instantly with no flash or replayed animation.
 */
let cachedShowAllTopics: boolean | undefined;

/**
 * Session-level cache of the persisted topics layout, mirroring
 * {@link cachedShowAllTopics}: the first mount falls back to `'list'` and
 * reconciles once the async pref read resolves; later mounts initialize
 * straight from this cache so the board/list choice is restored with no flash.
 */
let cachedTopicsViewMode: 'list' | 'kanban' | undefined;

export interface TrailsDashboardRepoEntry {
  /** Stable key — usually the repo path. */
  key: string;
  /** Last-segment label, e.g. "electron-app". */
  label: string;
  /** GitHub owner login if known; drives avatar fallback. */
  ownerLogin?: string;
  /** Total trails the user has in this repo. */
  trailCount: number;
  /** Most-recent trail in the repo, for the preview line + timestamp. */
  latestTrail: TrailIndexEntry;
}

export interface TrailsDashboardTopicEntry {
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
  shared?: boolean;
  /**
   * Number of trails curated into this topic (`topic.trailIds.length`).
   * Drives the trail-count glyph in the card's bottom-right corner. Omitted
   * when unknown; the card hides the count rather than rendering a 0.
   */
  trailCount?: number;
  /**
   * Whether this topic's workspace currently has a window open. Drives the
   * "open" indicator on the card (and collapses the "Shared" badge to its
   * icon to keep the title row compact).
   */
  isOpen?: boolean;
  /**
   * Optional workflow status (mirrors the canonical `Topic.status`). Drives the
   * status pill on the card. Absent / `active` renders no pill so the common
   * case stays quiet.
   */
  status?: TopicStatus;
}

export interface TrailsDashboardProps {
  /** Repos with at least one trail, in display order. */
  repoEntries: TrailsDashboardRepoEntry[];
  /**
   * Full recent-trail list, passed straight through to the repo cards so
   * each can compute its file-coverage metric. Defaults to empty (cards
   * render without coverage).
   */
  recentTrails?: TrailIndexEntry[];
  /**
   * Curated topic collections, in display order. Ignored when the user is
   * signed out — topics are a server-backed concept that requires auth.
   */
  topicEntries: TrailsDashboardTopicEntry[];
  /** Fired when the user clicks a repo card. */
  onSelectRepo: (entry: TrailsDashboardRepoEntry) => void;
  /** Fired when the user clicks a topic row. */
  onSelectTopic: (entry: TrailsDashboardTopicEntry) => void;
  /** Fired by the "New topic" button. Hide the button by omitting. */
  onCreateTopic?: () => void;
  /** Fired when the user clicks the trash icon on a topic card. Hides the icon when omitted. */
  onDeleteTopic?: (entry: TrailsDashboardTopicEntry) => void;
  /**
   * Fired when a card is dragged into a different kanban status column. The
   * caller persists the new state (e.g. via `TopicService.updateTopic`). Omit
   * to disable drag-to-restatus on the board.
   */
  onChangeTopicStatus?: (
    entry: TrailsDashboardTopicEntry,
    nextState: TopicStatusState,
  ) => void;
  /** "View All Projects" → opens the Trails view's projects landing. */
  onViewAllProjects: () => void;
  /** Max repo cards to render before clipping. Default 6. */
  repoLimit?: number;
  /** Max topic rows to render before clipping. Default 6. */
  topicLimit?: number;
}

/**
 * Repo + topic dashboard. Shown on the trails landing once the user has
 * accumulated trails — replaces the prompt-idea cards for return users.
 * Purely presentational; caller supplies data + handlers.
 */
export const TrailsDashboard: React.FC<TrailsDashboardProps> = ({
  repoEntries,
  recentTrails = [],
  topicEntries,
  onSelectRepo,
  onSelectTopic,
  onCreateTopic,
  onDeleteTopic,
  onChangeTopicStatus,
  onViewAllProjects,
  repoLimit = 6,
  topicLimit = 6,
}) => {
  const { theme } = useTheme();
  // "All topics" mode hides the Projects section and lets the Topics section
  // grow into a scrollable list of every topic. The transition is staged so
  // one half finishes before the other starts:
  //   forward: Projects collapses → THEN topics expand
  //   reverse: topics collapse    → THEN Projects grows back
  // `showAllTopics` is the immediate button intent; `projectsPresent` and
  // `topicsExpanded` are flipped by animation-complete callbacks so the two
  // halves never overlap.
  // Initialize from the session cache so a re-mount (view switch) restores the
  // expanded state instantly. `initial={false}` on the AnimatePresence regions
  // means this resting state paints without any enter animation.
  const initialShowAll = cachedShowAllTopics ?? false;
  const [showAllTopics, setShowAllTopics] = React.useState(initialShowAll);
  const [projectsPresent, setProjectsPresent] = React.useState(!initialShowAll);
  const [topicsExpanded, setTopicsExpanded] = React.useState(initialShowAll);
  // 'list' is the created/updated-sorted grid; 'kanban' buckets every topic by
  // its status into columns. The same TopicCards carry a stable `layoutId`, so
  // toggling between the two lets framer-motion fly each card from its sorted
  // slot into its status column. Persisted to user prefs (see effect below).
  const [viewMode, setViewMode] = React.useState<'list' | 'kanban'>(
    cachedTopicsViewMode ?? 'list',
  );
  // While true, the kanban lanes keep `overflow: visible` so the cards flying
  // in from the grid aren't clipped by a lane's scroll box. Cleared once the
  // spring settles, at which point the lanes take over their own scrolling.
  const [boardEntering, setBoardEntering] = React.useState(false);
  const enterBoardTimer = React.useRef<number | null>(null);
  React.useEffect(
    () => () => {
      if (enterBoardTimer.current) window.clearTimeout(enterBoardTimer.current);
    },
    [],
  );

  const toggleViewMode = () => {
    const next = viewMode === 'kanban' ? 'list' : 'kanban';
    // Persist (fire-and-forget) and keep the session cache in sync so a
    // re-mount restores this layout without a flash.
    cachedTopicsViewMode = next;
    void UserPreferencesService.updatePreferences({
      trails: { topicsViewMode: next },
    });
    if (viewMode === 'kanban') {
      setViewMode('list');
      return;
    }
    setViewMode('kanban');
    // Let the fly-in finish before the lanes start clipping/scrolling. Matches
    // the card spring's settle time.
    setBoardEntering(true);
    if (enterBoardTimer.current) window.clearTimeout(enterBoardTimer.current);
    enterBoardTimer.current = window.setTimeout(() => {
      setBoardEntering(false);
      enterBoardTimer.current = null;
    }, 650);
  };

  // First mount of the session: reconcile against the persisted preference.
  // Sets the resting state directly (not via the toggle) so it doesn't replay
  // the staged animation. Skipped on later mounts where the cache already
  // matches.
  React.useEffect(() => {
    if (cachedShowAllTopics !== undefined) return;
    let cancelled = false;
    void UserPreferencesService.getPreferences().then((prefs) => {
      if (cancelled) return;
      // Topics layout — apply before the showAllTopics early-return so a
      // persisted 'kanban' is restored even when "All topics" is off.
      const storedView = prefs.trails?.topicsViewMode ?? 'list';
      cachedTopicsViewMode = storedView;
      setViewMode(storedView);

      const stored = prefs.trails?.showAllTopics ?? false;
      cachedShowAllTopics = stored;
      if (!stored) return;
      setShowAllTopics(true);
      setProjectsPresent(false);
      setTopicsExpanded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRepos = repoEntries.slice(0, repoLimit);
  // The first `topicLimit` topics are always shown; the remainder reveal in a
  // height-animated block when expanded. `topicLimit` (6) divides evenly into
  // every possible column count (1–3 within the 1100px container), so the base
  // rows stay full and the extra block starts on a clean new row.
  const baseTopics = topicEntries.slice(0, topicLimit);
  const extraTopics = topicEntries.slice(topicLimit);

  const toggleAllTopics = () => {
    const next = !showAllTopics;
    // Persist the choice (fire-and-forget) and keep the session cache in sync
    // so a subsequent re-mount restores this state without a flash.
    cachedShowAllTopics = next;
    void UserPreferencesService.updatePreferences({
      trails: { showAllTopics: next },
    });
    if (!showAllTopics) {
      // Forward: signal intent and start collapsing Projects. The extra topics
      // reveal only once Projects' fade-out completes.
      setShowAllTopics(true);
      setProjectsPresent(false);
    } else {
      // Reverse: signal intent and start collapsing the extra topics. Projects
      // re-enters once that collapse completes — unless there were no extra
      // topics to collapse, in which case restore Projects immediately.
      setShowAllTopics(false);
      if (topicsExpanded && extraTopics.length > 0) {
        setTopicsExpanded(false);
      } else {
        setTopicsExpanded(false);
        setProjectsPresent(true);
      }
    }
  };

  // Map the dashboard's repo entries into the shared explored-card shape.
  // Memoized so the cards' coverage effect keys off a stable array.
  const exploredEntries = React.useMemo<ExploredProjectRepoEntry[]>(
    () =>
      visibleRepos.map((r) => ({
        repo: { path: r.key, label: r.label, ownerLogin: r.ownerLogin },
        trail: r.latestTrail,
        trailCount: r.trailCount,
      })),
    // visibleRepos is a fresh slice each render; key off its contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repoEntries, repoLimit],
  );

  return (
    <section
      style={{
        width: '100%',
        maxWidth: 1100,
        margin: '0 auto',
        padding: '40px 32px 64px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Section
        theme={theme}
        eyebrowIcon={<Library size={12} color={theme.colors.primary} />}
        eyebrow="Topics"
        title="Your topics"
        subtitle={
          topicEntries.length === 0
            ? 'Curated sets of trails on a shared subject.'
            : undefined
        }
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {topicEntries.length > 0 && (
              <PillButton
                theme={theme}
                onClick={toggleViewMode}
                icon={
                  viewMode === 'kanban' ? (
                    <Rows3 size={14} />
                  ) : (
                    <Columns3 size={14} />
                  )
                }
                iconPosition="start"
              >
                {viewMode === 'kanban' ? 'List' : 'Board'}
              </PillButton>
            )}
            {topicEntries.length > 0 && viewMode === 'list' && (
              <PillButton
                theme={theme}
                onClick={toggleAllTopics}
                icon={
                  showAllTopics ? (
                    <X size={14} />
                  ) : (
                    <LayoutGrid size={14} />
                  )
                }
                iconPosition="start"
              >
                {showAllTopics ? 'Show projects' : 'All topics'}
              </PillButton>
            )}
            {onCreateTopic && (
              <PillButton
                theme={theme}
                onClick={onCreateTopic}
                accent
                icon={<Plus size={14} />}
                iconPosition="start"
              >
                New topic
              </PillButton>
            )}
          </div>
        }
      >
        {topicEntries.length === 0 ? (
          <EmptyHint
            theme={theme}
            text="No topics yet. Bundle related trails together so they're easy to share."
          />
        ) : (
          // A single LayoutGroup spans both views so a card's `layoutId`
          // survives the list↔board swap and framer tweens it across.
          <LayoutGroup>
            {viewMode === 'kanban' ? (
              <KanbanBoard
                topics={topicEntries}
                theme={theme}
                lanesScroll={!boardEntering}
                onSelectTopic={onSelectTopic}
                onDeleteTopic={onDeleteTopic}
                onChangeTopicStatus={onChangeTopicStatus}
              />
            ) : (
              <>
                <TopicList
                  topics={baseTopics}
                  theme={theme}
                  onSelectTopic={onSelectTopic}
                  onDeleteTopic={onDeleteTopic}
                />
                {/* Extra topics reveal by growing height from 0 → auto, so the
                    container visibly expands instead of the cards popping in.
                    When its collapse completes on reverse, Projects fades back. */}
                <AnimatePresence
                  initial={false}
                  onExitComplete={() => setProjectsPresent(true)}
                >
                  {topicsExpanded && extraTopics.length > 0 && (
                    <motion.div
                      key="extra-topics"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      {/* paddingTop sits inside the measured height so the
                          inter-row gap eases in with the rest. */}
                      <div style={{ paddingTop: 12 }}>
                        <TopicList
                          topics={extraTopics}
                          theme={theme}
                          onSelectTopic={onSelectTopic}
                          onDeleteTopic={onDeleteTopic}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </LayoutGroup>
        )}
      </Section>

      <AnimatePresence
        initial={false}
        // Forward toggle: Projects has fully collapsed → now expand topics.
        onExitComplete={() => setTopicsExpanded(true)}
      >
        {/* Board view is topic-only; Projects re-enters when we return to list. */}
        {viewMode === 'list' && projectsPresent && (
          <motion.div
            key="projects-section"
            // Pure fade — Projects is the last element in the column, so
            // fading in place (no height collapse) reads cleaner and causes
            // no layout jump.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ marginTop: 36 }}
          >
            <Section
              theme={theme}
              eyebrowIcon={
                <FolderGit2 size={12} color={theme.colors.primary} />
              }
              eyebrow="Projects"
              title="Projects with Trails"
              subtitle={
                repoEntries.length === 0
                  ? 'No projects have trails yet.'
                  : undefined
              }
              action={
                repoEntries.length > 0 ? (
                  <PillButton
                    theme={theme}
                    onClick={onViewAllProjects}
                    accent
                    icon={<ArrowRight size={14} />}
                    iconPosition="end"
                  >
                    View All Projects
                  </PillButton>
                ) : null
              }
            >
              {visibleRepos.length === 0 ? (
                <EmptyHint
                  theme={theme}
                  text="Publish a trail from the File City panel and its repo will land here."
                />
              ) : (
                <ExploredProjectsGrid
                  entries={exploredEntries}
                  recentTrails={recentTrails}
                  onOpenRepo={(e) => {
                    const original = repoEntries.find(
                      (r) => r.key === e.repo.path,
                    );
                    if (original) onSelectRepo(original);
                  }}
                />
              )}
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

function Section({
  theme,
  eyebrowIcon,
  eyebrow,
  title,
  subtitle,
  action,
  children,
}: {
  theme: ThemeShape;
  eyebrowIcon?: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              fontSize: theme.fontSizes[0],
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {eyebrowIcon}
            {eyebrow}
          </div>
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
      {children}
    </div>
  );
}

function TopicList({
  topics,
  theme,
  onSelectTopic,
  onDeleteTopic,
}: {
  topics: TrailsDashboardTopicEntry[];
  theme: ThemeShape;
  onSelectTopic: (entry: TrailsDashboardTopicEntry) => void;
  onDeleteTopic?: (entry: TrailsDashboardTopicEntry) => void;
}) {
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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

/**
 * Kanban view: one column per status state, every topic bucketed by its
 * `status.state` (untriaged / `active` topics land in the Active column).
 * Columns read left→right toward completion. The cards are the same
 * {@link TopicCard}s the list renders — their shared `layoutId` is what lets
 * framer-motion animate each one from its sorted grid slot into its column
 * when the dashboard toggles into this view.
 */
// Untriaged topics (no status) share the quiet `active` default.
const bucketOf = (t: TrailsDashboardTopicEntry): TopicStatusState =>
  t.status?.state ?? 'active';

function KanbanBoard({
  topics,
  theme,
  lanesScroll,
  onSelectTopic,
  onDeleteTopic,
  onChangeTopicStatus,
}: {
  topics: TrailsDashboardTopicEntry[];
  theme: ThemeShape;
  /**
   * Whether each lane scrolls its own overflow. Held `false` during the
   * list→board fly-in so the lanes' `overflow` doesn't clip cards while they
   * animate in from the grid; flipped to `true` once they've landed.
   */
  lanesScroll: boolean;
  onSelectTopic: (entry: TrailsDashboardTopicEntry) => void;
  onDeleteTopic?: (entry: TrailsDashboardTopicEntry) => void;
  onChangeTopicStatus?: (
    entry: TrailsDashboardTopicEntry,
    nextState: TopicStatusState,
  ) => void;
}) {
  // Which lane the pointer is currently over during a drag, for the
  // drop-target highlight. Null when nothing's being dragged over the board.
  const [dropTarget, setDropTarget] = React.useState<TopicStatusState | null>(
    null,
  );
  const canDrag = !!onChangeTopicStatus;

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    target: TopicStatusState,
  ) => {
    if (!e.dataTransfer.types.includes(TOPIC_STATUS_DND_MIME)) return;
    e.preventDefault();
    setDropTarget(null);
    const topicId = e.dataTransfer.getData(TOPIC_STATUS_DND_MIME);
    const topic = topics.find((t) => t.key === topicId);
    // No-op when dropped back into its own column.
    if (!topic || bucketOf(topic) === target) return;
    onChangeTopicStatus?.(topic, target);
  };

  // The Waiting lane is hidden for now. Topics already in the `waiting` state
  // keep that status (and still show their Waiting pill in List view) — they
  // just don't surface on the board until the lane returns.
  const columns: Array<{
    state: TopicStatusState;
    label: string;
    color: string;
  }> = [
    { state: 'active', label: 'Active', color: theme.colors.primary },
    {
      state: 'needs-attention',
      label: 'Needs attention',
      color: theme.colors.warning,
    },
    { state: 'done', label: 'Done for now', color: theme.colors.success },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        gap: 12,
        alignItems: 'start',
      }}
    >
      {columns.map((col) => {
        const items = topics.filter((t) => bucketOf(t) === col.state);
        const isDropTarget = dropTarget === col.state;
        return (
          <div
            key={col.state}
            // The whole column is a drop zone, so a card can land on the header
            // or an empty lane, not just on top of another card.
            onDragOver={
              canDrag
                ? (e) => {
                    if (!e.dataTransfer.types.includes(TOPIC_STATUS_DND_MIME))
                      return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dropTarget !== col.state) setDropTarget(col.state);
                  }
                : undefined
            }
            onDragLeave={
              canDrag
                ? (e) => {
                    // Ignore leaves into descendants; only clear when the
                    // pointer truly exits the column.
                    if (e.currentTarget.contains(e.relatedTarget as Node))
                      return;
                    setDropTarget((s) => (s === col.state ? null : s));
                  }
                : undefined
            }
            onDrop={canDrag ? (e) => handleDrop(e, col.state) : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {/* Static lane header — it sits above the scroll region, so only
                the cards in the lane below it scroll. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 2px',
                flex: '0 0 auto',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: col.color,
                  flex: '0 0 auto',
                }}
              />
              <span
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                {col.label}
              </span>
              <span
                style={{
                  color: theme.colors.textTertiary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                }}
              >
                {items.length}
              </span>
            </div>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                // Room for the scrollbar so it doesn't sit on the cards.
                padding: lanesScroll ? '2px 6px 2px 0' : 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                // Fixed-height lane that fills toward the bottom of the
                // viewport, so the WHOLE column is a drop target — not just the
                // strip its cards happen to occupy. The 240px offset leaves
                // room for the titlebar + section header; tune if it over/under
                // shoots. The lane scrolls its own cards (header stays put);
                // held `visible` during the fly-in so animating cards aren't
                // clipped.
                height: 'max(320px, calc(100vh - 240px))',
                overflowY: lanesScroll ? 'auto' : 'visible',
                borderRadius: 10,
                // Solid accent outline while a card hovers over this lane;
                // otherwise a faint dashed outline only when the lane is empty,
                // so the board still reads as four lanes with nothing in one.
                border: isDropTarget
                  ? `1px solid ${col.color}`
                  : `1px dashed ${
                      items.length === 0
                        ? theme.colors.border
                        : 'transparent'
                    }`,
                background: isDropTarget
                  ? (theme.colors.backgroundTertiary ??
                    theme.colors.backgroundSecondary)
                  : 'transparent',
                transition: 'border-color 120ms ease, background 120ms ease',
              }}
            >
              {items.map((t) => (
                <TopicCard
                  key={t.key}
                  topic={t}
                  theme={theme}
                  draggable={canDrag}
                  onSelect={onSelectTopic}
                  onDelete={onDeleteTopic}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
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
  iconPosition = 'start',
}: {
  theme: ThemeShape;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
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
        borderRadius: 999,
        background: 'transparent',
        border: `1px solid ${accent ? theme.colors.primary : theme.colors.border}`,
        color: accent ? theme.colors.primary : theme.colors.text,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
        fontWeight: theme.fontWeights.medium,
        cursor: 'pointer',
      }}
    >
      {iconPosition === 'start' && icon}
      {children}
      {iconPosition === 'end' && icon}
    </button>
  );
}
