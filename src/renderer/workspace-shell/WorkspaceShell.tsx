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
import { Layers, PenTool, ToolCase } from 'lucide-react';
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
  useTerminalActivity,
} from '../contexts/TerminalContext';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { WindowService } from '../main-process-api/WindowService';
import { useTerminalLinkHandler } from '../hooks/useTerminalLinkHandler';
import { useTerminalRepoInfo } from '../hooks/useTerminalRepoInfo';
import { SendTabButton } from '../move-tab/SendTabButton';
import { useTabReceiver } from '../move-tab/useTabReceiver';
import { RepoAboutCard } from '../panels/home-panel/RepoAboutCard';
import { payloadFromLocalEntry } from '../events/repositorySelected';
import type { RepositorySelectedPayload } from '../events/repositorySelected';
import { useOpenRepositoryWindows } from '../hooks/useOpenRepositoryWindows';
import {
  TabbedTerminalPanel,
  type TerminalWorkingState,
  type TerminalPanelActions,
} from '@industry-theme/xterm-terminal-panel';
import { TopicsLeftPanel } from '../panels/TopicsLeftPanel';
import { ProjectsLeftPanel } from '../panels/ProjectsLeftPanel';
import { HomeLeftPanel } from '../panels/home-panel';
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
import type { FeedTab, DrawingTab } from '../events/portalTabs';
import {
  useWorkspaceTabs,
  type WorkspaceTab,
} from '../principal-window/PortalTabsContext';
import { usePortalEvents } from '../principal-window/PortalEventContext';
import { DocumentService } from '../services/DocumentService';
import type { LocalTopicTab } from '../events/portalTabs';
import {
  PORTAL_INTENTS,
  type TerminalOpenPayload,
} from '../events/portalIntents';

/** Which surface's left panel + landing the shell currently shows. */
export type WorkspaceView =
  | 'home-panel'
  | 'projects'
  | 'topics'
  | 'drawings'
  | 'skills';

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
  layout,
  panelSizes,
  onPanelSizesChange,
}) => {
  const { theme } = useTheme();
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  const {
    context: terminalCtx,
    actions: terminalActions,
    activityActions,
  } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();
  // Resolves the active terminal's directory to repo context (owner/repo,
  // avatar, git status) for the panel's bottom status bar.
  const getRepoInfo = useTerminalRepoInfo();

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);
  const [showSendTabButton, setShowSendTabButton] = useState(false);
  const [selectedRepo, setSelectedRepo] =
    useState<RepositorySelectedPayload | null>(null);
  const [repoCardExiting, setRepoCardExiting] = useState(false);

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
  const { feedMode, setFeedMode, activityCommits, deleteModal } =
    useProjectsHost({ events, repositories });

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

  const renderTabIcon = useCallback((tab: WorkspaceTab) => {
    // Projects owns the icons for its tabs + the shared document tabs.
    const projectsIcon = renderProjectsTabIcon(tab as FeedTab);
    if (projectsIcon) return projectsIcon;
    switch (tab.contentType) {
      case 'topics-home':
        return <Layers size={14} />;
      case 'local-topic':
        return <Layers size={14} />;
      case 'drawing':
        return <PenTool size={14} />;
      case 'skill':
        return <ToolCase size={14} />;
      default:
        return null;
    }
  }, []);

  // Open a repository in a dev workspace (from an activity card's open action).
  const handleOpenRepository = useCallback((entry: AlexandriaEntry) => {
    void WindowService.openDevWorkspace({ alexandriaEntry: entry });
    eventsRef.current.emit({
      type: 'repository:opened',
      source: 'workspace-shell',
      timestamp: Date.now(),
      payload: { repositoryId: entry.name, repository: entry },
    });
  }, []);

  const renderTabContent = useCallback(
    (tab: WorkspaceTab, _isActive: boolean) => {
      // Projects renders its own tabs + the shared document tabs (one source of
      // truth). It returns null for the Topics landing + topic tabs below.
      const projectsContent = renderProjectsTabContent(tab as FeedTab, {
        events: eventsRef.current,
        repositories: repositoriesRef.current,
        onOpenRepository: handleOpenRepository,
      });
      if (projectsContent) return projectsContent;
      switch (tab.contentType) {
        case 'topics-home':
          return (
            <HomePanel
              icon={<Layers size={32} />}
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
        case 'skill':
          return <SkillDetailTabContent key={tab.id} />;
        default:
          return null;
      }
    },
    [handleOpenRepository],
  );

  // Open links clicked in the terminal in the default browser.
  useTerminalLinkHandler(events);

  // Reflect terminal working-state broadcasts.
  useEffect(() => {
    const handleActivityChanged = (event: {
      type: string;
      payload: { sessionId: string; isWorking: boolean };
    }) => {
      if (event.type === 'terminal:activity-changed') {
        activityActions.updateActivity({
          sessionId: event.payload.sessionId,
          isWorking: event.payload.isWorking,
        });
      }
    };
    events.on('terminal:activity-changed', handleActivityChanged);
    return () => {
      events.off('terminal:activity-changed', handleActivityChanged);
    };
  }, [events, activityActions]);

  // "Open a terminal here" from the Projects left panel + repository profile
  // tab. Mirrors the dev-workspace flow: create — or
  // reuse, since `createTerminalSession` dedupes by context — a session rooted at
  // the path, then point `requestFocusTabId` at the `tab-restored-<id>` tab the
  // TabbedTerminalPanel materializes from `terminalSessions`. Appending a
  // terminal tab to the shared bucket does NOT work: the panel seeds terminal
  // tabs from the session list, not from `initialTabs` after mount.
  const [requestFocusTabId, setRequestFocusTabId] = useState<string | null>(
    null,
  );
  const handleFocusTabHandled = useCallback(
    () => setRequestFocusTabId(null),
    [],
  );

  // Tab close after cross-window transfer.
  const [requestCloseTabId, setRequestCloseTabId] = useState<string | null>(
    null,
  );

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
          context: `tab:${incomingTab.tabId}`,
        });
        window.dispatchEvent(
          new CustomEvent('terminal-session-created', {
            detail: {
              sessionId,
              context: `${terminalCtx.terminalContext}:tab:${incomingTab.tabId}`,
            },
          }),
        );
        setRequestFocusTabId(`tab-restored-${sessionId}`);
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

  const handleShowProject = useCallback(() => {
    if (!activeTabDirectory) return;
    const entry = findEntryForDirectory(activeTabDirectory);
    if (!entry) return;
    const matchingEntries = repositories.filter((e) => {
      const ep = e.purl ?? e.github?.purl;
      const ip = entry.purl ?? entry.github?.purl;
      return ep && ip && ep === ip;
    });
    try {
      const payload = payloadFromLocalEntry(
        entry,
        matchingEntries.length > 0 ? matchingEntries : undefined,
      );
      setSelectedRepo(payload);
      setRepoCardExiting(false);
      // Expand the left panel if collapsed.
      if (isLeftCollapsed) {
        panelLayoutRef.current?.expandPanel('left');
        setIsLeftCollapsed(false);
        onCollapsedChange({ left: false, right: collapsed.right });
      }
    } catch (err) {
      console.error('[WorkspaceShell] Failed to build repo payload:', err);
    }
  }, [
    activeTabDirectory,
    findEntryForDirectory,
    repositories,
    isLeftCollapsed,
    onCollapsedChange,
    collapsed.right,
  ]);

  const dismissRepoCard = useCallback(() => {
    setRepoCardExiting(true);
    setTimeout(() => {
      setSelectedRepo(null);
      setRepoCardExiting(false);
    }, 320);
  }, []);

  // Switching the workspace surface (sidebar click) swaps the left panel, so
  // the RepoAboutCard slide-in from a previous surface must not linger on top
  // of it. Clear immediately — no exit animation — matching HomeLeftPanel's
  // `home-panel:show-overview` behavior.
  useEffect(() => {
    setSelectedRepo(null);
    setRepoCardExiting(false);
  }, [activeView]);

  // bottom-bar content for cross-window tab transfer (principal → dev-workspace).
  const bottomBarContent = useMemo(() => {
    const hasRepo = activeTabDirectory
      ? findEntryForDirectory(activeTabDirectory) !== undefined
      : false;
    if (!showSendTabButton && !hasRepo) return null;
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
  ]);
  useEffect(() => {
    const handleTerminalOpen = (event: { payload: TerminalOpenPayload }) => {
      const directory = event.payload?.directory;
      if (!directory) return;
      void (async () => {
        try {
          const sessionId = await terminalActions.createTerminalSession({
            cwd: directory,
            context: `repo:${directory}`,
          });
          window.dispatchEvent(
            new CustomEvent('terminal-session-created', {
              detail: {
                sessionId,
                context: `${terminalCtx.terminalContext}:repo:${directory}`,
              },
            }),
          );
          setRequestFocusTabId(`tab-restored-${sessionId}`);
        } catch (err) {
          console.error('[WorkspaceShell] Failed to open terminal:', err);
        }
      })();
    };
    events.on(PORTAL_INTENTS.terminalOpen, handleTerminalOpen);
    // The titlebar search lives outside the shell, so it can only reach the
    // portal bus (like its topic opens). Listen there too so a local-clone
    // pick from the titlebar materializes a terminal tab in this host.
    portalEvents.on(PORTAL_INTENTS.terminalOpen, handleTerminalOpen);
    return () => {
      events.off(PORTAL_INTENTS.terminalOpen, handleTerminalOpen);
      portalEvents.off(PORTAL_INTENTS.terminalOpen, handleTerminalOpen);
    };
  }, [events, portalEvents, terminalActions, terminalCtx.terminalContext]);

  // Bridge handoff: a doc pushed from the Principal MCP Bridge
  // (POST /api/document/open) opens (or focuses) a markdown tab.
  useEffect(() => {
    return DocumentService.onOpenDocument(({ filePath, repositoryPath }) => {
      if (!filePath) return;
      openMarkdownDoc(filePath, repositoryPath);
    });
  }, [openMarkdownDoc]);

  // Bridge in-document doc links. The shared markdown link handler
  // (`useMarkdownLinkHandler`, used by topic descriptions and other markdown
  // surfaces here) resolves a click — including purl links — to a file and
  // emits `file:opened` on this bus. Route by extension, mirroring how the
  // Dev Workspace handles its own `file:opened` events.
  useEffect(() => {
    const handleFileOpened = (event: {
      source?: string;
      payload?: { filePath?: string; repositoryPath?: string };
    }) => {
      if (event.source === 'tab') return; // ignore tab re-emits
      const filePath = event.payload?.filePath;
      if (!filePath) return;
      const isMarkdown = /\.(md|mdx|markdown)$/i.test(filePath);
      const isMedia =
        /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|ogv)$/i.test(
          filePath,
        );
      if (isMarkdown) {
        openMarkdownDoc(filePath, event.payload?.repositoryPath);
      } else if (isMedia) {
        openMedia(filePath);
      } else {
        openSourceFile(filePath);
      }
    };
    events.on('file:opened', handleFileOpened);
    return () => {
      events.off('file:opened', handleFileOpened);
    };
  }, [events, openMarkdownDoc, openSourceFile, openMedia]);

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
          activeView === 'home-panel'
            ? 'Home'
            : activeView === 'projects'
              ? feedMode === 'collections'
                ? 'Social'
                : feedMode === 'organizations'
                  ? 'Team'
                  : 'Activity'
              : activeView === 'drawings'
                  ? 'Drawings'
                  : activeView === 'skills'
                      ? 'Skills'
                      : 'Topics',
        content:
          activeView === 'home-panel' ? (
            <HomeLeftPanel repositories={repositories} events={events} />
          ) : activeView === 'projects' ? (
            <ProjectsLeftPanel
              repositories={repositories}
              events={events}
              feedMode={feedMode}
              onFeedModeChange={setFeedMode}
              activityCommits={activityCommits}
            />
          ) : activeView === 'drawings' ? (
            <DrawingsLeftPanel events={events} />
          ) : activeView === 'skills' ? (
            <SkillsLeftPanel />
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
              getRepoInfo={getRepoInfo}
              workingStates={workingStates}
              initialTabs={tabs}
              onTabsChange={setTabs}
              activeTabId={activeTabId}
              onActiveTabChange={setActiveTabId}
              requestFocusTabId={requestFocusTabId}
              onFocusTabHandled={handleFocusTabHandled}
              requestCloseTabId={requestCloseTabId}
              renderTabContent={renderTabContent}
              renderTabIcon={renderTabIcon}
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
      portalEvents,
      events,
      repositories,
      feedMode,
      setFeedMode,
      activityCommits,
      terminalPanelContext,
      terminalActions,
      terminalCtx.terminalContext,
      terminalDirectory,
      getRepoInfo,
      workingStates,
      tabs,
      activeTabId,
      setTabs,
      setActiveTabId,
      requestFocusTabId,
      handleFocusTabHandled,
      requestCloseTabId,
      renderTabContent,
      renderTabIcon,
      bottomBarContent,
      theme,
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
          {/* RepoAboutCard overlay — slides in over the left panel when a
              project is selected from the terminal bottom bar. */}
          {selectedRepo && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '25%',
                height: '100%',
                zIndex: 10,
                overflowY: 'auto',
                background: theme.colors.background,
                animation: repoCardExiting
                  ? 'repoAboutSlideOut 320ms ease forwards'
                  : 'repoAboutSlideIn 320ms ease',
              }}
            >
              <style>{`
                @keyframes repoAboutSlideIn {
                  from { transform: translateX(-100%); }
                  to   { transform: translateX(0); }
                }
                @keyframes repoAboutSlideOut {
                  from { transform: translateX(0); }
                  to   { transform: translateX(-100%); }
                }
              `}</style>
              <RepoAboutCard
                repo={selectedRepo}
                onDismiss={dismissRepoCard}
                events={events}
                baseDefaultDirectory={baseDefaultDirectory}
              />
            </div>
          )}
          {/* Projects repository delete modal — always mounted with the shell. */}
          {deleteModal}
        </div>
      </SkillsSurfaceProvider>
    </SkillBrowserPanelProvider>
  );
};

/**
 * WorkspaceShell — self-contained host (owns its local event bus, repositories
 * load, layout state) wrapped in a single `terminal:workspace` TerminalProvider.
 */
export const WorkspaceShell: React.FC<{ activeView: WorkspaceView }> = ({
  activeView,
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
  const [collapsed, setCollapsed] = useState({ left: false, right: false });
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
          layout={layout}
          panelSizes={panelSizes}
          onPanelSizesChange={setPanelSizes}
        />
      </TerminalProvider>
    </div>
  );
};

export default WorkspaceShell;
