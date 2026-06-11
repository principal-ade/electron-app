import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import {
  ConfigurablePanelLayout,
  ConfigurablePanelLayoutHandle,
  PanelLayout,
  usePanelFocus,
  usePanelKeyboardShortcuts,
  FocusIndicator,
} from '@principal-ade/panel-layouts';
import { PanelProvider, usePanelProvider } from '../contexts/PanelContext';
import {
  TerminalProvider,
  useTerminalProvider,
} from '../contexts/TerminalContext';
import { AgentHighlightProvider } from '../contexts/AgentHighlightContext';
import { TabbedTerminalPanel } from '@industry-theme/xterm-terminal-panel';
import { LocalProjectsPanel } from '@industry-theme/alexandria-panels';
import { panels as docsPanels } from '@industry-theme/alexandria-docs-panel';
import { localhostProcessesPanels, RecentRepositoriesPanel } from '../panels';
import { AlexandriaFilesPanel } from './files-panel/AlexandriaFilesPanel';
import {
  EventBusPanel,
  AgentToolsPanel,
} from '@industry-theme/agent-driven-ui-panels';
import { MarkdownPanel } from '../panels/markdown-panel';
import { PierreFileView } from '../dev-workspace/file-city-panel/PierreFileView';
import { MediaViewerPanel } from '../panels/MediaViewerPanel';
import {
  StoryboardListPanel,
  CanvasEditorPanel,
} from '@industry-theme/principal-view-panels';
import { panels as backlogPanels } from '@industry-theme/backlogmd-kanban-panel';
import { panels as agentPanels } from '@industry-theme/agent-panels'; // Keep as array - multiple panels with different IDs
import {
  GitHubIssuesPanel,
  GitHubIssueDetailPanel,
} from '@industry-theme/github-panels';
import {
  GitChangesPanel,
  PackageCompositionPanel,
} from '@industry-theme/repository-composition-panels';
import { panels as codeQualityPanels } from '@principal-ade/code-quality-panels';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { TerminalService } from '../main-process-api/TerminalService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { useTerminalLinkHandler } from '../hooks/useTerminalLinkHandler';
import { WindowService } from '../main-process-api/WindowService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { RemoveFromWorkspaceModal } from '../panels/components/RemoveFromWorkspaceModal';
import {
  PanelIconSidebar,
  ALEXANDRIA_LEFT_PANEL_ICONS,
} from '../components/Sidebar/PanelIconSidebar';
import { WorkspaceTrailsPanel } from './workspace-trails-panel/WorkspaceTrailsPanel';
import { TopicDescriptionSlideOver } from './topic-description-tab/TopicDescriptionSlideOver';
import { TrailService } from '../services/TrailService';
import { SessionsPanel } from './sessions-panel/SessionsPanel';
import { HookDebugPanel } from './hook-debug-panel/HookDebugPanel';
import {
  BRIEF_AGENT_CLICK_EVENT,
  BRIEF_AGENT_MIME,
  buildBriefingText,
  type BriefAgentDragPayload,
} from '../components/Titlebar/BriefAgentButton';
import { terminalClient } from '../tipc/terminalClient';
import { FileCityTrailTabContent } from './file-city-trail-tab/FileCityTrailTabContent';
import {
  MDXEditorPanel,
  type MDXEditorPanelActions,
  type MDXEditorPanelProps,
} from '@industry-theme/file-editing-panels';
import {
  buildTopicDescriptionPath,
  readTopicDescription,
  writeTopicDescription,
} from './topic-description-tab/topicDescriptionSentinel';
import type {
  AlexandriaTab,
  FileCityTrailTab,
  MarkdownDocTab,
  MediaTab,
  MermaidDiagramTab,
  SourceFileTab,
  TopicDescriptionTab,
} from './tab-types';
import { IndustryZoomableMermaidDiagram } from 'themed-markdown';
import type { TrailPayload } from '@industry-theme/file-city-panel';

type PanelDefinition = {
  id: string;
  label: string;
  content: React.ReactNode;
};

/**
 * Imperative handle for controlling panel collapse/expand
 */
export interface PanelControlHandle {
  collapseLeft: () => void;
  expandLeft: () => void;
  collapseRight: () => void;
  expandRight: () => void;
  /** Open the topic-description ("Notes") editor as a middle-panel tab. */
  openTopicDescription: () => void;
}

interface AlexandriaWorkspaceLayoutProps {
  workspace: Workspace;
  repository?: {
    name: string;
    path: string;
  };
  /**
   * Enable keyboard shortcuts for panel navigation (Alt+1, Alt+2, Alt+3)
   * @default false - Disabled by default until DOM focus integration is complete
   */
  enableKeyboardShortcuts?: boolean;
  /**
   * External collapsed state (controlled from titlebar)
   */
  collapsed?: { left: boolean; right: boolean };
  /**
   * Callback when collapsed state changes
   */
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
  /**
   * External layout state (controlled from titlebar for switch operations)
   */
  layout?: PanelLayout;
  /**
   * Callback when layout changes
   */
  onLayoutChange?: (layout: PanelLayout) => void;
  /**
   * Callback when a repository is selected or deselected
   */
  onRepositorySelected?: (
    repository: { name: string; path: string } | undefined,
  ) => void;
  /**
   * Show the panel icon sidebar
   * @default true
   */
  showPanelSidebar?: boolean;
  /**
   * Callback to receive panel control methods for imperative collapse/expand
   */
  onPanelControlReady?: (control: PanelControlHandle) => void;
  /**
   * Whether the topic-description slide-over is open. Toggled from the
   * titlebar's Description button; the overlay renders over the left column.
   */
  descriptionOpen?: boolean;
  /**
   * Suppress the slide-over's open animation — set when the notes are opened
   * by default on window launch so they appear in place instead of sliding in.
   */
  descriptionInstant?: boolean;
  /** Closes the topic-description slide-over. */
  onCloseDescription?: () => void;
}

interface AlexandriaWorkspaceLayoutContentProps {
  workspace: Workspace;
  selectedRepository?: { name: string; path: string };
  onRepositorySelected: (
    repository: { name: string; path: string } | undefined,
  ) => void;
  enableKeyboardShortcuts: boolean;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  layout: PanelLayout;
  onLayoutChange: (layout: PanelLayout) => void;
  showPanelSidebar: boolean;
  onPanelControlReady?: (control: PanelControlHandle) => void;
  descriptionOpen?: boolean;
  descriptionInstant?: boolean;
  onCloseDescription?: () => void;
}

/**
 * Content component that uses panel context
 */
const AlexandriaWorkspaceLayoutContent: React.FC<
  AlexandriaWorkspaceLayoutContentProps
> = ({
  workspace,
  selectedRepository,
  onRepositorySelected,
  enableKeyboardShortcuts,
  collapsed,
  onCollapsedChange,
  layout,
  onLayoutChange,
  showPanelSidebar,
  onPanelControlReady,
  descriptionOpen,
  descriptionInstant,
  onCloseDescription,
}) => {
  const { theme } = useTheme();
  const { context, actions, events } = usePanelProvider();
  // Open links clicked in the terminal in the default browser
  useTerminalLinkHandler(events);
  const { context: terminalCtx, actions: terminalActions } =
    useTerminalProvider();
  const [showAllTerminals, setShowAllTerminals] = useState(false);

  // Imperative focus request for the TabbedTerminalPanel — set when we want
  // a specific tab brought to front (e.g. clicking a repo card opens/focuses
  // a terminal for that repo). The panel clears it via onFocusTabHandled.
  const [focusTabId, setFocusTabId] = useState<string | null>(null);

  // Which terminal tab is currently visible. Tracked so the Brief Agent drop
  // handler can target the tab the user actually sees, instead of falling back
  // to the first session in the list. TabbedTerminalPanel doesn't expose its
  // internal tabId→sessionId map, so we capture it ourselves from
  // `renderTabContent` (which is called with sessionId for terminal tabs).
  const [activeTerminalTabId, setActiveTerminalTabId] = useState<string | null>(
    null,
  );
  const tabSessionMapRef = useRef<Map<string, string>>(new Map());
  // Wrapper around the TabbedTerminalPanel. Used as the search root for the
  // visible xterm textarea when we want to refocus the terminal after writing
  // a briefing — both the drag-drop and click paths need it. Storing it in a
  // ref means the click handler (driven by a window event from a sibling tree)
  // can find the same element the drop handler uses.
  const terminalPanelWrapperRef = useRef<HTMLDivElement | null>(null);

  // Non-terminal tabs hosted alongside terminals in the middle slot. Mirrors
  // dev-workspace: terminal tabs are managed inside TabbedTerminalPanel; we
  // only own custom tabs (currently just the singleton 'file-city-trail').
  const [tabs, setTabs] = useState<AlexandriaTab[]>([]);

  // Bump to force-remount the TabbedTerminalPanel. The panel manages terminal
  // tabs internally and won't drop them when a session is destroyed from
  // outside (e.g. when we tear down a repo's sessions on workspace removal).
  // Remounting triggers its `restoreOwnedSessions`, which rebuilds tabs from
  // the current live-session list — orphans disappear.
  const [terminalRemountKey, setTerminalRemountKey] = useState(0);

  // Payload of the trail currently shown in the file-city-trail tab. Held
  // at the layout level so re-renders of the tab content (singleton) swap
  // payloads cleanly when a different trail is activated.
  const [activeTrailPayload, setActiveTrailPayload] =
    useState<TrailPayload | null>(null);
  const [activeTrailRepoPath, setActiveTrailRepoPath] = useState<
    string | undefined
  >(undefined);

  // Ref for imperative panel layout control
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  // Refs to track current state
  const collapsedStateRef = useRef(collapsed);
  const onCollapsedChangeRef = useRef(onCollapsedChange);
  // Lets the once-mounted panel-control handle reach the latest
  // `handleOpenTopicDescription` (defined below) without re-subscribing.
  const openTopicDescriptionRef = useRef<() => void>(() => {});
  // Read inside the once-mounted file:opened listener so newly opened doc tabs
  // carry the currently selected repo without re-subscribing on every change.
  const selectedRepositoryRef = useRef(selectedRepository);
  selectedRepositoryRef.current = selectedRepository;

  // Update refs when props change
  useEffect(() => {
    collapsedStateRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    onCollapsedChangeRef.current = onCollapsedChange;
  }, [onCollapsedChange]);

  // Provide panel control methods to parent via callback (only once on mount)
  useEffect(() => {
    if (onPanelControlReady && panelLayoutRef.current) {
      const control: PanelControlHandle = {
        collapseLeft: () => {
          panelLayoutRef.current?.collapsePanel('left');
          collapsedStateRef.current = {
            ...collapsedStateRef.current,
            left: true,
          };
          onCollapsedChangeRef.current(collapsedStateRef.current);
        },
        expandLeft: () => {
          panelLayoutRef.current?.expandPanel('left');
          // After expand, ensure panel is at least 20% (library may restore to small size)
          const currentLayout = panelLayoutRef.current?.getLayout();
          if (currentLayout && currentLayout.left < 20) {
            panelLayoutRef.current?.setLayout({
              left: 25,
              middle: 50,
              right: currentLayout.right,
            });
          }
          collapsedStateRef.current = {
            ...collapsedStateRef.current,
            left: false,
          };
          onCollapsedChangeRef.current(collapsedStateRef.current);
        },
        collapseRight: () => {
          panelLayoutRef.current?.collapsePanel('right');
          collapsedStateRef.current = {
            ...collapsedStateRef.current,
            right: true,
          };
          onCollapsedChangeRef.current(collapsedStateRef.current);
        },
        expandRight: () => {
          panelLayoutRef.current?.expandPanel('right');
          // After expand, ensure panel is at least 20% (library may restore to small size)
          const currentLayout = panelLayoutRef.current?.getLayout();
          if (currentLayout && currentLayout.right < 20) {
            panelLayoutRef.current?.setLayout({
              left: currentLayout.left,
              middle: 50,
              right: 25,
            });
          }
          collapsedStateRef.current = {
            ...collapsedStateRef.current,
            right: false,
          };
          onCollapsedChangeRef.current(collapsedStateRef.current);
        },
        openTopicDescription: () => {
          openTopicDescriptionRef.current();
        },
      };
      onPanelControlReady(control);
    }
  }, [onPanelControlReady]);

  // Tear down whatever surface(s) currently host the active trail. Clearing
  // the payload empties both the middle tab and the right-panel slot; we also
  // drop the file-city-trail tab so the middle goes back to terminals-only,
  // and swap the right panel back to markdown-viewer + collapse it if it was
  // showing the trail explorer (deselecting should put the workspace back to
  // its idle two-pane shape).
  const handleCloseActiveTrail = useCallback(() => {
    setActiveTrailPayload(null);
    setActiveTrailRepoPath(undefined);
    setTabs((prev) => prev.filter((t) => t.contentType !== 'file-city-trail'));
    if (layout.right === 'trail-explorer') {
      onLayoutChange({ ...layout, right: 'markdown-viewer' });
      panelLayoutRef.current?.collapsePanel('right');
      collapsedStateRef.current = {
        ...collapsedStateRef.current,
        right: true,
      };
      onCollapsedChangeRef.current(collapsedStateRef.current);
    }
  }, [layout, onLayoutChange]);

  // Route a trail into the right panel's trail-explorer slot. Always force-
  // expand + resize to a usable width — the right panel may be collapsed,
  // sized to <20%, or out of sync with `collapsed.right`. Re-activating the
  // already-active trail closes it (toggle).
  const handleTrailOpenInRightPanel = useCallback(
    (payload: TrailPayload, repositoryPath?: string) => {
      if (activeTrailPayload?.id === payload.id) {
        handleCloseActiveTrail();
        return;
      }
      setActiveTrailPayload(payload);
      setActiveTrailRepoPath(repositoryPath);
      onLayoutChange({ ...layout, right: 'trail-explorer' });
      if (panelLayoutRef.current) {
        panelLayoutRef.current.expandPanel('right');
        const currentLayout = panelLayoutRef.current.getLayout();
        if (!currentLayout || currentLayout.right < 20) {
          panelLayoutRef.current.setLayout({
            left: currentLayout?.left ?? 23,
            middle: 50,
            right: 30,
          });
        }
      }
      collapsedStateRef.current = {
        ...collapsedStateRef.current,
        right: false,
      };
      onCollapsedChangeRef.current(collapsedStateRef.current);
    },
    [activeTrailPayload?.id, handleCloseActiveTrail, layout, onLayoutChange],
  );

  // Auto-open trails POSTed against this workspace's topic in the right
  // panel. `sendToTopicWindows` scopes PAYLOAD_SET delivery to windows
  // whose `metadata.topicIds` includes the topic, so this listener only
  // fires for trails meant for this workspace — no client-side filter
  // needed. The LEFT trails panel still refreshes via its own
  // `LIBRARY_CHANGED` listener.
  useEffect(() => {
    const off = TrailService.onPayloadSet(({ payload, repositoryPath }) => {
      handleTrailOpenInRightPanel(payload, repositoryPath);
    });
    return () => off();
  }, [handleTrailOpenInRightPanel]);

  // Force-open (or focus) the singleton file-city-trail tab in the middle,
  // mirroring dev-workspace's `openFileCityTrailTab`. Re-activating the
  // already-active trail closes it. Used by left-click when no terminals are
  // live, and by two-finger click as the explicit "give me a tab" override
  // regardless of terminal state.
  const handleTrailOpenInTab = useCallback(
    (payload: TrailPayload, repositoryPath?: string) => {
      if (activeTrailPayload?.id === payload.id) {
        handleCloseActiveTrail();
        return;
      }
      setActiveTrailPayload(payload);
      setActiveTrailRepoPath(repositoryPath);
      setTabs((prev) => {
        if (prev.some((t) => t.contentType === 'file-city-trail')) return prev;
        const newTab: FileCityTrailTab = {
          id: 'file-city-trail',
          label: 'Trail',
          contentType: 'file-city-trail',
          closable: true,
        };
        return [...prev, newTab];
      });
      setFocusTabId('file-city-trail');
    },
    [activeTrailPayload?.id, handleCloseActiveTrail],
  );

  // Open (or focus) the singleton topic-description editor tab. The tab carries
  // a sentinel path the MDXEditorPanel reads/writes through `topicEditorActions`
  // below, so editing round-trips `topic.description` via TopicService — no file
  // on disk. No-ops when the workspace has no topic.
  const handleOpenTopicDescription = useCallback(() => {
    const topicId = workspace.topicIds?.[0];
    if (!topicId) return;
    const filePath = buildTopicDescriptionPath(topicId);
    setTabs((prev) => {
      if (prev.some((t) => t.contentType === 'topic-description')) return prev;
      const newTab: TopicDescriptionTab = {
        id: 'topic-description',
        label: 'Braindump',
        contentType: 'topic-description',
        filePath,
        closable: true,
      };
      return [...prev, newTab];
    });
    setFocusTabId('topic-description');
  }, [workspace.topicIds]);
  openTopicDescriptionRef.current = handleOpenTopicDescription;

  // File actions handed to the topic-description MDXEditorPanel. Sentinel paths
  // route reads/writes to TopicService; everything else is delegated to the
  // host's live actions.
  //
  // This object MUST keep a stable identity. MDXEditorPanel re-runs its
  // file-load effect whenever its `actions` prop changes identity, and that
  // effect flips on a "Loading file..." screen while it re-reads. The provider
  // `actions` churns on every keystroke/save (active-file/git slices), so
  // spreading it here — and depending on `[actions]` — made the panel reload
  // and flash "Loading file..." after every Cmd+S. We read the live provider
  // actions through a ref instead, so the memo can be built once.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const topicEditorActions = useMemo<MDXEditorPanelActions>(() => {
    const readFile = (path: string) => readTopicDescription(path);
    const writeFile = (path: string, content: string) =>
      writeTopicDescription(path, content);
    return new Proxy({ readFile, writeFile } as MDXEditorPanelActions, {
      get(target, prop, receiver) {
        if (prop === 'readFile' || prop === 'writeFile') {
          return Reflect.get(target, prop, receiver);
        }
        return actionsRef.current[prop as keyof typeof actionsRef.current];
      },
    });
  }, []);

  // `renderTabContent` is a dep of the `panels` memo, so it must stay
  // identity-stable — otherwise every panel definition rebuilds on each
  // render. `context` (and the derived `topicEditorActions`) change identity
  // constantly (active-file/git slices churn on every keystroke and save), so
  // we read them through refs instead of listing them as callback deps. This
  // mirrors dev-workspace's renderTabContent. The MDX panel doesn't need live
  // context — it loads via `filePath`/`readFile` and manages its own buffer.
  const contextRef = useRef(context);
  contextRef.current = context;
  const topicEditorActionsRef = useRef(topicEditorActions);
  topicEditorActionsRef.current = topicEditorActions;

  // Left-click on a trail: if any terminal is live in this workspace, the
  // middle slot is "in use" — route the trail into the right panel instead so
  // the user doesn't lose their terminal context. Otherwise open (or focus)
  // the singleton file-city-trail tab in the middle.
  const handleTrailActivate = useCallback(
    (payload: TrailPayload, repositoryPath?: string) => {
      if (activeTrailPayload?.id === payload.id) {
        handleCloseActiveTrail();
        return;
      }
      if (terminalCtx.terminalSessions.length > 0) {
        handleTrailOpenInRightPanel(payload, repositoryPath);
        return;
      }
      handleTrailOpenInTab(payload, repositoryPath);
    },
    [
      activeTrailPayload?.id,
      handleCloseActiveTrail,
      terminalCtx.terminalSessions.length,
      handleTrailOpenInRightPanel,
      handleTrailOpenInTab,
    ],
  );

  // Sync from the TabbedTerminalPanel. Terminal tabs are managed inside the
  // panel — we only persist non-terminal entries so closing the trail tab
  // (via its X) actually removes it from our state.
  const handleTabsChange = useCallback((next: AlexandriaTab[]) => {
    setTabs((prev) => {
      const nextCustom = next.filter((t) => t.contentType !== 'terminal');
      const prevCustom = prev.filter((t) => t.contentType !== 'terminal');
      const sameLength = nextCustom.length === prevCustom.length;
      const sameIds =
        sameLength &&
        nextCustom.every((t) => prevCustom.some((p) => p.id === t.id));
      if (sameIds) return prev;
      return nextCustom;
    });
  }, []);

  const renderTabContent = useCallback(
    (tab: AlexandriaTab, _isActive?: boolean, sessionId?: string | null) => {
      if (tab.contentType === 'terminal') {
        if (sessionId) {
          tabSessionMapRef.current.set(tab.id, sessionId);
        } else {
          tabSessionMapRef.current.delete(tab.id);
        }
      }
      if (tab.contentType === 'file-city-trail') {
        return (
          <FileCityTrailTabContent
            trailPayload={activeTrailPayload}
            repositoryPath={activeTrailRepoPath}
            events={events}
          />
        );
      }
      if (tab.contentType === 'topic-description') {
        return (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MDXEditorPanel
              context={contextRef.current as MDXEditorPanelProps['context']}
              actions={topicEditorActionsRef.current}
              events={events}
              filePath={tab.filePath}
              showCloseButton={false}
            />
          </div>
        );
      }
      if (tab.contentType === 'markdown-doc') {
        return (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MarkdownPanel
              context={contextRef.current}
              actions={actionsRef.current}
              events={events}
              filePath={tab.filePath}
              repositoryPath={tab.repositoryPath}
            />
          </div>
        );
      }
      if (tab.contentType === 'source-file') {
        return (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'auto',
              position: 'relative',
            }}
          >
            <PierreFileView filePath={tab.filePath} fileName={tab.label} />
          </div>
        );
      }
      if (tab.contentType === 'media') {
        return (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MediaViewerPanel filePath={tab.filePath} fileName={tab.label} />
          </div>
        );
      }
      if (tab.contentType === 'mermaid-diagram') {
        return (
          <div
            style={{
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <IndustryZoomableMermaidDiagram
              code={tab.code}
              id={tab.id}
              theme={theme}
              fitStrategy="contain"
            />
          </div>
        );
      }
      // Terminal tabs: return null → TabbedTerminalPanel renders its default.
      return null;
    },
    [activeTrailPayload, activeTrailRepoPath, events, theme],
  );

  // Get terminal context and directory from TerminalProvider
  const terminalContext = terminalCtx.terminalContext || 'terminal:default';
  const terminalDirectory = terminalCtx.repositoryPath || '/';

  // Create merged context for TabbedTerminalPanel (includes terminal sessions from TerminalProvider)
  const terminalPanelContext = useMemo(
    () => ({
      ...context,
      terminalSessions: terminalCtx.terminalSessions,
      terminalContext: terminalCtx.terminalContext,
    }),
    [context, terminalCtx.terminalSessions, terminalCtx.terminalContext],
  );

  // The repo path whose terminal tab is currently visible. Drives the
  // "active terminal" border on the Projects panel: only the project whose
  // terminal the user is actually looking at gets the highlight, while every
  // project with a live session still shows the terminal icon. Resolved from
  // the active tab via our captured tab→session map, then matching the
  // session's `repo:` context. Null when no terminal tab is active (e.g. a
  // file-city-trail tab is selected) or the active tab isn't repo-pinned.
  const activeTerminalRepoPath = useMemo(() => {
    if (!activeTerminalTabId) return null;
    const sessionId = tabSessionMapRef.current.get(activeTerminalTabId);
    if (!sessionId) return null;
    const session = terminalCtx.terminalSessions.find((s) => s.id === sessionId);
    const prefix = `${terminalContext}:repo:`;
    if (session?.context?.startsWith(prefix)) {
      return session.context.slice(prefix.length);
    }
    return null;
  }, [activeTerminalTabId, terminalCtx.terminalSessions, terminalContext]);

  // Context for the configurable left ("Projects") panel. Carries the active
  // terminal's repo path through `context` rather than a sibling prop so the
  // panel keeps the standard context/actions/events contract.
  const workspacePanelContext = useMemo(
    () => ({ ...context, activeTerminalRepoPath }),
    [context, activeTerminalRepoPath],
  );

  // State for remove from workspace modal
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [entryToRemove, setEntryToRemove] = useState<AlexandriaEntry | null>(
    null,
  );
  const [workspaceForRemoval, setWorkspaceForRemoval] =
    useState<Workspace | null>(null);

  // Currently displayed markdown file in the right panel. The MarkdownPanel
  // owns its own read + watch — we just feed it the path.
  const [activeMarkdownPath, setActiveMarkdownPath] = useState<string | null>(
    null,
  );

  // Handle removal modal close
  const handleCloseRemoveModal = useCallback(() => {
    setIsRemoveModalOpen(false);
    setEntryToRemove(null);
    setWorkspaceForRemoval(null);
  }, []);

  // Brief Agent: handle a topic-briefing drop on the terminal panel. Picks a
  // target session by matching the selected repo's context, falling back to
  // the first available terminal session.
  //
  // Capture phase: the inner TabbedTerminalPanel (and xterm canvas) install
  // their own drag handlers that stopPropagation, so bubble-phase listeners
  // on the wrapper never fire for drops inside the terminal body.
  const handleTerminalDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (e.dataTransfer.types.includes(BRIEF_AGENT_MIME)) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [],
  );

  // Shared briefing executor — used by both the drag-drop and the click paths.
  // Picks the visible terminal, writes the briefing prompt, and refocuses the
  // terminal's xterm input so the user can hit Enter without re-clicking.
  const briefAgent = useCallback(
    async (payload: BriefAgentDragPayload) => {
      const sessions = terminalCtx.terminalSessions;
      // Prefer the terminal tab the user is actually looking at. For drops,
      // it landed inside its body; for clicks, it's the only one the user
      // can see right now. Fall back to repo-context match, then first
      // session, for the edge case where the active-tab signal isn't
      // available yet (e.g. mount race) or its session has been destroyed.
      let target = undefined as (typeof sessions)[number] | undefined;
      if (activeTerminalTabId) {
        const activeSessionId =
          tabSessionMapRef.current.get(activeTerminalTabId);
        if (activeSessionId) {
          target = sessions.find((s) => s.id === activeSessionId);
        }
      }
      if (!target && selectedRepository) {
        const repoContext = `${terminalContext}:repo:${selectedRepository.path}`;
        target = sessions.find((s) => s.context === repoContext);
      }
      if (!target) target = sessions[0];
      if (!target) return;

      try {
        await terminalClient.writeToSession({
          sessionId: target.id,
          data: buildBriefingText(payload),
        });
        // If for some reason we fell back to a non-active tab, bring it
        // forward. requestFocusTabId takes a tab ID, not a session ID — look
        // up the tab ID via our captured map.
        let targetTabId: string | null = null;
        for (const [tabId, sid] of tabSessionMapRef.current.entries()) {
          if (sid === target.id) {
            targetTabId = tabId;
            break;
          }
        }
        if (targetTabId && targetTabId !== activeTerminalTabId) {
          setFocusTabId(targetTabId);
        }
        // Focus the xterm input directly. TabbedTerminalPanel's
        // requestFocusTabId only activates the tab — when the briefed tab
        // is already active (the common case) it short-circuits and never
        // calls terminal.focus(). Without this the next keystroke goes
        // nowhere. Defer one frame so any tab swap has flushed.
        requestAnimationFrame(() => {
          const root = terminalPanelWrapperRef.current;
          if (!root) return;
          const textareas = root.querySelectorAll<HTMLTextAreaElement>(
            '.xterm-helper-textarea',
          );
          for (const ta of Array.from(textareas)) {
            // Inactive tabs stay mounted with opacity:0 + the `inert`
            // attribute (not display:none), so offsetParent stays non-null
            // for all of them. Filter by the inert ancestor instead — only
            // the visible tab lacks one.
            if (!ta.closest('[inert]')) {
              ta.focus();
              break;
            }
          }
        });
      } catch (err) {
        console.error('[BriefAgent] writeToSession failed', err);
      }
    },
    [
      terminalCtx.terminalSessions,
      terminalContext,
      selectedRepository,
      activeTerminalTabId,
    ],
  );

  const handleTerminalDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      const raw = e.dataTransfer.getData(BRIEF_AGENT_MIME);
      if (!raw) return;
      e.preventDefault();
      e.stopPropagation();

      let payload: BriefAgentDragPayload;
      try {
        payload = JSON.parse(raw) as BriefAgentDragPayload;
      } catch (err) {
        console.error('[BriefAgent] invalid drag payload', err);
        return;
      }

      await briefAgent(payload);
    },
    [briefAgent],
  );

  // Click path: BriefAgentButton lives in the titlebar (a sibling React tree),
  // so it tells us to brief by dispatching a window CustomEvent carrying the
  // same payload shape the drag path uses.
  useEffect(() => {
    const onBriefAgentClick = (e: Event) => {
      const payload = (e as CustomEvent<BriefAgentDragPayload>).detail;
      if (!payload || !payload.topicId) return;
      void briefAgent(payload);
    };
    window.addEventListener(BRIEF_AGENT_CLICK_EVENT, onBriefAgentClick);
    return () => {
      window.removeEventListener(BRIEF_AGENT_CLICK_EVENT, onBriefAgentClick);
    };
  }, [briefAgent]);

  // Handle removal confirmation
  const handleConfirmRemove = useCallback(
    async (moveToDefault: boolean) => {
      if (!entryToRemove || !workspaceForRemoval) return;

      try {
        // Remove from workspace first (while entry still has original path)
        // Pass full entry so core library can extract github.id for matching
        await WorkspaceService.removeRepositoryFromWorkspace(
          entryToRemove,
          workspaceForRemoval.id,
        );

        // Refresh the workspace repositories in context
        context.refresh('workspace', 'workspaceRepositories');

        // Then move to default directory if requested
        if (moveToDefault) {
          await WorkspaceService.moveRepositoryToDefaultDirectory(
            entryToRemove,
          );
        }
      } catch (error) {
        console.error(
          '[AlexandriaWorkspaceLayout] Failed to remove from workspace:',
          error,
        );
        throw error;
      }
    },
    [entryToRemove, workspaceForRemoval, context],
  );

  // Panel focus management for keyboard shortcuts
  const { focusedPanel, setFocus, isFocused } = usePanelFocus({
    initialFocus: enableKeyboardShortcuts ? 'middle' : null, // Only set initial focus if shortcuts enabled
    collapsed,
    panelType: 'three-panel',
  });

  // Collapse/expand handlers for sidebar and keyboard shortcuts
  const handleLeftExpand = useCallback(() => {
    panelLayoutRef.current?.expandPanel('left');
    // After expand, ensure panel is at least 20% (library may restore to small size)
    const currentLayout = panelLayoutRef.current?.getLayout();
    if (currentLayout && currentLayout.left < 20) {
      panelLayoutRef.current?.setLayout({
        left: 25,
        middle: 50,
        right: currentLayout.right,
      });
    }
    collapsedStateRef.current = { ...collapsedStateRef.current, left: false };
    onCollapsedChangeRef.current(collapsedStateRef.current);
  }, []);

  const handleLeftCollapse = useCallback(() => {
    panelLayoutRef.current?.collapsePanel('left');
    collapsedStateRef.current = { ...collapsedStateRef.current, left: true };
    onCollapsedChangeRef.current(collapsedStateRef.current);
  }, []);

  const handleRightExpand = useCallback(() => {
    panelLayoutRef.current?.expandPanel('right');
    // After expand, ensure panel is at least 20% (library may restore to small size)
    const currentLayout = panelLayoutRef.current?.getLayout();
    if (currentLayout && currentLayout.right < 20) {
      panelLayoutRef.current?.setLayout({
        left: currentLayout.left,
        middle: 50,
        right: 25,
      });
    }
    collapsedStateRef.current = { ...collapsedStateRef.current, right: false };
    onCollapsedChangeRef.current(collapsedStateRef.current);
  }, []);

  const handleRightCollapse = useCallback(() => {
    panelLayoutRef.current?.collapsePanel('right');
    collapsedStateRef.current = { ...collapsedStateRef.current, right: true };
    onCollapsedChangeRef.current(collapsedStateRef.current);
  }, []);

  // Legacy handlers for keyboard shortcuts (converted to use imperative methods)
  const handleExpand = useCallback(
    async (panel: 'left' | 'right') => {
      if (panel === 'left') {
        handleLeftExpand();
      } else {
        handleRightExpand();
      }
    },
    [handleLeftExpand, handleRightExpand],
  );

  const handleCollapse = useCallback(
    async (panel: 'left' | 'right') => {
      if (panel === 'left') {
        handleLeftCollapse();
      } else {
        handleRightCollapse();
      }
    },
    [handleLeftCollapse, handleRightCollapse],
  );

  // Keyboard shortcuts (Alt+1, Alt+2, Alt+3)
  // NOTE: Disabled by default until DOM focus integration is implemented
  // to prevent interference with terminal keyboard bindings
  usePanelKeyboardShortcuts({
    enabled: enableKeyboardShortcuts,
    focusedPanel,
    collapsed,
    panelType: 'three-panel',
    setFocus,
    onExpand: handleExpand,
    onCollapse: handleCollapse,
  });

  // Listen for repository:selected events (for updating context, NOT opening windows)
  useEffect(() => {
    const unsubscribe = events.on('repository:selected', async (event) => {
      const { repository, repositoryPath } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
        repositoryPath: string;
      };

      console.info(
        '[AlexandriaWorkspaceLayout] Repository selected event received:',
        {
          repository,
          repositoryPath,
        },
      );

      if (repository) {
        const repoPath = repositoryPath || repository.path;

        // Toggle: if clicking on the already selected repo, deselect it
        if (selectedRepository && selectedRepository.path === repoPath) {
          console.info(
            '[AlexandriaWorkspaceLayout] Deselecting repository:',
            selectedRepository.name,
          );
          onRepositorySelected(undefined);
        } else {
          const selectedRepo = {
            name: repository.name,
            path: repoPath,
          };
          console.info(
            '[AlexandriaWorkspaceLayout] Updating selected repository:',
            selectedRepo,
          );
          onRepositorySelected(selectedRepo);

          // Auto-add this repo to the current workspace if it's not already
          // a member. Clicking a project in the panel is now the canonical
          // way to add it — there's no longer a separate "Add" button.
          try {
            const alreadyMember =
              await WorkspaceService.isRepositoryInWorkspace(
                repository,
                workspace.id,
              );
            if (!alreadyMember) {
              await WorkspaceService.addRepositoryToWorkspace(
                repository,
                workspace.id,
              );
              context.refresh('workspace', 'workspaceRepositories');
            }
          } catch (err) {
            console.error(
              '[AlexandriaWorkspaceLayout] Failed to add repo to workspace:',
              err,
            );
          }

          // Open a terminal tab pinned to this repo, or focus the existing
          // one if its session is already alive. The renderer-side
          // `createTerminalSession` does NOT de-dupe by context (and the
          // main-side `createSession` always spawns a fresh pty), so we
          // check the live session list ourselves and only create when no
          // session matches `${terminalContext}:repo:${repoPath}`.
          const fullSessionContext = `${terminalContext}:repo:${repoPath}`;
          try {
            const sessions = await TerminalService.list();
            const existing = sessions.find(
              (s) => s.context === fullSessionContext,
            );
            if (existing) {
              setFocusTabId(`tab-restored-${existing.id}`);
            } else {
              const sessionId = await terminalActions.createTerminalSession({
                cwd: repoPath,
                context: `repo:${repoPath}`,
              });
              window.dispatchEvent(
                new CustomEvent('terminal-session-created', {
                  detail: { sessionId, context: fullSessionContext },
                }),
              );
              setFocusTabId(`tab-restored-${sessionId}`);
            }
          } catch (err) {
            console.error(
              '[AlexandriaWorkspaceLayout] Failed to open terminal for repo:',
              err,
            );
          }
        }
      }
    });

    return unsubscribe;
  }, [
    events,
    onRepositorySelected,
    selectedRepository,
    terminalActions,
    terminalContext,
    workspace.id,
    context,
  ]);

  // Listen for repository:opened events (for explicitly opening windows)
  useEffect(() => {
    const unsubscribe = events.on('repository:opened', async (event) => {
      const { repository, repositoryPath } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
        repositoryPath: string;
      };

      console.info(
        '[AlexandriaWorkspaceLayout] Repository opened event received:',
        {
          repository,
          repositoryPath,
        },
      );

      if (repository) {
        // Open the repository in a new dev workspace window
        try {
          await WindowService.openDevWorkspace({
            alexandriaEntry: repository,
          });
        } catch (error) {
          console.error(
            '[AlexandriaWorkspaceLayout] Failed to open dev workspace:',
            error,
          );
        }
      }
    });

    return unsubscribe;
  }, [events]);

  // Listen for repository:removeFromWorkspace — the hover-X on the projects
  // card. Removes membership, tears down any repo-pinned terminal sessions in
  // this workspace's context, and deselects the repo if it was active.
  useEffect(() => {
    const unsubscribe = events.on(
      'repository:removeFromWorkspace',
      async (event) => {
        const { repository, repositoryPath } = event.payload as {
          repositoryId: string;
          repository: AlexandriaEntry;
          repositoryPath: string;
        };
        if (!repository) return;
        const repoPath = repositoryPath || repository.path;

        try {
          await WorkspaceService.removeRepositoryFromWorkspace(
            repository,
            workspace.id,
          );
          context.refresh('workspace', 'workspaceRepositories');
        } catch (err) {
          console.error(
            '[AlexandriaWorkspaceLayout] Failed to remove repo from workspace:',
            err,
          );
          return;
        }

        // Tear down terminal sessions pinned to this repo within this
        // workspace's context. Sessions in other workspaces are untouched.
        let destroyed = 0;
        try {
          const fullSessionContext = `${terminalContext}:repo:${repoPath}`;
          const sessions = await TerminalService.list();
          const targets = sessions.filter(
            (s) => s.context === fullSessionContext,
          );
          await Promise.all(
            targets.map((s) => terminalActions.destroyTerminalSession(s.id)),
          );
          destroyed = targets.length;
        } catch (err) {
          console.error(
            '[AlexandriaWorkspaceLayout] Failed to close terminal tabs for removed repo:',
            err,
          );
        }

        // Force the TabbedTerminalPanel to re-derive its tabs from the live
        // session list, so the destroyed sessions' tab chrome disappears.
        if (destroyed > 0) {
          setTerminalRemountKey((k) => k + 1);
        }

        // Deselect if the removed repo was the active selection.
        if (selectedRepository?.path === repoPath) {
          onRepositorySelected(undefined);
        }
      },
    );

    return unsubscribe;
  }, [
    events,
    workspace.id,
    context,
    terminalContext,
    terminalActions,
    selectedRepository,
    onRepositorySelected,
  ]);

  // Listen for repository:addToWorkspace — the hover-+ on a non-member
  // project card. Adds membership without selecting the repo or opening a
  // terminal tab; the user can click the card afterward to do those.
  useEffect(() => {
    const unsubscribe = events.on(
      'repository:addToWorkspace',
      async (event) => {
        const { repository } = event.payload as {
          repositoryId: string;
          repository: AlexandriaEntry;
          repositoryPath: string;
        };
        if (!repository) return;

        try {
          const alreadyMember = await WorkspaceService.isRepositoryInWorkspace(
            repository,
            workspace.id,
          );
          if (!alreadyMember) {
            await WorkspaceService.addRepositoryToWorkspace(
              repository,
              workspace.id,
            );
            context.refresh('workspace', 'workspaceRepositories');
          }
        } catch (err) {
          console.error(
            '[AlexandriaWorkspaceLayout] Failed to add repo to workspace:',
            err,
          );
        }
      },
    );

    return unsubscribe;
  }, [events, workspace.id, context]);

  // Listen for file:opened events (from Alexandria docs panel). Clicking a doc
  // opens it as a tab in the middle slot — one tab per distinct file, keyed by
  // absolute path. If the doc already has a tab, just bring it to front.
  useEffect(() => {
    const unsubscribe = events.on('file:opened', async (event) => {
      const { filePath, repositoryPath } = event.payload as {
        filePath: string;
        repositoryPath?: string;
      };

      if (!filePath) {
        console.warn('[AlexandriaWorkspaceLayout] file:opened with no path');
        return;
      }

      const label = filePath.split('/').pop() || filePath;
      // Route by file type, mirroring the dev workspace: markdown →
      // MarkdownPanel, image/video → MediaViewerPanel, everything else →
      // read-only PierreFileView. Distinct tab-id prefixes so the same path
      // can't collide across viewers.
      const isMarkdown = /\.(md|mdx|markdown)$/i.test(filePath);
      const isMedia =
        /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|mp4|webm|mov|avi|mkv|ogv)$/i.test(
          filePath,
        );

      let newTab: MarkdownDocTab | SourceFileTab | MediaTab;
      if (isMarkdown) {
        newTab = {
          id: `markdown-doc:${filePath}`,
          label,
          contentType: 'markdown-doc',
          filePath,
          // Prefer the emitter's repo (e.g. a link into another project keeps
          // its own context); fall back to the selected repo.
          repositoryPath: repositoryPath ?? selectedRepositoryRef.current?.path,
          closable: true,
        };
      } else if (isMedia) {
        newTab = {
          id: `media:${filePath}`,
          label,
          contentType: 'media',
          filePath,
          closable: true,
        };
      } else {
        newTab = {
          id: `source-file:${filePath}`,
          label,
          contentType: 'source-file',
          filePath,
          closable: true,
        };
      }
      const { id: tabId } = newTab;

      setTabs((prev) =>
        prev.some((t) => t.id === tabId) ? prev : [...prev, newTab],
      );
      setFocusTabId(tabId);
    });

    return unsubscribe;
  }, [events]);

  // Listen for mermaid:open-in-tab events (from a markdown diagram's "open in
  // tab" arrow button, emitted by IndustryMarkdownSlide via onOpenMermaidInTab).
  // Opens the diagram as its own tab in the middle slot. Keyed by a hash of the
  // diagram source so re-clicking the same diagram focuses the existing tab.
  useEffect(() => {
    const unsubscribe = events.on('mermaid:open-in-tab', async (event) => {
      const { code, title } = event.payload as {
        code: string;
        title?: string;
      };

      if (!code) {
        console.warn('[AlexandriaWorkspaceLayout] mermaid:open-in-tab with no code');
        return;
      }

      // Stable content hash (djb2) so identical diagrams share one tab.
      let hash = 5381;
      for (let i = 0; i < code.length; i++) {
        hash = (hash * 33) ^ code.charCodeAt(i);
      }
      const tabId = `mermaid-diagram:${(hash >>> 0).toString(36)}`;

      const newTab: MermaidDiagramTab = {
        id: tabId,
        label: title?.trim() || 'Diagram',
        contentType: 'mermaid-diagram',
        code,
        closable: true,
      };

      setTabs((prev) =>
        prev.some((t) => t.id === tabId) ? prev : [...prev, newTab],
      );
      setFocusTabId(tabId);
    });

    return unsubscribe;
  }, [events]);

  // Listen for doc:openInRightPanel events (from Alexandria docs panel context menu)
  useEffect(() => {
    const unsubscribe = events.on('doc:openInRightPanel', async (event) => {
      const doc = event.payload as {
        path: string;
        relativePath: string;
        name: string;
      };

      console.info(
        '[AlexandriaWorkspaceLayout] Open in right panel event received:',
        doc,
      );

      // Get the file path (prefer absolute path, fall back to relative)
      const filePath = doc.path || doc.relativePath;

      if (!filePath) {
        console.warn(
          '[AlexandriaWorkspaceLayout] No file path in doc:openInRightPanel event',
        );
        return;
      }

      try {
        setActiveMarkdownPath(filePath);

        // Switch the right panel to markdown-viewer
        onLayoutChange({ ...layout, right: 'markdown-viewer' });

        // Expand the right panel if it's collapsed
        if (collapsed.right) {
          onCollapsedChange({ ...collapsed, right: false });
        }

        console.info(
          '[AlexandriaWorkspaceLayout] Switched right panel to markdown-viewer for:',
          filePath,
        );
      } catch (error) {
        console.error(
          '[AlexandriaWorkspaceLayout] Failed to open in right panel:',
          error,
        );
      }
    });

    return unsubscribe;
  }, [events, actions, layout, onLayoutChange, collapsed, onCollapsedChange]);

  // Listen for repository:openDocs — the book-icon hover button on a project
  // card. Toggle behavior: if the right panel is already showing alexandria-
  // docs for *this* repo, collapse it. Otherwise select the repo (so the docs
  // panel keys onto it), switch the right slot to alexandria-docs, and
  // force-expand the right panel.
  useEffect(() => {
    const unsubscribe = events.on('repository:openDocs', async (event) => {
      const { repository, repositoryPath } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
        repositoryPath: string;
      };
      if (!repository) return;

      const repoPath = repositoryPath || repository.path;

      const docsAlreadyOpenForRepo =
        layout.right === 'alexandria-docs' &&
        !collapsedStateRef.current.right &&
        selectedRepository?.path === repoPath;

      if (docsAlreadyOpenForRepo) {
        panelLayoutRef.current?.collapsePanel('right');
        collapsedStateRef.current = {
          ...collapsedStateRef.current,
          right: true,
        };
        onCollapsedChangeRef.current(collapsedStateRef.current);
        return;
      }

      onRepositorySelected({ name: repository.name, path: repoPath });

      onLayoutChange({ ...layout, right: 'alexandria-docs' });

      if (panelLayoutRef.current) {
        panelLayoutRef.current.expandPanel('right');
        const currentLayout = panelLayoutRef.current.getLayout();
        if (!currentLayout || currentLayout.right < 20) {
          panelLayoutRef.current.setLayout({
            left: currentLayout?.left ?? 23,
            middle: 50,
            right: 30,
          });
        }
      }
      collapsedStateRef.current = {
        ...collapsedStateRef.current,
        right: false,
      };
      onCollapsedChangeRef.current(collapsedStateRef.current);
    });

    return unsubscribe;
  }, [
    events,
    layout,
    onLayoutChange,
    onRepositorySelected,
    selectedRepository,
  ]);

  // Listen for repository:openFiles — the file-tree hover button on a project
  // card. Mirrors repository:openDocs: toggle the right slot if it's already
  // showing the files panel for this repo, otherwise select the repo (so the
  // panel keys onto its file tree), switch the right slot to the files panel,
  // and force-expand the right panel.
  useEffect(() => {
    const unsubscribe = events.on('repository:openFiles', async (event) => {
      const { repository, repositoryPath } = event.payload as {
        repositoryId: string;
        repository: AlexandriaEntry;
        repositoryPath: string;
      };
      if (!repository) return;

      const repoPath = repositoryPath || repository.path;

      const filesAlreadyOpenForRepo =
        layout.right === 'repository-files' &&
        !collapsedStateRef.current.right &&
        selectedRepository?.path === repoPath;

      if (filesAlreadyOpenForRepo) {
        panelLayoutRef.current?.collapsePanel('right');
        collapsedStateRef.current = {
          ...collapsedStateRef.current,
          right: true,
        };
        onCollapsedChangeRef.current(collapsedStateRef.current);
        return;
      }

      onRepositorySelected({ name: repository.name, path: repoPath });

      onLayoutChange({ ...layout, right: 'repository-files' });

      if (panelLayoutRef.current) {
        panelLayoutRef.current.expandPanel('right');
        const currentLayout = panelLayoutRef.current.getLayout();
        if (!currentLayout || currentLayout.right < 20) {
          panelLayoutRef.current.setLayout({
            left: currentLayout?.left ?? 23,
            middle: 50,
            right: 30,
          });
        }
      }
      collapsedStateRef.current = {
        ...collapsedStateRef.current,
        right: false,
      };
      onCollapsedChangeRef.current(collapsedStateRef.current);
    });

    return unsubscribe;
  }, [
    events,
    layout,
    onLayoutChange,
    onRepositorySelected,
    selectedRepository,
  ]);

  // Get panel components - using direct imports instead of array access
  // to avoid type inference issues with mixed desktop/web panels
  const WorkspacePanelComponent = RecentRepositoriesPanel;
  const LocalProjectsPanelComponent = LocalProjectsPanel;
  const DocsPanelComponent = docsPanels[0]?.component; // Cannot convert - component not exported
  const LocalhostPanelComponent = localhostProcessesPanels[0]?.component; // Cannot convert - local panel
  const EventBusPanelComponent = EventBusPanel;
  const AgentToolsPanelComponent = AgentToolsPanel;
  const MarkdownPanelComponent = MarkdownPanel;
  const PrincipalViewPanelComponent = CanvasEditorPanel;

  // Dev workspace panels
  const KanbanPanelComponent = backlogPanels[0]?.component; // Cannot convert - component not exported
  const TaskDetailPanelComponent = backlogPanels[1]?.component; // Cannot convert - component not exported
  const MilestonePanelComponent = backlogPanels[2]?.component; // Cannot convert - component not exported
  const SkillsListPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.skills-list',
  )?.component; // Cannot convert - need metadata ID lookup
  const SkillDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.skill-detail',
  )?.component; // Cannot convert - need metadata ID lookup
  const AgentsListPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agents-list',
  )?.component; // Cannot convert - need metadata ID lookup
  const AgentDetailPanelComponent = agentPanels.find(
    (p) => p.metadata?.id === 'industry-theme.agent-detail',
  )?.component; // Cannot convert - need metadata ID lookup
  const GitHubIssuesPanelComponent = GitHubIssuesPanel;
  const GitHubIssueDetailPanelComponent = GitHubIssueDetailPanel;
  const GitChangesPanelComponent = GitChangesPanel;
  const FilesPanelComponent = AlexandriaFilesPanel;
  const PackageCompositionPanelComponent = PackageCompositionPanel;
  const CodeQualityPanelComponent = codeQualityPanels.find(
    (p) => p.metadata?.id === 'principal-ade.quality-hexagon-panel',
  )?.component; // Cannot convert - package may not be installed
  const StoryboardListPanelComponent = StoryboardListPanel;

  // Define panels
  const panels: PanelDefinition[] = useMemo(
    () => [
      {
        id: 'workspace-repos',
        label: 'Projects',
        content: WorkspacePanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <WorkspacePanelComponent
              context={workspacePanelContext}
              actions={actions}
              events={events}
            />
            <TopicDescriptionSlideOver
              open={descriptionOpen ?? false}
              instant={descriptionInstant ?? false}
              topicId={workspace.topicIds?.[0]}
              onClose={() => onCloseDescription?.()}
              onEdit={handleOpenTopicDescription}
              events={events}
              workspaceId={workspace.id}
              repositoryPath={selectedRepository?.path}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Workspace panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'terminal',
        label: 'Terminal',
        content: (
          <div
            ref={terminalPanelWrapperRef}
            onDragEnterCapture={handleTerminalDragOver}
            onDragOverCapture={handleTerminalDragOver}
            onDropCapture={handleTerminalDrop}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('middle')} />
            )}
            <TabbedTerminalPanel<AlexandriaTab>
              key={terminalRemountKey}
              context={terminalPanelContext}
              actions={terminalActions}
              events={events}
              terminalContext={terminalContext}
              directory={terminalDirectory}
              initialTabs={tabs as AlexandriaTab[]}
              onTabsChange={handleTabsChange}
              renderTabContent={(tab, isActive, sessionId) =>
                renderTabContent(tab as AlexandriaTab, isActive, sessionId)
              }
              showAllTerminals={showAllTerminals}
              onShowAllTerminalsChange={setShowAllTerminals}
              requestFocusTabId={focusTabId}
              onFocusTabHandled={() => setFocusTabId(null)}
              onActiveTabChange={setActiveTerminalTabId}
            />
          </div>
        ),
      },
      {
        id: 'alexandria-docs',
        label: 'Documentation',
        content: DocsPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <DocsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Alexandria Docs panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'localhost-browser',
        label: 'Localhost Browser',
        content: LocalhostPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <LocalhostPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Localhost Browser panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'event-bus',
        label: 'Event Bus',
        content: EventBusPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <EventBusPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Event Bus panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'agent-tools',
        label: 'Agent Tools',
        content: AgentToolsPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <AgentToolsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Agent Tools panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'local-projects',
        label: 'Local Projects',
        content: LocalProjectsPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <LocalProjectsPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Local Projects panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'trails',
        label: 'Trails',
        content: (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <WorkspaceTrailsPanel
              workspace={workspace}
              onTrailActivate={handleTrailActivate}
              onTrailOpenInTab={handleTrailOpenInTab}
              activeTrailId={activeTrailPayload?.id ?? null}
            />
            <TopicDescriptionSlideOver
              open={descriptionOpen ?? false}
              instant={descriptionInstant ?? false}
              topicId={workspace.topicIds?.[0]}
              onClose={() => onCloseDescription?.()}
              onEdit={handleOpenTopicDescription}
              events={events}
              workspaceId={workspace.id}
              repositoryPath={selectedRepository?.path}
            />
          </div>
        ),
      },
      {
        id: 'sessions',
        label: 'Sessions',
        content: (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <SessionsPanel topicId={workspace.topicIds?.[0]} />
            <TopicDescriptionSlideOver
              open={descriptionOpen ?? false}
              instant={descriptionInstant ?? false}
              topicId={workspace.topicIds?.[0]}
              onClose={() => onCloseDescription?.()}
              onEdit={handleOpenTopicDescription}
              events={events}
              workspaceId={workspace.id}
              repositoryPath={selectedRepository?.path}
            />
          </div>
        ),
      },
      {
        id: 'hook-debug',
        label: 'Hook Debug',
        content: (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <HookDebugPanel />
          </div>
        ),
      },
      {
        id: 'trail-explorer',
        label: 'Trail Explorer',
        content: (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <FileCityTrailTabContent
              trailPayload={activeTrailPayload}
              repositoryPath={activeTrailRepoPath}
              events={events}
              mobileShowMap
            />
          </div>
        ),
      },
      {
        id: 'markdown-viewer',
        label: 'Markdown Viewer',
        content: MarkdownPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <MarkdownPanelComponent
              context={context}
              actions={actions}
              events={events}
              filePath={activeMarkdownPath}
              repositoryPath={selectedRepository?.path}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Markdown Viewer panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'principal-view',
        label: 'Architecture',
        content: PrincipalViewPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <PrincipalViewPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Architecture panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'canvasList',
        label: 'Architecture List',
        content: StoryboardListPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <StoryboardListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Architecture List panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'kanban',
        label: 'Kanban',
        content: KanbanPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <KanbanPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Kanban panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'task-detail',
        label: 'Task Detail',
        content: TaskDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <TaskDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Task Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'milestones',
        label: 'Milestones',
        content: MilestonePanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <MilestonePanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Milestones panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'skillsList',
        label: 'Skills List',
        content: SkillsListPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <SkillsListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Skills List panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'skillDetail',
        label: 'Skill Detail',
        content: SkillDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <SkillDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Skill Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'agentsList',
        label: 'Agents List',
        content: AgentsListPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <AgentsListPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Agents List panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'agentDetail',
        label: 'Agent Detail',
        content: AgentDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <AgentDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Agent Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'githubIssues',
        label: 'GitHub Issues',
        content: GitHubIssuesPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <GitHubIssuesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              GitHub Issues panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'githubIssueDetail',
        label: 'GitHub Issue Detail',
        content: GitHubIssueDetailPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <GitHubIssueDetailPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              GitHub Issue Detail panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'gitChanges',
        label: 'Git Changes',
        content: GitChangesPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <GitChangesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Git Changes panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'repository-files',
        label: 'Files',
        content: FilesPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <FilesPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('right')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Files panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'packageComposition',
        label: 'Package Composition',
        content: PackageCompositionPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <PackageCompositionPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Package Composition panel not available
            </p>
          </div>
        ),
      },
      {
        id: 'codeQuality',
        label: 'Code Quality',
        content: CodeQualityPanelComponent ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <CodeQualityPanelComponent
              context={context}
              actions={actions}
              events={events}
            />
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              height: '100%',
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {enableKeyboardShortcuts && (
              <FocusIndicator isFocused={isFocused('left')} />
            )}
            <p style={{ fontSize: `${theme.fontSizes[1]}px` }}>
              Code Quality panel not available
            </p>
          </div>
        ),
      },
    ],
    [
      theme,
      workspace,
      context,
      actions,
      events,
      WorkspacePanelComponent,
      LocalProjectsPanelComponent,
      DocsPanelComponent,
      LocalhostPanelComponent,
      EventBusPanelComponent,
      AgentToolsPanelComponent,
      MarkdownPanelComponent,
      PrincipalViewPanelComponent,
      StoryboardListPanelComponent,
      KanbanPanelComponent,
      TaskDetailPanelComponent,
      MilestonePanelComponent,
      SkillsListPanelComponent,
      SkillDetailPanelComponent,
      AgentsListPanelComponent,
      AgentDetailPanelComponent,
      GitHubIssuesPanelComponent,
      GitHubIssueDetailPanelComponent,
      GitChangesPanelComponent,
      FilesPanelComponent,
      PackageCompositionPanelComponent,
      CodeQualityPanelComponent,
      isFocused,
      enableKeyboardShortcuts,
      terminalContext,
      terminalDirectory,
      terminalPanelContext,
      terminalActions,
      showAllTerminals,
      tabs,
      handleTabsChange,
      renderTabContent,
      handleTrailActivate,
      handleTrailOpenInRightPanel,
      handleTrailOpenInTab,
      activeTrailPayload,
      activeTrailRepoPath,
      focusTabId,
      terminalRemountKey,
      descriptionOpen,
      descriptionInstant,
      workspacePanelContext,
    ],
  );

  return (
    <>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          overflow: 'hidden',
        }}
      >
        {/* Main panel layout area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ConfigurablePanelLayout
            ref={panelLayoutRef}
            theme={theme}
            panels={panels}
            layout={layout}
            defaultSizes={{ left: 23, middle: 52, right: 25 }}
            collapsed={collapsed}
            collapsiblePanels={{ left: true, right: true }}
            showCollapseButtons={false}
          />
        </div>

        {/* Panel Icon Sidebar */}
        {showPanelSidebar && (
          <PanelIconSidebar
            currentPanelId={typeof layout.left === 'string' ? layout.left : ''}
            onPanelChange={(panelId) =>
              onLayoutChange({ ...layout, left: panelId })
            }
            theme={theme}
            collapsed={collapsed.left}
            onExpand={handleLeftExpand}
            onCollapse={handleLeftCollapse}
            position="right"
            panelIcons={ALEXANDRIA_LEFT_PANEL_ICONS}
          />
        )}
      </div>

      {/* Remove from Workspace Modal */}
      <RemoveFromWorkspaceModal
        isOpen={isRemoveModalOpen}
        entry={entryToRemove}
        workspace={workspaceForRemoval}
        onClose={handleCloseRemoveModal}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
};

/**
 * Alexandria Workspace Layout Component
 * Similar to web-ade's EditorLayout but for workspace management
 */
// Default layout for Alexandria workspace
const DEFAULT_LAYOUT: PanelLayout = {
  left: 'workspace-repos',
  middle: 'terminal',
  right: 'markdown-viewer',
};

export const AlexandriaWorkspaceLayout: React.FC<
  AlexandriaWorkspaceLayoutProps
> = ({
  workspace,
  repository: initialRepository,
  enableKeyboardShortcuts = false,
  collapsed: externalCollapsed,
  onCollapsedChange: externalOnCollapsedChange,
  layout: externalLayout,
  onLayoutChange: externalOnLayoutChange,
  onRepositorySelected: externalOnRepositorySelected,
  showPanelSidebar = true,
  onPanelControlReady,
  descriptionOpen,
  descriptionInstant,
  onCloseDescription,
}) => {
  const { theme } = useTheme();

  // Internal collapsed state (used when not controlled externally)
  const [internalCollapsed, setInternalCollapsed] = useState({
    left: false,
    right: false,
  });

  // Internal layout state (used when not controlled externally)
  const [internalLayout, setInternalLayout] =
    useState<PanelLayout>(DEFAULT_LAYOUT);

  // Use external state if provided, otherwise use internal
  const collapsed = externalCollapsed ?? internalCollapsed;
  const onCollapsedChange = externalOnCollapsedChange ?? setInternalCollapsed;

  const layout = externalLayout ?? internalLayout;
  const onLayoutChange = externalOnLayoutChange ?? setInternalLayout;

  // Track the selected repository
  const [selectedRepository, setSelectedRepository] = useState<
    | {
        name: string;
        path: string;
      }
    | undefined
  >(initialRepository);

  // Handler that updates both internal state and calls external callback
  const handleRepositorySelected = useCallback(
    (repository: { name: string; path: string } | undefined) => {
      setSelectedRepository(repository);
      externalOnRepositorySelected?.(repository);
    },
    [externalOnRepositorySelected],
  );

  // Log when repository changes
  useEffect(() => {
    console.info(
      '[AlexandriaWorkspaceLayout] Selected repository state updated:',
      selectedRepository,
    );
  }, [selectedRepository]);

  const terminalContext = `alexandria-workspace-${workspace.id}`;

  // Fallback for workspaces without a `suggestedClonePath` set — usually
  // legacy records from before the field was wired into creation flows.
  // Tracks user preferences live so a freshly configured base directory
  // immediately becomes the default for terminal cwd.
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    UserPreferencesService.getPreferences().then((prefs) => {
      if (!cancelled) setBaseDefaultDirectory(prefs.baseDefaultDirectory || '');
    });
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      setBaseDefaultDirectory(prefs.baseDefaultDirectory || '');
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const workspacePath =
    workspace.suggestedClonePath || baseDefaultDirectory || '';

  // PanelProvider re-keys its entire context value off `workspace` by reference.
  // Without this memo, every render rebuilds the literal → context value churns →
  // every consumer re-renders → downstream effects can cascade into an infinite
  // render loop (the localhost-detection 5s tick re-primes it on a timer).
  const panelWorkspace = useMemo(
    () => ({
      id: workspace.id,
      name: workspace.name,
      path: workspacePath,
      suggestedClonePath: workspace.suggestedClonePath,
      description: workspace.description,
      theme: workspace.theme,
      icon: workspace.icon,
      isDefault: workspace.isDefault,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      metadata: workspace.metadata,
    }),
    [workspace, workspacePath],
  );

  return (
    <PanelProvider
      workspace={panelWorkspace}
      repository={selectedRepository}
      theme={theme}
      terminalContext={terminalContext}
    >
      <TerminalProvider
        repositoryPath={selectedRepository?.path || workspacePath}
        terminalContext={terminalContext}
        repoName={selectedRepository?.name}
      >
        <AgentHighlightProvider repositoryPath={selectedRepository?.path || ''}>
          <AlexandriaWorkspaceLayoutContent
            workspace={workspace}
            selectedRepository={selectedRepository}
            onRepositorySelected={handleRepositorySelected}
            enableKeyboardShortcuts={enableKeyboardShortcuts}
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            layout={layout}
            onLayoutChange={onLayoutChange}
            showPanelSidebar={showPanelSidebar}
            onPanelControlReady={onPanelControlReady}
            descriptionOpen={descriptionOpen}
            descriptionInstant={descriptionInstant}
            onCloseDescription={onCloseDescription}
          />
        </AgentHighlightProvider>
      </TerminalProvider>
    </PanelProvider>
  );
};
