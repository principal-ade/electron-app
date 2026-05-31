import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ArrowRight,
  FolderGit2,
  LayoutGrid,
  Library,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import {
  ExploredProjectsGrid,
  type ExploredProjectRepoEntry,
} from './ExploredProjectsGrid';
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
 * Replace the platform home prefix with `~` so paths render compactly.
 * Matches macOS (`/Users/<name>`) and Linux (`/home/<name>`); other paths
 * pass through untouched.
 */
const tildifyPath = (path: string): string => {
  const mac = path.match(/^\/Users\/[^/]+/);
  if (mac) return path.replace(mac[0], '~');
  const linux = path.match(/^\/home\/[^/]+/);
  if (linux) return path.replace(linux[0], '~');
  return path;
};

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

  // First mount of the session: reconcile against the persisted preference.
  // Sets the resting state directly (not via the toggle) so it doesn't replay
  // the staged animation. Skipped on later mounts where the cache already
  // matches.
  React.useEffect(() => {
    if (cachedShowAllTopics !== undefined) return;
    let cancelled = false;
    void UserPreferencesService.getPreferences().then((prefs) => {
      const stored = prefs.trails?.showAllTopics ?? false;
      cachedShowAllTopics = stored;
      if (cancelled || !stored) return;
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
      </Section>

      <AnimatePresence
        initial={false}
        // Forward toggle: Projects has fully collapsed → now expand topics.
        onExitComplete={() => setTopicsExpanded(true)}
      >
        {projectsPresent && (
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
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
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
        <li
          key={t.key}
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredKey(t.key)}
          onMouseLeave={() => setHoveredKey((k) => (k === t.key ? null : k))}
        >
          <button
            type="button"
            onClick={() => onSelectTopic(t)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 10,
              padding: '14px 16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              transition: 'border-color 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[2],
                  fontWeight: theme.fontWeights.semibold,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {t.title}
              </div>
              {t.shared && (
                <span
                  title="Shared to web-ade"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    flex: '0 0 auto',
                    padding: '1px 6px',
                    fontSize: theme.fontSizes[0],
                    fontFamily: theme.fonts.body,
                    color: theme.colors.primary,
                    border: `1px solid ${theme.colors.primary}`,
                    borderRadius: 999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Share2 size={10} />
                  Shared
                </span>
              )}
            </div>
            {t.projectRepos && t.projectRepos.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  gap: 8,
                  color: theme.colors.textTertiary,
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[0],
                  minWidth: 0,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  whiteSpace: 'nowrap',
                }}
                onWheel={(e) => {
                  if (e.deltaY !== 0 && e.deltaX === 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                title={t.projectRepos
                  .map((r) =>
                    r.ownerLogin ? `${r.ownerLogin}/${r.name}` : r.name,
                  )
                  .join(', ')}
              >
                {t.projectRepos.map((r, i) => (
                  <span
                    key={`${r.ownerLogin ?? ''}/${r.name}/${i}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      minWidth: 0,
                      flex: '0 0 auto',
                    }}
                  >
                    {r.ownerLogin ? (
                      <img
                        src={`https://github.com/${r.ownerLogin}.png?size=40`}
                        alt={r.ownerLogin}
                        width={14}
                        height={14}
                        style={{
                          borderRadius: '50%',
                          flex: '0 0 auto',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      />
                    ) : (
                      <FolderGit2 size={12} />
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {r.name}
                    </span>
                  </span>
                ))}
              </div>
            ) : t.folderPath ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: theme.colors.textTertiary,
                  fontFamily: theme.fonts.monospace,
                  fontSize: theme.fontSizes[0],
                  minWidth: 0,
                }}
                title={tildifyPath(t.folderPath)}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {tildifyPath(t.folderPath)}
                </span>
              </div>
            ) : null}
          </button>
          {onDeleteTopic && (
            <button
              type="button"
              aria-label={`Delete topic ${t.title}`}
              title="Delete topic"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTopic(t);
              }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 26,
                height: 26,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: theme.colors.textTertiary,
                cursor: 'pointer',
                padding: 0,
                opacity: hoveredKey === t.key ? 1 : 0,
                pointerEvents: hoveredKey === t.key ? 'auto' : 'none',
                transition: 'opacity 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  theme.colors.backgroundTertiary ?? theme.colors.background;
                e.currentTarget.style.color = theme.colors.error ?? '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.colors.textTertiary;
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </li>
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
