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
  Search,
  X,
} from 'lucide-react';
import type { TopicStatus } from '@principal-ai/alexandria-core-library';

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
// Terminal "no longer live work" states — hidden from the default browse list
// and from the board lanes (they keep their status and still show in search).
const TERMINAL_STATES = new Set<TopicStatusState>([
  'done-for-now',
  'deprecated',
  'abandoned',
]);
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import {
  ExploredProjectsGrid,
  type ExploredProjectRepoEntry,
} from '../TrailsView/ExploredProjectsGrid';
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

export interface TopicsDashboardRepoEntry {
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
   * status pill on the card. Absent / `active` renders no pill so the common
   * case stays quiet.
   */
  status?: TopicStatus;
}

/** Imperative handle for the collapsible topic search field. */
interface TopicSearchHandle {
  /** Expand (if needed) and focus the search input. */
  focus: () => void;
}

/** Imperative handle the host uses to drive the dashboard via keyboard. */
export interface TopicsDashboardHandle {
  /** Expand + focus the topics search field. No-op when no topics exist. */
  focusSearch: () => void;
}

export interface TopicsDashboardProps {
  /** Repos with at least one trail, in display order. */
  repoEntries: TopicsDashboardRepoEntry[];
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
  topicEntries: TopicsDashboardTopicEntry[];
  /** Fired when the user clicks a repo card. */
  onSelectRepo: (entry: TopicsDashboardRepoEntry) => void;
  /** Fired when the user clicks a topic row. */
  onSelectTopic: (entry: TopicsDashboardTopicEntry) => void;
  /** Fired by the "New topic" button. Hide the button by omitting. */
  onCreateTopic?: () => void;
  /** Fired when the user clicks the trash icon on a topic card. Hides the icon when omitted. */
  onDeleteTopic?: (entry: TopicsDashboardTopicEntry) => void;
  /**
   * Fired when a card is dragged into a different kanban status column. The
   * caller persists the new state (e.g. via `TopicService.updateTopic`). Omit
   * to disable drag-to-restatus on the board.
   */
  onChangeTopicStatus?: (
    entry: TopicsDashboardTopicEntry,
    nextState: TopicStatusState,
  ) => void;
  /** "View All Projects" → opens the Trails view's projects landing. */
  onViewAllProjects: () => void;
  /**
   * Fired whenever the Topics view toggle changes (and once on mount with the
   * restored value). Lets the host adapt its layout — board mode wants a
   * flex-fill container so the lanes can scroll internally.
   */
  onViewModeChange?: (mode: 'list' | 'kanban') => void;
  /**
   * Fired when the list-view topics grid needs to scroll internally — the user
   * expanded "All topics" or is searching with matches. Lets the host switch
   * the dashboard wrapper to a flex-fill layout so the grid scrolls itself and
   * the page footer stays pinned, instead of the whole page scrolling.
   */
  onListScrollChange?: (scroll: boolean) => void;
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
export const TopicsDashboard = React.forwardRef<
  TopicsDashboardHandle,
  TopicsDashboardProps
>(function TopicsDashboard(
  {
    repoEntries,
    recentTrails = [],
    topicEntries,
    onSelectRepo,
    onSelectTopic,
    onCreateTopic,
    onDeleteTopic,
    onChangeTopicStatus,
    onViewAllProjects,
    onViewModeChange,
    onListScrollChange,
    repoLimit = 6,
    topicLimit = 6,
  },
  ref,
) {
  const { theme } = useTheme();
  // Lets the host (HomeView) focus the search field via keyboard shortcut.
  const topicSearchRef = React.useRef<TopicSearchHandle>(null);
  React.useImperativeHandle(
    ref,
    () => ({
      focusSearch: () => topicSearchRef.current?.focus(),
    }),
    [],
  );
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
  // Pending staged "Projects re-enters after the extra topics collapse" timer
  // from a reverse "Show projects" toggle. Tracked so a quick re-toggle (or a
  // board switch) can cancel it before it fires.
  const restoreProjectsTimer = React.useRef<number | null>(null);
  // Free-text filter for the topics section. Matches title, the topic's project
  // repo names, and any custom status label. While active it shows every match
  // (the topicLimit/"All topics" split is bypassed) and works in both views.
  const [topicQuery, setTopicQuery] = React.useState('');
  // True while the search field is expanded. Used to fade the Projects section
  // out so the search lands on a topics-only view, mirroring "All topics".
  const [searchActive, setSearchActive] = React.useState(false);
  // True between clicking "Board" and the board actually appearing: we hold the
  // view in `list` while the Projects section fades out, then flip to `kanban`
  // once its exit completes (see the Projects AnimatePresence). Staged so the
  // cards never fly into the board behind a still-fading Projects section.
  const [pendingBoardSwitch, setPendingBoardSwitch] = React.useState(false);
  React.useEffect(
    () => () => {
      if (enterBoardTimer.current) window.clearTimeout(enterBoardTimer.current);
      if (restoreProjectsTimer.current)
        window.clearTimeout(restoreProjectsTimer.current);
    },
    [],
  );

  // Surface the current view to the host so it can switch its container to a
  // flex-fill layout in board mode. Done synchronously alongside every
  // setViewMode (not in a [viewMode] effect) so the host's fill layout lands in
  // the SAME commit as the board — otherwise the board's first frame renders
  // unbounded (lanes at full content height) and framer flies the cards to that
  // too-tall layout before the host bounds it a frame later. This mount effect
  // only covers the initial paint; toggles/restores notify inline.
  React.useEffect(() => {
    onViewModeChange?.(viewMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist (fire-and-forget) and keep the session cache in sync so a re-mount
  // restores this layout without a flash.
  const persistViewMode = (next: 'list' | 'kanban') => {
    cachedTopicsViewMode = next;
    void UserPreferencesService.updatePreferences({
      trails: { topicsViewMode: next },
    });
  };

  // Commit to the board: flip the view and run the fly-in, holding the lanes
  // `visible` until the spring settles so the cards aren't clipped mid-flight.
  const enterBoard = () => {
    setViewMode('kanban');
    // Same-commit so the host bounds the board before framer measures it.
    onViewModeChange?.('kanban');
    setBoardEntering(true);
    if (enterBoardTimer.current) window.clearTimeout(enterBoardTimer.current);
    enterBoardTimer.current = window.setTimeout(() => {
      setBoardEntering(false);
      enterBoardTimer.current = null;
    }, 650);
  };

  const selectViewMode = (next: 'list' | 'kanban') => {
    // A view switch overrides any staged Projects-restore from a reverse "Show
    // projects" toggle; cancel it so it can't fire against the new layout.
    if (restoreProjectsTimer.current) {
      window.clearTimeout(restoreProjectsTimer.current);
      restoreProjectsTimer.current = null;
    }
    if (next === 'list') {
      // Cancel an in-flight switch-to-board that hasn't committed yet, bringing
      // Projects back (unless "All topics" owns that space).
      if (pendingBoardSwitch) {
        setPendingBoardSwitch(false);
        persistViewMode('list');
        setProjectsPresent(!showAllTopics);
        return;
      }
      if (viewMode === 'list') return;
      persistViewMode('list');
      setViewMode('list');
      onViewModeChange?.('list');
      // Projects re-enters once we're back in list (unless "All topics" is on).
      setProjectsPresent(!showAllTopics);
      return;
    }
    // → board.
    if (viewMode === 'kanban' || pendingBoardSwitch) return;
    persistViewMode('kanban');
    // Stage it: if Projects is on screen, fade it out first and defer the board
    // fly-in to its exit-complete. Otherwise go straight to the board.
    if (projectsPresent && !searchActive) {
      setPendingBoardSwitch(true);
      setProjectsPresent(false);
    } else {
      enterBoard();
    }
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
      onViewModeChange?.(storedView);

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
    // Mount-only reconciliation; the view notification is intentionally inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRepos = repoEntries.slice(0, repoLimit);

  const normalizedQuery = topicQuery.trim().toLowerCase();
  const searching = normalizedQuery.length > 0;
  // Case-insensitive substring match over title + status label + each project
  // repo's name and owner (so "owner", "name", or "owner/name" all match).
  // Memoized so the filtered array is stable across unrelated renders.
  const filteredTopics = React.useMemo(() => {
    if (!normalizedQuery) return topicEntries;
    return topicEntries.filter((t) => {
      const repoTerms = (t.projectRepos ?? []).flatMap((r) =>
        [r.name, r.ownerLogin, r.ownerLogin ? `${r.ownerLogin}/${r.name}` : null]
          .filter(Boolean),
      );
      const haystack = [t.title, t.status?.label, ...repoTerms]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [topicEntries, normalizedQuery]);

  // The default browse list hides terminal topics (done-for-now / deprecated /
  // abandoned) so the view stays focused on live work; the board lanes and
  // search both still surface them, so they're never lost. Search runs against
  // `filteredTopics` (every status), which is why the hide only applies to the
  // non-searching browse list.
  const browseTopics = React.useMemo(
    () =>
      topicEntries.filter(
        (t) => !TERMINAL_STATES.has(normalizeTopicState(t.status?.state)),
      ),
    [topicEntries],
  );

  // The first `topicLimit` topics are always shown; the remainder reveal in a
  // height-animated block when expanded. `topicLimit` (6) divides evenly into
  // every possible column count (1–3 within the 1100px container), so the base
  // rows stay full and the extra block starts on a clean new row. While
  // searching the split collapses — every match lands in the base list.
  const baseTopics = searching
    ? filteredTopics
    : browseTopics.slice(0, topicLimit);
  const extraTopics = searching ? [] : browseTopics.slice(topicLimit);

  // The list-view grid switches to an internal scroll once it's showing a long
  // list — "All topics" expanded (extra rows revealed) or a search with
  // matches. In both states the Projects section is hidden, so the grid can
  // take the full height and scroll its own overflow while the page footer
  // stays pinned. Gated on `topicsExpanded` (not just the button intent) so the
  // box only fills once the extra rows are actually in, avoiding a tall empty
  // box mid expand-animation.
  const listScroll =
    viewMode === 'list' && ((showAllTopics && topicsExpanded) || searching);
  // Fill = the host should hand this section a bounded height. Board lanes and
  // the long list both scroll their own overflow inside it.
  const fill = viewMode === 'kanban' || listScroll;

  // Tell the host to flex-fill its wrapper for the long-list case (board fill is
  // driven separately via onViewModeChange, which fires same-commit so the
  // board's fly-in measures a bounded layout). The list scroll has no such
  // cross-layout animation, so an effect-timed notification is fine here.
  React.useEffect(() => {
    onListScrollChange?.(listScroll);
  }, [listScroll, onListScrollChange]);

  const toggleAllTopics = () => {
    const next = !showAllTopics;
    // Persist the choice (fire-and-forget) and keep the session cache in sync
    // so a subsequent re-mount restores this state without a flash.
    cachedShowAllTopics = next;
    void UserPreferencesService.updatePreferences({
      trails: { showAllTopics: next },
    });
    // Cancel a staged Projects-restore still pending from a prior reverse toggle
    // so a quick re-toggle can't resurrect Projects after we've hidden it again.
    if (restoreProjectsTimer.current) {
      window.clearTimeout(restoreProjectsTimer.current);
      restoreProjectsTimer.current = null;
    }
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
        // Collapse the extra topics, then bring Projects back once the collapse
        // has played. Driven by a timer matching the 0.35s height animation
        // rather than the block's onExitComplete — AnimatePresence does not fire
        // onExitComplete reliably for a height:auto→0 exit, which left Projects
        // stuck hidden until the toggle was clicked a second time.
        setTopicsExpanded(false);
        restoreProjectsTimer.current = window.setTimeout(() => {
          setProjectsPresent(true);
          restoreProjectsTimer.current = null;
        }, 350);
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
        // When filling (board lanes, or the long topics list) the section sizes
        // to its bounded parent so the inner region can scroll; the bottom
        // padding shrinks since that region already reaches toward the footer.
        // Otherwise it keeps its natural, paddingy height.
        padding: fill ? '40px 32px 24px' : '40px 32px 64px',
        display: 'flex',
        flexDirection: 'column',
        ...(fill ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      <Section
        theme={theme}
        fill={fill}
        eyebrowIcon={<Library size={12} color={theme.colors.primary} />}
        eyebrow="Topics"
        title={
          topicEntries.length > 0 ? (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <ViewModeSwitch
                theme={theme}
                value={viewMode}
                onChange={selectViewMode}
              />
              <TopicSearch
                ref={topicSearchRef}
                theme={theme}
                value={topicQuery}
                onChange={setTopicQuery}
                onActiveChange={setSearchActive}
              />
            </div>
          ) : (
            'Your topics'
          )
        }
        subtitle={
          topicEntries.length === 0
            ? 'Curated sets of trails on a shared subject.'
            : undefined
        }
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {topicEntries.length > 0 && viewMode === 'list' && !searching && (
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
        ) : searching && filteredTopics.length === 0 ? (
          <EmptyHint
            theme={theme}
            text={`No topics match “${topicQuery.trim()}”.`}
          />
        ) : viewMode === 'list' && !searching && browseTopics.length === 0 ? (
          // Every topic is done, so the focused browse list is empty. Point at
          // the board / search, which still surface done topics.
          <EmptyHint
            theme={theme}
            text="Every topic is done. Search above or switch to the board view to see them."
          />
        ) : (
          // A single LayoutGroup spans both views so a card's `layoutId`
          // survives the list↔board swap and framer tweens it across.
          <LayoutGroup>
            {viewMode === 'kanban' ? (
              <KanbanBoard
                topics={filteredTopics}
                theme={theme}
                fill
                lanesScroll={!boardEntering}
                onSelectTopic={onSelectTopic}
                onDeleteTopic={onDeleteTopic}
                onChangeTopicStatus={onChangeTopicStatus}
              />
            ) : (
              // Once the list is long ("All topics" expanded, or a search with
              // many matches) the grid scrolls *itself* in a flex-filled box
              // instead of growing the page — the section header and the footer
              // stay put. The host bounds this region's height (see
              // onListScrollChange), so `flex: 1; minHeight: 0` makes the box
              // take exactly the leftover space and scroll its overflow. The
              // default 6-card view keeps `undefined` styling, so it (and its
              // list↔board fly animation) is left exactly as it was.
              <div
                style={
                  listScroll
                    ? {
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        // Gutter so the scrollbar clears the cards.
                        paddingRight: 4,
                      }
                    : undefined
                }
              >
                <TopicList
                  topics={baseTopics}
                  theme={theme}
                  onSelectTopic={onSelectTopic}
                  onDeleteTopic={onDeleteTopic}
                />
                {/* Extra topics reveal by growing height from 0 → auto, so the
                    container visibly expands instead of the cards popping in. On
                    reverse, Projects is restored by a timer in toggleAllTopics
                    (height:auto→0 exits don't fire onExitComplete reliably). */}
                <AnimatePresence initial={false}>
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
              </div>
            )}
          </LayoutGroup>
        )}
      </Section>

      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          // Staged switch-to-board: Projects has fully faded → now fly the
          // cards into the board (held in `list` until this moment).
          if (pendingBoardSwitch) {
            setPendingBoardSwitch(false);
            enterBoard();
            return;
          }
          // Forward "All topics" toggle: Projects has fully collapsed → now
          // expand topics. Guarded to that flow so a search-driven exit
          // (showAllTopics still false) doesn't spuriously reveal every topic.
          if (showAllTopics) setTopicsExpanded(true);
        }}
      >
        {/* Board view is topic-only; Projects re-enters when we return to list.
            It also fades while the search field is open for a focused view. */}
        {viewMode === 'list' && projectsPresent && !searchActive && (
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
              eyebrow="Trails"
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
                    View
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
});

function Section({
  theme,
  eyebrowIcon,
  eyebrow,
  eyebrowAccessory,
  title,
  subtitle,
  action,
  fill = false,
  children,
}: {
  theme: ThemeShape;
  eyebrowIcon?: React.ReactNode;
  eyebrow: string;
  eyebrowAccessory?: React.ReactNode;
  /**
   * The prominent line under the eyebrow. Usually a heading string, but can be
   * arbitrary nodes (e.g. inline controls) — passing nothing drops the row.
   */
  title?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  /**
   * Fill the parent's height: the header stays its natural size and the
   * children area flexes to take the rest (so a board inside can size its
   * lanes to the available space). Default: natural height.
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
              gap: 10,
            }}
          >
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
            {eyebrowAccessory}
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
              // Non-string titles (e.g. inline controls) render raw so they
              // keep their own styling instead of the heading treatment.
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
            display: 'flex',
            flexDirection: 'column',
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
 * `status.state` (untriaged topics land in the New Thought column). Columns
 * read left→right along the aliveness axis toward completion. The cards are the
 * same {@link TopicCard}s the list renders — their shared `layoutId` is what
 * lets framer-motion animate each one from its sorted grid slot into its column
 * when the dashboard toggles into this view.
 */
// Untriaged topics (no/legacy status) share the quiet `new-thought` default.
const bucketOf = (t: TopicsDashboardTopicEntry): TopicStatusState =>
  normalizeTopicState(t.status?.state);

function KanbanBoard({
  topics,
  theme,
  lanesScroll,
  fill = false,
  onSelectTopic,
  onDeleteTopic,
  onChangeTopicStatus,
}: {
  topics: TopicsDashboardTopicEntry[];
  theme: ThemeShape;
  /**
   * Whether each lane scrolls its own overflow. Held `false` during the
   * list→board fly-in so the lanes' `overflow` doesn't clip cards while they
   * animate in from the grid; flipped to `true` once they've landed.
   */
  lanesScroll: boolean;
  /**
   * Fill the parent's height: the board grid and its lanes flex to fill the
   * available space (each lane scrolls its own cards) instead of being sized
   * to a viewport-relative height. Default: viewport-relative lane height.
   */
  fill?: boolean;
  onSelectTopic: (entry: TopicsDashboardTopicEntry) => void;
  onDeleteTopic?: (entry: TopicsDashboardTopicEntry) => void;
  onChangeTopicStatus?: (
    entry: TopicsDashboardTopicEntry,
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

  // The board shows the live aliveness lanes only. Waiting, Deprecated, and
  // Abandoned are hidden for now: topics in those states keep their status (and
  // still show their pill in List view) — they just don't surface on the board.
  const columns: Array<{
    state: TopicStatusState;
    label: string;
    color: string;
  }> = [
    { state: 'new-thought', label: 'New Thought', color: theme.colors.accent },
    { state: 'working', label: 'Working', color: theme.colors.success },
    { state: 'paused', label: 'Paused', color: theme.colors.warning },
    {
      state: 'done-for-now',
      label: 'Done for now',
      color: theme.colors.textSecondary,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        gap: 12,
        // When filling, stretch the lanes to the grid's height so each whole
        // column is a full-height drop target; otherwise align to the top.
        alignItems: fill ? 'stretch' : 'start',
        ...(fill
          ? {
              flex: 1,
              minHeight: 0,
              // During the fly-in the lanes run `overflow: visible` so a card
              // animating across columns isn't clipped by its lane's scroll
              // box. That would let a full lane spill past its bottom (over the
              // footer) until the lanes flip to `auto` and snap-clip it. Clip
              // at the grid instead: it spans all columns, so the horizontal
              // fly-in is untouched, but the vertical spill is bounded to the
              // same edge the lanes settle to — no spill, no snap. Released to
              // `visible` at rest so the lanes own their scrolling.
              overflow: lanesScroll ? 'visible' : 'hidden',
            }
          : {}),
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              ...(fill ? { minHeight: 0 } : {}),
            }}
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
                // The lane fills its column so the WHOLE column is a drop
                // target — not just the strip its cards happen to occupy. When
                // `fill`, it flexes to the height the parent hands down (the
                // host bounds that to fit between the header and footer);
                // otherwise it falls back to a viewport-relative height. The
                // lane scrolls its own cards (header stays put); held `visible`
                // during the fly-in so animating cards aren't clipped.
                ...(fill
                  ? { flex: 1, minHeight: 0 }
                  : { height: 'max(320px, calc(100vh - 240px))' }),
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
                  showStatus={false}
                  boardMode
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
      {iconPosition === 'start' && icon}
      {children}
      {iconPosition === 'end' && icon}
    </button>
  );
}

/**
 * Expanding topic filter. Renders as a lone search icon next to the view switch
 * until clicked, then grows into an inline input. The icon-only resting state
 * keeps the eyebrow uncluttered; closing (X or Escape) clears the query so the
 * full topic list is always restored.
 */
const TopicSearch = React.forwardRef<
  TopicSearchHandle,
  {
    theme: ThemeShape;
    value: string;
    onChange: (next: string) => void;
    /** Fired when the field expands (true) or collapses (false). */
    onActiveChange?: (active: boolean) => void;
  }
>(function TopicSearch({ theme, value, onChange, onActiveChange }, ref) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Imperative entry point for the host's keyboard shortcut (Cmd/Ctrl+L).
  // Expands the field if collapsed — the effect above then focuses on the next
  // paint — and focuses+selects directly when it's already open.
  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        setOpen(true);
        onActiveChange?.(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      },
    }),
    [onActiveChange],
  );

  const openSearch = () => {
    setOpen(true);
    onActiveChange?.(true);
  };

  const close = () => {
    onChange('');
    setOpen(false);
    onActiveChange?.(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Search topics"
        onClick={openSearch}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 26,
          borderRadius: 10,
          border: `1px solid ${theme.colors.border}`,
          background: 'transparent',
          color: theme.colors.textTertiary,
          cursor: 'pointer',
        }}
      >
        <Search size={13} />
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 10,
        border: `1px solid ${theme.colors.primary}`,
        background: 'transparent',
      }}
    >
      <Search size={13} color={theme.colors.textTertiary} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        placeholder="Search topics…"
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          width: 150,
          padding: 0,
        }}
      />
      <button
        type="button"
        aria-label="Clear search"
        onClick={close}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          color: theme.colors.textTertiary,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
});

/**
 * Compact two-segment switch for the topics list↔board view. Lives inline next
 * to the "Topics" eyebrow; each segment carries an icon + label and the active
 * one gets a primary-tinted fill.
 */
function ViewModeSwitch({
  theme,
  value,
  onChange,
}: {
  theme: ThemeShape;
  value: 'list' | 'kanban';
  onChange: (next: 'list' | 'kanban') => void;
}) {
  const segments: { mode: 'list' | 'kanban'; label: string; icon: React.ReactNode }[] = [
    { mode: 'list', label: 'List', icon: <Rows3 size={12} /> },
    { mode: 'kanban', label: 'Board', icon: <Columns3 size={12} /> },
  ];
  return (
    <div
      role="tablist"
      aria-label="Topics view"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        borderRadius: 12,
        border: `1px solid ${theme.colors.border}`,
        background: 'transparent',
      }}
    >
      {segments.map((seg) => {
        const active = value === seg.mode;
        return (
          <button
            key={seg.mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) onChange(seg.mode);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 10,
              border: 'none',
              background: active ? theme.colors.primary : 'transparent',
              color: active ? theme.colors.background : theme.colors.textTertiary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[0],
              fontWeight: theme.fontWeights.medium,
              cursor: active ? 'default' : 'pointer',
            }}
          >
            {seg.icon}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
