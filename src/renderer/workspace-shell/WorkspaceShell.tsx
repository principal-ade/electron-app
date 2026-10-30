/**
 * WorkspaceShell
 *
 * The persistent host for every workspace surface — Projects, Topics,
 * Drawings, and Skills. It replaces the separate per-view
 * frameworks / overlays with ONE shell:
 *
 * - one tabbed-terminal host reading the shared `useWorkspaceTabs()` bucket, so
 *   the open tabs (and the single terminal) persist when you swap the left panel;
 * - one terminal scope (`terminal:workspace`);
 * - a swappable left panel chosen by `activeView` — the Projects feed or
 *   Topics list.
 *
 * PrincipalPortal mounts ONE instance for the workspace views, passing
 * `activeView`; switching between them keeps this component (and its
 * terminal/tabs) mounted and only swaps the left panel.
 *
 * Projects carries more host machinery than Topics — its activity feed,
 * git-status refresh, delete modal and local→portal open-intent forwarder live
 * in `useProjectsHost`; its tab bodies render via `renderProjectsTabContent`.
 * The Projects panels emit open intents on the shell's LOCAL `events` bus (the
 * forwarder lifts them to the portal bus); Topics emits straight on the portal
 * bus. See docs/portal-unification.md + docs/portal-view-migration.md.
 */

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { DocumentRange } from '../../shared/documentRange';
import {
  Globe,
  Loader2,
  Network,
  PenTool,
  PencilRuler,
  ToolCase,
  Send,
  SquareArrowOutUpRight,
  Terminal,
} from 'lucide-react';
import { HttpRequestTabContent } from '../requests/HttpRequestTabContent';
import { RequestsLeftPanel } from '../requests/RequestsLeftPanel';
import { requestDefinition } from '../../shared/requests/preparedRequest';
import { TopicsIcon } from '../components/TopicsIcon';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
} from '@principal-ade/panel-layouts';
import {
  PanelEventBus,
  type PanelEventEmitter,
} from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  TerminalProvider,
  useTerminalProvider,
} from '../contexts/TerminalContext';
import { usePanelProgramStatus } from '../contexts/terminalProgramStatus';
import { toHomeProgramStatus } from '../panels/home-panel/homeProgramStatus';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { ProcessRegistryService } from '../main-process-api/ProcessRegistryService';
import { useTerminalImplementation } from '../hooks/useTerminalImplementation';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { RepoFileSearchPalette } from './RepoFileSearchPalette';
import { useTerminalLinkHandler } from '../hooks/useTerminalLinkHandler';
import { useTerminalRepoInfo } from '../hooks/useTerminalRepoInfo';
import { SendTabButton } from '../move-tab/SendTabButton';
import { DetachTabButton } from '../move-tab/DetachTabButton';
import { useTabReceiver } from '../move-tab/useTabReceiver';
import { toDetachableTabDescriptor } from '../move-tab/detachedTabDescriptor';
import {
  describeTabDrag,
  useDragOutDetach,
  type TabDragState,
} from '../move-tab/useDragOutDetach';
import { WindowService } from '../main-process-api/WindowService';
import type { DetachedTabDropPoint } from '../../shared/detachedTab';
import { RepoAboutCard } from '../panels/home-panel/RepoAboutCard';
import {
  payloadFromLocalEntry,
  payloadFromPurl,
} from '../events/repositorySelected';
import type { RepositorySelectedPayload } from '../events/repositorySelected';
import { findEntriesByPurl } from '../utils/alexandriaIdentity';
import {
  openTopicProject,
  type TopicProjectTarget,
} from '../utils/topicProjectNavigation';
import type { Purl } from '@principal-ai/alexandria-core-library';
import { useOpenRepositoryWindows } from '../hooks/useOpenRepositoryWindows';
import {
  TabbedTerminalPanel,
  type TerminalPanelActions,
  type TerminalTabOpenRequest,
} from '@industry-theme/xterm-terminal-panel';
import { TopicsLeftPanel } from '../panels/TopicsLeftPanel';
import { ProjectsLeftPanel } from '../panels/ProjectsLeftPanel';
import type { ProjectFilter } from '../panels/ProjectsList';
import { HomeLeftPanel } from '../panels/home-panel';
import { useUserAboutInfo } from '../panels/home-panel/useUserAboutInfo';
import { LocalTopicTabContent } from '../topics-view/LocalTopicTabContent';
import {
  renderProjectsTabContent,
  renderProjectsTabIcon,
} from '../projects-view/projectsTabContent';
import { useProjectsHost } from '../projects-view/useProjectsHost';
import { DrawingsLeftPanel } from '../drawings-view/DrawingsLeftPanel';
import { DrawingTabContent } from '../drawings-view/DrawingTabContent';
import { useDrawingsHost } from '../drawings-view/useDrawingsHost';
import { SkillBrowserPanelProvider } from '../principal-window/views/SkillBrowserView/SkillBrowserPanelProvider';
import { SkillsSurfaceProvider } from '../skills-view/SkillsSurfaceContext';
import { SkillsLeftPanel } from '../skills-view/SkillsLeftPanel';
import { SkillDetailTabContent } from '../skills-view/SkillDetailTabContent';
import { SubsystemModelsLeftPanel } from '../subsystem-models/SubsystemModelsLeftPanel';
import { ProcessesView } from '../principal-window/views/ProcessesView';
import { SubsystemModelTabContent } from '../subsystem-models/SubsystemModelTabContent';
import { C4SketchTabContent } from '../c4-sketches/C4SketchTabContent';
import { LocalhostBrowserTabContent } from '../principal-window/views/ProcessesView/LocalhostBrowserTabContent';
import type {
  FeedTab,
  DrawingTab,
  SubsystemModelTab,
  LocalhostBrowserTab,
} from '../events/portalTabs';
import {
  useWorkspaceTabs,
  type WorkspaceTab,
} from '../principal-window/PortalTabsContext';
import { usePortalEvents } from '../principal-window/PortalEventContext';
import { DocumentService } from '../services/DocumentService';
import type { LocalTopicTab } from '../events/portalTabs';
import {
  PORTAL_INTENTS,
  type TerminalNewPayload,
} from '../events/portalIntents';
import { DRAWING_EVENTS } from '../drawings-view/drawingsStorage';
import type { HomeTabEntry } from '../panels/home-panel/homeTabEntries';
import { TerminalEmptyState } from './TerminalEmptyState';

/** Which surface's left panel + landing the shell currently shows. */
export type WorkspaceView =
  | 'home-panel'
  | 'projects'
  | 'topics'
  | 'drawings'
  | 'skills'
  | 'processes'
  | 'requests'
  | 'subsystem-models';

/**
 * Stable identity for the terminal panel's `renderEmptyState` — the panel
 * memoizes on prop identity, so a fresh arrow each render would defeat it. The
 * empty state takes no props from the shell.
 */
const renderTerminalEmptyState = () => <TerminalEmptyState />;

/** Centered landing hint shown by the `topics-home` tab. */
const HomePanel: React.FC<{
  icon: React.ReactNode;
  title: string;
  body: string;
}> = ({ icon, title, body }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
        backgroundColor: theme.colors.background,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
      }}
    >
      {icon}
      <div
        style={{
          fontSize: theme.fontSizes[2],
          fontWeight: 600,
          color: theme.colors.text,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: theme.fontSizes[1], maxWidth: 420 }}>{body}</div>
    </div>
  );
};

interface WorkspaceShellInnerProps {
  activeView: WorkspaceView;
  events: PanelEventEmitter;
  repositories: AlexandriaEntry[];
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  selectedRepository: RepositorySelectedPayload | null;
  isRepositoryPanelActive: boolean;
  onOpenRepository: (repository: RepositorySelectedPayload) => void;
  onCloseRepository: () => void;
  layout: PanelLayout;
  panelSizes: { left: number; middle: number; right: number };
  onPanelSizesChange: (sizes: {
    left: number;
    middle: number;
    right: number;
  }) => void;
}

const WorkspaceShellInner: React.FC<WorkspaceShellInnerProps> = ({
  activeView,
  events,
  repositories,
  collapsed,
  onCollapsedChange,
  selectedRepository,
  isRepositoryPanelActive,
  onOpenRepository,
  onCloseRepository,
  layout,
  panelSizes,
  onPanelSizesChange,
}) => {
  const { theme } = useTheme();
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  const { context: terminalCtx, actions: terminalActions } =
    useTerminalProvider();
  // Resolves the active terminal's directory to repo context (owner/repo,
  // avatar, git status) for the panel's bottom status bar.
  const getRepoInfo = useTerminalRepoInfo();

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);
  // Projects filter lives here (the shell stays mounted while the left panel is
  // swapped) so switching side panels doesn't reset it. Cloned is the default.
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('cloned');
  // Home profile, resolved here (the shell stays mounted while the left panel
  // is swapped) so re-entering the Home panel shows the last profile instead of
  // remounting and flashing the skeleton.
  const { user: aboutUser, loading: userLoading } = useUserAboutInfo();
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);
  const [showSendTabButton, setShowSendTabButton] = useState(false);
  const terminalImplementation = useTerminalImplementation();

  useEffect(() => {
    if (collapsed.left === isLeftCollapsed) return;

    if (collapsed.left) {
      panelLayoutRef.current?.collapsePanel('left');
    } else {
      panelLayoutRef.current?.expandPanel('left');
      const currentLayout = panelLayoutRef.current?.getLayout();
      if (currentLayout && currentLayout.left < 20) {
        panelLayoutRef.current?.setLayout({
          left: 25,
          middle: 75,
          right: currentLayout.right,
        });
      }
    }
    setIsLeftCollapsed(collapsed.left);
  }, [collapsed.left, isLeftCollapsed]);

  // Refs so renderTabContent stays stable across renders.
  const eventsRef = useRef(events);
  const repositoriesRef = useRef(repositories);
  useEffect(() => {
    eventsRef.current = events;
    repositoriesRef.current = repositories;
  });

  // The shared workspace tab bucket (the persistent host's tab list).
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    openMarkdownDoc,
    openSourceFile,
    openMedia,
    openLocalTopic,
    openProjectInfo,
    openRepoExplorer,
    openFileCityGuide,
    openSubsystemModel,
    openC4Sketch,
    openDrawing,
    openSkill,
    openLocalhostBrowser,
    openHttpRequest,
    catalogRequests,
  } = useWorkspaceTabs();
  // The Topics left panel emits open intents on the portal bus
  // (PortalIntentBridge turns them into tabs).
  const { events: portalEvents } = usePortalEvents();

  // Projects host concerns (activity feed, git-status refresh, delete modal,
  // and the local→portal open-intent forwarder). Runs for the shell's whole
  // lifetime across all surfaces so the Projects feed + delete modal stay live
  // even while Topics is showing. The Projects left panel + tab content
  // emit on the shell's local `events` bus (the forwarder lifts opens to the
  // portal bus); Topics emits straight on `portalEvents`.
  const { deleteModal } = useProjectsHost({ events, repositories });

  // Drawings host glue (open/save/delete → shared tab bucket).
  useDrawingsHost({ events });

  // Skills surface state runs (loaders, focus-refresh) only when Skills is the
  // active surface or a skill detail tab is open; otherwise it stays dormant.
  const skillsBus = useMemo(() => new PanelEventBus(), []);
  const skillsEnabled =
    activeView === 'skills' || tabs.some((t) => t.contentType === 'skill');

  useEffect(() => {
    const loadPreferences = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
      setShowSendTabButton(preferences.showSendTabButton ?? false);
    };
    loadPreferences();
    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      (preferences) => {
        setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
        setShowSendTabButton(preferences.showSendTabButton ?? false);
      },
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // OSC 7501 program-reported status, reduced to one record per session.
  const programStatus = usePanelProgramStatus();
  const homeProgramStatus = useMemo(
    () =>
      toHomeProgramStatus(
        terminalCtx.terminalSessions,
        terminalCtx.terminalContext,
        programStatus,
      ),
    [terminalCtx.terminalSessions, terminalCtx.terminalContext, programStatus],
  );

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

  const terminalDirectory = baseDefaultDirectory || process.env.HOME || '/';

  // Remove the source tab only after the destination window accepted it.
  const handleTabDetached = useCallback(
    (tabId: string) => {
      const remaining = tabs.filter((tab) => tab.id !== tabId);
      setTabs(remaining);
      setActiveTabId((current) =>
        current === tabId ? (remaining[0]?.id ?? null) : current,
      );
    },
    [tabs, setTabs, setActiveTabId],
  );

  // Shared transfer entry for the bottom-bar button, topic header, and
  // drag-out. Resolves after main's claim/accept handshake; the source tab is
  // removed only on accept.
  const [detachingTabId, setDetachingTabId] = useState<string | null>(null);
  const [detachNotice, setDetachNotice] = useState<string | null>(null);
  const detachingRef = useRef(false);
  const detachTabToWindow = useCallback(
    async (
      tabId: string,
      dropPoint?: DetachedTabDropPoint,
    ): Promise<boolean> => {
      if (detachingRef.current) return false;
      const descriptor = toDetachableTabDescriptor(
        tabs.find((tab) => tab.id === tabId),
      );
      if (!descriptor) return false;

      detachingRef.current = true;
      setDetachingTabId(tabId);
      setDetachNotice(null);
      const result = await WindowService.openDetachedTab(descriptor, {
        dropPoint,
      });
      detachingRef.current = false;
      setDetachingTabId(null);

      if (result.ok && result.transferred) {
        handleTabDetached(tabId);
        return true;
      }
      setDetachNotice(
        result.ok && result.alreadyOpen
          ? 'Already open in its own window'
          : 'Could not open a new window; the tab was kept',
      );
      return false;
    },
    [tabs, handleTabDetached],
  );

  // Live drag state so the shell can say what releasing outside will do.
  const [tabDrag, setTabDrag] = useState<TabDragState | null>(null);
  useDragOutDetach({
    tabs,
    onDragOut: detachTabToWindow,
    onDragStateChange: setTabDrag,
  });
  const tabDragHint = describeTabDrag(tabDrag);

  // Auto-dismiss the transient detach notice (also shown as a toast).
  useEffect(() => {
    if (!detachNotice) return;
    const timer = setTimeout(() => setDetachNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [detachNotice]);

  const renderTabIcon = useCallback(
    (tab: WorkspaceTab) => {
      // The tab being moved shows the handshake in progress (up to 20s).
      if (tab.id === detachingTabId) {
        return (
          <Loader2
            size={14}
            style={{ animation: 'spin 0.8s linear infinite' }}
          />
        );
      }
      // Projects owns the icons for its tabs + the shared document tabs.
      const projectsIcon = renderProjectsTabIcon(tab as FeedTab);
      if (projectsIcon) return projectsIcon;
      switch (tab.contentType) {
        case 'terminal':
          return <Terminal size={14} />;
        case 'topics-home':
          return <TopicsIcon size={14} />;
        case 'local-topic':
          return <TopicsIcon size={14} />;
        case 'drawing':
          return <PenTool size={14} />;
        case 'skill':
          return <ToolCase size={14} />;
        case 'subsystem-model':
          return <Network size={14} />;
        case 'c4-sketch':
          return <PencilRuler size={14} />;
        case 'localhost-browser':
          return <Globe size={14} />;
        case 'http-request':
          return <Send size={14} />;
        default:
          return null;
      }
    },
    [detachingTabId],
  );

  // Open a repo from a topic tab's Projects rail. Mirrors a pick from the
  // Projects surface: a purl that matches a local clone opens that repo's
  // profile (with every clone aggregated), or a terminal for alternate gestures;
  // a remote-only GitHub purl opens the explorer for either gesture.
  // Emitted on the shell's local bus, which the Projects open-intent
  // forwarder lifts to the portal where `PortalIntentBridge` materializes the
  // tab.
  const handleOpenTopicProject = useCallback(
    (purl: string, target?: TopicProjectTarget) => {
      openTopicProject(
        eventsRef.current,
        repositoriesRef.current,
        purl,
        target,
      );
    },
    [],
  );

  const renderTabContent = useCallback(
    (tab: WorkspaceTab, _isActive: boolean) => {
      // Projects renders its own tabs + the shared document tabs (one source of
      // truth). It returns null for the Topics landing + topic tabs below.
      const projectsContent = renderProjectsTabContent(tab as FeedTab, {
        events: eventsRef.current,
        repositories: repositoriesRef.current,
      });
      if (projectsContent) return projectsContent;
      switch (tab.contentType) {
        case 'topics-home':
          return (
            <HomePanel
              icon={<TopicsIcon size={32} />}
              title="Your topics"
              body="Topics are subject briefs scoped to projects. Pick one from the panel on the left to read its description here."
            />
          );
        case 'local-topic': {
          const topicTab = tab as LocalTopicTab;
          return (
            <LocalTopicTabContent
              key={topicTab.id}
              topicId={topicTab.topicId}
              title={topicTab.title}
              events={eventsRef.current}
              onOpenProject={handleOpenTopicProject}
              onOpenModel={openSubsystemModel}
              onOpenTopic={openLocalTopic}
              onOpenSketch={openC4Sketch}
              onOpenDrawing={(drawingId, name, path) =>
                openDrawing({ drawingId, name, path })
              }
              onDetach={() => void detachTabToWindow(topicTab.id)}
            />
          );
        }
        case 'drawing': {
          const drawingTab = tab as DrawingTab;
          return (
            <DrawingTabContent
              key={drawingTab.id}
              tabId={drawingTab.id}
              drawingId={drawingTab.drawingId}
              path={drawingTab.path}
              name={drawingTab.name}
              events={eventsRef.current}
            />
          );
        }
        case 'subsystem-model': {
          const modelTab = tab as SubsystemModelTab;
          return (
            <SubsystemModelTabContent
              key={modelTab.id}
              modelId={modelTab.modelId}
            />
          );
        }
        case 'c4-sketch':
          return <C4SketchTabContent key={tab.id} sketchId={tab.sketchId} />;
        case 'localhost-browser': {
          const browserTab = tab as LocalhostBrowserTab;
          return (
            <LocalhostBrowserTabContent
              key={browserTab.id}
              port={browserTab.port}
              path={browserTab.path}
              processId={browserTab.processId}
              processStatus={browserTab.processStatus}
              processReady={browserTab.processReady}
              processRunCount={browserTab.processRunCount}
              navigationRevision={browserTab.navigationRevision}
            />
          );
        }
        case 'skill':
          return <SkillDetailTabContent key={tab.id} />;
        case 'http-request':
          return <HttpRequestTabContent key={tab.sessionId} tab={tab} />;
        default:
          return null;
      }
    },
    [
      handleOpenTopicProject,
      openSubsystemModel,
      openLocalTopic,
      openC4Sketch,
      openDrawing,
      detachTabToWindow,
    ],
  );

  // Open links clicked in the terminal in the default browser.
  useTerminalLinkHandler(events);

  // "Open a terminal here" from the Projects left panel + repository profile
  // tab. The panel owns tab identity and session creation (`requestOpenTab`), so
  // the host supplies intent only — it never invents a session context, which is
  // what used to collapse every terminal in a repo onto one tab.
  const [requestFocusTabId, setRequestFocusTabId] = useState<string | null>(
    null,
  );
  const [requestOpenTab, setRequestOpenTab] =
    useState<TerminalTabOpenRequest | null>(null);
  const handleOpenTabHandled = useCallback(() => setRequestOpenTab(null), []);
  const handleFocusTabHandled = useCallback(
    () => setRequestFocusTabId(null),
    [],
  );

  // Tab close after cross-window transfer.
  const [requestCloseTabId, setRequestCloseTabId] = useState<string | null>(
    null,
  );

  // Cmd+Shift+F file search: the git repo the active terminal sits in, resolved
  // lazily when the chord fires (see the keydown effect below).
  const [fileSearchRepo, setFileSearchRepo] = useState<{
    path: string;
    label: string;
  } | null>(null);
  // Transient feedback when the chord fires but there is no repo to search.
  const [fileSearchNotice, setFileSearchNotice] = useState<string | null>(null);

  // Cross-window tab receiver.
  const { incomingTab, clearIncomingTab } = useTabReceiver();
  const repoWindows = useOpenRepositoryWindows();

  // When a tab arrives from another window, create a terminal session for it.
  useEffect(() => {
    if (!incomingTab) return;
    void (async () => {
      try {
        const sessionId = await terminalActions.createTerminalSession({
          cwd: incomingTab.cwd || terminalDirectory,
          // Fully qualified: the receiving panel derives its tab id by stripping
          // `<terminalContext>:`, so the transferred tab keeps its identity.
          context: `${terminalCtx.terminalContext}:${incomingTab.tabId}`,
        });
        window.dispatchEvent(
          new CustomEvent('terminal-session-created', {
            detail: {
              sessionId,
              context: `${terminalCtx.terminalContext}:${incomingTab.tabId}`,
            },
          }),
        );
        setRequestFocusTabId(incomingTab.tabId);
      } catch (err) {
        console.error(
          '[WorkspaceShell] Failed to create session for incoming tab:',
          err,
        );
      }
    })();
    clearIncomingTab();
  }, [
    incomingTab,
    clearIncomingTab,
    terminalActions,
    terminalCtx.terminalContext,
    terminalDirectory,
  ]);

  // Find the active terminal tab's directory for the "show project" button.
  const activeTabDirectory = useMemo(() => {
    if (!activeTabId) return undefined;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab && 'directory' in activeTab) {
      return (activeTab as { directory: string }).directory;
    }
    return undefined;
  }, [activeTabId, tabs]);

  // Nearest-ancestor lookup: find the AlexandriaEntry whose path is the longest
  // prefix of the given directory (same logic as useTerminalRepoInfo).
  const findEntryForDirectory = useCallback(
    (directory: string): AlexandriaEntry | undefined => {
      let best: AlexandriaEntry | undefined;
      let bestLen = -1;
      for (const entry of repositories) {
        const repoPath = String(entry.path);
        if (
          (directory === repoPath || directory.startsWith(repoPath + '/')) &&
          repoPath.length > bestLen
        ) {
          best = entry;
          bestLen = repoPath.length;
        }
      }
      return best;
    },
    [repositories],
  );

  // Resolve a terminal working directory to a repository payload. Aggregates
  // every registered entry that shares the matched repo's purl so all clones are
  // listed (mirrors the Projects list's click-to-open payload).
  const resolveRepoPayloadForDirectory = useCallback(
    (directory: string): RepositorySelectedPayload | undefined => {
      const entry = findEntryForDirectory(directory);
      if (!entry) return undefined;
      const matchingEntries = repositories.filter((e) => {
        const ep = e.purl ?? e.github?.purl;
        const ip = entry.purl ?? entry.github?.purl;
        return ep && ip && ep === ip;
      });
      return payloadFromLocalEntry(
        entry,
        matchingEntries.length > 0 ? matchingEntries : undefined,
      );
    },
    [findEntryForDirectory, repositories],
  );

  // Reopen a Home rail entry whose tab has been closed (a pinned entry). Each
  // kind routes through the same opener that created it originally, so Home
  // never needs its own tab-construction path.
  const handleOpenHomeEntry = useCallback(
    (entry: HomeTabEntry) => {
      switch (entry.kind) {
        case 'http-request': {
          const saved = catalogRequests.find(
            (request) => request.id === entry.savedRequestId,
          );
          if (saved) openHttpRequest(requestDefinition(saved));
          break;
        }
        case 'topic':
          if (entry.topicId) openLocalTopic(entry.topicId, entry.title);
          break;
        case 'markdown-doc':
          if (entry.filePath) {
            openMarkdownDoc(entry.filePath, entry.repositoryPath);
          }
          break;
        case 'source-file':
          if (entry.filePath) openSourceFile(entry.filePath);
          break;
        case 'media':
          if (entry.filePath) openMedia(entry.filePath);
          break;
        case 'drawing':
          if (entry.drawingId) {
            eventsRef.current.emit({
              type: DRAWING_EVENTS.open,
              source: 'home-panel',
              timestamp: Date.now(),
              payload: {
                drawingId: entry.drawingId,
                path: entry.path,
                name: entry.name ?? entry.label,
              },
            });
          }
          break;
        case 'subsystem-model':
          if (entry.modelId) {
            openSubsystemModel(entry.modelId, entry.title ?? entry.label);
          }
          break;
        case 'skill':
          openSkill(entry.label);
          break;
        case 'localhost-browser':
          if (entry.port != null) {
            // A pinned browser tab is the one "launch" entry: when its linked
            // managed process is stopped, start it again before revealing the
            // tab. Unlinked/detected servers just reopen the URL tab.
            if (entry.processId) {
              void ProcessRegistryService.list()
                .then((processes) => {
                  const proc = processes.find(
                    (candidate) => candidate.id === entry.processId,
                  );
                  if (
                    proc?.origin === 'managed' &&
                    (proc.status === 'stopped' || proc.status === 'failed')
                  ) {
                    return ProcessRegistryService.restart(proc.id);
                  }
                  return undefined;
                })
                .catch((error) =>
                  console.warn(
                    '[WorkspaceShell] Failed to start pinned browser process:',
                    error,
                  ),
                );
            }
            openLocalhostBrowser(
              entry.port,
              entry.path ?? '/',
              entry.label,
              entry.processId,
            );
          }
          break;
        case 'terminal':
          // A terminal entry's id IS its tab id, so revealing it is a focus —
          // no session lookup, no chance of respawning a dead shell.
          setRequestFocusTabId(entry.id);
          break;
        case 'repo-tab': {
          if (!entry.purl) break;
          const purl = entry.purl as Purl;
          const matches = findEntriesByPurl(repositoriesRef.current, purl);
          const payload = matches[0]
            ? payloadFromLocalEntry(matches[0], matches)
            : payloadFromPurl(purl);
          if (entry.variant === 'repo-explorer') openRepoExplorer(payload);
          else if (entry.variant === 'file-city-guide')
            openFileCityGuide(payload);
          else openProjectInfo(payload);
          break;
        }
      }
    },
    [
      openLocalTopic,
      openHttpRequest,
      catalogRequests,
      openMarkdownDoc,
      openSourceFile,
      openMedia,
      openSubsystemModel,
      openSkill,
      openLocalhostBrowser,
      openRepoExplorer,
      openFileCityGuide,
      openProjectInfo,
    ],
  );

  const handleShowProject = useCallback(() => {
    if (!activeTabDirectory) return;
    let payload: RepositorySelectedPayload | undefined;
    try {
      payload = resolveRepoPayloadForDirectory(activeTabDirectory);
    } catch (err) {
      console.error('[WorkspaceShell] Failed to build repo payload:', err);
      return;
    }
    if (!payload) return;
    onOpenRepository(payload);
    // Expand the left panel if collapsed.
    if (isLeftCollapsed) {
      panelLayoutRef.current?.expandPanel('left');
      setIsLeftCollapsed(false);
      onCollapsedChange({ left: false, right: collapsed.right });
    }
  }, [
    activeTabDirectory,
    resolveRepoPayloadForDirectory,
    isLeftCollapsed,
    onOpenRepository,
    onCollapsedChange,
    collapsed.right,
  ]);

  // Resolve the clone that contains the active terminal's working directory to
  // a repo payload, or undefined when the terminal isn't rooted in a registered
  // clone.
  const resolveActiveTerminalRepoPayload = useCallback(():
    | RepositorySelectedPayload
    | undefined => {
    if (!activeTabDirectory) return undefined;
    try {
      return resolveRepoPayloadForDirectory(activeTabDirectory);
    } catch (err) {
      console.error('[WorkspaceShell] Failed to build repo payload:', err);
      return undefined;
    }
  }, [activeTabDirectory, resolveRepoPayloadForDirectory]);

  // Open (or focus) the project-info tab for the clone that contains the active
  // terminal's working directory. Emitted on the shell's local bus, which the
  // Projects open-intent forwarder lifts to the portal where PortalIntentBridge
  // materializes the tab — the same path as clicking the project in the
  // Projects list, so a remote-only clone still routes to the explorer.
  // Returns whether it actually resolved a clone (so the caller only consumes
  // the chord when there is something to open).
  const openProjectTabForActiveTerminal = useCallback((): boolean => {
    const payload = resolveActiveTerminalRepoPayload();
    if (!payload) return false;
    eventsRef.current.emit({
      type: PORTAL_INTENTS.repositorySelected,
      source: 'workspace-terminal-project-shortcut',
      timestamp: Date.now(),
      payload,
    });
    return true;
  }, [resolveActiveTerminalRepoPayload]);

  // Open (or focus) the owner/repo explorer for the clone that contains the
  // active terminal's working directory. Unlike the project chord this is
  // always the explorer, even for a locally-cloned repo whose project chord
  // would land on the profile tab. The explorer can't render without an
  // owner/repo, so a local-only clone (no GitHub identity) is a no-op and the
  // terminal keeps the chord.
  const openExplorerForActiveTerminal = useCallback((): boolean => {
    const payload = resolveActiveTerminalRepoPayload();
    if (!payload) return false;
    if (!payload.github?.owner || !payload.github?.name) return false;
    eventsRef.current.emit({
      type: PORTAL_INTENTS.repositoryExplorerOpen,
      source: 'workspace-terminal-explorer-shortcut',
      timestamp: Date.now(),
      payload,
    });
    return true;
  }, [resolveActiveTerminalRepoPayload]);

  // Cmd+Shift+O (Ctrl+Shift+O off macOS): open the project tab for the clone
  // the active terminal is sitting in. Capture phase + stopPropagation so the
  // terminal never sees the chord; a no-op when the active tab isn't a terminal
  // rooted in a registered clone.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !((e.metaKey || e.ctrlKey) && e.shiftKey) ||
        e.altKey ||
        e.code !== 'KeyO'
      ) {
        return;
      }
      if (!openProjectTabForActiveTerminal()) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [openProjectTabForActiveTerminal]);

  // Cmd+Shift+E (Ctrl+Shift+E off macOS): open the owner/repo explorer for the
  // clone the active terminal is sitting in. Same capture-phase guard as the
  // project chord; a no-op when the active tab isn't a terminal rooted in a
  // registered repo with a GitHub identity.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !((e.metaKey || e.ctrlKey) && e.shiftKey) ||
        e.altKey ||
        e.code !== 'KeyE'
      ) {
        return;
      }
      if (!openExplorerForActiveTerminal()) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [openExplorerForActiveTerminal]);

  // Cmd+Shift+F (Ctrl+Shift+F off macOS): open a file-search popup scoped to the
  // registered repository the active terminal is sitting in. Resolution goes
  // through the Alexandria registry (the same nearest-ancestor lookup Cmd+Shift+O
  // uses) — the file-tree infrastructure only serves registered repos, so an
  // unregistered directory shows a brief notice instead of opening the popup.
  // Capture phase + stopPropagation so the terminal never sees the chord; a no-op
  // when the active tab isn't a terminal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !((e.metaKey || e.ctrlKey) && e.shiftKey) ||
        e.altKey ||
        e.code !== 'KeyF'
      ) {
        return;
      }
      const directory = activeTabDirectory;
      if (!directory) return; // no active terminal → don't consume the chord
      if (fileSearchRepo) return; // already open → let the palette own the keys
      e.preventDefault();
      e.stopPropagation();
      const entry = findEntryForDirectory(directory);
      const repoPath = entry?.path ? String(entry.path) : undefined;
      if (!entry || !repoPath) {
        setFileSearchNotice('Not a registered repository');
        return;
      }
      const label =
        entry.github?.owner && entry.github?.name
          ? `${entry.github.owner}/${entry.github.name}`
          : entry.name || repoPath.split('/').filter(Boolean).pop() || repoPath;
      setFileSearchRepo({ path: repoPath, label });
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [activeTabDirectory, findEntryForDirectory, fileSearchRepo]);

  // Auto-dismiss the transient file-search notice.
  useEffect(() => {
    if (!fileSearchNotice) return;
    const timer = setTimeout(() => setFileSearchNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [fileSearchNotice]);

  // The active tab and its detached-window descriptor (null for tabs that
  // carry live state and cannot be reconstructed in another window).
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [tabs, activeTabId],
  );
  const detachableTab = useMemo(
    () => toDetachableTabDescriptor(activeTab),
    [activeTab],
  );

  // bottom-bar content for cross-window tab transfer (principal → dev-workspace)
  // and detaching the active tab into its own window.
  const bottomBarContent = useMemo(() => {
    const hasRepo = activeTabDirectory
      ? findEntryForDirectory(activeTabDirectory) !== undefined
      : false;
    if (!showSendTabButton && !hasRepo && !detachableTab) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {hasRepo && (
          <button
            onClick={handleShowProject}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontSize: 12,
              padding: '0 8px',
              whiteSpace: 'nowrap',
            }}
            title="Show this project in the side panel"
          >
            show project
          </button>
        )}
        {detachableTab && (
          <DetachTabButton
            busy={detachingTabId === detachableTab.tabId}
            notice={detachNotice}
            onDetach={() => void detachTabToWindow(detachableTab.tabId)}
          />
        )}
        {showSendTabButton && (
          <SendTabButton
            direction="to-dev-workspace"
            activeTabId={activeTabId}
            cwd={terminalDirectory}
            repoWindows={repoWindows}
            onTabDispatched={() => {
              if (activeTabId) setRequestCloseTabId(activeTabId);
            }}
          />
        )}
      </div>
    );
  }, [
    showSendTabButton,
    activeTabId,
    terminalDirectory,
    repoWindows,
    activeTabDirectory,
    findEntryForDirectory,
    handleShowProject,
    detachableTab,
    detachingTabId,
    detachNotice,
    detachTabToWindow,
  ]);
  useEffect(() => {
    const handleTerminalOpen = (event: { payload: TerminalNewPayload }) => {
      const directory = event.payload?.directory;
      if (!directory) return;
      // The panel mints the tab id and creates the session with a context
      // derived from it, so a second open in the same directory gets its own tab
      // instead of reattaching to the first one's session.
      setRequestOpenTab({ directory, label: event.payload?.label });
    };
    events.on(PORTAL_INTENTS.terminalNew, handleTerminalOpen);
    // The titlebar search lives outside the shell, so it can only reach the
    // portal bus (like its topic opens). Listen there too so a local-clone
    // pick from the titlebar materializes a terminal tab in this host.
    portalEvents.on(PORTAL_INTENTS.terminalNew, handleTerminalOpen);
    return () => {
      events.off(PORTAL_INTENTS.terminalNew, handleTerminalOpen);
      portalEvents.off(PORTAL_INTENTS.terminalNew, handleTerminalOpen);
    };
  }, [events, portalEvents]);

  // Route an absolute file path to the right viewer tab by extension — markdown
  // docs and media get their dedicated tabs, everything else the source viewer.
  // Shared by the bridge handoff below, the `file:opened` bus handler, and the
  // Cmd+Shift+F palette.
  const openFileByPath = useCallback(
    (filePath: string, repositoryPath?: string, range?: DocumentRange) => {
      const isMarkdown = /\.(md|mdx|markdown)$/i.test(filePath);
      const isMedia =
        /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|ogv)$/i.test(
          filePath,
        );
      if (isMarkdown && !range) {
        openMarkdownDoc(filePath, repositoryPath);
      } else if (isMedia) {
        openMedia(filePath);
      } else {
        openSourceFile(filePath, range);
      }
    },
    [openMarkdownDoc, openMedia, openSourceFile],
  );

  // Bridge handoff: a doc pushed from the Principal MCP Bridge
  // (POST /api/document/open) opens (or focuses) a tab. Route by extension like
  // any other opened file — a non-markdown path (`.env`, source, media) must
  // not land in the markdown tab, which would only render
  // "Select a markdown file to preview".
  useEffect(() => {
    return DocumentService.onOpenDocument(
      ({ filePath, repositoryPath, range }) => {
        if (!filePath) return;
        openFileByPath(filePath, repositoryPath, range);
      },
    );
  }, [openFileByPath]);

  // Bridge in-document doc links. The shared markdown link handler
  // (`useMarkdownLinkHandler`, used by topic descriptions and other markdown
  // surfaces here) resolves a click — including purl links — to a file and
  // emits `file:opened` on this bus. Route by extension, mirroring how the
  // Dev Workspace handles its own `file:opened` events.
  useEffect(() => {
    const handleFileOpened = (event: {
      source?: string;
      payload?: {
        filePath?: string;
        repositoryPath?: string;
        range?: DocumentRange;
      };
    }) => {
      if (event.source === 'tab') return; // ignore tab re-emits
      const filePath = event.payload?.filePath;
      if (!filePath) return;
      openFileByPath(
        filePath,
        event.payload?.repositoryPath,
        event.payload?.range,
      );
    };
    events.on('file:opened', handleFileOpened);
    return () => {
      events.off('file:opened', handleFileOpened);
    };
  }, [events, openFileByPath]);

  const handlePanelResize = useCallback(
    (sizes: { left: number; middle: number; right: number }) => {
      const leftCollapsed = sizes.left < 5;
      if (leftCollapsed !== isLeftCollapsed) {
        setIsLeftCollapsed(leftCollapsed);
        onCollapsedChange({ left: leftCollapsed, right: false });
      }
      onPanelSizesChange(sizes);
    },
    [isLeftCollapsed, onCollapsedChange, onPanelSizesChange],
  );

  const allPanels = useMemo(
    () => [
      {
        id: 'workspace-list',
        label:
          isRepositoryPanelActive && selectedRepository
            ? (selectedRepository.github?.name ??
              selectedRepository.localEntry?.github?.name ??
              'Repository')
            : activeView === 'home-panel'
              ? 'Home'
              : activeView === 'projects'
                ? 'Activity'
                : activeView === 'drawings'
                  ? 'Drawings'
                  : activeView === 'skills'
                    ? 'Skills'
                    : activeView === 'subsystem-models'
                      ? 'Subsystem Models'
                      : activeView === 'processes'
                        ? 'Processes'
                        : activeView === 'requests'
                          ? 'Requests'
                          : 'Topics',
        content:
          isRepositoryPanelActive && selectedRepository ? (
            <RepoAboutCard
              repo={selectedRepository}
              onDismiss={onCloseRepository}
              events={events}
              baseDefaultDirectory={baseDefaultDirectory}
            />
          ) : activeView === 'home-panel' ? (
            <HomeLeftPanel
              programStatusByTab={homeProgramStatus}
              tabs={tabs}
              repositories={repositories}
              events={events}
              aboutUser={aboutUser}
              userLoading={userLoading}
              activeTabId={activeTabId}
              onActivateTab={setActiveTabId}
              onOpenEntry={handleOpenHomeEntry}
            />
          ) : activeView === 'projects' ? (
            <ProjectsLeftPanel
              repositories={repositories}
              events={events}
              filter={projectFilter}
              onFilterChange={setProjectFilter}
            />
          ) : activeView === 'drawings' ? (
            <DrawingsLeftPanel events={events} />
          ) : activeView === 'skills' ? (
            <SkillsLeftPanel />
          ) : activeView === 'subsystem-models' ? (
            <SubsystemModelsLeftPanel
              events={portalEvents}
              activeTabId={activeTabId}
            />
          ) : activeView === 'processes' ? (
            <ProcessesView />
          ) : activeView === 'requests' ? (
            <RequestsLeftPanel />
          ) : (
            <TopicsLeftPanel events={portalEvents} />
          ),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <TabbedTerminalPanel<WorkspaceTab>
              context={terminalPanelContext}
              actions={terminalActions as TerminalPanelActions}
              events={events}
              terminalContext={terminalCtx.terminalContext}
              directory={terminalDirectory}
              renderer={terminalImplementation}
              getRepoInfo={getRepoInfo}
              programStatus={programStatus}
              initialTabs={tabs}
              onTabsChange={setTabs}
              activeTabId={activeTabId}
              onActiveTabChange={setActiveTabId}
              requestFocusTabId={requestFocusTabId}
              onFocusTabHandled={handleFocusTabHandled}
              requestOpenTab={requestOpenTab}
              onOpenTabHandled={handleOpenTabHandled}
              requestCloseTabId={requestCloseTabId}
              renderTabContent={renderTabContent}
              renderTabIcon={renderTabIcon}
              renderEmptyState={renderTerminalEmptyState}
              bottomBarContent={bottomBarContent}
            />
          </div>
        ),
      },
      {
        id: 'placeholder',
        label: 'Details',
        content: (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: theme.colors.background,
            }}
          />
        ),
      },
    ],
    [
      activeView,
      isRepositoryPanelActive,
      selectedRepository,
      onCloseRepository,
      portalEvents,
      events,
      repositories,
      aboutUser,
      userLoading,
      terminalPanelContext,
      terminalActions,
      terminalCtx.terminalContext,
      terminalDirectory,
      getRepoInfo,
      programStatus,
      homeProgramStatus,
      tabs,
      activeTabId,
      setTabs,
      setActiveTabId,
      requestFocusTabId,
      handleFocusTabHandled,
      requestOpenTab,
      handleOpenTabHandled,
      requestCloseTabId,
      handleOpenHomeEntry,
      renderTabContent,
      renderTabIcon,
      bottomBarContent,
      baseDefaultDirectory,
      terminalImplementation,
      theme,
      projectFilter,
    ],
  );

  return (
    // Skills surface providers wrap the shell stably (always mounted, so the
    // hidden skill detail tab keeps its context across surface switches); the
    // surface's heavy effects are gated on `skillsEnabled`.
    <SkillBrowserPanelProvider events={skillsBus}>
      <SkillsSurfaceProvider enabled={skillsEnabled}>
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: theme.colors.background,
          }}
        >
          <ConfigurablePanelLayout
            ref={panelLayoutRef}
            panels={allPanels}
            layout={layout}
            collapsiblePanels={{ left: true, right: true }}
            defaultSizes={panelSizes || { left: 25, middle: 75, right: 0 }}
            collapsed={{ left: collapsed.left, right: true }}
            showCollapseButtons={false}
            theme={theme}
            onPanelResize={handlePanelResize}
          />
          {/* Projects repository delete modal — always mounted with the shell. */}
          {deleteModal}
          {/* Cmd+Shift+F file search, scoped to the active terminal's repo. */}
          {fileSearchRepo && (
            <RepoFileSearchPalette
              repoPath={fileSearchRepo.path}
              repoLabel={fileSearchRepo.label}
              onClose={() => setFileSearchRepo(null)}
              onSelectFile={(absolutePath) => {
                openFileByPath(absolutePath, fileSearchRepo.path);
                setFileSearchRepo(null);
              }}
            />
          )}
          {fileSearchNotice && (
            <div
              style={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                padding: '8px 16px',
                borderRadius: 6,
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[2],
                fontFamily: theme.fonts.body,
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.4)',
                pointerEvents: 'none',
              }}
            >
              {fileSearchNotice}
            </div>
          )}
          {/* Detach feedback: the source tab dims while main runs the
              claim/accept handshake, and the outcome surfaces as a toast under
              the tab strip rather than only in the bottom bar. */}
          {detachingTabId && (
            <style>{`[data-tab-id="${detachingTabId.replace(/"/g, '\\"')}"] { opacity: 0.45 !important; pointer-events: none; }`}</style>
          )}
          {detachNotice && (
            <div
              role="status"
              style={{
                position: 'fixed',
                top: 56,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                padding: '8px 16px',
                borderRadius: 6,
                background: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[2],
                fontFamily: theme.fonts.body,
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.4)',
                pointerEvents: 'none',
              }}
            >
              {detachNotice}
            </div>
          )}
          {/* While a tab drag is outside the window, say what releasing does. */}
          {tabDragHint && (
            <div
              aria-live="polite"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10001,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(0, 0, 0, 0.25)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 8,
                  background: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  color: tabDrag?.detachable
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                  fontSize: theme.fontSizes[2],
                  fontFamily: theme.fonts.body,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                }}
              >
                {tabDrag?.detachable && <SquareArrowOutUpRight size={14} />}
                {tabDragHint}
              </div>
            </div>
          )}
        </div>
      </SkillsSurfaceProvider>
    </SkillBrowserPanelProvider>
  );
};

/**
 * WorkspaceShell — self-contained host (owns its local event bus, repositories
 * load, layout state) wrapped in a single `terminal:workspace` TerminalProvider.
 */
export const WorkspaceShell: React.FC<{
  activeView: WorkspaceView;
  leftSidebarCollapsed: boolean;
  onLeftSidebarCollapsedChange: (collapsed: boolean) => void;
  selectedRepository: RepositorySelectedPayload | null;
  isRepositoryPanelActive: boolean;
  onOpenRepository: (repository: RepositorySelectedPayload) => void;
  onCloseRepository: () => void;
}> = ({
  activeView,
  leftSidebarCollapsed,
  onLeftSidebarCollapsedChange,
  selectedRepository,
  isRepositoryPanelActive,
  onOpenRepository,
  onCloseRepository,
}) => {
  const { theme } = useTheme();
  const events = useMemo(() => new PanelEventBus(), []);

  // Local repositories used by project and topic surfaces.
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetchRepositories = async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        // Most-recently-opened first (matches the old Projects feed ordering).
        const sorted = [...repos].sort((a, b) => {
          if (a.lastOpenedAt && !b.lastOpenedAt) return -1;
          if (!a.lastOpenedAt && b.lastOpenedAt) return 1;
          const aTime = a.lastOpenedAt || a.registeredAt;
          const bTime = b.lastOpenedAt || b.registeredAt;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        if (!cancelled) setRepositories(sorted);
      } catch (err) {
        console.error('[WorkspaceShell] Failed to fetch repositories:', err);
        if (!cancelled) setRepositories([]);
      }
    };
    void fetchRepositories();
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      void fetchRepositories();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const [layout] = useState<PanelLayout>({
    left: 'workspace-list',
    middle: 'terminal',
    right: 'placeholder',
  });
  const collapsed = { left: leftSidebarCollapsed, right: false };
  const setCollapsed = (next: { left: boolean; right: boolean }) => {
    onLeftSidebarCollapsedChange(next.left);
  };
  const [panelSizes, setPanelSizes] = useState({
    left: 25,
    middle: 75,
    right: 0,
  });

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
      <TerminalProvider
        repositoryPath=""
        terminalContext="terminal:workspace"
        repoName="Workspace"
      >
        <WorkspaceShellInner
          activeView={activeView}
          events={events}
          repositories={repositories}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          selectedRepository={selectedRepository}
          isRepositoryPanelActive={isRepositoryPanelActive}
          onOpenRepository={onOpenRepository}
          onCloseRepository={onCloseRepository}
          layout={layout}
          panelSizes={panelSizes}
          onPanelSizesChange={setPanelSizes}
        />
      </TerminalProvider>
    </div>
  );
};

export default WorkspaceShell;
