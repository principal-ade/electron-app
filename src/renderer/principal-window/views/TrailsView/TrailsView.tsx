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
  Check,
  Search,
  Loader2,
  Network,
  ArrowLeftRight,
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
import { WindowService } from '../../../main-process-api/WindowService';
import { useTerminalLinkHandler } from '../../../hooks/useTerminalLinkHandler';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { GitService } from '../../../main-process-api/GitService';
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import {
  TrailTopologyGraph,
  type TrailPayload,
  type TrailSequenceView,
  type TopologyTrailEntry,
} from '@industry-theme/file-city-panel';
import {
  FileCityTrailPanel,
  type TrailBriefLayoutState,
} from '../../../dev-workspace/file-city-trail-panel';
import { ShareTrailModal } from '../../../dev-workspace/trails-panel/ShareTrailModal';
import { RepositoryMonitoringService } from '../../../main-process-api/RepositoryMonitoringService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { TrailsRecentList } from './TrailsRecentList';
import { ExploredProjectsGrid } from './ExploredProjectsGrid';
import {
  TrailsRecentHeaders,
  type TrailHeaderRow,
} from './TrailsRecentHeaders';
import { TrailsRecentFiles, type TrailFileRow } from './TrailsRecentFiles';
import { TrailFileTrailsOverlay } from './TrailFileTrailsOverlay';
import { SpikeConvertToolbar } from './SpikeConvertToolbar';
import { TrailPromptIdeas } from '../../components/TrailPromptIdeas';

import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { getPrincipalBridgeUrl } from '../../../../shared/config/appBranding';

/**
 * Workspace-global default for the brief-layout switch — applied when
 * the user has no stored preference yet. Matches the upstream panel's
 * own defaults so first-mount behavior is unchanged.
 */
const DEFAULT_BRIEF_LAYOUT_STATE: TrailBriefLayoutState = {
  layout: 'split',
  hideMap: false,
  splitPct: 50,
  drawerHeightPct: 30,
};

/** Light validator: coerce an unknown prefs payload back to the panel's shape. */
const coerceBriefLayoutState = (
  raw:
    | {
        layout?: unknown;
        hideMap?: unknown;
        splitPct?: unknown;
        drawerHeightPct?: unknown;
      }
    | undefined,
): TrailBriefLayoutState => {
  if (!raw) return DEFAULT_BRIEF_LAYOUT_STATE;
  const layout =
    raw.layout === 'split' || raw.layout === 'diagram'
      ? raw.layout
      : DEFAULT_BRIEF_LAYOUT_STATE.layout;
  const hideMap =
    typeof raw.hideMap === 'boolean'
      ? raw.hideMap
      : DEFAULT_BRIEF_LAYOUT_STATE.hideMap;
  const splitPct =
    typeof raw.splitPct === 'number' && Number.isFinite(raw.splitPct)
      ? raw.splitPct
      : DEFAULT_BRIEF_LAYOUT_STATE.splitPct;
  const drawerHeightPct =
    typeof raw.drawerHeightPct === 'number' &&
    Number.isFinite(raw.drawerHeightPct)
      ? raw.drawerHeightPct
      : DEFAULT_BRIEF_LAYOUT_STATE.drawerHeightPct;
  return { layout, hideMap, splitPct, drawerHeightPct };
};

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
   * Every TrailPayload the parent has lazy-loaded for this project. Drives
   * the topology overlay — the merged emergent-architecture graph
   * aggregates components/edges across every payload here. The pane
   * doesn't fetch these itself; it just renders what the parent has.
   */
  aggregatePayloads: Map<string, TrailPayload>;
  /**
   * Called when the reader clicks a trail title inside the topology
   * overlay's info panel. The parent looks the id up against its trail
   * index and routes to the preview pane the way a list click would.
   */
  onOpenTrailFromTopology?: (trailId: string) => void;
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
  aggregatePayloads,
  onOpenTrailFromTopology,
}) => {
  const { theme } = useTheme();

  // Workspace-global brief-layout preference. Persisted via
  // UserPreferencesService so the reader's hide-map / layout choice
  // survives trail clicks, repo switches, and app restarts. Lifted
  // into the host (rather than letting the panel manage it) so the
  // persistence scope is ours to change later — per-repo or per-trail
  // without touching the upstream panel package.
  const [briefLayoutState, setBriefLayoutState] =
    useState<TrailBriefLayoutState>(DEFAULT_BRIEF_LAYOUT_STATE);
  useEffect(() => {
    let cancelled = false;
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setBriefLayoutState(coerceBriefLayoutState(prefs.trails?.briefLayout));
      })
      .catch(() => {
        // Service failure leaves us on the in-memory default; no toast.
      });
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      setBriefLayoutState(coerceBriefLayoutState(prefs.trails?.briefLayout));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const handleBriefLayoutChange = useCallback(
    (next: TrailBriefLayoutState) => {
      // Optimistic local update so the panel reflects the toggle before
      // the IPC round-trip lands. The 'user-preferences-updated' event
      // will re-apply the persisted value, but it matches what we just
      // set, so there's no visible flip.
      setBriefLayoutState(next);
      void UserPreferencesService.updatePreferences({
        trails: { briefLayout: next },
      });
    },
    [],
  );

  // Topology overlay state. Local to the pane — purely a view-mode
  // toggle, no persistence yet. Rendered as a full-bleed overlay over
  // the trail explorer so the existing panel doesn't have to know about
  // it. Selected node and the click history live here too so toggling
  // the overlay off and back on lands clean.
  const [showTopology, setShowTopology] = useState(false);
  const [topologySelectedNodeId, setTopologySelectedNodeId] = useState<
    string | null
  >(null);
  // Threshold for how many trails a component must appear in before
  // its bubble renders. Default 1 = no filter; raising it surfaces the
  // consensus topology once the trail set has enough one-offs to
  // clutter the graph. Capped to the actual trail count so the reader
  // can't crank it past "no nodes survive."
  const [topologyMinTrails, setTopologyMinTrails] = useState(1);

  // Map the parent-owned aggregate payload cache into the (trail, view)
  // pairs the topology aggregator expects. Each TrailPayload that ships
  // a sequence view becomes one entry; trails without one (or with only
  // future view kinds) are silently dropped — the topology graph only
  // knows how to read sequence views in v1.
  const topologyEntries = useMemo<TopologyTrailEntry[]>(() => {
    const out: TopologyTrailEntry[] = [];
    for (const trail of aggregatePayloads.values()) {
      const view = trail.views.find(
        (v): v is TrailSequenceView => v.kind === 'sequence',
      );
      if (view) out.push({ trail, view });
    }
    return out;
  }, [aggregatePayloads]);

  const handleOpenTopologyTrail = useCallback(
    (trailId: string) => {
      // Clicking a trail title in the topology info panel routes back
      // through the parent's list-click handler. The overlay stays open
      // so the reader can keep exploring; they dismiss it explicitly
      // via the toolbar toggle.
      onOpenTrailFromTopology?.(trailId);
    },
    [onOpenTrailFromTopology],
  );

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
          briefLayout={briefLayoutState.layout}
          briefSide="leading"
          defaultHideMap={briefLayoutState.hideMap}
          onBriefLayoutChange={handleBriefLayoutChange}
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

        {/* Topology overlay — full-bleed cover over the trail explorer
            when toggled on. Kept conditional (vs. always-mounted hidden)
            so the force layout only runs when the reader actually opens
            it, and so the SVG isn't sitting in the DOM behind the city
            sucking up reflows on every panel render. */}
        {showTopology && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: theme.colors.background,
              zIndex: 2,
            }}
          >
            <TrailTopologyGraph
              trails={topologyEntries}
              selectedNodeId={topologySelectedNodeId}
              onSelectNode={setTopologySelectedNodeId}
              onOpenTrail={handleOpenTopologyTrail}
              minTrailsPerNode={topologyMinTrails}
            />
            {/* Min-trails stepper. Only mounted with the overlay so it
                doesn't clutter the explorer chrome when topology is off.
                Decrement disabled at 1 (no filter); increment disabled
                when the threshold already exceeds the loaded trail
                count, since one more would render nothing. */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                fontFamily: theme.fonts.monospace,
                fontSize: 11,
                letterSpacing: '0.04em',
              }}
            >
              <span style={{ opacity: 0.7, textTransform: 'uppercase' }}>
                Min trails
              </span>
              <button
                type="button"
                onClick={() =>
                  setTopologyMinTrails((n) => Math.max(1, n - 1))
                }
                disabled={topologyMinTrails <= 1}
                style={{
                  all: 'unset',
                  cursor: topologyMinTrails <= 1 ? 'default' : 'pointer',
                  opacity: topologyMinTrails <= 1 ? 0.35 : 1,
                  width: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                −
              </button>
              <span style={{ minWidth: 16, textAlign: 'center' }}>
                {topologyMinTrails}
              </span>
              <button
                type="button"
                onClick={() =>
                  setTopologyMinTrails((n) =>
                    Math.min(topologyEntries.length, n + 1),
                  )
                }
                disabled={topologyMinTrails >= topologyEntries.length}
                style={{
                  all: 'unset',
                  cursor:
                    topologyMinTrails >= topologyEntries.length
                      ? 'default'
                      : 'pointer',
                  opacity:
                    topologyMinTrails >= topologyEntries.length ? 0.35 : 1,
                  width: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Topology toggle — small floating button in the top-right
            corner. Lives above the overlay's z-index so the reader can
            dismiss without dragging through the info panel. Hidden
            when the project has no loaded payloads yet (nothing to
            aggregate). */}
        {topologyEntries.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTopology((s) => !s)}
            title={
              showTopology
                ? 'Hide topology graph'
                : `Topology graph (${topologyEntries.length} trails merged)`
            }
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${
                showTopology
                  ? theme.colors.accent ?? theme.colors.primary
                  : theme.colors.border
              }`,
              background: showTopology
                ? theme.colors.accent ?? theme.colors.primary
                : theme.colors.backgroundSecondary,
              color: showTopology
                ? theme.colors.background
                : theme.colors.text,
              fontFamily: theme.fonts.monospace,
              fontSize: 11,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <Network size={12} />
            {showTopology ? 'Explorer' : 'Topology'}
          </button>
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
  bootstrapProjectPath: string | null;
  onBootstrapProjectPathConsumed?: () => void;
}> = ({
  selectedProject,
  onClearProject,
  bootstrapTrailId,
  bootstrapProjectPath,
  onBootstrapProjectPathConsumed,
}) => {
  const { theme } = useTheme();

  const events = useMemo(() => new PanelEventBus(), []);
  // Open links clicked in the terminal in the default browser
  useTerminalLinkHandler(events);
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

  // Purpose filter — the Recent feed always shows every purpose now that
  // the purpose dropdown has been removed. Kept as a constant so the
  // downstream filtering and highlight-color logic still reads cleanly.
  const purposeFilter: 'all' | 'investigation' | 'informative' = 'all';

  // Recent-feed display mode. `'trails'` is the existing per-trail list; `'areas'`
  // pivots the same filtered set into an aggregate of top-level sequence-diagram
  // lane namespaces (one row per unique header) so the user can spot overlap
  // and candidate groupings across trails.
  const [recentDisplayMode, setRecentDisplayMode] = useState<
    'trails' | 'areas' | 'files'
  >('trails');

  // File selection inside the files view. When set, the city spotlights just
  // this one file on top of the aggregate heat-map. Mutually exclusive with
  // `previewTrail` and `selectedAreaHeader` — picking a file clears those.
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
    null,
  );

  // Folder selection inside the files view (no trailing slash). When set, the
  // city outlines that folder's region and fills the touched files under it so
  // the user can associate a tree folder with its part of the map. Mutually
  // exclusive with `selectedFilePath` — both ride the same tree selection.
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    null,
  );

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

  // Consume the cross-view nav bootstrap from HomeView. A non-null value
  // (including '') flips us into Recent; a non-empty string also pre-
  // selects that repo. Notify the shell so the prop is cleared and the
  // same bootstrap doesn't reapply on the next render.
  useEffect(() => {
    if (bootstrapProjectPath === null || bootstrapProjectPath === undefined) {
      return;
    }
    setViewMode('recent');
    if (bootstrapProjectPath.length > 0) {
      setSelectedProjectPath(bootstrapProjectPath);
    }
    onBootstrapProjectPathConsumed?.();
  }, [bootstrapProjectPath, onBootstrapProjectPathConsumed]);

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

  useEffect(() => {
    if (!previewTrail) {
      setPreviewPayload(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    // Intentionally don't clear `previewPayload` here. Nulling it
    // sends the panel into idle mode for the duration of the fetch
    // (trail.data null → isIdle → brief + sequence drawer unmount
    // and the city renders in idle layout). With hideMap persisted,
    // that flash of the idle city under the translucent "Loading
    // preview…" veil is jarring. Keeping the previous payload mounted
    // means the brief stays open in whatever layout the reader chose,
    // the sequence drawer stays mounted, and the veil sits over a
    // stable scene until the new payload swaps in.
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
      `    curl -s ${getPrincipalBridgeUrl()}/api/file-city/trail/${previewTrail.id}`,
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

  // Titlebar bridge: the "Add a project" button now lives in the titlebar
  // (IntegratedTitlebar). It fires a window-level event because TrailsView
  // owns the scan-progress modal and `handleAddProject`'s state.
  useEffect(() => {
    const onTrigger = () => {
      if (scanningHome) return;
      void handleAddProject();
    };
    window.addEventListener('trails:add-project', onTrigger);
    return () => window.removeEventListener('trails:add-project', onTrigger);
  }, [handleAddProject, scanningHome]);

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

  // Landing-screen repo cards. One entry per distinct repo in the Recent
  // feed, carrying the repo identity + that repo's newest trail. Since
  // `recentTrails` is sorted newest-first, the first occurrence of a
  // `repositoryPath` is also that repo's most recent trail.
  const repoCardEntries = useMemo<
    Array<{
      repo: { path: string; label: string; ownerLogin?: string };
      trail: TrailIndexEntry;
      trailCount: number;
    }>
  >(() => {
    const byRepo = new Map<
      string,
      {
        repo: { path: string; label: string; ownerLogin?: string };
        trail: TrailIndexEntry;
        trailCount: number;
      }
    >();
    for (const trail of recentTrails) {
      if (!trail.repositoryPath) continue;
      const existing = byRepo.get(trail.repositoryPath);
      if (existing) {
        existing.trailCount += 1;
        continue;
      }
      const entry = repositories.find((r) => r.path === trail.repositoryPath);
      byRepo.set(trail.repositoryPath, {
        repo: {
          path: trail.repositoryPath,
          label: trailRepoLabel(trail.repositoryPath),
          ownerLogin: entry?.github?.owner,
        },
        trail,
        trailCount: 1,
      });
    }
    return Array.from(byRepo.values());
  }, [recentTrails, repositories]);

  // Click handler for the landing repo cards. Pre-selects the repo's
  // project filter and the specific trail before flipping into Recent,
  // so the user lands on that repo's populated trail grid. We intentionally
  // do not open a specific trail in the preview pane — the user picks which
  // trail to open from the grid.
  const openTrailFromRepoCard = useCallback(
    (entry: {
      repo: { path: string };
      trail: TrailIndexEntry;
    }) => {
      setSelectedProjectPath(entry.repo.path);
      setPreviewTrail(null);
      setViewMode('recent');
    },
    [],
  );

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

  // Project-scoped subset of the aggregate payload cache. `aggregatePayloads`
  // accumulates across project switches (the fetch effect above only adds
  // missing IDs and never prunes), so consumers that want "trails for the
  // active project only" — like the topology overlay — have to filter
  // against the current `recentTrails` slice. Returns an empty Map when
  // no project is selected so nothing leaks through during a switch.
  const projectAggregatePayloads = useMemo(() => {
    const out = new Map<string, TrailPayload>();
    if (!selectedProjectPath) return out;
    for (const trail of recentTrails) {
      if (trail.repositoryPath !== selectedProjectPath) continue;
      const payload = aggregatePayloads.get(trail.id);
      if (payload) out.set(trail.id, payload);
    }
    return out;
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

  // How many distinct trails touch each file in the active project. Drives
  // the aggregate "heat map" — files referenced by more trails read hotter
  // (more opaque). A file referenced by several markers in one trail still
  // counts once for that trail.
  const coverageCountByPath = useMemo(() => {
    const counts = new Map<string, number>();
    if (!projectFileTree || !selectedProjectPath) return counts;
    for (const trail of recentTrails) {
      if (trail.repositoryPath !== selectedProjectPath) continue;
      const payload = aggregatePayloads.get(trail.id);
      if (!payload) continue;
      const seenInTrail = new Set<string>();
      for (const marker of payload.markers) {
        const p = marker.sourcePath;
        if (!p || seenInTrail.has(p)) continue;
        seenInTrail.add(p);
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
    }
    return counts;
  }, [recentTrails, selectedProjectPath, aggregatePayloads, projectFileTree]);

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

  // Heat-map layers fed to the explorer when no trail is selected. Files are
  // bucketed by how many trails touch them and painted in the primary accent
  // at increasing opacity — more-covered files read hotter. Tiers cap at 4+
  // so a few heavily-referenced files don't wash out the rest.
  const aggregateHighlightLayers = useMemo<HighlightLayer[] | null>(() => {
    if (!projectFileTree) return null;
    const treePaths = new Set(
      projectFileTree.allFiles.map((f) => f.relativePath),
    );
    // tier (1..4) -> paths covered by that many trails (4 = "4 or more")
    const pathsByTier = new Map<number, string[]>();
    for (const [path, count] of coverageCountByPath) {
      if (!treePaths.has(path)) continue;
      const tier = Math.min(count, 4);
      const bucket = pathsByTier.get(tier);
      if (bucket) bucket.push(path);
      else pathsByTier.set(tier, [path]);
    }
    if (pathsByTier.size === 0) return null;
    // Single-hue sequential ramp: every tier is the primary hue, but cooler
    // tiers are lightened toward white so the four levels stay distinct at a
    // solid opacity (an opacity-only ramp washed out against the buildings).
    const parseHex = (hex: string): [number, number, number] => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) return [59, 130, 246]; // #3b82f6 fallback
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const toHex = (r: number, g: number, b: number) =>
      '#' +
      [r, g, b]
        .map((v) => Math.round(v).toString(16).padStart(2, '0'))
        .join('');
    const [pr, pg, pb] = parseHex(theme.colors.primary ?? '#3b82f6');
    // Mix the primary toward white: tier 1 lightest, tier 4 pure primary.
    const tierColor = (tier: number) => {
      const whiteFrac = (4 - tier) * 0.22;
      return toHex(
        pr + (255 - pr) * whiteFrac,
        pg + (255 - pg) * whiteFrac,
        pb + (255 - pb) * whiteFrac,
      );
    };
    const layers: HighlightLayer[] = [];
    for (const [tier, paths] of pathsByTier) {
      layers.push({
        id: `trails-heat-${tier}`,
        name:
          tier >= 4
            ? 'Files covered by 4+ trails'
            : `Files covered by ${tier} trail${tier === 1 ? '' : 's'}`,
        enabled: true,
        color: tierColor(tier),
        opacity: 0.85,
        // Hotter tiers sit on higher priorities so they stack above the
        // cooler ones (and below the area/hover layers at 30+).
        priority: 20 + tier,
        items: paths.map((path) => ({
          path,
          type: 'file',
          renderStrategy: 'fill',
        })),
      });
    }
    return layers;
  }, [coverageCountByPath, projectFileTree, theme.colors.primary]);

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
    setPreviewTrail((current) =>
      current && current.repositoryPath === selectedProjectPath ? current : null,
    );
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
    if (recentDisplayMode !== 'areas') {
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
          const byPath = headerToPathTrails.get(top);
          if (sourcePath && byPath) {
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

  // Files view: the union of every file the filtered trails touch (one entry
  // per distinct `marker.sourcePath`) with a per-file trail count. Feeds the
  // `TrailsRecentFiles` tree and its "×N" row badges. Counts a file once per
  // trail even when several markers in that trail point at it. Gated on the
  // files display mode so we don't walk payloads when the tree isn't shown.
  const recentFileRows = useMemo<TrailFileRow[]>(() => {
    if (recentDisplayMode !== 'files') return [];
    const counts = new Map<string, number>();
    for (const trail of filteredRecentTrails) {
      const payload = aggregatePayloads.get(trail.id);
      if (!payload) continue;
      const seenInTrail = new Set<string>();
      for (const marker of payload.markers) {
        const p = marker.sourcePath;
        if (!p || seenInTrail.has(p)) continue;
        seenInTrail.add(p);
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([path, trailCount]) => ({
      path,
      trailCount,
    }));
  }, [recentDisplayMode, filteredRecentTrails, aggregatePayloads]);

  // How many filtered trails still need a payload load (for the files-view
  // footer). Mirrors `recentHeaderPendingCount` but gated on files mode.
  const recentFilePendingCount = useMemo(() => {
    if (recentDisplayMode !== 'files') return 0;
    let pending = 0;
    for (const trail of filteredRecentTrails) {
      if (!aggregatePayloads.has(trail.id)) pending++;
    }
    return pending;
  }, [recentDisplayMode, filteredRecentTrails, aggregatePayloads]);

  // Trails touching the file picked in the Files tree — drives the overlay
  // that floats over the explorer. Preserves `filteredRecentTrails` order
  // (date-sorted) so the most recent trails surface first.
  const selectedFileTrails = useMemo<TrailIndexEntry[]>(() => {
    if (recentDisplayMode !== 'files' || !selectedFilePath) return [];
    const out: TrailIndexEntry[] = [];
    for (const trail of filteredRecentTrails) {
      const payload = aggregatePayloads.get(trail.id);
      if (!payload) continue;
      if (payload.markers.some((m) => m.sourcePath === selectedFilePath)) {
        out.push(trail);
      }
    }
    return out;
  }, [
    recentDisplayMode,
    selectedFilePath,
    filteredRecentTrails,
    aggregatePayloads,
  ]);

  // Files referenced by markers in the selected area. Reads the cached set
  // `areaFilesByHeader` produced by the headers memo above so we don't walk
  // payloads twice. Returns null when no area is selected (panel falls back
  // to the cross-purpose aggregate).
  const selectedAreaHighlightLayers = useMemo<HighlightLayer[] | null>(() => {
    if (!selectedAreaHeader) return null;
    const paths = areaFilesByHeader.get(selectedAreaHeader);
    if (!paths || paths.size === 0) return null;
    return [
      {
        id: `trails-area-${selectedAreaHeader}`,
        name: `Files in area "${selectedAreaHeader}"`,
        enabled: true,
        color: theme.colors.primary ?? '#3b82f6',
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
    if (recentDisplayMode !== 'areas') return null;
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
    return {
      id: `trails-trail-hover-${hoveredTrailId}`,
      name: `Hovered trail "${trail.title ?? hoveredTrailId}"`,
      enabled: true,
      color: theme.colors.primary ?? '#3b82f6',
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
    theme.colors.primary,
  ]);

  // Transient folder-border layer for the hovered area card. Pulled from
  // the cached headers memo's common-parent map; renders a single
  // `type: 'directory'` item with `renderStrategy: 'border'` so the city
  // outlines that part of the repo for as long as the pointer sits on the
  // card. Suppressed when the hovered area has no meaningful common parent
  // (files span multiple top-level folders) since a root-level border
  // wouldn't tell the user anything new.
  const hoveredAreaBorderLayer = useMemo<HighlightLayer | null>(() => {
    if (recentDisplayMode !== 'areas') return null;
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

  // Single-file spotlight for the files view. Renders one bright fill layer
  // in the primary accent on top of the aggregate heat-map (so the rest of
  // the touched files stay visible for context). Returns null when no file is
  // selected or the file isn't in the project tree.
  const selectedFileHighlightLayer = useMemo<HighlightLayer | null>(() => {
    if (recentDisplayMode !== 'files' || !selectedFilePath) return null;
    if (projectFileTree) {
      const treePaths = new Set(
        projectFileTree.allFiles.map((f) => f.relativePath),
      );
      if (!treePaths.has(selectedFilePath)) return null;
    }
    return {
      id: `trails-file-${selectedFilePath}`,
      name: `File "${selectedFilePath}"`,
      enabled: true,
      color: theme.colors.primary ?? '#3b82f6',
      opacity: 0.9,
      // Above the area-fill (30) and hover layers (35/40) so the picked file
      // reads as the focused element regardless of what else is painted.
      priority: 45,
      items: [
        {
          path: selectedFilePath,
          type: 'file',
          renderStrategy: 'fill',
        },
      ],
    };
  }, [
    recentDisplayMode,
    selectedFilePath,
    projectFileTree,
    theme.colors.primary,
  ]);

  // Folder spotlight for the files view. Fills the *touched* files under the
  // selected folder — exactly how an area selection highlights its files
  // (`type: 'file'` fills). The folder lights up because its member files do;
  // untouched files stay dim because they're not in the set. Deliberately no
  // `directory` item — that forces a whole-district cover that also lights
  // every untouched building. Null when no folder is selected or nothing
  // under it is touched.
  const selectedFolderHighlightLayers = useMemo<HighlightLayer[] | null>(() => {
    if (recentDisplayMode !== 'files' || !selectedFolderPath) return null;
    const prefix = selectedFolderPath + '/';
    const treePaths = projectFileTree
      ? new Set(projectFileTree.allFiles.map((f) => f.relativePath))
      : null;
    const touched = recentFileRows
      .map((r) => r.path)
      .filter((p) => p.startsWith(prefix) && (!treePaths || treePaths.has(p)));
    if (touched.length === 0) return null;
    return [
      {
        id: `trails-folder-${selectedFolderPath}`,
        name: `Touched files in "${selectedFolderPath}"`,
        enabled: true,
        color: theme.colors.primary ?? '#3b82f6',
        opacity: 0.9,
        // Above the area-fill / hover layers, below the single-file
        // spotlight (45).
        priority: 43,
        items: touched.map((path) => ({
          path,
          type: 'file' as const,
          renderStrategy: 'fill' as const,
        })),
      },
    ];
  }, [
    recentDisplayMode,
    selectedFolderPath,
    recentFileRows,
    projectFileTree,
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
    if (selectedFolderHighlightLayers) extras.push(...selectedFolderHighlightLayers);
    if (selectedFileHighlightLayer) extras.push(selectedFileHighlightLayer);
    if (extras.length === 0) return base;
    return [...(base ?? []), ...extras];
  }, [
    selectedAreaHeader,
    selectedAreaHighlightLayers,
    aggregateHighlightLayers,
    hoveredTrailHighlightLayer,
    hoveredAreaBorderLayer,
    selectedFolderHighlightLayers,
    selectedFileHighlightLayer,
  ]);

  // Clear the area scope when the headers view goes away or the selected
  // header drops out of the current row set (e.g. user changed project,
  // purpose, or text filter). Without this the city would keep highlighting
  // an area the user can no longer see in the list.
  useEffect(() => {
    if (!selectedAreaHeader) return;
    if (recentDisplayMode !== 'areas') {
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
    if (recentDisplayMode !== 'areas') {
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
    if (recentDisplayMode !== 'areas') {
      setHoveredTrailId(null);
    }
  }, [recentDisplayMode, hoveredTrailId]);

  // Drop the file spotlight when the files view goes away (mode switch) or
  // the selected file drops out of the touched-file set (project / filter
  // change), so the city doesn't keep highlighting a file the user can no
  // longer see in the tree.
  useEffect(() => {
    if (!selectedFilePath) return;
    if (recentDisplayMode !== 'files') {
      setSelectedFilePath(null);
      return;
    }
    const stillTouched = recentFileRows.some(
      (row) => row.path === selectedFilePath,
    );
    if (!stillTouched) setSelectedFilePath(null);
  }, [recentDisplayMode, recentFileRows, selectedFilePath]);

  // Same cleanup for the selected folder — drop it when leaving files mode or
  // when nothing under it is touched anymore (project / filter change).
  useEffect(() => {
    if (!selectedFolderPath) return;
    if (recentDisplayMode !== 'files') {
      setSelectedFolderPath(null);
      return;
    }
    const prefix = selectedFolderPath + '/';
    const stillTouched = recentFileRows.some((row) =>
      row.path.startsWith(prefix),
    );
    if (!stillTouched) setSelectedFolderPath(null);
  }, [recentDisplayMode, recentFileRows, selectedFolderPath]);

  // How many filtered trails still need a payload load. Surfaces under the
  // headers list so users know rows may still reshuffle as IPC resolves.
  const recentHeaderPendingCount = useMemo(() => {
    if (recentDisplayMode !== 'areas') return 0;
    let pending = 0;
    for (const trail of filteredRecentTrails) {
      if (!aggregatePayloads.has(trail.id)) pending++;
    }
    return pending;
  }, [filteredRecentTrails, aggregatePayloads, recentDisplayMode]);

  const overlayBg = theme.colors.background;

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

      {/* Trail prompt ideas — the landing screen whenever no project is */}
      {/* selected. Hidden only while the user is browsing the recent feed. */}
      {!selectedProject &&
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
              backgroundColor: overlayBg,
              overflow: 'hidden',
            }}
          >
            {/* Repo cards — one per distinct repo in the Recent feed,
                showing the repo identity and its newest trail. Only
                rendered once the user has at least one saved trail. */}
            {hasRecentTrails ? (
              <>
                {/* Fixed heading — sits above the scroll region so it stays
                    put while only the repo grid below it scrolls. */}
                <div
                  style={{
                    flex: '0 0 auto',
                    width: '100%',
                    maxWidth: 960,
                    padding: '48px 32px 0',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      color: theme.colors.text,
                      fontFamily: theme.fonts.heading ?? theme.fonts.body,
                      fontSize: 'clamp(40px, 6vw, 72px)',
                      fontWeight: theme.fontWeights.bold,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.05,
                      maxWidth: 640,
                      margin: '0 auto 24px',
                    }}
                  >
                    Projects with <span style={{ color: theme.colors.primary }}>Trails</span>
                  </div>
                </div>
                {/* Scroller — only the repo grid scrolls. */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                    overflowY: 'auto',
                    padding: '24px 32px 32px',
                  }}
                >
                  <div style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}>
                    <ExploredProjectsGrid
                      entries={repoCardEntries}
                      recentTrails={recentTrails}
                      onOpenRepo={openTrailFromRepoCard}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  width: '100%',
                  overflowY: 'auto',
                  padding: 32,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <TrailPromptIdeas />
              </div>
            )}
          </div>
        )}


      {/* Recent-trails overlay — entered from the landing screen's */}
      {/* "View Recent Trails" button. Covers the panel until the user */}
      {/* navigates back. */}
      {!selectedProject &&
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
                    {(() => {
                      const activeProject = recentProjects.find(
                        (p) => p.path === selectedProjectPath,
                      );
                      const avatarUrl = activeProject?.ownerLogin
                        ? `https://github.com/${activeProject.ownerLogin}.png?size=32`
                        : null;
                      return (
                        <>
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt=""
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <FolderGit2
                              size={14}
                              color={theme.colors.textSecondary}
                            />
                          )}
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: theme.colors.text,
                              fontFamily: theme.fonts.body,
                              fontSize: theme.fontSizes[1],
                              fontWeight: theme.fontWeights.semibold,
                            }}
                          >
                            {activeProject?.label ?? 'No project selected'}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('landing');
                      setRecentFilter('');
                    }}
                    title="Switch project"
                    aria-label="Switch project"
                    style={{
                      flex: '0 0 auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 8,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 8,
                      backgroundColor: theme.colors.backgroundSecondary,
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    <ArrowLeftRight size={14} />
                  </button>
                  <div style={{ flex: 1 }} />
                  <div
                    style={{
                      flex: '0 0 auto',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
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
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedProjectPath) return;
                        void (async () => {
                          try {
                            const existing =
                              await AlexandriaService.getRepositoryByPath(
                                selectedProjectPath,
                              );
                            const entry =
                              existing ??
                              (await AlexandriaService.registerRepository(
                                selectedProjectPath,
                              ));
                            await WindowService.openDevWorkspace({
                              alexandriaEntry: entry,
                            });
                          } catch (err) {
                            console.error(
                              '[TrailsView] Failed to open dev workspace for project',
                              selectedProjectPath,
                              err,
                            );
                          }
                        })();
                      }}
                      disabled={!selectedProjectPath}
                      title="Open the selected project in the dev workspace window"
                      style={{
                        flex: '0 0 auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        fontSize: theme.fontSizes[1],
                        cursor: selectedProjectPath ? 'pointer' : 'default',
                        opacity: selectedProjectPath ? 1 : 0.6,
                      }}
                    >
                      Open Project
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
                          { value: 'files', label: 'Files' },
                          { value: 'trails', label: 'Trails' },
                          { value: 'areas', label: 'Areas' },
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
                              option.value === 'areas'
                                ? 'Aggregate top-level sequence-diagram areas across the filtered trails'
                                : option.value === 'files'
                                  ? 'File tree of every file the filtered trails touch'
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
                      {recentDisplayMode === 'files' ? (
                        <TrailsRecentFiles
                          files={recentFileRows}
                          selectedPath={
                            selectedFilePath ?? selectedFolderPath
                          }
                          onSelectFile={(path) => {
                            // File spotlight wins — clear any single-trail
                            // preview, area scope, and folder selection so the
                            // city renders the file layer over the heat-map.
                            setPreviewTrail(null);
                            setSelectedAreaHeader(null);
                            setSelectedFolderPath(null);
                            setSelectedFilePath(path);
                          }}
                          onSelectFolder={(path) => {
                            // Folder region highlight — clear the trail
                            // preview, area scope, and any single-file
                            // spotlight so the folder layer reads cleanly.
                            setPreviewTrail(null);
                            setSelectedAreaHeader(null);
                            setSelectedFilePath(null);
                            setSelectedFolderPath(path);
                          }}
                          pendingCount={recentFilePendingCount}
                        />
                      ) : recentDisplayMode === 'trails' ? (
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
                  {/* Single-cell grid so the pane fills the column while the
                      file-trails overlay floats on top as an absolute sibling
                      (the pane clips its own children with overflow:hidden, so
                      the overlay can't live inside it). */}
                  <div style={{ position: 'relative', minHeight: 0, display: 'grid' }}>
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
                      aggregatePayloads={projectAggregatePayloads}
                      onOpenTrailFromTopology={(trailId) => {
                        // Route a topology-overlay trail click through the
                        // same path a recent-list card click takes: look
                        // the id up against the in-memory index and set
                        // it as the preview. Falls back to a no-op when
                        // the id can't be matched (e.g. the trail was
                        // deleted between layout and click).
                        const entry = recentTrails.find(
                          (t) => t.id === trailId,
                        );
                        if (entry) setPreviewTrail(entry);
                      }}
                    />
                    {recentDisplayMode === 'files' &&
                      selectedFilePath &&
                      selectedFileTrails.length > 0 && (
                        <TrailFileTrailsOverlay
                          filePath={selectedFilePath}
                          trails={selectedFileTrails}
                          selectedTrailId={previewTrail?.id ?? null}
                          resolveRepoLabel={(trail) =>
                            trailRepoLabel(trail.repositoryPath)
                          }
                          onSelectTrail={(trail) => {
                            // Open the trail in the pane and dismiss the
                            // overlay (which also drops the file spotlight)
                            // so the chosen trail is fully visible.
                            setPreviewTrail(trail);
                            setSelectedFilePath(null);
                          }}
                          onClose={() => setSelectedFilePath(null)}
                        />
                      )}
                  </div>
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
        <ShareTrailModal
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
  /**
   * Repo path to pre-select when TrailsView mounts/activates. Set by
   * IntegratedShell in response to `home:open-in-trails`; an empty string
   * means "no specific repo, just flip to Recent". TrailsView clears it
   * via `onBootstrapProjectPathConsumed` once applied so the same path
   * doesn't reapply on re-render.
   */
  bootstrapProjectPath?: string | null;
  onBootstrapProjectPathConsumed?: () => void;
}

export const TrailsView: React.FC<TrailsViewProps> = ({
  bootstrapTrailId,
  bootstrapProjectPath,
  onBootstrapProjectPathConsumed,
}) => {
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
        bootstrapProjectPath={bootstrapProjectPath ?? null}
        onBootstrapProjectPathConsumed={onBootstrapProjectPathConsumed}
      />
    </TerminalProvider>
  );
};
