import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  GitBranch,
  X,
  Folder,
  Trash2,
  Footprints,
  Copy,
  Check,
  ExternalLink,
  Search,
  Loader2,
  ArrowLeft,
  Plus,
  BookOpen,
  Share2,
} from 'lucide-react';
import type {
  ConvertProgressEntry,
  ConvertTrailResult,
  OpenCodeDetectResult,
  OpenCodeRunPromptResult,
} from '../../../../shared/main-process-api-interfaces/OpenCodeConvertAPI';
import {
  PanelEventBus,
  type DataSlice,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { FileTree } from '@principal-ai/repository-abstraction';
import {
  TabbedTerminalPanel,
  type TerminalTab,
  type TerminalWorkingState,
  type TerminalPanelActions,
} from '@industry-theme/xterm-terminal-panel';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../../../contexts/TerminalContext';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { GitService } from '../../../main-process-api/GitService';
import { GithubService } from '../../../main-process-api/GithubService';
import { SkillLockService } from '../../../main-process-api/SkillLockService';
import { ShellService } from '../../../main-process-api/ShellService';
import { WindowService } from '../../../main-process-api/WindowService';
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import { FileCityTrailPanel } from '../../../dev-workspace/file-city-trail-panel';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { GitGlobalConfigModal } from '../../../components/GitGlobalConfigModal';
import { DIRECTORY_ID_TO_DESTINATION } from '../SkillBrowserView/InstallSkillToolbar';
import { TrailProjectCityCard } from './TrailProjectCityCard';
import { SpikeConvertToolbar } from './SpikeConvertToolbar';

/** Constants for the trail skills bundled in principal-ai/skills. */
const TRAIL_SKILL_REPO_OWNER = 'principal-ai';
const TRAIL_SKILL_REPO_NAME = 'skills';
const TRAIL_SKILL_BRANCH = 'main';
const TRAIL_SKILL_GITHUB_URL = `https://github.com/${TRAIL_SKILL_REPO_OWNER}/${TRAIL_SKILL_REPO_NAME}`;

/** All skill folders the Trails install button writes to disk. */
const TRAIL_INSTALL_SKILL_NAMES = [
  'convert-investigation',
  'author-investigation-trail',
  'author-informative-trail',
] as const;

/**
 * Display metadata for the "What skills" expander shown above the install
 * button. Order here drives the card order in the row. Each card links to
 * the skill's folder on GitHub.
 */
const TRAIL_SKILL_DETAILS: ReadonlyArray<{
  name: (typeof TRAIL_INSTALL_SKILL_NAMES)[number];
  title: string;
  description: string;
  url: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  {
    name: 'author-investigation-trail',
    title: 'Author Investigation Trail',
    description:
      'Capture an investigation as you debug — records the files, calls, and findings you walked through so the chain of reasoning is preserved.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/author-investigation-trail`,
    Icon: Search,
  },
  {
    name: 'author-informative-trail',
    title: 'Author Informative Trail',
    description:
      'Lay a guided tour through the code to explain how a feature or system works, so a teammate can follow the path without reverse-engineering it.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/author-informative-trail`,
    Icon: BookOpen,
  },
  {
    name: 'convert-investigation',
    title: 'Convert Investigation',
    description:
      'Turn a raw investigation trail into a polished, shareable spec — cleans up the trail and forwards it through the convert pipeline.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/convert-investigation`,
    Icon: Share2,
  },
];

/**
 * Starter prompts shown on the post-install "Trail Prompt Ideas" screen.
 * Users can paste them straight into their agent's terminal.
 */
const TRAIL_PROMPT_IDEAS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Explain something',
    prompt:
      'Use the author-informative-trail skill to explain how <feature or system> works in this codebase.',
  },
  {
    label: 'Request lifecycle',
    prompt:
      'Use the author-informative-trail skill to map the lifecycle of a typical API request from entry point to response.',
  },
  {
    label: 'Investigate a bug',
    prompt:
      'Use the author-investigation-trail skill to investigate where <bug or symptom> is coming from in this codebase.',
  },
];
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

/** Last path segment of a repo path, used for the recent-trails feed. */
const trailRepoLabel = (repositoryPath: string | undefined): string => {
  if (!repositoryPath) return 'No repo';
  const trimmed = repositoryPath.replace(/[\\/]+$/, '');
  const idx = trimmed.search(/[\\/](?!.*[\\/])/);
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
};

/** Short relative time ("just now", "2h ago", "3d ago") for trail rows. */
const formatRelativeTime = (iso: string): string => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const deltaSec = Math.max(0, (Date.now() - t) / 1000);
  if (deltaSec < 60) return 'just now';
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
};

/**
 * Single footprint glyph — matches the SVG used on the web-ade home page.
 * Drawn pointing "up"; rotate the wrapper to orient it along a trail.
 */
const Footprint: React.FC<{
  side: 'left' | 'right';
  size?: number;
  color: string;
  strokeWidth?: number;
}> = ({ side, size = 20, color, strokeWidth = 2 }) => (
  <svg
    viewBox="2 1 9 18"
    width={size}
    height={size * (18 / 9)}
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    aria-hidden
  >
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
    <path d="M4 13h4" />
  </svg>
);

/**
 * Diagonal trail of alternating left/right footprints. The row is centered
 * on (anchorX, anchorY) of the parent and rotated around that point, so two
 * trails with opposite rotations cross paths through the anchor.
 *
 * Each footprint fades in and out on a continuous loop, staggered along
 * the trail so the row appears to "walk" across.
 */
const FootprintTrail: React.FC<{
  /** Trail orientation. Restricted to horizontal/vertical multiples of 90°. */
  rotationDeg: 0 | 90 | 180 | 270;
  anchorX?: string;
  anchorY?: string;
  count?: number;
  color: string;
  size?: number;
  gap?: number;
  opacity?: number;
  /** Stagger between consecutive feet starting to fade in, in seconds */
  stepSec?: number;
  /** Per-foot fade-in duration, in seconds */
  fadeInSec?: number;
  /** Time the full trail stays visible after the last foot lights up */
  holdSec?: number;
  /** Time the whole trail takes to fade out, in seconds */
  fadeOutSec?: number;
  /** Global cycle duration shared across trails (so they take turns) */
  cycleSec: number;
  /** Phase offset within the cycle, in seconds */
  delaySec?: number;
}> = ({
  rotationDeg,
  anchorX = '50%',
  anchorY = '50%',
  count = 16,
  color,
  size = 22,
  gap = 30,
  opacity = 0.28,
  stepSec = 0.15,
  fadeInSec = 0.3,
  holdSec = 1.2,
  fadeOutSec = 0.6,
  cycleSec,
  delaySec = 0,
}) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  // The whole trail fades out together at this moment within the cycle:
  const fadeOutStart = (count - 1) * stepSec + fadeInSec + holdSec;
  const fadeOutEnd = fadeOutStart + fadeOutSec;
  const foOutStartPct = (fadeOutStart / cycleSec) * 100;
  const foOutEndPct = (fadeOutEnd / cycleSec) * 100;

  // One keyframe per foot — same fade-out for all, but per-foot fade-in time.
  const keyframes = Array.from({ length: count }, (_, i) => {
    const fadeInStart = i * stepSec;
    const fadeInEnd = fadeInStart + fadeInSec;
    const inStartPct = (fadeInStart / cycleSec) * 100;
    const inEndPct = (fadeInEnd / cycleSec) * 100;
    return `
      @keyframes trail-${id}-foot-${i} {
        0%, ${inStartPct.toFixed(3)}% { opacity: 0; }
        ${inEndPct.toFixed(3)}% { opacity: var(--trails-foot-opacity, 0.28); }
        ${foOutStartPct.toFixed(3)}% { opacity: var(--trails-foot-opacity, 0.28); }
        ${foOutEndPct.toFixed(3)}%, 100% { opacity: 0; }
      }
    `;
  }).join('\n');

  return (
    <>
      <style>{keyframes}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: anchorY,
          left: anchorX,
          display: 'flex',
          alignItems: 'center',
          gap,
          transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
          transformOrigin: 'center',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {Array.from({ length: count }).map((_, i) => {
          const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
          return (
            <span
              key={i}
              style={{
                transform: `translateY(${side === 'left' ? '-7px' : '7px'}) rotate(90deg)`,
                transformOrigin: 'center',
                flexShrink: 0,
                opacity: 0,
                animationName: `trail-${id}-foot-${i}`,
                animationDuration: `${cycleSec}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${delaySec}s`,
                ['--trails-foot-opacity' as never]: String(opacity),
              }}
            >
              <Footprint side={side} size={size} color={color} />
            </span>
          );
        })}
      </div>
    </>
  );
};

/**
 * Right-side preview pane for the Recent view. Mounts the full
 * `FileCityTrailPanel` (the same panel the dev workspace runs) so the
 * preview surfaces the trail's markdown, 3D city, snippet pane, and
 * sequence drawer rather than the compact `TrailBriefModal` brief.
 *
 * We hand-roll a minimal `PanelContextValue` instead of wrapping in the
 * heavy `RepositoryPanelProvider`: the preview only needs `trail` (from
 * the already-loaded payload) and `fileTree` (one cache-only IPC per
 * selection). lineCounts is omitted — the panel wrapper supplies a
 * null slice for it. A multi-tree provider will likely subsume this
 * fetch once we want to share trees across previews.
 */
const RecentTrailPreviewPane: React.FC<{
  trail: TrailIndexEntry | null;
  payload: TrailPayload | null;
  loading: boolean;
  events: PanelEventEmitter;
  onDismiss: () => void;
  onBegin: () => void;
}> = ({ trail, payload, loading, events, onDismiss, onBegin }) => {
  const { theme } = useTheme();

  const repositoryPath = trail?.repositoryPath ?? null;

  // Cache-only fetch: if the repo has been opened anywhere in the app,
  // the file tree is warm; otherwise the panel falls back to its empty
  // tree. No background refresh, no cache-sync subscription — previews
  // are snapshots.
  const [fileTree, setFileTree] = useState<FileTree | null>(null);
  useEffect(() => {
    if (!repositoryPath) {
      setFileTree(null);
      return;
    }
    let cancelled = false;
    setFileTree(null);
    void RepositoryMonitoringService.getFileTree(repositoryPath).then(
      (tree) => {
        if (!cancelled) setFileTree(tree);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repositoryPath]);

  const repoName = useMemo(() => {
    if (!repositoryPath) return null;
    return repositoryPath.split('/').filter(Boolean).pop() ?? null;
  }, [repositoryPath]);

  const panelContext = useMemo(
    () => ({
      currentScope: {
        type: 'repository' as const,
        ...(repositoryPath
          ? { repository: { path: repositoryPath, name: repoName ?? '' } }
          : {}),
      },
      refresh: async () => {},
      adapters: {},
      repository: repositoryPath
        ? { path: repositoryPath, name: repoName, owner: null }
        : null,
      fileTree: {
        scope: 'repository' as const,
        name: 'fileTree',
        data: fileTree,
        loading: false,
        error: null,
        refresh: async () => {},
      } as DataSlice<FileTree | null>,
      trail: {
        scope: 'repository' as const,
        name: 'trail',
        data: payload,
        loading,
        error: null,
        refresh: async () => {},
      } as DataSlice<TrailPayload | null>,
    }),
    [repositoryPath, repoName, fileTree, payload, loading],
  );

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 10,
        backgroundColor: theme.colors.backgroundSecondary,
        overflow: 'hidden',
      }}
    >
      {!trail ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            opacity: 0.7,
          }}
        >
          Select a trail to preview
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 6,
              padding: '6px 8px',
              borderBottom: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
            <button
              type="button"
              onClick={onBegin}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 6,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                cursor: 'pointer',
              }}
            >
              <Footprints size={12} />
              Begin
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss preview"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 6,
                backgroundColor: theme.colors.background,
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                cursor: 'pointer',
              }}
            >
              <X size={12} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {loading || !payload ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                }}
              >
                <Loader2
                  size={16}
                  style={{ animation: 'trails-spin 1s linear infinite' }}
                />
                <style>{`@keyframes trails-spin { to { transform: rotate(360deg); } }`}</style>
                Loading preview…
              </div>
            ) : (
              <FileCityTrailPanel
                key={trail.id}
                context={panelContext}
                actions={{}}
                events={events}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Inner content — assumes TerminalProvider is mounted above it.
 * Renders a stubbed TabbedTerminalPanel with a search overlay on top
 * for picking a local Alexandria project.
 */
const TrailsViewInner: React.FC<{
  selectedProject: AlexandriaEntry | null;
  onClearProject: () => void;
}> = ({ selectedProject, onClearProject }) => {
  const { theme } = useTheme();

  const events = useMemo(() => new PanelEventBus(), []);
  const { context: terminalCtx, actions: terminalActions } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local Alexandria entries
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Tab state for the TabbedTerminalPanel — one tab per opened project.
  // The panel only reads `initialTabs` on mount, so we bump `remountKey` to
  // remount the panel when we add a tab. Existing terminal sessions reconnect
  // via their tab-id-keyed `terminalContext` so processes are preserved.
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const [remountKey] = useState(0);

  // Whether the search dropdown is visible (focused or hovered)
  const [searchOpen, setSearchOpen] = useState(false);

  // Whether the project-search overlay is shown. When projects exist, the
  // welcome view is the default; the user opts in via the Open Project button.
  const [showSearch, setShowSearch] = useState(false);

  // Search mode for the overlay input. 'projects' filters Alexandria
  // entries; 'trails' filters the local trail library. The toggle above
  // the input is only shown when at least one trail exists.
  const [searchMode, setSearchMode] = useState<'projects' | 'trails'>(
    'projects',
  );

  // Top-level view mode for the welcome overlay. 'search' shows the
  // existing input + dropdown (with Projects/Trails sub-toggle). 'recent'
  // replaces it with a 2-day grid of trail cards bucketed by
  // updatedAt day, plus a 3-track preview pane. Only switchable when
  // at least one trail exists.
  const [viewMode, setViewMode] = useState<'search' | 'recent'>('search');

  // Free-text filter applied inside Recent mode. Trails that don't match
  // are dropped before bucketing, so empty columns surface naturally.
  const [recentFilter, setRecentFilter] = useState('');

  // Recent-view grouping orientation. `date` buckets cards by updated-day;
  // `project` buckets them by repositoryPath and the cards substitute a
  // relative-time row for the repo row since the section header carries
  // that identity already.
  const [recentGrouping, setRecentGrouping] = useState<'date' | 'project'>(
    'date',
  );


  // Trail card clicked in Recent view — its full payload renders in the
  // right preview pane (TrailBriefModal). Clicking Start on the
  // modal opens the dev workspace; dismissing it clears the selection.
  const [previewTrail, setPreviewTrail] = useState<TrailIndexEntry | null>(null);
  const [previewPayload, setPreviewPayload] = useState<TrailPayload | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!previewTrail) {
      setPreviewPayload(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewPayload(null);
    void (async () => {
      try {
        const payload = await TrailLibraryService.load(previewTrail.id);
        if (cancelled) return;
        setPreviewPayload(payload);
      } catch (error) {
        if (!cancelled) {
          console.error('[TrailsView] Failed to load preview payload:', error);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewTrail]);

  // SPIKE: OpenCode convert toolbar — only renders when a preview trail
  // is selected. State lifted here so the buttons can sit in the Recent
  // toolbar (next to Back to search) rather than over the preview pane.
  const [spikeDetectResult, setSpikeDetectResult] =
    useState<OpenCodeDetectResult | null>(null);
  const [spikeDetecting, setSpikeDetecting] = useState(false);
  const [spikeRunResult, setSpikeRunResult] =
    useState<OpenCodeRunPromptResult | null>(null);
  const [spikeRunning, setSpikeRunning] = useState(false);
  const [spikeConvertResult, setSpikeConvertResult] =
    useState<ConvertTrailResult | null>(null);
  const [spikeConverting, setSpikeConverting] = useState(false);
  const [spikeProgress, setSpikeProgress] = useState<ConvertProgressEntry[]>(
    [],
  );

  // Subscribe to streamed progress while the spike toolbar is mounted.
  // The renderer keeps the last ~50 entries in memory; older ones drop.
  useEffect(() => {
    const unsubscribe = window.mainProcess.openCodeConvert.onProgress(
      (entry) => {
        setSpikeProgress((prev) => {
          const next = [...prev, entry];
          if (next.length > 50) next.splice(0, next.length - 50);
          return next;
        });
      },
    );
    return unsubscribe;
  }, []);
  const onSpikeDetectClick = useCallback(async () => {
    setSpikeDetecting(true);
    try {
      setSpikeDetectResult(
        await window.mainProcess.openCodeConvert.detect(),
      );
    } catch (err) {
      setSpikeDetectResult({
        installed: false,
        authed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSpikeDetecting(false);
    }
  }, []);
  const onSpikeRunClick = useCallback(async () => {
    setSpikeRunning(true);
    try {
      setSpikeRunResult(
        await window.mainProcess.openCodeConvert.runPrompt({
          prompt: 'Reply with the single word: pong.',
        }),
      );
    } catch (err) {
      setSpikeRunResult({
        ok: false,
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSpikeRunning(false);
    }
  }, []);
  // "Share with Agent" — builds a short markdown brief that points an
  // agent at the local Principal MCP Bridge endpoint so it can fetch the
  // full trail payload itself. Returns null when no trail is selected.
  const buildSpikeAgentBrief = useCallback((): string | null => {
    if (!previewTrail) return null;
    const title =
      previewPayload?.title || previewTrail.title || 'Untitled trail';
    const purpose = previewPayload?.purpose ?? 'investigation';
    const repo = trailRepoLabel(previewTrail.repositoryPath);
    return [
      'I want help with a trail from my local File City library.',
      '',
      `**Trail id:** ${previewTrail.id}`,
      `**Title:** ${title}`,
      `**Purpose:** ${purpose}`,
      `**Repo:** ${repo}`,
      '',
      'Fetch the full payload (markers, snippets, views, notes) from the',
      'local Principal MCP Bridge — the electron app must be running:',
      '',
      `    curl -s http://localhost:3044/api/file-city/trail/${previewTrail.id}`,
      '',
    ].join('\n');
  }, [previewTrail, previewPayload]);

  const onSpikeConvertClick = useCallback(async () => {
    if (!previewTrail) return;
    setSpikeConverting(true);
    setSpikeConvertResult(null);
    setSpikeProgress([]);
    try {
      setSpikeConvertResult(
        await window.mainProcess.openCodeConvert.convertTrail(previewTrail.id),
      );
    } catch (err) {
      setSpikeConvertResult({
        ok: false,
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSpikeConverting(false);
    }
  }, [previewTrail]);

  const [hoveredResultPath, setHoveredResultPath] = useState<string | null>(
    null,
  );

  // Project pending a remove-from-registry confirmation. Null when the
  // confirm modal is closed.
  const [removeConfirm, setRemoveConfirm] = useState<AlexandriaEntry | null>(
    null,
  );
  const [removeBusy, setRemoveBusy] = useState(false);

  // Global git user.name, used to personalize the welcome view heading.
  // Null until loaded or if no global git identity is configured.
  const [gitUserName, setGitUserName] = useState<string | null>(null);
  const [gitConfigOpen, setGitConfigOpen] = useState(false);

  const loadGitUserName = useCallback(async () => {
    try {
      const result = await GitService.execCommand(
        process.env.HOME || '/',
        ['config', '--global', 'user.name'],
      );
      setGitUserName(result.stdout.trim() || null);
    } catch {
      // No global git identity — leave gitUserName null and fall back.
    }
  }, []);

  useEffect(() => {
    void loadGitUserName();
  }, [loadGitUserName]);


  // Trail skill installation state.
  // `null` while we're still loading the skill lock file.
  const [skillInstalled, setSkillInstalled] = useState<boolean | null>(null);
  const [installingSkill, setInstallingSkill] = useState(false);
  const [skillInstallError, setSkillInstallError] = useState<string | null>(
    null,
  );
  // Toggle for the "What skills" expander on the install screen.
  const [showSkillDetails, setShowSkillDetails] = useState(false);

  // Which trail-prompt-idea card was most recently copied (resets after a
  // short delay so the check icon goes back to the copy icon).
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(
    null,
  );

  const handleCopyPrompt = useCallback(
    async (prompt: string, index: number) => {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopiedPromptIndex(index);
        window.setTimeout(
          () =>
            setCopiedPromptIndex((current) =>
              current === index ? null : current,
            ),
          1500,
        );
      } catch (error) {
        console.error('[TrailsView] Failed to copy prompt:', error);
      }
    },
    [],
  );

  // Considered "installed" only when every trail skill is present. If any
  // are missing the install button stays available so the user can install
  // the rest.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const checks = await Promise.all(
          TRAIL_INSTALL_SKILL_NAMES.map((name) =>
            SkillLockService.isSkillInstalled(name),
          ),
        );
        if (!cancelled) setSkillInstalled(checks.every(Boolean));
      } catch (error) {
        console.error('[TrailsView] Failed to load skill state:', error);
        if (!cancelled) setSkillInstalled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep skillInstalled state in sync with global install/uninstall events
  // (e.g. user installs the skill from SkillBrowserView in another tab).
  // Any change to a trail skill triggers a full re-check rather than a flip,
  // since "installed" means *all* trail skills are present.
  useEffect(() => {
    const tracked = new Set<string>(TRAIL_INSTALL_SKILL_NAMES);
    const recheck = async () => {
      try {
        const checks = await Promise.all(
          TRAIL_INSTALL_SKILL_NAMES.map((name) =>
            SkillLockService.isSkillInstalled(name),
          ),
        );
        setSkillInstalled(checks.every(Boolean));
      } catch (error) {
        console.error('[TrailsView] Failed to refresh skill state:', error);
      }
    };
    const offInstalled = SkillLockService.onSkillInstalled((payload) => {
      if (tracked.has(payload.skillName)) void recheck();
    });
    const offUninstalled = SkillLockService.onSkillUninstalled((payload) => {
      if (tracked.has(payload.skillName)) void recheck();
    });
    return () => {
      offInstalled();
      offUninstalled();
    };
  }, []);

  // Install the trail skills (convert-investigation and the author-*-trail
  // skills) into both the Claude-specific and universal (.agents) skill
  // directories. Cursor/Windsurf/etc. now also read from .agents/skills, so
  // installing to those two locations covers everyone.
  const handleInstallSkill = useCallback(async () => {
    setInstallingSkill(true);
    setSkillInstallError(null);
    try {
      const treeResult = await GithubService.getTree(
        TRAIL_SKILL_REPO_OWNER,
        TRAIL_SKILL_REPO_NAME,
        TRAIL_SKILL_BRANCH,
      );
      if (!treeResult?.success || !treeResult.data) {
        throw new Error('Could not fetch skills repository tree.');
      }

      const tree = treeResult.data.tree;
      const destinations = [
        DIRECTORY_ID_TO_DESTINATION['claude-specific'],
        DIRECTORY_ID_TO_DESTINATION['agent-universal'],
      ] as const;

      const failures: string[] = [];
      const fullyInstalled = new Set<string>();

      for (const skillName of TRAIL_INSTALL_SKILL_NAMES) {
        const prefix = `${skillName}/`;
        const fileList = tree
          .filter(
            (item) => item.type === 'blob' && item.path.startsWith(prefix),
          )
          .map((item) => item.path);
        if (fileList.length === 0) {
          failures.push(`${skillName}: not found in repo`);
          continue;
        }
        const folderEntry = tree.find(
          (item) => item.type === 'tree' && item.path === skillName,
        );

        let skillSucceededOnce = false;
        for (const destination of destinations) {
          const result = await GithubService.installSkill({
            githubUrl: TRAIL_SKILL_GITHUB_URL,
            skillPath: skillName,
            destination,
            skillName,
            fileList,
            skillTreeSha: folderEntry?.sha,
          });
          if (result.success) {
            skillSucceededOnce = true;
          } else {
            failures.push(
              `${skillName} → ${destination}: ${result.error || 'failed'}`,
            );
          }
        }
        if (skillSucceededOnce) {
          fullyInstalled.add(skillName);
        }
      }

      if (fullyInstalled.size === 0) {
        throw new Error(
          failures.length > 0
            ? failures.join('; ')
            : 'Failed to install trail skills.',
        );
      }
      // Only consider the trail "installed" when every skill landed
      // somewhere. Otherwise leave the install button available so the user
      // can retry the missing ones — the event subscription will also
      // re-check, but we set this here for immediacy.
      const allInstalled = TRAIL_INSTALL_SKILL_NAMES.every((name) =>
        fullyInstalled.has(name),
      );
      setSkillInstalled(allInstalled);
      if (failures.length > 0) {
        setSkillInstallError(`Partial install: ${failures.join('; ')}`);
      }
    } catch (error) {
      console.error('[TrailsView] Skill install failed:', error);
      setSkillInstallError(
        error instanceof Error ? error.message : 'Install failed.',
      );
    } finally {
      setInstallingSkill(false);
    }
  }, []);

  // Remove a project from the Alexandria registry without touching the
  // folder on disk. If the removed project is currently selected, clear
  // the selection.
  const handleRemoveFromRegistry = useCallback(
    async (entry: AlexandriaEntry) => {
      const path = String(entry.path);
      setRemoveBusy(true);
      try {
        await AlexandriaService.removeRepository(path, false);
        setRepositories((prev) => prev.filter((r) => r.path !== entry.path));
        if (selectedProject && selectedProject.path === entry.path) {
          onClearProject();
        }
        setRemoveConfirm(null);
      } catch (error) {
        console.error('[TrailsView] Failed to remove from registry:', error);
      } finally {
        setRemoveBusy(false);
      }
    },
    [selectedProject, onClearProject],
  );

  // Ask the user to pick a folder, scan it for git repos not yet in
  // Alexandria (the folder itself counts if it's a repo), then auto-register
  // them. The modal stays open so the user can see what was added.
  type AddedRepo = { path: string; name: string; ok: boolean; error?: string };
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [scanningHome, setScanningHome] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [addedRepos, setAddedRepos] = useState<AddedRepo[]>([]);
  const [scannedFolder, setScannedFolder] = useState<string | null>(null);
  const [totalFoundInFolder, setTotalFoundInFolder] = useState<number | null>(null);

  const handleAddProject = useCallback(async () => {
    const picked = await FileSystemService.selectDirectory({
      title: 'Add Project',
      buttonLabel: 'Add',
      properties: ['openDirectory'],
    });
    if (!picked || ('canceled' in picked && picked.canceled)) return;
    const rootPath = (picked as { filePaths?: string[] }).filePaths?.[0];
    if (!rootPath) return;
    setScannedFolder(rootPath);
    setSearchModalOpen(true);
    setScanningHome(true);
    setScanError(null);
    setAddedRepos([]);
    setTotalFoundInFolder(null);
    try {
      // Scan all repos in the folder (tracked + untracked). Re-registering
      // tracked entries lets the main service backfill any missing remoteUrl
      // — that's what was hiding bulk-added repos from Quick Open.
      const allPaths = await GitService.scanFolderForRepos(rootPath, 3);
      setTotalFoundInFolder(allPaths.length);
      const existingPaths = new Set<string>(repositories.map((r) => String(r.path)));
      const results: AddedRepo[] = [];
      for (const repoPath of allPaths) {
        const isNew = !existingPaths.has(repoPath);
        const name = repoPath.split('/').filter(Boolean).pop() ?? repoPath;
        try {
          await AlexandriaService.registerRepository(repoPath);
          if (isNew) {
            results.push({ path: repoPath, name, ok: true });
            setAddedRepos([...results]);
          }
        } catch (error) {
          results.push({
            path: repoPath,
            name,
            ok: false,
            error: error instanceof Error ? error.message : 'Register failed',
          });
          setAddedRepos([...results]);
        }
      }
      const refreshed = await AlexandriaService.getRepositories();
      setRepositories(refreshed);
    } catch (error) {
      console.error('[TrailsView] Folder scan failed:', error);
      setScanError(error instanceof Error ? error.message : 'Scan failed.');
    } finally {
      setScanningHome(false);
    }
  }, [repositories]);

  // Load local Alexandria repositories
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        if (!cancelled) setRepositories(repos);
      } catch (error) {
        console.error('[TrailsView] Failed to load Alexandria entries:', error);
      } finally {
        if (!cancelled) setReposLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recent trails feed (local only, across all repos). Drives the
  // welcome-screen routing: with at least one trail, the search overlay +
  // recent feed take over from the trail-prompt-ideas screen.
  const [recentTrails, setRecentTrails] = useState<TrailIndexEntry[]>([]);
  const [recentTrailsLoading, setRecentTrailsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await TrailLibraryService.list();
        if (cancelled) return;
        const sorted = [...result.entries].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        );
        setRecentTrails(sorted);
      } catch (error) {
        console.error('[TrailsView] Failed to load recent trails:', error);
      } finally {
        if (!cancelled) setRecentTrailsLoading(false);
      }
    };
    void load();
    const off = TrailLibraryService.onLibraryChanged(() => {
      void load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const hasRecentTrails = recentTrails.length > 0;

  // Cmd/Ctrl+I focuses the trails-view search input. Opens the search overlay
  // first if a project isn't selected so the shortcut works from both the
  // welcome screen and the overlay.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedProject) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== 'i') return;
      if (e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      setShowSearch(true);
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (input) {
          input.focus();
          input.select();
        }
      });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [selectedProject]);

  // Convert terminal activities to workingStates record
  const workingStates = useMemo(() => {
    const states: Record<string, TerminalWorkingState> = {};
    for (const activity of terminalActivities) {
      states[activity.sessionId] = {
        isWorking: activity.isWorking,
        message: activity.workingMessage,
        subtitle: activity.workingSubtitle,
      };
    }
    return states;
  }, [terminalActivities]);

  // Terminal context for the panel
  const terminalPanelContext = useMemo(
    () => ({
      currentScope: { type: 'workspace' as const },
      terminalSessions: terminalCtx.terminalSessions,
      terminalContext: terminalCtx.terminalContext,
      refresh: async () => {},
      terminal: {
        scope: 'workspace' as const,
        name: 'terminal',
        data: terminalCtx.terminalSessions.map((session) => ({
          id: session.id,
          pid: 0,
          cwd: session.directory || '',
          shell: '',
          createdAt: session.createdAt || Date.now(),
          lastActivity: Date.now(),
        })),
        loading: false,
        error: null,
        refresh: async () => {},
      },
    }),
    [terminalCtx.terminalSessions, terminalCtx.terminalContext],
  );

  // When typing: full-text filter. When empty: recents from last 24h.
  const visibleRepos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return repositories.filter((r) => {
        const name = r.name?.toLowerCase() ?? '';
        const fullName = r.github
          ? `${r.github.owner}/${r.github.name}`.toLowerCase()
          : '';
        const path = String(r.path ?? '').toLowerCase();
        return name.includes(q) || fullName.includes(q) || path.includes(q);
      });
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return repositories
      .filter((r) => {
        if (!r.lastOpenedAt) return false;
        const t = Date.parse(r.lastOpenedAt);
        return Number.isFinite(t) && t >= cutoff;
      })
      .sort((a, b) => Date.parse(b.lastOpenedAt!) - Date.parse(a.lastOpenedAt!));
  }, [repositories, query]);

  const showingRecents = query.trim().length === 0;

  // Trail-mode filter mirrors the project-mode one: full-text match on
  // title / summary / repo label when typing, otherwise the full recent
  // list (already sorted by updatedAt at load time).
  const visibleTrails = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recentTrails;
    return recentTrails.filter((t) => {
      const title = (t.title ?? '').toLowerCase();
      const summary = (t.summaryPreview ?? '').toLowerCase();
      const repo = trailRepoLabel(t.repositoryPath).toLowerCase();
      return title.includes(q) || summary.includes(q) || repo.includes(q);
    });
  }, [recentTrails, query]);

  // Recent-view groups: one section per calendar day with at least one
  // trail. `recentTrails` is pre-sorted newest-first, so each group's
  // `trails` array stays newest-first too. `recentFilter`, when set,
  // filters before grouping so empty days simply don't appear.
  const trailDayGroups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const q = recentFilter.trim().toLowerCase();
    const byKey = new Map<
      string,
      { date: Date; trails: TrailIndexEntry[] }
    >();
    for (const trail of recentTrails) {
      if (q) {
        const title = (trail.title ?? '').toLowerCase();
        const summary = (trail.summaryPreview ?? '').toLowerCase();
        const repo = trailRepoLabel(trail.repositoryPath).toLowerCase();
        if (
          !title.includes(q) &&
          !summary.includes(q) &&
          !repo.includes(q)
        ) {
          continue;
        }
      }
      const t = Date.parse(trail.updatedAt);
      if (!Number.isFinite(t)) continue;
      const d = new Date(t);
      d.setHours(0, 0, 0, 0);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.trails.push(trail);
      } else {
        byKey.set(key, { date: d, trails: [trail] });
      }
    }
    const groups = Array.from(byKey.values()).map(({ date, trails }) => {
      const diffDays = Math.floor((startMs - date.getTime()) / MS_PER_DAY);
      let label: string;
      if (diffDays <= 0) label = 'Today';
      else if (diffDays === 1) label = 'Yesterday';
      else if (diffDays < 7)
        label = date.toLocaleDateString(undefined, { weekday: 'long' });
      else
        label = date.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
      const subLabel = date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      return { date, label, subLabel, trails };
    });
    groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    return groups;
  }, [recentTrails, recentFilter]);

  // Recent-view groups bucketed by repositoryPath. Each group's
  // most-recent trail drives the group's sort position. Trails with no
  // `repositoryPath` collapse into a single "Unknown project" group.
  const trailProjectGroups = useMemo(() => {
    const q = recentFilter.trim().toLowerCase();
    const byKey = new Map<
      string,
      {
        repoLabel: string;
        repositoryPath?: string;
        ownerLogin?: string;
        avatarUrl: string | null;
        trails: TrailIndexEntry[];
      }
    >();
    for (const trail of recentTrails) {
      if (q) {
        const title = (trail.title ?? '').toLowerCase();
        const summary = (trail.summaryPreview ?? '').toLowerCase();
        const repo = trailRepoLabel(trail.repositoryPath).toLowerCase();
        if (
          !title.includes(q) &&
          !summary.includes(q) &&
          !repo.includes(q)
        ) {
          continue;
        }
      }
      const key = trail.repositoryPath ?? '__unknown__';
      const existing = byKey.get(key);
      if (existing) {
        existing.trails.push(trail);
      } else {
        const entry = trail.repositoryPath
          ? repositories.find((r) => r.path === trail.repositoryPath)
          : undefined;
        const ownerLogin = entry?.github?.owner;
        byKey.set(key, {
          repoLabel: trailRepoLabel(trail.repositoryPath),
          repositoryPath: trail.repositoryPath,
          ownerLogin,
          avatarUrl: ownerLogin
            ? `https://github.com/${ownerLogin}.png?size=48`
            : null,
          trails: [trail],
        });
      }
    }
    const groups = Array.from(byKey.values());
    groups.sort((a, b) => {
      const aTime = Date.parse(a.trails[0]?.updatedAt ?? '') || 0;
      const bTime = Date.parse(b.trails[0]?.updatedAt ?? '') || 0;
      return bTime - aTime;
    });
    return groups;
  }, [recentTrails, recentFilter, repositories]);

  // When user clicks an entry: open the project in its own dev workspace
  // window. The search overlay closes itself via showSearch reset.
  const handleSelect = useCallback(
    async (entry: AlexandriaEntry, openTrailId?: string) => {
      if (!entry?.path) return;
      try {
        await WindowService.openDevWorkspace({
          alexandriaEntry: entry,
          openTrailId,
        });
        setShowSearch(false);
      } catch (error) {
        console.error('[TrailsView] Failed to open project window:', error);
      }
    },
    [],
  );

  // Click handler for the recent-trails feed: resolve repo path → entry,
  // then open the dev workspace window with the trail preselected. Falls
  // back to a no-op if we can't locate the owning project.
  const handleOpenRecentTrail = useCallback(
    async (trail: TrailIndexEntry) => {
      if (!trail.repositoryPath) return;
      const entry = repositories.find((r) => r.path === trail.repositoryPath);
      if (!entry) {
        console.warn(
          '[TrailsView] Recent trail repo not in Alexandria registry:',
          trail.repositoryPath,
        );
        return;
      }
      await handleSelect(entry, trail.id);
    },
    [repositories, handleSelect],
  );

  const overlayBg = theme.colors.background;

  // Shared welcome header rendered at the top of every onboarding step.
  // "Welcome" sits above the git user.name (clickable to open the global git
  // config modal). Falls back to "to Principal AI" when no identity is set.
  const welcomeHeader = (
    <div style={{ textAlign: 'center', maxWidth: 640 }}>
      <div
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.heading ?? theme.fonts.body,
          fontSize: 'clamp(40px, 6vw, 72px)',
          fontWeight: theme.fontWeights.bold,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          marginBottom: 12,
        }}
      >
        <div>
          Welcome{' '}
          <button
            type="button"
            onClick={() => setGitConfigOpen(true)}
            title={
              gitUserName
                ? "This name comes from your global git config (user.name). Click to view or edit."
                : "No global git identity is configured. Click to set one."
            }
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              color: theme.colors.primary,
              font: 'inherit',
              fontStyle: gitUserName ? 'normal' : 'italic',
              letterSpacing: 'inherit',
              lineHeight: 'inherit',
              cursor: 'pointer',
              transition: 'color 150ms ease, opacity 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.85';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onFocus={(e) => {
              e.currentTarget.style.opacity = '0.85';
            }}
            onBlur={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {gitUserName ?? 'stranger'}
          </button>
        </div>
        <div>to</div>
        <div style={{ color: theme.colors.text }}>
          Principal <span style={{ color: theme.colors.primary }}>AI</span>
        </div>
      </div>
    </div>
  );

  // Trail card renderer shared by the date-grouped and project-grouped
  // feeds. `metaMode` swaps the bottom metadata line: 'repo' shows the
  // owner avatar + repo label (used in date grouping where the section
  // header carries the date); 'date' shows a relative time (used in
  // project grouping where the section header carries the repo).
  const renderTrailCard = (
    trail: TrailIndexEntry,
    metaMode: 'repo' | 'date',
  ): React.ReactNode => {
    const repoLabel = trailRepoLabel(trail.repositoryPath);
    const entry = trail.repositoryPath
      ? repositories.find((r) => r.path === trail.repositoryPath)
      : undefined;
    const owned = !!entry;
    const ownerLogin = entry?.github?.owner;
    const avatarUrl = ownerLogin
      ? `https://github.com/${ownerLogin}.png?size=32`
      : null;
    const isSelected = previewTrail?.id === trail.id;
    return (
      <button
        key={trail.id}
        type="button"
        onClick={() => setPreviewTrail(isSelected ? null : trail)}
        title={
          owned
            ? `Preview ${trail.title}`
            : "This trail's project isn't in your registry."
        }
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${
            isSelected ? theme.colors.accent : theme.colors.border
          }`,
          background: isSelected
            ? `color-mix(in srgb, ${theme.colors.accent} 12%, ${theme.colors.background})`
            : theme.colors.background,
          color: theme.colors.text,
          cursor: 'pointer',
          opacity: owned ? 1 : 0.6,
          textAlign: 'left',
          fontFamily: theme.fonts.body,
          transition:
            'background-color 120ms ease, border-color 120ms ease',
        }}
        onMouseEnter={(e) => {
          if (isSelected) return;
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundTertiary ?? theme.colors.border;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isSelected
            ? `color-mix(in srgb, ${theme.colors.accent} 12%, ${theme.colors.background})`
            : theme.colors.background;
        }}
      >
        <div
          style={{
            minWidth: 0,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights.semibold,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {trail.title || 'Untitled trail'}
        </div>
        {trail.markerCount > 0 && (
          <div
            aria-label={`${trail.markerCount} steps`}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}
          >
            {Array.from({ length: trail.markerCount }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: theme.colors.textSecondary,
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        )}
        {metaMode === 'repo' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              minWidth: 0,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              />
            ) : null}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1,
              }}
            >
              {repoLabel}
            </span>
          </div>
        ) : (
          <div
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}
          >
            {formatRelativeTime(trail.updatedAt)}
          </div>
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Tabbed terminal panel (underlay) — only rendered once a project is */}
      {/* selected inside this window. Project clicks now open a dedicated */}
      {/* dev-workspace window, so the trails view itself rarely hosts tabs. */}
      {selectedProject && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <TabbedTerminalPanel<TerminalTab>
            key={remountKey}
            context={terminalPanelContext}
            actions={terminalActions as TerminalPanelActions}
            events={events}
            terminalContext={terminalCtx.terminalContext}
            directory={selectedProject?.path ?? process.env.HOME ?? '/'}
            defaultScrollLocked={false}
            workingStates={workingStates}
            initialTabs={tabs}
            onTabsChange={setTabs}
            requestFocusTabId={focusTabId}
            onFocusTabHandled={() => setFocusTabId(null)}
          />
        </div>
      )}

      {/* Selected-project chip + reopen-search affordance (top-right) */}
      {selectedProject && (
        <button
          onClick={onClearProject}
          title="Pick a different project"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            cursor: 'pointer',
          }}
        >
          <Folder size={14} />
          <span>{selectedProject.name}</span>
          <X size={14} color={theme.colors.textSecondary} />
        </button>
      )}

      {/* Skill install step — shown before the project-add step when any */}
      {/* trail skill isn't installed yet. */}
      {!selectedProject && skillInstalled === false && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            backgroundColor: overlayBg,
            padding: 32,
            overflowY: 'auto',
          }}
        >
          <div style={{ flex: '0 0 auto', marginTop: '9vh' }}>{welcomeHeader}</div>

          <div
            style={{
              flex: '0 0 auto',
              marginTop: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              width: '100%',
            }}
          >
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => void handleInstallSkill()}
              disabled={installingSkill}
              title="Installs the trail skills (convert-investigation, author-investigation-trail, author-informative-trail) to ~/.claude/skills and ~/.agents/skills. Cursor and Windsurf also read skills from ~/.agents/skills."
              style={{
                width: 360,
                padding: 36,
                borderRadius: 12,
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                cursor: installingSkill ? 'default' : 'pointer',
                opacity: installingSkill ? 0.7 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                textAlign: 'center',
                transition: 'border-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (installingSkill) return;
                e.currentTarget.style.borderColor = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <Footprints size={36} color={theme.colors.primary} />
              <div
                style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                {installingSkill ? 'Installing…' : 'Install Trail Skills'}
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSkillDetails((prev) => !prev)}
            aria-expanded={showSkillDetails}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: theme.colors.primary,
              fontFamily: theme.fonts.body,
              fontSize: theme.fontSizes[1],
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'underline',
            }}
          >
            What skills
          </button>

          {/* Skill detail cards — revealed by the "What skills" toggle. */}
          {/* Sits directly below the "What skills" link. Clicking a card */}
          {/* opens that skill's folder on GitHub. */}
          {showSkillDetails && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 16,
                flexWrap: 'wrap',
                width: '100%',
                maxWidth: 1080,
              }}
            >
              {TRAIL_SKILL_DETAILS.map((skill) => {
                const SkillIcon = skill.Icon;
                return (
                  <button
                    key={skill.name}
                    type="button"
                    onClick={() => void ShellService.openExternal(skill.url)}
                    title={`Open ${skill.name} on GitHub`}
                    style={{
                      flex: '1 1 240px',
                      maxWidth: 320,
                      minWidth: 220,
                      padding: 20,
                      borderRadius: 12,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      color: theme.colors.text,
                      fontFamily: theme.fonts.body,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 8,
                      textAlign: 'left',
                      transition: 'border-color 150ms ease',
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
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                    >
                      <SkillIcon size={20} color={theme.colors.primary} />
                      <ExternalLink size={12} color={theme.colors.textSecondary} />
                    </div>
                    <div
                      style={{
                        fontSize: theme.fontSizes[2],
                        fontWeight: theme.fontWeights.semibold,
                      }}
                    >
                      {skill.title}
                    </div>
                    <div
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {skill.description}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {skillInstallError && (
            <div
              style={{
                color: theme.colors.error ?? theme.colors.primary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                maxWidth: 520,
                textAlign: 'center',
              }}
            >
              {skillInstallError}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Trail prompt ideas — shown after the skill is installed when the */}
      {/* user has never created a trail. Once any trail exists, the search */}
      {/* overlay + recent feed take over (see below). */}
      {!selectedProject &&
        skillInstalled === true &&
        !reposLoading &&
        !recentTrailsLoading &&
        !hasRecentTrails &&
        !showSearch && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              backgroundColor: overlayBg,
              padding: 32,
              overflowY: 'auto',
            }}
          >
            <div style={{ flex: '0 0 auto', marginTop: '9vh' }}>
              {welcomeHeader}
            </div>

            <div
              style={{
                flex: '0 0 auto',
                marginTop: 40,
                width: '100%',
                maxWidth: 960,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading ?? theme.fonts.body,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                Create a Trail
              </div>

              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                {TRAIL_PROMPT_IDEAS.map((idea, i) => {
                  const isCopied = copiedPromptIndex === i;
                  return (
                    <div
                      key={idea.label}
                      style={{
                        position: 'relative',
                        flex: '1 1 260px',
                        minWidth: 220,
                        maxWidth: 300,
                        padding: '14px 16px 48px 16px',
                        borderRadius: 10,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[0],
                          fontWeight: theme.fontWeights.semibold,
                          color: theme.colors.textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {idea.label}
                      </div>
                      <div
                        style={{
                          fontFamily: theme.fonts.monospace,
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.text,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {idea.prompt}
                      </div>
                      <button
                        onClick={() => void handleCopyPrompt(idea.prompt, i)}
                        title={isCopied ? 'Copied' : 'Copy prompt'}
                        style={{
                          position: 'absolute',
                          bottom: 10,
                          right: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: 6,
                          background: theme.colors.background,
                          color: isCopied
                            ? theme.colors.primary
                            : theme.colors.textSecondary,
                          cursor: 'pointer',
                        }}
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  maxWidth: 360,
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginTop: 8,
                }}
              >
                <div style={{ flex: 1, height: 1, background: theme.colors.border }} />
                or
                <div style={{ flex: 1, height: 1, background: theme.colors.border }} />
              </div>

              <div
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading ?? theme.fonts.body,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                  textAlign: 'center',
                }}
              >
                {repositories.length > 0 ? 'Open a Project' : 'Add a Project'}
              </div>
              {repositories.length === 0 && (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    textAlign: 'center',
                    maxWidth: 520,
                    marginTop: -4,
                  }}
                >
                  Pick a folder — we'll add it if it's a git repo, or scan inside for repos and add them all.
                </div>
              )}

              {repositories.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  style={{
                    width: 360,
                    padding: 24,
                    borderRadius: 12,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights.semibold,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'border-color 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  <Folder size={20} color={theme.colors.primary} />
                  Open Project
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleAddProject()}
                  disabled={scanningHome}
                  title="Pick a folder to add — we'll find any git repos inside"
                  style={{
                    width: 360,
                    padding: 24,
                    borderRadius: 12,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights.semibold,
                    cursor: scanningHome ? 'default' : 'pointer',
                    opacity: scanningHome ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'border-color 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (scanningHome) return;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  {scanningHome ? (
                    <Loader2
                      size={20}
                      color={theme.colors.primary}
                      style={{ animation: 'trails-spin 1s linear infinite' }}
                    />
                  ) : (
                    <Folder size={20} color={theme.colors.primary} />
                  )}
                  <style>{`@keyframes trails-spin { to { transform: rotate(360deg); } }`}</style>
                  {scanningHome ? 'Scanning…' : 'Add Project'}
                </button>
              )}
            </div>
          </div>
        )}


      {/* Search overlay (covers panel until a project is picked). Becomes */}
      {/* the default landing screen once the user has at least one local */}
      {/* trail — alongside the recent-trails feed on the right. */}
      {!selectedProject &&
        skillInstalled === true &&
        !recentTrailsLoading &&
        (showSearch || hasRecentTrails) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: overlayBg,
            overflow: 'hidden',
          }}
        >
          {/* Back to welcome — returns to the Create-a-Trail screen. Only */}
          {/* shown when the overlay was entered explicitly (showSearch). */}
          {/* When recent trails drove us here, there's nothing behind it. */}
          {showSearch && (
            <button
              type="button"
              onClick={() => setShowSearch(false)}
              title="Back"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 22,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 8,
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} />
              Back
            </button>
          )}
          {/* Footprint trails — span the entire overlay, behind all content. */}
          {/* When the user focuses the search input, the trails fade out and */}
          {/* their animations pause until the input is blurred. */}
          <div
            aria-hidden
            className={searchOpen || viewMode === 'recent' ? 'trails-paused' : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 0,
              opacity: searchOpen || viewMode === 'recent' ? 0 : 1,
              transition: 'opacity 300ms ease-out',
            }}
          >
            {/*
              Trails take turns. Cycle is shared globally; each trail's
              delaySec offsets it within the cycle. With 6 trails of ~4s
              each, a 24s cycle gives each its own slot.
            */}
            {(() => {
              const CYCLE = 24;
              const SLOT = CYCLE / 6;
              return (
                <>
                  {/* First trail — runs just below the title, walking right */}
                  <FootprintTrail
                    rotationDeg={0}
                    anchorX="50%"
                    anchorY="33%"
                    color={theme.colors.primary}
                    count={20}
                    opacity={0.32}
                    cycleSec={CYCLE}
                    delaySec={0 * SLOT}
                  />
                  {/* Short vertical trail in the bottom-left, walking down */}
                  <FootprintTrail
                    rotationDeg={90}
                    anchorX="14%"
                    anchorY="82%"
                    color={theme.colors.primary}
                    count={5}
                    size={20}
                    opacity={0.22}
                    cycleSec={CYCLE}
                    delaySec={1 * SLOT}
                  />
                  {/* Horizontal trail at the top of the marquee, walking left */}
                  <FootprintTrail
                    rotationDeg={180}
                    anchorX="50%"
                    anchorY="5%"
                    color={theme.colors.primary}
                    count={22}
                    opacity={0.32}
                    cycleSec={CYCLE}
                    delaySec={2 * SLOT}
                  />
                  {/* Short vertical trail in the bottom-right, walking up */}
                  <FootprintTrail
                    rotationDeg={270}
                    anchorX="86%"
                    anchorY="82%"
                    color={theme.colors.primary}
                    count={5}
                    size={20}
                    opacity={0.22}
                    cycleSec={CYCLE}
                    delaySec={3 * SLOT}
                  />
                  {/* Horizontal trail well below the input, walking right */}
                  <FootprintTrail
                    rotationDeg={0}
                    anchorX="50%"
                    anchorY="68%"
                    color={theme.colors.primary}
                    count={22}
                    opacity={0.22}
                    cycleSec={CYCLE}
                    delaySec={4 * SLOT}
                  />
                  {/* Horizontal trail near the bottom, walking left */}
                  <FootprintTrail
                    rotationDeg={180}
                    anchorX="50%"
                    anchorY="94%"
                    color={theme.colors.primary}
                    count={20}
                    size={20}
                    opacity={0.18}
                    cycleSec={CYCLE}
                    delaySec={5 * SLOT}
                  />
                </>
              );
            })()}
          </div>

          {/* Marquee section — hidden in Recent mode so the week grid */}
          {/* gets the full vertical space. */}
          {viewMode === 'search' && (
          <div
            style={{
              flex: '0 0 auto',
              height: '40vh',
              minHeight: 220,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <div
              style={{
                color: theme.colors.text,
                fontFamily: theme.fonts.heading ?? theme.fonts.body,
                fontSize: 'clamp(48px, 8vw, 96px)',
                fontWeight: theme.fontWeights.bold,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              Principal <span style={{ color: theme.colors.primary }}>AI</span>
            </div>
          </div>
          )}

          {/* Search section */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: viewMode === 'recent' ? 24 : 32,
              paddingLeft: 24,
              paddingRight: 24,
              paddingBottom: 24,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
              minHeight: 0,
            }}
          >
            {viewMode === 'search' && (
            <div
              style={{
                width: 'min(640px, 90%)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Mode toggle — only shown when at least one trail exists. */}
              {/* Swaps the input + dropdown between project search and */}
              {/* trail search. Clearing the query on switch keeps the */}
              {/* recents-vs-filter logic predictable in each mode. */}
              {hasRecentTrails && (
                <div
                  style={{
                    alignSelf: 'center',
                    display: 'inline-flex',
                    padding: 4,
                    borderRadius: 999,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundSecondary,
                  }}
                >
                  {(['projects', 'trails'] as const).map((mode) => {
                    const active = searchMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          if (active) return;
                          setSearchMode(mode);
                          setQuery('');
                        }}
                        style={{
                          padding: '6px 18px',
                          borderRadius: 999,
                          border: 'none',
                          background: active
                            ? theme.colors.primary
                            : 'transparent',
                          color: active
                            ? theme.colors.background
                            : theme.colors.textSecondary,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                          fontWeight: theme.fontWeights.semibold,
                          cursor: active ? 'default' : 'pointer',
                          transition:
                            'background-color 120ms ease, color 120ms ease',
                        }}
                      >
                        {mode === 'projects' ? 'Projects' : 'Trails'}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '18px 22px',
                  borderRadius: 14,
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                }}
                onClick={() => inputRef.current?.focus()}
              >
                {searchMode === 'trails' ? (
                  <Footprints
                    size={22}
                    color={theme.colors.textSecondary}
                  />
                ) : (
                  <GitBranch size={22} color={theme.colors.textSecondary} />
                )}
                <style>{`
                  .trails-search-input::placeholder {
                    color: ${theme.colors.textSecondary};
                    opacity: 0.5;
                  }
                  .trails-paused span {
                    animation-play-state: paused !important;
                  }
                `}</style>
                <input
                  ref={inputRef}
                  className="trails-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => {
                    // Delay so click-on-result lands before close
                    setTimeout(() => setSearchOpen(false), 150);
                  }}
                  placeholder={
                    searchMode === 'trails'
                      ? 'Search your trails'
                      : 'Pick a project to make a trail'
                  }
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: theme.colors.text,
                    fontSize: theme.fontSizes[3] ?? 20,
                    fontFamily: theme.fonts.body,
                  }}
                />
                <kbd
                  title="Focus search"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes[0] ?? 12,
                    fontFamily: theme.fonts.body,
                    lineHeight: 1,
                    userSelect: 'none',
                    opacity: 0.7,
                  }}
                >
                  ⌘I
                </kbd>
              </div>

              {/* View Recent Trails — opens the 2-day grid. Only */}
              {/* shown when at least one local trail exists. The Add */}
              {/* Project button sits next to it so users can register */}
              {/* repos without leaving the search overlay. */}
              {hasRecentTrails && (
                <div
                  style={{
                    alignSelf: 'center',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('recent');
                      setQuery('');
                      setSearchOpen(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 16px',
                      borderRadius: 999,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'color 120ms ease, border-color 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.text;
                      e.currentTarget.style.borderColor =
                        theme.colors.textSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textSecondary;
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    <Footprints size={14} />
                    View Recent Trails
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAddProject()}
                    disabled={scanningHome}
                    title="Pick a folder to add — we'll find any git repos inside"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 999,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                      fontWeight: theme.fontWeights.semibold,
                      cursor: scanningHome ? 'default' : 'pointer',
                      opacity: scanningHome ? 0.7 : 1,
                      transition: 'color 120ms ease, border-color 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (scanningHome) return;
                      e.currentTarget.style.color = theme.colors.text;
                      e.currentTarget.style.borderColor =
                        theme.colors.textSecondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textSecondary;
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    <Plus size={14} />
                    {scanningHome ? 'Scanning…' : 'Add Project'}
                  </button>
                </div>
              )}

              {/* Results dropdown — hide entirely when showing recents but there are none */}
              {(searchOpen || query.length > 0) &&
                (searchMode === 'trails'
                  ? !(showingRecents && visibleTrails.length === 0)
                  : !(
                      showingRecents &&
                      !reposLoading &&
                      visibleRepos.length === 0
                    )) && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  maxHeight: '40vh',
                  overflowY: 'auto',
                  borderRadius: 10,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  zIndex: 11,
                }}
              >
                {searchMode === 'trails' ? (
                  <>
                    {showingRecents && (
                      <div
                        style={{
                          padding: '8px 14px 6px',
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.body,
                          fontWeight: theme.fontWeights.semibold,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          borderBottom: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        Recent trails
                      </div>
                    )}
                    {visibleTrails.length === 0 && !showingRecents && (
                      <div
                        style={{
                          padding: 16,
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        No matching trails.
                      </div>
                    )}
                    {visibleTrails.map((trail) => {
                      const repoLabel = trailRepoLabel(trail.repositoryPath);
                      const owned = !!(
                        trail.repositoryPath &&
                        repositories.some(
                          (r) => r.path === trail.repositoryPath,
                        )
                      );
                      return (
                        <button
                          key={trail.id}
                          type="button"
                          onClick={() => void handleOpenRecentTrail(trail)}
                          disabled={!owned}
                          title={
                            owned
                              ? `Open ${trail.title}`
                              : 'This trail’s project isn’t in your registry.'
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            width: '100%',
                            padding: '10px 14px',
                            border: 'none',
                            borderBottom: `1px solid ${theme.colors.border}`,
                            background: 'transparent',
                            color: theme.colors.text,
                            cursor: owned ? 'pointer' : 'not-allowed',
                            opacity: owned ? 1 : 0.6,
                            textAlign: 'left',
                            fontFamily: theme.fonts.body,
                          }}
                          onMouseEnter={(e) => {
                            if (!owned) return;
                            e.currentTarget.style.backgroundColor =
                              theme.colors.backgroundTertiary ??
                              theme.colors.border;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              'transparent';
                          }}
                        >
                          <Footprints
                            size={16}
                            color={theme.colors.textSecondary}
                            style={{ flexShrink: 0, marginTop: 2 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: theme.fontSizes[1],
                                fontWeight: theme.fontWeights.semibold,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {trail.title || 'Untitled trail'}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: theme.fontSizes[0],
                                color: theme.colors.textSecondary,
                              }}
                            >
                              <Folder size={11} />
                              <span
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  minWidth: 0,
                                }}
                              >
                                {repoLabel}
                              </span>
                              <span aria-hidden>·</span>
                              <span>{trail.markerCount} steps</span>
                              <span aria-hidden>·</span>
                              <span>
                                {formatRelativeTime(trail.updatedAt)}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {showingRecents && (
                      <div
                        style={{
                          padding: '8px 14px 6px',
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.body,
                          fontWeight: theme.fontWeights.semibold,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          borderBottom: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        Recent (last 24h)
                      </div>
                    )}
                    {reposLoading ? (
                      <div
                        style={{
                          padding: 16,
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        Loading projects...
                      </div>
                    ) : visibleRepos.length === 0 ? (
                      <div
                        style={{
                          padding: 16,
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        {showingRecents
                          ? 'No projects opened in the last 24 hours.'
                          : 'No matching projects.'}
                      </div>
                    ) : (
                      visibleRepos.map((entry) => {
                        const resultKey = String(entry.path);
                        const isResultHovered =
                          hoveredResultPath === resultKey;
                        return (
                          <div
                            key={`${entry.name}-${entry.path}`}
                            onMouseEnter={() =>
                              setHoveredResultPath(resultKey)
                            }
                            onMouseLeave={() =>
                              setHoveredResultPath((p) =>
                                p === resultKey ? null : p,
                              )
                            }
                            style={{
                              position: 'relative',
                              borderBottom: `1px solid ${theme.colors.border}`,
                              backgroundColor: isResultHovered
                                ? theme.colors.backgroundTertiary ??
                                  theme.colors.border
                                : 'transparent',
                            }}
                          >
                            <button
                              onClick={() => handleSelect(entry)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                width: '100%',
                                padding: '10px 40px 10px 14px',
                                border: 'none',
                                background: 'transparent',
                                color: theme.colors.text,
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontFamily: theme.fonts.body,
                              }}
                            >
                              <Folder
                                size={16}
                                color={theme.colors.textSecondary}
                                style={{ flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: theme.fontSizes[1],
                                    fontWeight: theme.fontWeights.semibold,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {entry.github
                                    ? `${entry.github.owner}/${entry.github.name}`
                                    : entry.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: theme.fontSizes[0],
                                    color: theme.colors.textSecondary,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {String(entry.path)}
                                </div>
                              </div>
                            </button>
                            {isResultHovered && (
                              <button
                                onMouseDown={(e) => {
                                  // Prevent input blur from closing the dropdown
                                  // before the click fires.
                                  e.preventDefault();
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRemoveConfirm(entry);
                                }}
                                title="Remove from registry (does not delete folder)"
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  right: 8,
                                  transform: 'translateY(-50%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 26,
                                  height: 26,
                                  border: 'none',
                                  borderRadius: 6,
                                  background: 'transparent',
                                  color: theme.colors.textSecondary,
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color =
                                    theme.colors.text;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color =
                                    theme.colors.textSecondary;
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
              )}
            </div>
            )}

            {viewMode === 'recent' && (
              <div
                style={{
                  flex: 1,
                  alignSelf: 'stretch',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minHeight: 0,
                  width: '100%',
                  maxWidth: 1600,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flex: '0 0 auto',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      justifyContent: 'flex-start',
                    }}
                  >
                    <div
                      role="tablist"
                      style={{
                        display: 'inline-flex',
                        padding: 2,
                        gap: 2,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 8,
                        backgroundColor: theme.colors.backgroundSecondary,
                      }}
                    >
                      {(
                        [
                          { id: 'date', label: 'By date' },
                          { id: 'project', label: 'By project' },
                        ] as const
                      ).map((opt) => {
                        const active = recentGrouping === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setRecentGrouping(opt.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: 'none',
                              backgroundColor: active
                                ? theme.colors.background
                                : 'transparent',
                              color: active
                                ? theme.colors.text
                                : theme.colors.textSecondary,
                              fontFamily: theme.fonts.body,
                              fontSize: theme.fontSizes[1],
                              fontWeight: active
                                ? theme.fontWeights.semibold
                                : theme.fontWeights.body,
                              cursor: 'pointer',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: '0 0 auto',
                      width: '100%',
                      maxWidth: 300,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                    }}
                  >
                    <Search size={14} color={theme.colors.textSecondary} />
                    <input
                      value={recentFilter}
                      onChange={(e) => setRecentFilter(e.target.value)}
                      placeholder="Filter trails by title, summary, or project"
                      className="trails-search-input"
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                      }}
                    />
                    {recentFilter && (
                      <button
                        type="button"
                        onClick={() => setRecentFilter('')}
                        title="Clear filter"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          border: 'none',
                          borderRadius: 6,
                          background: 'transparent',
                          color: theme.colors.textSecondary,
                          cursor: 'pointer',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    {previewTrail && (
                      <SpikeConvertToolbar
                        detecting={spikeDetecting}
                        running={spikeRunning}
                        converting={spikeConverting}
                        detectResult={spikeDetectResult}
                        runResult={spikeRunResult}
                        convertResult={spikeConvertResult}
                        progress={spikeProgress}
                        onDetect={onSpikeDetectClick}
                        onRun={onSpikeRunClick}
                        onConvert={onSpikeConvertClick}
                        buildAgentBrief={buildSpikeAgentBrief}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('search');
                        setRecentFilter('');
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 8,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        cursor: 'pointer',
                      }}
                    >
                      <ArrowLeft size={14} />
                      Back to search
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    display: 'grid',
                    // Trail feed on the left, preview pane on the right.
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
                    gap: 10,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 10,
                      backgroundColor: theme.colors.backgroundSecondary,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        minHeight: 0,
                      }}
                    >
                      {(
                        recentGrouping === 'date'
                          ? trailDayGroups.length === 0
                          : trailProjectGroups.length === 0
                      ) ? (
                        <div
                          style={{
                            padding: '32px 8px',
                            textAlign: 'center',
                            fontFamily: theme.fonts.body,
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.textSecondary,
                            opacity: 0.5,
                          }}
                        >
                          No matching trails.
                        </div>
                      ) : recentGrouping === 'date' ? (
                        trailDayGroups.map((group) => (
                          <div
                            key={group.date.getTime()}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 8,
                                padding: '0 4px',
                                fontFamily: theme.fonts.body,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: theme.fontSizes[1],
                                  fontWeight: theme.fontWeights.semibold,
                                  color: theme.colors.text,
                                }}
                              >
                                {group.label}
                              </span>
                              <span
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  color: theme.colors.textSecondary,
                                }}
                              >
                                {group.subLabel}
                              </span>
                            </div>
                            {group.trails.map((trail) =>
                              renderTrailCard(trail, 'repo'),
                            )}
                          </div>
                        ))
                      ) : (
                        trailProjectGroups.map((group) => (
                          <TrailProjectCityCard
                            key={group.repositoryPath ?? '__unknown__'}
                            repoLabel={group.repoLabel}
                            repositoryPath={group.repositoryPath}
                            ownerAvatarUrl={group.avatarUrl}
                            trails={group.trails}
                            selectedTrailId={previewTrail?.id ?? null}
                            onSelectTrail={(trail) =>
                              setPreviewTrail(
                                previewTrail?.id === trail.id
                                  ? null
                                  : trail,
                              )
                            }
                          />
                        ))
                      )}
                    </div>
                  </div>
                  <RecentTrailPreviewPane
                    trail={previewTrail}
                    payload={previewPayload}
                    loading={previewLoading}
                    events={events}
                    onDismiss={() => setPreviewTrail(null)}
                    onBegin={() => {
                      if (previewTrail) {
                        void handleOpenRecentTrail(previewTrail);
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Installed-skill pills — visual confirmation that the trail */}
          {/* skills are on disk. Clicking a pill opens that skill on GitHub. */}
          {/* We only render this overlay when skillInstalled === true, so */}
          {/* every pill is in its "installed" state. */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              zIndex: 21,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              maxWidth: 'calc(100% - 24px)',
              pointerEvents: 'none',
            }}
          >
            {TRAIL_SKILL_DETAILS.map((skill) => (
              <button
                key={skill.name}
                type="button"
                onClick={() => void ShellService.openExternal(skill.url)}
                title={`${skill.name} installed — open on GitHub`}
                style={{
                  pointerEvents: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.textSecondary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[0],
                  cursor: 'pointer',
                  transition: 'border-color 150ms ease, color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <Check size={12} color={theme.colors.primary} />
                {skill.name}
              </button>
            ))}
          </div>

        </div>
      )}


      {/* Confirm modal for remove-from-registry */}
      {removeConfirm && (
        <div
          onClick={() => {
            if (!removeBusy) setRemoveConfirm(null);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 90%)',
              padding: 20,
              borderRadius: 12,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.semibold,
                marginBottom: 8,
              }}
            >
              Remove from list?
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                lineHeight: 1.4,
                marginBottom: 16,
              }}
            >
              This does not delete the project — it just removes{' '}
              <span style={{ color: theme.colors.text }}>
                {removeConfirm.github
                  ? `${removeConfirm.github.owner}/${removeConfirm.github.name}`
                  : removeConfirm.name}
              </span>{' '}
              from this list.
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                onClick={() => setRemoveConfirm(null)}
                disabled={removeBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.border}`,
                  background: 'transparent',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  cursor: removeBusy ? 'default' : 'pointer',
                  opacity: removeBusy ? 0.6 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRemoveFromRegistry(removeConfirm)}
                disabled={removeBusy}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: theme.colors.primary,
                  color: theme.colors.background,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  fontWeight: theme.fontWeights.semibold,
                  cursor: removeBusy ? 'default' : 'pointer',
                  opacity: removeBusy ? 0.6 : 1,
                }}
              >
                {removeBusy ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Home-scan results modal — opened by the Search button. */}
      {searchModalOpen && (
        <div
          onClick={() => {
            if (!scanningHome) setSearchModalOpen(false);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 12,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.background,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${theme.colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.heading ?? theme.fonts.body,
                  fontSize: theme.fontSizes[3],
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                {scanningHome ? (
                  <Loader2
                    size={18}
                    color={theme.colors.primary}
                    style={{ animation: 'trails-spin 1s linear infinite' }}
                  />
                ) : (
                  <Search size={18} color={theme.colors.primary} />
                )}
                {(() => {
                  const label = scannedFolder ? scannedFolder.split('/').filter(Boolean).pop() : null;
                  if (scanningHome) return label ? `Searching ${label}…` : 'Searching…';
                  return label ? `Results in ${label}` : 'Search Results';
                })()}
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                disabled={scanningHome}
                title="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: scanningHome ? 'default' : 'pointer',
                  opacity: scanningHome ? 0.4 : 1,
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '12px 20px', overflowY: 'auto' }}>
              {scanError && (
                <div
                  style={{
                    color: theme.colors.error ?? theme.colors.primary,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    padding: '8px 0',
                  }}
                >
                  {scanError}
                </div>
              )}
              {!scanError && !scanningHome && addedRepos.length === 0 && (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontFamily: theme.fonts.body,
                    fontSize: theme.fontSizes[1],
                    padding: '8px 0',
                    textAlign: 'center',
                  }}
                >
                  {totalFoundInFolder === 0
                    ? 'No git repositories found in that folder.'
                    : totalFoundInFolder !== null
                      ? `Found ${totalFoundInFolder} git repositor${totalFoundInFolder === 1 ? 'y' : 'ies'} — all already in your list.`
                      : 'No new repositories found in that folder.'}
                </div>
              )}
              {addedRepos.length > 0 && (
                <>
                  <div
                    style={{
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[0],
                      padding: '4px 0 8px',
                    }}
                  >
                    {(() => {
                      const repoWord = (n: number) =>
                        `repositor${n === 1 ? 'y' : 'ies'}`;
                      const okCount = addedRepos.filter((r) => r.ok).length;
                      const newCount = addedRepos.length;
                      const totalPrefix =
                        totalFoundInFolder !== null
                          ? `Found ${totalFoundInFolder} ${repoWord(totalFoundInFolder)} in this folder. `
                          : '';
                      if (scanningHome) {
                        return `${totalPrefix}Adding ${newCount} new…`;
                      }
                      const alreadyTracked =
                        totalFoundInFolder !== null
                          ? totalFoundInFolder - newCount
                          : null;
                      const tail =
                        alreadyTracked !== null && alreadyTracked > 0
                          ? ` (${alreadyTracked} already in your list)`
                          : '';
                      return `${totalPrefix}Added ${okCount} of ${newCount} new ${repoWord(newCount)}${tail}.`;
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {addedRepos.map((repo) => (
                      <div
                        key={repo.path}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${theme.colors.border}`,
                          background: theme.colors.backgroundSecondary,
                          fontFamily: theme.fonts.body,
                          fontSize: theme.fontSizes[1],
                        }}
                      >
                        {repo.ok ? (
                          <Check size={14} color={theme.colors.primary} />
                        ) : (
                          <X size={14} color={theme.colors.error ?? theme.colors.primary} />
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div
                            style={{
                              color: theme.colors.text,
                              fontWeight: theme.fontWeights.semibold,
                            }}
                          >
                            {repo.name}
                          </div>
                          <div
                            style={{
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {repo.error ? repo.error : repo.path}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderTop: `1px solid ${theme.colors.border}`,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                disabled={scanningHome}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.border}`,
                  background: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  cursor: scanningHome ? 'default' : 'pointer',
                  opacity: scanningHome ? 0.5 : 1,
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global git config modal — opened by clicking the welcome name. */}
      <GitGlobalConfigModal
        isOpen={gitConfigOpen}
        onClose={() => {
          setGitConfigOpen(false);
          // Re-read user.name in case the user edited it in the modal.
          void loadGitUserName();
        }}
      />

    </div>
  );
};

export const TrailsView: React.FC = () => {
  const [selectedProject, setSelectedProject] =
    useState<AlexandriaEntry | null>(null);

  return (
    <TerminalProvider
      repositoryPath={selectedProject?.path ?? ''}
      terminalContext="terminal:trails"
      repoName={selectedProject?.name ?? 'Trails'}
    >
      <TrailsViewInner
        selectedProject={selectedProject}
        onClearProject={() => setSelectedProject(null)}
      />
    </TerminalProvider>
  );
};
