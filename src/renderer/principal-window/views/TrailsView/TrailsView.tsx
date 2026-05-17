import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  X,
  Folder,
  FolderGit2,
  FolderPlus,
  Footprints,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Search,
  Loader2,
  BookOpen,
  Compass,
  Share2,
  Columns2,
  LayoutPanelTop,
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
import type { HighlightLayer } from '@principal-ai/file-city-react';
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
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { TrailPayload } from '@industry-theme/file-city-panel';
import {
  FileCityTrailPanel,
  type TrailBriefLayout,
} from '../../../dev-workspace/file-city-trail-panel';
import { TrailShareModal } from '../../../dev-workspace/trails-panel/TrailShareModal';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { GitGlobalConfigModal } from '../../../components/GitGlobalConfigModal';
import { DIRECTORY_ID_TO_DESTINATION } from '../SkillBrowserView/InstallSkillToolbar';
import { TrailsRecentList } from './TrailsRecentList';
import {
  TrailsRecentHeaders,
  type TrailHeaderRow,
} from './TrailsRecentHeaders';
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
const TRAIL_PROMPT_IDEAS: Array<{
  label: string;
  prompt: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  {
    label: 'Informative trail',
    Icon: BookOpen,
    prompt:
      'Use the author-informative-trail skill in this codebase to lay a canonical trail through <feature or system>.',
  },
  {
    label: 'Investigation trail',
    Icon: Compass,
    prompt:
      'Use the author-investigation-trail skill in this codebase to investigate <question or symptom>.',
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

/**
 * Longest directory prefix shared by every repo-relative `sourcePath` in the
 * set. Returns `''` when paths span multiple top-level folders (no
 * meaningful common parent) or the input is empty. The result is a
 * directory path with no leading or trailing slash — caller appends a
 * trailing `/` for display.
 */
const longestCommonDirPrefix = (paths: Iterable<string>): string => {
  let common: string[] | null = null;
  for (const path of paths) {
    const segs = path.split('/').slice(0, -1); // drop filename
    if (common === null) {
      common = segs;
      continue;
    }
    let i = 0;
    while (i < common.length && i < segs.length && common[i] === segs[i]) i++;
    common = common.slice(0, i);
    if (common.length === 0) break;
  }
  return common && common.length > 0 ? common.join('/') : '';
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
  /**
   * Project the explorer renders. Drives the panel context's repository
   * identity. Independent of `trail` — when no trail is selected we
   * still mount the explorer for this project.
   */
  repositoryPath: string | null;
  /**
   * File tree for `repositoryPath`. Lifted to the parent so the same
   * tree drives both the explorer city and the aggregate-coverage stat
   * rendered in the toolbar.
   */
  fileTree: FileTree | null;
  /**
   * Aggregate highlight layers the parent computed from every trail in
   * the active project — one per purpose (investigation, informative).
   * Only consumed when no trail is selected — once a trail loads the
   * panel derives its own marker-based layers and ignores this slice.
   */
  aggregateHighlightLayers: HighlightLayer[] | null;
  trail: TrailIndexEntry | null;
  payload: TrailPayload | null;
  loading: boolean;
  events: PanelEventEmitter;
  /**
   * Forwarded to the panel as `FileCityTrailExplorerPanelActions.closeTrail`
   * so the explorer's built-in close button can ask the host to deselect
   * the trail. No standalone header — the panel owns the chrome.
   */
  onCloseTrail: () => void;
  /**
   * Forwarded to the panel as `FileCityTrailExplorerPanelActions.shareTrail`
   * so the brief card's Share button can open the host's share modal.
   * Returning a promise lets the card animate in-flight + result state.
   */
  onShareTrail?: () => void | Promise<void>;
  /**
   * Brief layout the host wants the panel to render. Flips live — the
   * upstream panel reads this on every render, so the toggle button in the
   * preview-header toolbar swaps layouts in place without remount.
   */
  briefLayout: TrailBriefLayout;
}> = ({
  repositoryPath,
  fileTree,
  aggregateHighlightLayers,
  trail,
  payload,
  loading,
  events,
  onCloseTrail,
  onShareTrail,
  briefLayout,
}) => {
  const { theme } = useTheme();

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
      // Idle-state aggregate layers. The upstream panel only honors
      // this when `trail.data` is null; once a trail is active the panel
      // builds its own marker-derived layers from the payload.
      highlightLayers: {
        scope: 'repository' as const,
        name: 'highlightLayers',
        data: aggregateHighlightLayers,
        loading: false,
        error: null,
        refresh: async () => {},
      } as DataSlice<HighlightLayer[] | null>,
    }),
    [
      repositoryPath,
      repoName,
      fileTree,
      payload,
      loading,
      aggregateHighlightLayers,
    ],
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
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Keep the panel mounted across trail clicks so the city doesn't
            rebuild every time. Repo switches still force a clean remount via
            the keyed identity below; trail-to-trail clicks just stream a
            new context in, and the loading overlay floats on top while the
            payload IPC resolves. */}
        <FileCityTrailPanel
          // Key only on repo identity, not on selected trail. Trail-to-trail
          // clicks update in place; repo switches force a clean remount so
          // the upstream explorer's internal scene (camera, hover, selected
          // marker) can't carry highlights from the previous repo's city
          // into the new one.
          key={`explorer:${repositoryPath ?? 'none'}`}
          context={panelContext}
          actions={{}}
          events={events}
          onCloseTrail={onCloseTrail}
          onShareTrail={onShareTrail}
          briefLayout={briefLayout}
        />
        {trail && (loading || !payload) && (
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
              // Translucent veil so the still-mounted city shows through
              // and the user can see the panel is the same instance, just
              // waiting on the new trail's payload.
              backgroundColor: `color-mix(in srgb, ${theme.colors.background} 70%, transparent)`,
              pointerEvents: 'none',
            }}
          >
            <Loader2
              size={16}
              style={{ animation: 'trails-spin 1s linear infinite' }}
            />
            <style>{`@keyframes trails-spin { to { transform: rotate(360deg); } }`}</style>
            Loading preview…
          </div>
        )}
      </div>
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
  bootstrapTrailId: string | null;
}> = ({ selectedProject, onClearProject, bootstrapTrailId }) => {
  const { theme } = useTheme();

  const events = useMemo(() => new PanelEventBus(), []);
  const { context: terminalCtx, actions: terminalActions } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local Alexandria entries
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [reposLoading, setReposLoading] = useState(true);

  // Tab state for the TabbedTerminalPanel — one tab per opened project.
  // The panel only reads `initialTabs` on mount, so we bump `remountKey` to
  // remount the panel when we add a tab. Existing terminal sessions reconnect
  // via their tab-id-keyed `terminalContext` so processes are preserved.
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const [remountKey] = useState(0);

  // Top-level view for the trails landing. 'landing' shows the trail-prompt
  // ideas + Add Project + View Recent Trails buttons. 'recent' replaces it
  // with a 2-day grid of trail cards bucketed by updatedAt day, plus a
  // 3-track preview pane. Starts on 'recent' when IntegratedShell handed us
  // a `bootstrapTrailId` (cold-start URL hash or warm-start SHOW_IN_PRINCIPAL
  // IPC) so the activated trail lands in the grid instead of behind the
  // landing screen.
  const [viewMode, setViewMode] = useState<'landing' | 'recent'>(() =>
    bootstrapTrailId ? 'recent' : 'landing',
  );

  // If `bootstrapTrailId` changes while we're mounted (e.g. user switched
  // away from TrailsView, then a warm-start SHOW_IN_PRINCIPAL arrived and
  // brought us back), flip to Recent again.
  useEffect(() => {
    if (bootstrapTrailId) {
      setViewMode('recent');
    }
  }, [bootstrapTrailId]);

  // Free-text filter applied inside Recent mode. Trails that don't match
  // are dropped before bucketing, so empty columns surface naturally.
  const [recentFilter, setRecentFilter] = useState('');

  // Purpose filter — narrows the Recent feed to one trail purpose. `'all'`
  // (the default) shows both. Only the two purposes the app actually
  // produces are exposed (investigation, informative); changelog exists
  // in the upstream schema but isn't authored from this host.
  const [purposeFilter, setPurposeFilter] = useState<
    'all' | 'investigation' | 'informative'
  >('all');

  // Recent-feed display mode. `'cards'` is the existing per-trail list; `'headers'`
  // pivots the same filtered set into an aggregate of top-level sequence-diagram
  // lane namespaces (one row per unique header) so the user can spot overlap
  // and candidate groupings across trails.
  const [recentDisplayMode, setRecentDisplayMode] = useState<
    'cards' | 'headers'
  >('cards');

  // Area selection inside the headers view. When set, the city's highlight
  // layer narrows to just the files referenced by markers whose top-level
  // lane matches this header. Mutually exclusive with `previewTrail` — area
  // scoping is for cross-trail aggregate exploration, single-trail preview
  // is for one specific trail.
  const [selectedAreaHeader, setSelectedAreaHeader] = useState<string | null>(
    null,
  );

  // Pointer-hovered area card. Drives a transient folder-border layer on
  // the city outlining the hovered area's common parent so the user can
  // see "this part of the repo" without committing to a click.
  const [hoveredAreaHeader, setHoveredAreaHeader] = useState<string | null>(
    null,
  );

  // Pointer-hovered trail row (inside an expanded area card). Drives a
  // transient per-trail fill layer on the city showing just that trail's
  // marker source paths — preview-without-click.
  const [hoveredTrailId, setHoveredTrailId] = useState<string | null>(null);

  // Project filter — Recent view only ever shows trails for one project at
  // a time. The right pane uses this project to drive the file tree the
  // explorer renders when no trail is selected. `null` means "no project
  // available yet" (e.g. no trails loaded); the auto-select effect below
  // promotes the most-recent trail's repo to selected once we have data.
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(
    null,
  );

  // Trail card clicked in Recent view — its full payload renders in the
  // right preview pane (TrailBriefModal). Clicking Start on the
  // modal opens the dev workspace; dismissing it clears the selection.
  const [previewTrail, setPreviewTrail] = useState<TrailIndexEntry | null>(null);

  // Share-modal state. Opened from the explorer brief card's Share button —
  // the modal owns the actual API call (TrailShareService.share) and the
  // sharing → success (copy link / open in browser) UX.
  const [shareModalTrail, setShareModalTrail] =
    useState<TrailIndexEntry | null>(null);
  const handleShareActiveTrail = useCallback(() => {
    if (!previewTrail) return;
    setShareModalTrail(previewTrail);
  }, [previewTrail]);
  const [previewPayload, setPreviewPayload] = useState<TrailPayload | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);

  // Brief layout for the preview-pane explorer. The upstream panel reads
  // `briefLayout` inline on every render (no internal useState for it),
  // so toggling here re-lays-out the brief without remounting the city.
  const [previewBriefLayout, setPreviewBriefLayout] =
    useState<TrailBriefLayout>('three-zone');

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
  // toolbar (next to the Back button) rather than over the preview pane.
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
  const [createTrailModalOpen, setCreateTrailModalOpen] = useState(false);
  const [createTrailModalClosing, setCreateTrailModalClosing] = useState(false);
  const closeCreateTrailModal = useCallback(() => {
    setCreateTrailModalClosing(true);
    window.setTimeout(() => {
      setCreateTrailModalOpen(false);
      setCreateTrailModalClosing(false);
    }, 180);
  }, []);
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

  // When the window was opened/routed with a bootstrap trail id, steer the
  // project filter to that trail's repo so its card is visible. Preview
  // selection is handled by the project-change effect below, which also
  // restores the bootstrap pick after clearing — colocating both halves
  // avoids racing against its setPreviewTrail(null).
  useEffect(() => {
    if (!bootstrapTrailId || recentTrails.length === 0) return;
    const entry = recentTrails.find((t) => t.id === bootstrapTrailId);
    if (!entry?.repositoryPath) return;
    if (entry.repositoryPath !== selectedProjectPath) {
      setSelectedProjectPath(entry.repositoryPath);
    }
    // selectedProjectPath intentionally omitted — we only steer it when the
    // bootstrap fires, not on every user-driven project change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapTrailId, recentTrails]);

  // Distinct projects across the Recent feed, ordered by their newest
  // trail's updatedAt. Trails without a `repositoryPath` are skipped —
  // they can't be filtered to a single project and currently have no
  // file tree to feed the explorer.
  const recentProjects = useMemo(() => {
    const seen = new Map<string, { path: string; label: string; ownerLogin?: string }>();
    for (const trail of recentTrails) {
      if (!trail.repositoryPath || seen.has(trail.repositoryPath)) continue;
      const entry = repositories.find((r) => r.path === trail.repositoryPath);
      seen.set(trail.repositoryPath, {
        path: trail.repositoryPath,
        label: trailRepoLabel(trail.repositoryPath),
        ownerLogin: entry?.github?.owner,
      });
    }
    return Array.from(seen.values());
  }, [recentTrails, repositories]);

  // Auto-pick the most-recent project once trails load, and re-pick when
  // the current selection disappears (e.g. last trail in that project
  // was deleted). Honors a user's manual pick otherwise.
  useEffect(() => {
    if (recentProjects.length === 0) {
      if (selectedProjectPath !== null) setSelectedProjectPath(null);
      return;
    }
    const stillExists = recentProjects.some(
      (p) => p.path === selectedProjectPath,
    );
    if (!stillExists) {
      setSelectedProjectPath(recentProjects[0].path);
    }
  }, [recentProjects, selectedProjectPath]);

  // File tree for the active project, paired with its repo path. Cache-
  // only fetch — if the repo has been opened anywhere in the app, the
  // tree is warm. Lifted out of the preview pane so the aggregate-
  // coverage stat in the toolbar can share the same fetch.
  //
  // The path is held alongside the tree so derivations (coverage
  // path set, highlight layer, coverage badge) can guard against the
  // window where `selectedProjectPath` has flipped to the new repo but
  // the matching tree hasn't resolved yet. Without the guard we'd
  // briefly render the new repo's marker paths against the old repo's
  // tree, lighting up an unrelated subset of buildings.
  const [projectFileTreeState, setProjectFileTreeState] = useState<{
    path: string;
    tree: FileTree;
  } | null>(null);
  useEffect(() => {
    if (!selectedProjectPath) {
      setProjectFileTreeState(null);
      return;
    }
    let cancelled = false;
    void RepositoryMonitoringService.getFileTree(selectedProjectPath).then(
      (tree) => {
        if (cancelled) return;
        if (tree) {
          setProjectFileTreeState({ path: selectedProjectPath, tree });
        } else {
          setProjectFileTreeState(null);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedProjectPath]);

  // Tree shown to the explorer + used by every coverage derivation. Only
  // exposes the tree when its paired path matches the active project.
  const projectFileTree =
    projectFileTreeState?.path === selectedProjectPath
      ? projectFileTreeState.tree
      : null;

  // Lazy-loaded payloads for every trail in the active project. Drives the
  // idle-state aggregate highlight layer (every sourcePath across every
  // saved trail) and the "N files · P% of repo" coverage badge.
  const [aggregatePayloads, setAggregatePayloads] = useState<
    Map<string, TrailPayload>
  >(() => new Map());
  useEffect(() => {
    if (!selectedProjectPath) return;
    const targetIds = recentTrails
      .filter((t) => t.repositoryPath === selectedProjectPath)
      .map((t) => t.id);
    const missing = targetIds.filter((id) => !aggregatePayloads.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        missing.map(
          async (id) => [id, await TrailLibraryService.load(id)] as const,
        ),
      );
      if (cancelled) return;
      setAggregatePayloads((prev) => {
        const next = new Map(prev);
        for (const [id, payload] of results) {
          if (payload) next.set(id, payload);
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [recentTrails, selectedProjectPath, aggregatePayloads]);

  // Distinct sourcePaths covered by every loaded payload in the active
  // project, split by purpose. Trails whose payload hasn't loaded yet
  // contribute nothing — the sets grow as IPC resolves. Returns empty
  // until the paired tree matches the active project so a stale repo's
  // paths can't feed the layers during a switch.
  //
  // Split so the city can render two layers (one per purpose) with
  // informative taking precedence when a file appears in both.
  const coverageByPurpose = useMemo(() => {
    if (!projectFileTree || !selectedProjectPath) {
      return {
        informative: new Set<string>(),
        investigation: new Set<string>(),
      };
    }
    const informative = new Set<string>();
    const investigation = new Set<string>();
    for (const trail of recentTrails) {
      if (trail.repositoryPath !== selectedProjectPath) continue;
      const effective = trail.purpose ?? 'investigation';
      const target =
        effective === 'informative'
          ? informative
          : effective === 'investigation'
            ? investigation
            : null;
      if (!target) continue;
      const payload = aggregatePayloads.get(trail.id);
      if (!payload) continue;
      for (const marker of payload.markers) {
        if (marker.sourcePath) target.add(marker.sourcePath);
      }
    }
    return { informative, investigation };
  }, [recentTrails, selectedProjectPath, aggregatePayloads, projectFileTree]);

  // Union of both purposes — drives the coverage badge ("N files / M
  // total"). Counts a file once even if it's in both an informative and
  // an investigation trail.
  const coveragePathSet = useMemo(() => {
    const set = new Set<string>(coverageByPurpose.informative);
    for (const p of coverageByPurpose.investigation) set.add(p);
    return set;
  }, [coverageByPurpose]);

  // Coverage stats for the toolbar badge. Filters covered paths against
  // the file tree so stale marker paths from a renamed file don't inflate
  // the count. `null` until the paired tree resolves for the active
  // project — keeps the badge from flashing the wrong repo's count.
  const coverageStats = useMemo(() => {
    if (!projectFileTree) return null;
    const total = projectFileTree.stats.totalFiles;
    const treePaths = new Set(
      projectFileTree.allFiles.map((f) => f.relativePath),
    );
    let covered = 0;
    for (const p of coveragePathSet) {
      if (treePaths.has(p)) covered += 1;
    }
    const pct = total > 0 ? (covered / total) * 100 : 0;
    return { covered, total, pct };
  }, [projectFileTree, coveragePathSet]);

  // Two highlight layers fed to the explorer when no trail is selected.
  // Investigation paints first (lower priority); informative paints on
  // top so files covered by both show up as informative. Colors match
  // the per-purpose accents used by `TrailCard`.
  const aggregateHighlightLayers = useMemo<HighlightLayer[] | null>(() => {
    if (!projectFileTree) return null;
    const treePaths = new Set(
      projectFileTree.allFiles.map((f) => f.relativePath),
    );
    const informativePaths: string[] = [];
    for (const path of coverageByPurpose.informative) {
      if (treePaths.has(path)) informativePaths.push(path);
    }
    const investigationOnlyPaths: string[] = [];
    const informativeSet = coverageByPurpose.informative;
    for (const path of coverageByPurpose.investigation) {
      if (!treePaths.has(path)) continue;
      if (informativeSet.has(path)) continue;
      investigationOnlyPaths.push(path);
    }
    const layers: HighlightLayer[] = [];
    if (investigationOnlyPaths.length > 0) {
      layers.push({
        id: 'trails-aggregate-investigation',
        name: 'Files covered by investigation trails',
        enabled: true,
        color: '#a855f7',
        opacity: 0.45,
        priority: 10,
        items: investigationOnlyPaths.map((path) => ({
          path,
          type: 'file',
          renderStrategy: 'fill',
        })),
      });
    }
    if (informativePaths.length > 0) {
      layers.push({
        id: 'trails-aggregate-informative',
        name: 'Files covered by informative trails',
        enabled: true,
        color: theme.colors.success ?? '#10b981',
        opacity: 0.55,
        priority: 20,
        items: informativePaths.map((path) => ({
          path,
          type: 'file',
          renderStrategy: 'fill',
        })),
      });
    }
    return layers.length > 0 ? layers : null;
  }, [coverageByPurpose, projectFileTree, theme.colors.success]);

  // Clear the preview when the project changes so we don't show a trail
  // from a different repo in the right pane. When a bootstrap trail belongs
  // to the new project, restore it as the preview selection instead of
  // clearing — this is how the bridge-routed activate lands selected.
  useEffect(() => {
    if (bootstrapTrailId) {
      const entry = recentTrails.find((t) => t.id === bootstrapTrailId);
      if (entry && entry.repositoryPath === selectedProjectPath) {
        setPreviewTrail((current) =>
          current?.id === entry.id ? current : entry,
        );
        return;
      }
    }
    setPreviewTrail(null);
  }, [selectedProjectPath, bootstrapTrailId, recentTrails]);

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
      // Project filter: only show trails for the active project. When no
      // project is selected (no trails yet), the loop produces no groups.
      if (!selectedProjectPath || trail.repositoryPath !== selectedProjectPath) {
        continue;
      }
      // Purpose filter. Per upstream schema, `undefined` purpose is
      // treated as `'investigation'` — match that here so legacy entries
      // still surface under the investigation filter. `'all'` skips the
      // check entirely.
      if (purposeFilter !== 'all') {
        const effective = trail.purpose ?? 'investigation';
        if (effective !== purposeFilter) continue;
      }
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
  }, [recentTrails, recentFilter, selectedProjectPath, purposeFilter]);

  // Flattened, date-ordered list of trails currently visible in Recent. The
  // headers view aggregates over this same set so toggling Cards↔Headers
  // doesn't change what's "in scope" — only how it's grouped.
  const filteredRecentTrails = useMemo(() => {
    const flat: TrailIndexEntry[] = [];
    for (const g of trailDayGroups) flat.push(...g.trails);
    return flat;
  }, [trailDayGroups]);

  // Aggregate top-level sequence-diagram lane namespaces across the filtered
  // trails. Walks each trail's sequence views once and, for every marker that
  // resolves to an area, records (a) the contributing trail and (b) the
  // marker's `sourcePath`. The same pass feeds the cards' file-count + common-
  // parent subtitle, the selected-area fill layer, and the hover-area border
  // layer — keeping marker iteration single-pass.
  //
  // Each marker contributes one header — its `participant` override when set,
  // otherwise the first dotted segment of `name`. First-class `actors[]`
  // entries also count (they may have no markers and thus no files, but they
  // still show up as a row with `fileCount: 0`). Rows are sorted by trail-
  // count desc so the most-shared headers (the candidates for grouping) float
  // to the top.
  const { recentHeaderRows, areaFilesByHeader } = useMemo<{
    recentHeaderRows: TrailHeaderRow[];
    areaFilesByHeader: Map<string, Set<string>>;
  }>(() => {
    if (recentDisplayMode !== 'headers') {
      return { recentHeaderRows: [], areaFilesByHeader: new Map() };
    }
    const headerToTrails = new Map<string, TrailIndexEntry[]>();
    // header → path → trailId → { trail; steps }. The step set captures the
    // marker names (e.g. `auth.validation.started`) that point at this
    // path inside the trail, so when a path goes stale we can surface
    // exactly which sequence steps need repointing.
    type TrailRefAtPath = { trail: TrailIndexEntry; steps: Set<string> };
    const headerToPathTrails = new Map<
      string,
      Map<string, Map<string, TrailRefAtPath>>
    >();
    const ensureHeader = (header: string) => {
      if (!headerToPathTrails.has(header))
        headerToPathTrails.set(header, new Map());
    };
    for (const trail of filteredRecentTrails) {
      const payload = aggregatePayloads.get(trail.id);
      if (!payload) continue;
      const markerById = new Map<string, string | undefined>();
      for (const m of payload.markers) markerById.set(m.id, m.sourcePath);
      const seenThisTrail = new Set<string>();
      for (const view of payload.views ?? []) {
        if (view.kind !== 'sequence') continue;
        for (const marker of view.markers) {
          const laneId = marker.participant || marker.name;
          if (!laneId) continue;
          const top = laneId.split('.')[0];
          if (!top) continue;
          seenThisTrail.add(top);
          ensureHeader(top);
          const sourcePath = markerById.get(marker.markerId);
          if (sourcePath) {
            const byPath = headerToPathTrails.get(top)!;
            let trailMap = byPath.get(sourcePath);
            if (!trailMap) {
              trailMap = new Map();
              byPath.set(sourcePath, trailMap);
            }
            let ref = trailMap.get(trail.id);
            if (!ref) {
              ref = { trail, steps: new Set() };
              trailMap.set(trail.id, ref);
            }
            // Step label is the marker's namespaced name when available,
            // falling back to the participant override. Either is unique
            // enough to locate the marker in the sequence diagram.
            const step = marker.name || marker.participant;
            if (step) ref.steps.add(step);
          }
        }
        for (const actor of view.actors ?? []) {
          const top = actor.name.split('.')[0];
          if (!top) continue;
          seenThisTrail.add(top);
          ensureHeader(top);
        }
      }
      for (const header of seenThisTrail) {
        const list = headerToTrails.get(header);
        if (list) list.push(trail);
        else headerToTrails.set(header, [trail]);
      }
    }
    // Split each area's referenced paths into live (present in the project's
    // file tree) and stale (renamed/deleted). When the tree hasn't resolved
    // yet we treat everything as live so the badge doesn't flash a false
    // positive during initial load.
    const treePaths = projectFileTree
      ? new Set(projectFileTree.allFiles.map((f) => f.relativePath))
      : null;
    const filesByHeader = new Map<string, Set<string>>();
    const rows: TrailHeaderRow[] = Array.from(headerToTrails.entries()).map(
      ([header, trails]) => {
        const byPath = headerToPathTrails.get(header);
        const live = new Set<string>();
        // Pivot the path-centric stale entries into trail-centric ones so
        // the chip list can render each offending trail with its specific
        // missing (path, step) pairs.
        const stalePerTrail = new Map<
          string,
          {
            trail: TrailIndexEntry;
            missing: Array<{ path: string; steps: string[] }>;
          }
        >();
        let staleCount = 0;
        if (byPath) {
          for (const [path, trailMap] of byPath) {
            const isLive = !treePaths || treePaths.has(path);
            if (isLive) {
              live.add(path);
              continue;
            }
            staleCount++;
            for (const ref of trailMap.values()) {
              let bucket = stalePerTrail.get(ref.trail.id);
              if (!bucket) {
                bucket = { trail: ref.trail, missing: [] };
                stalePerTrail.set(ref.trail.id, bucket);
              }
              bucket.missing.push({
                path,
                steps: Array.from(ref.steps).sort(),
              });
            }
          }
        }
        const staleByTrail = Array.from(stalePerTrail.values());
        for (const entry of staleByTrail) {
          entry.missing.sort((a, b) => a.path.localeCompare(b.path));
        }
        // Trails with the most broken pointers go first — that's the
        // workset that needs the most attention.
        staleByTrail.sort((a, b) => {
          if (b.missing.length !== a.missing.length)
            return b.missing.length - a.missing.length;
          return (a.trail.title ?? '').localeCompare(b.trail.title ?? '');
        });
        filesByHeader.set(header, live);
        return {
          header,
          trails,
          commonParent: longestCommonDirPrefix(live),
          fileCount: live.size,
          staleFileCount: staleCount,
          staleByTrail,
        };
      },
    );
    rows.sort((a, b) => {
      if (b.trails.length !== a.trails.length)
        return b.trails.length - a.trails.length;
      return a.header.localeCompare(b.header);
    });
    return { recentHeaderRows: rows, areaFilesByHeader: filesByHeader };
  }, [
    filteredRecentTrails,
    aggregatePayloads,
    recentDisplayMode,
    projectFileTree,
  ]);

  // Files referenced by markers in the selected area. Reads the cached set
  // `areaFilesByHeader` produced by the headers memo above so we don't walk
  // payloads twice. Returns null when no area is selected (panel falls back
  // to the cross-purpose aggregate).
  const selectedAreaHighlightLayers = useMemo<HighlightLayer[] | null>(() => {
    if (!selectedAreaHeader) return null;
    const paths = areaFilesByHeader.get(selectedAreaHeader);
    if (!paths || paths.size === 0) return null;
    // Color follows the active purpose so the visual continues to read as
    // "trails of this purpose, narrowed to one area" rather than a new
    // unrelated layer. In `'all'` mode we fall back to the theme accent so
    // the layer reads as "area scope" without claiming a purpose.
    const color =
      purposeFilter === 'informative'
        ? theme.colors.success ?? '#10b981'
        : purposeFilter === 'investigation'
          ? '#a855f7'
          : theme.colors.primary ?? '#3b82f6';
    return [
      {
        id: `trails-area-${selectedAreaHeader}`,
        name: `Files in area "${selectedAreaHeader}"`,
        enabled: true,
        color,
        opacity: 0.55,
        priority: 30,
        items: Array.from(paths).map((path) => ({
          path,
          type: 'file',
          renderStrategy: 'fill',
        })),
      },
    ];
  }, [
    selectedAreaHeader,
    areaFilesByHeader,
    purposeFilter,
    theme.colors.success,
    theme.colors.primary,
  ]);

  // Transient fill layer for the hovered trail row. Reads the trail's
  // payload from the same `aggregatePayloads` cache the headers memo uses,
  // collects every marker `sourcePath` filtered against the project's file
  // tree, and emits a single fill layer in the trail's purpose color. The
  // upstream panel ignores aggregate layers once a trail preview is active,
  // so this layer never fights the panel's own per-trail layers — it only
  // shows when no trail is previewed yet.
  const hoveredTrailHighlightLayer = useMemo<HighlightLayer | null>(() => {
    if (recentDisplayMode !== 'headers') return null;
    if (!hoveredTrailId || !projectFileTree) return null;
    const payload = aggregatePayloads.get(hoveredTrailId);
    if (!payload) return null;
    const trail = recentTrails.find((t) => t.id === hoveredTrailId);
    if (!trail) return null;
    const treePaths = new Set(
      projectFileTree.allFiles.map((f) => f.relativePath),
    );
    const paths = new Set<string>();
    for (const marker of payload.markers) {
      const p = marker.sourcePath;
      if (p && treePaths.has(p)) paths.add(p);
    }
    if (paths.size === 0) return null;
    // Match the trail row's purpose chip color so the city visual reads
    // as "this exact trail." Mirrors `purposeChipColor` in
    // TrailsRecentHeaders to avoid a cross-package import.
    const effective = trail.purpose ?? 'investigation';
    const color =
      effective === 'informative'
        ? (trail.signOffCount ?? 0) > 0
          ? theme.colors.success ?? '#10b981'
          : theme.colors.textTertiary
        : effective === 'changelog'
          ? '#f97316'
          : '#a855f7';
    return {
      id: `trails-trail-hover-${hoveredTrailId}`,
      name: `Hovered trail "${trail.title ?? hoveredTrailId}"`,
      enabled: true,
      color,
      opacity: 0.6,
      // Slightly above the area-fill (priority 30) so the hovered trail
      // visually sits on top of the area scope it lives within.
      priority: 35,
      dynamic: true,
      items: Array.from(paths).map((path) => ({
        path,
        type: 'file',
        renderStrategy: 'fill',
      })),
    };
  }, [
    recentDisplayMode,
    hoveredTrailId,
    aggregatePayloads,
    recentTrails,
    projectFileTree,
    theme.colors.success,
    theme.colors.textTertiary,
  ]);

  // Transient folder-border layer for the hovered area card. Pulled from
  // the cached headers memo's common-parent map; renders a single
  // `type: 'directory'` item with `renderStrategy: 'border'` so the city
  // outlines that part of the repo for as long as the pointer sits on the
  // card. Suppressed when the hovered area has no meaningful common parent
  // (files span multiple top-level folders) since a root-level border
  // wouldn't tell the user anything new.
  const hoveredAreaBorderLayer = useMemo<HighlightLayer | null>(() => {
    if (recentDisplayMode !== 'headers') return null;
    if (!hoveredAreaHeader) return null;
    const row = recentHeaderRows.find((r) => r.header === hoveredAreaHeader);
    if (!row || !row.commonParent) return null;
    const accent = theme.colors.primary ?? '#3b82f6';
    return {
      id: `trails-area-hover-${hoveredAreaHeader}`,
      name: `Hovered area "${hoveredAreaHeader}" common parent`,
      enabled: true,
      color: accent,
      // High priority so the border draws above the aggregate / selected
      // fills. `borderWidth` is a hint to the renderer (falls back if not
      // honored on the current strategy).
      priority: 40,
      borderWidth: 2,
      // Hovered layers change every pointer event — flag as dynamic so the
      // renderer can skip layout caches built for the steady-state layers.
      dynamic: true,
      items: [
        {
          path: row.commonParent,
          type: 'directory',
          renderStrategy: 'border',
        },
      ],
    };
  }, [
    recentDisplayMode,
    hoveredAreaHeader,
    recentHeaderRows,
    theme.colors.primary,
  ]);

  // What the preview pane actually consumes: area-scoped layer when an area
  // is selected, otherwise the cross-purpose aggregate. Note the branch on
  // `selectedAreaHeader` (not `selectedAreaHighlightLayers`): an area that
  // resolves to zero files must still suppress the aggregate, otherwise an
  // empty area would visually look like "no selection" and show every
  // highlight. The hovered-area border layer composes on top of either base.
  // The panel still ignores both once a trail is previewed (it builds its
  // own per-trail layers from the payload).
  const effectiveHighlightLayers = useMemo<HighlightLayer[] | null>(() => {
    const base = selectedAreaHeader
      ? selectedAreaHighlightLayers
      : aggregateHighlightLayers;
    const extras: HighlightLayer[] = [];
    if (hoveredTrailHighlightLayer) extras.push(hoveredTrailHighlightLayer);
    if (hoveredAreaBorderLayer) extras.push(hoveredAreaBorderLayer);
    if (extras.length === 0) return base;
    return [...(base ?? []), ...extras];
  }, [
    selectedAreaHeader,
    selectedAreaHighlightLayers,
    aggregateHighlightLayers,
    hoveredTrailHighlightLayer,
    hoveredAreaBorderLayer,
  ]);

  // Clear the area scope when the headers view goes away or the selected
  // header drops out of the current row set (e.g. user changed project,
  // purpose, or text filter). Without this the city would keep highlighting
  // an area the user can no longer see in the list.
  useEffect(() => {
    if (!selectedAreaHeader) return;
    if (recentDisplayMode !== 'headers') {
      setSelectedAreaHeader(null);
      return;
    }
    const stillVisible = recentHeaderRows.some(
      (row) => row.header === selectedAreaHeader,
    );
    if (!stillVisible) setSelectedAreaHeader(null);
  }, [recentDisplayMode, recentHeaderRows, selectedAreaHeader]);

  // Clear pointer-hover state on the same boundary conditions — leaving
  // headers mode unmounts the cards and the row's `onMouseLeave` never
  // fires, so the hover-border layer would stick.
  useEffect(() => {
    if (!hoveredAreaHeader) return;
    if (recentDisplayMode !== 'headers') {
      setHoveredAreaHeader(null);
      return;
    }
    const stillVisible = recentHeaderRows.some(
      (row) => row.header === hoveredAreaHeader,
    );
    if (!stillVisible) setHoveredAreaHeader(null);
  }, [recentDisplayMode, recentHeaderRows, hoveredAreaHeader]);

  // Same cleanup for hovered-trail state — trail rows live inside expanded
  // area cards, so when the user collapses an area or leaves headers mode
  // the row unmounts mid-hover and `onMouseLeave` never fires.
  useEffect(() => {
    if (!hoveredTrailId) return;
    if (recentDisplayMode !== 'headers') {
      setHoveredTrailId(null);
    }
  }, [recentDisplayMode, hoveredTrailId]);

  // How many filtered trails still need a payload load. Surfaces under the
  // headers list so users know rows may still reshuffle as IPC resolves.
  const recentHeaderPendingCount = useMemo(() => {
    if (recentDisplayMode !== 'headers') return 0;
    let pending = 0;
    for (const trail of filteredRecentTrails) {
      if (!aggregatePayloads.has(trail.id)) pending++;
    }
    return pending;
  }, [filteredRecentTrails, aggregatePayloads, recentDisplayMode]);

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

      {/* Trail prompt ideas — the landing screen whenever no project is */}
      {/* selected. Hidden only while the user is browsing the recent feed. */}
      {!selectedProject &&
        skillInstalled === true &&
        !reposLoading &&
        !recentTrailsLoading &&
        viewMode !== 'recent' && (
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
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'stretch',
                justifyContent: 'center',
                gap: 24,
              }}
            >
              <style>{`
                .trail-idea-card {
                  border-color: transparent !important;
                  transition: border-color 150ms ease;
                }
                .trail-idea-card:hover {
                  border-color: ${theme.colors.primary} !important;
                }
                .trail-idea-copy {
                  opacity: 0;
                  transition: opacity 150ms ease;
                }
                .trail-idea-card:hover .trail-idea-copy,
                .trail-idea-copy.is-copied {
                  opacity: 1;
                }
                @keyframes trails-spin { to { transform: rotate(360deg); } }
              `}</style>

              {hasRecentTrails ? (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    title="Pick a starting point for a new trail"
                    className="trail-idea-card"
                    onClick={() => setCreateTrailModalOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCreateTrailModalOpen(true);
                      }
                    }}
                    style={{
                      position: 'relative',
                      flex: '0 1 300px',
                      width: '100%',
                      maxWidth: 300,
                      aspectRatio: '4 / 3',
                      padding: '20px 22px',
                      borderRadius: 10,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={56} color={theme.colors.primary} />
                    <div
                      style={{
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[2],
                        fontWeight: theme.fontWeights.semibold,
                        color: theme.colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Create a Trail
                    </div>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    title="Browse trails you've recently laid"
                    className="trail-idea-card"
                    onClick={() => setViewMode('recent')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setViewMode('recent');
                      }
                    }}
                    style={{
                      position: 'relative',
                      flex: '0 1 300px',
                      width: '100%',
                      maxWidth: 300,
                      aspectRatio: '4 / 3',
                      padding: '20px 22px',
                      borderRadius: 10,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <Footprints size={56} color={theme.colors.primary} />
                    <div
                      style={{
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[2],
                        fontWeight: theme.fontWeights.semibold,
                        color: theme.colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Recent Trails
                    </div>
                  </div>
                </>
              ) : (
                TRAIL_PROMPT_IDEAS.map((idea, i) => {
                  const isCopied = copiedPromptIndex === i;
                  return (
                    <div
                      key={idea.label}
                      className="trail-idea-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleCopyPrompt(idea.prompt, i)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleCopyPrompt(idea.prompt, i);
                        }
                      }}
                      style={{
                        position: 'relative',
                        flex: '0 1 300px',
                        width: '100%',
                        maxWidth: 300,
                        aspectRatio: '4 / 3',
                        padding: '20px 22px',
                        borderRadius: 10,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        gap: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <idea.Icon size={32} color={theme.colors.primary} />
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
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyPrompt(idea.prompt, i);
                        }}
                        title={isCopied ? 'Copied' : 'Copy prompt'}
                        className={
                          isCopied
                            ? 'trail-idea-copy is-copied'
                            : 'trail-idea-copy'
                        }
                        style={{
                          position: 'absolute',
                          top: 10,
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
                })
              )}
            </div>
          </div>
        )}


      {/* Recent-trails overlay — entered from the landing screen's */}
      {/* "View Recent Trails" button. Covers the panel until the user */}
      {/* navigates back. */}
      {!selectedProject &&
        skillInstalled === true &&
        !recentTrailsLoading &&
        viewMode === 'recent' && (
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
          {/* Content section — hosts the recent-trails grid. */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 24,
              paddingLeft: 24,
              paddingRight: 24,
              paddingBottom: 24,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 1,
              minHeight: 0,
            }}
          >
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
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      maxWidth: 280,
                    }}
                  >
                    <FolderGit2
                      size={14}
                      color={theme.colors.textSecondary}
                    />
                    <select
                      value={selectedProjectPath ?? ''}
                      onChange={(e) =>
                        setSelectedProjectPath(e.target.value || null)
                      }
                      disabled={recentProjects.length === 0}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        cursor:
                          recentProjects.length === 0
                            ? 'default'
                            : 'pointer',
                        minWidth: 0,
                      }}
                    >
                      {recentProjects.length === 0 ? (
                        <option value="">No projects with trails</option>
                      ) : (
                        recentProjects.map((p) => (
                          <option key={p.path} value={p.path}>
                            {p.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  {/* Purpose dropdown. `All` (the default) shows every trail
                      regardless of purpose; the two specific options narrow
                      the feed and recolor the area-highlight layer to match
                      the chosen purpose. */}
                  <div
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor:
                          purposeFilter === 'informative'
                            ? theme.colors.success ?? '#10b981'
                            : purposeFilter === 'investigation'
                              ? '#a855f7'
                              : theme.colors.textTertiary,
                      }}
                    />
                    <select
                      aria-label="Trail purpose"
                      value={purposeFilter}
                      onChange={(e) =>
                        setPurposeFilter(
                          e.target.value as
                            | 'all'
                            | 'investigation'
                            | 'informative',
                        )
                      }
                      style={{
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        cursor: 'pointer',
                      }}
                    >
                      <option value="all">All</option>
                      <option value="informative">Informative</option>
                      <option value="investigation">Investigations</option>
                    </select>
                  </div>
                  {coverageStats && (
                    <div
                      title={`${coverageStats.covered} of ${coverageStats.total} files in this project are touched by at least one saved trail`}
                      style={{
                        flex: '0 0 auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.textSecondary,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: theme.colors.text }}>
                        {coverageStats.covered}
                      </span>
                      <span>/ {coverageStats.total} files</span>
                      <span
                        style={{
                          color: theme.colors.primary,
                          fontWeight: theme.fontWeights.semibold,
                        }}
                      >
                        · {coverageStats.pct.toFixed(2)}%
                      </span>
                    </div>
                  )}
                  <div style={{ flex: 1 }} />
                  <div
                    style={{
                      flex: '0 1 300px',
                      minWidth: 160,
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
                      flex: '0 0 auto',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {previewTrail && (() => {
                      const nextLayout: TrailBriefLayout =
                        previewBriefLayout === 'three-zone' ? 'split' : 'three-zone';
                      const Icon =
                        previewBriefLayout === 'three-zone' ? Columns2 : LayoutPanelTop;
                      const label =
                        previewBriefLayout === 'three-zone'
                          ? 'Switch to brief-left / city-right'
                          : 'Switch to top brief + bottom sequence';
                      return (
                        <button
                          type="button"
                          onClick={() => setPreviewBriefLayout(nextLayout)}
                          title={label}
                          aria-label={label}
                          style={{
                            flex: '0 0 auto',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: `1px solid ${theme.colors.border}`,
                            backgroundColor: theme.colors.backgroundSecondary,
                            color: theme.colors.textSecondary,
                            cursor: 'pointer',
                          }}
                        >
                          <Icon size={14} />
                        </button>
                      );
                    })()}
                    {previewTrail && (
                      <SpikeConvertToolbar
                        showConvertPipeline={false}
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
                        if (scanningHome) return;
                        void handleAddProject();
                      }}
                      disabled={scanningHome}
                      title="Pick a folder to add — we'll find any git repos inside"
                      style={{
                        flex: '0 0 auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        cursor: scanningHome ? 'default' : 'pointer',
                        opacity: scanningHome ? 0.6 : 1,
                      }}
                    >
                      {scanningHome ? (
                        <Loader2
                          size={14}
                          color={theme.colors.textSecondary}
                          style={{ animation: 'trails-spin 1s linear infinite' }}
                        />
                      ) : (
                        <FolderPlus
                          size={14}
                          color={theme.colors.textSecondary}
                        />
                      )}
                      <span>{scanningHome ? 'Scanning…' : 'Add a project'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('landing');
                        setRecentFilter('');
                      }}
                      style={{
                        flex: '0 0 auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: 8,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} />
                      Create new trail
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
                    {/* Sticky list header — Areas ↔ Trails toggle. Same
                        filtered set; only the grouping changes. Areas pivots
                        the feed into an aggregate of top-level sequence-
                        diagram lanes so the user can spot overlap across
                        trails. */}
                    <div
                      role="tablist"
                      aria-label="Recent feed layout"
                      style={{
                        flex: '0 0 auto',
                        display: 'flex',
                        gap: 4,
                        padding: 8,
                        borderBottom: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.background,
                      }}
                    >
                      {(
                        [
                          { value: 'headers', label: 'Areas' },
                          { value: 'cards', label: 'Trails' },
                        ] as const
                      ).map((option) => {
                        const active = recentDisplayMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setRecentDisplayMode(option.value)}
                            title={
                              option.value === 'headers'
                                ? 'Aggregate top-level sequence-diagram areas across the filtered trails'
                                : 'Show one card per trail, grouped by day'
                            }
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: 'none',
                              backgroundColor: active
                                ? theme.colors.backgroundSecondary
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
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
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
                      {recentDisplayMode === 'cards' ? (
                        <TrailsRecentList
                          groups={trailDayGroups.map((group) => ({
                            key: String(group.date.getTime()),
                            label: group.label,
                            subLabel: group.subLabel,
                            trails: group.trails,
                          }))}
                          resolveRepo={(trail) => {
                            const entry = trail.repositoryPath
                              ? repositories.find(
                                  (r) => r.path === trail.repositoryPath,
                                )
                              : undefined;
                            return {
                              repoLabel: trailRepoLabel(trail.repositoryPath),
                              ownerLogin: entry?.github?.owner,
                              owned: !!entry,
                            };
                          }}
                          selectedTrailId={previewTrail?.id ?? null}
                          onSelectTrail={(trail) =>
                            setPreviewTrail(
                              previewTrail?.id === trail.id ? null : trail,
                            )
                          }
                        />
                      ) : (
                        <TrailsRecentHeaders
                          rows={recentHeaderRows}
                          selectedTrailId={previewTrail?.id ?? null}
                          onSelectTrail={(trail) => {
                            // Keep the area selected (= card expanded) when
                            // a trail is picked. The panel ignores aggregate
                            // / area layers while a trail is active anyway,
                            // and the area highlight returns automatically
                            // when the user closes the trail preview.
                            setPreviewTrail(
                              previewTrail?.id === trail.id ? null : trail,
                            );
                          }}
                          selectedHeader={selectedAreaHeader}
                          onSelectHeader={(header) => {
                            // Area scope wins — clear any single-trail
                            // preview so the city renders the area layer.
                            setPreviewTrail(null);
                            setSelectedAreaHeader(
                              selectedAreaHeader === header ? null : header,
                            );
                          }}
                          onHoverHeader={setHoveredAreaHeader}
                          onHoverTrail={setHoveredTrailId}
                          pendingCount={recentHeaderPendingCount}
                        />
                      )}
                    </div>
                  </div>
                  <RecentTrailPreviewPane
                    repositoryPath={selectedProjectPath}
                    fileTree={projectFileTree}
                    aggregateHighlightLayers={effectiveHighlightLayers}
                    trail={previewTrail}
                    payload={previewPayload}
                    loading={previewLoading}
                    events={events}
                    onCloseTrail={() => setPreviewTrail(null)}
                    onShareTrail={handleShareActiveTrail}
                    briefLayout={previewBriefLayout}
                  />
                </div>
              </div>
            )}
          </div>

        </div>
      )}


      {/* Share-trail modal — opened from the explorer brief card. Owns the
          TrailShareService.share call + sharing → success (copy / open in
          browser) UX. */}
      {shareModalTrail && (
        <TrailShareModal
          trail={shareModalTrail}
          repositoryPath={shareModalTrail.repositoryPath ?? undefined}
          onClose={() => setShareModalTrail(null)}
        />
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

      {/* Create-a-trail modal — surfaces the prompt-idea options. */}
      {createTrailModalOpen && (
        <div
          onClick={closeCreateTrailModal}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            animation: createTrailModalClosing
              ? 'ct-modal-backdrop-out 180ms ease-in forwards'
              : 'ct-modal-backdrop 160ms ease-out',
          }}
        >
          <style>{`
            @keyframes ct-modal-backdrop {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes ct-modal-backdrop-out {
              from { opacity: 1; }
              to { opacity: 0; }
            }
            @keyframes ct-modal-pop {
              from { opacity: 0; transform: scale(0.96) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes ct-modal-pop-out {
              from { opacity: 1; transform: scale(1) translateY(0); }
              to { opacity: 0; transform: scale(0.96) translateY(8px); }
            }
          `}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 100%)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 12,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.background,
              overflow: 'hidden',
              animation: createTrailModalClosing
                ? 'ct-modal-pop-out 180ms ease-in forwards'
                : 'ct-modal-pop 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              transformOrigin: 'center',
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
                <Copy size={18} color={theme.colors.primary} />
                Copy Prompt and Give To Agent
              </div>
              <button
                type="button"
                onClick={closeCreateTrailModal}
                title="Close"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textSecondary,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div
              style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 16,
                justifyContent: 'center',
                overflowY: 'auto',
              }}
            >
              {TRAIL_PROMPT_IDEAS.map((idea, i) => {
                const isCopied = copiedPromptIndex === i;
                return (
                  <div
                    key={idea.label}
                    className="trail-idea-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      void handleCopyPrompt(idea.prompt, i);
                      window.setTimeout(closeCreateTrailModal, 800);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void handleCopyPrompt(idea.prompt, i);
                        window.setTimeout(closeCreateTrailModal, 800);
                      }
                    }}
                    style={{
                      position: 'relative',
                      flex: '0 1 300px',
                      width: '100%',
                      maxWidth: 300,
                      aspectRatio: '4 / 3',
                      padding: '20px 22px',
                      borderRadius: 10,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <idea.Icon size={32} color={theme.colors.primary} />
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
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCopyPrompt(idea.prompt, i);
                        window.setTimeout(closeCreateTrailModal, 800);
                      }}
                      title={isCopied ? 'Copied' : 'Copy prompt'}
                      className={
                        isCopied
                          ? 'trail-idea-copy is-copied'
                          : 'trail-idea-copy'
                      }
                      style={{
                        position: 'absolute',
                        top: 10,
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

export interface TrailsViewProps {
  /**
   * Trail id the principal window was opened with (or routed to). Sourced
   * from `TrailService.getOpenTrailId()` on cold start and SHOW_IN_PRINCIPAL
   * on warm start; flows down from IntegratedShell so TrailsView starts on
   * the Recent grid instead of the landing screen.
   */
  bootstrapTrailId?: string | null;
}

export const TrailsView: React.FC<TrailsViewProps> = ({ bootstrapTrailId }) => {
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
        bootstrapTrailId={bootstrapTrailId ?? null}
      />
    </TerminalProvider>
  );
};
