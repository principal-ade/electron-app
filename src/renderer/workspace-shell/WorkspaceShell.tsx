/**
 * WorkspaceShell
 *
 * The persistent host for the Inbox + Topics surfaces (portal-unification
 * Increment 3, first cut). It replaces the separate InboxView/InboxPanelFramework
 * and TopicsView/TopicsPanelFramework with ONE shell:
 *
 * - one tabbed-terminal host reading the shared `useWorkspaceTabs()` bucket, so
 *   the open tabs (and the single terminal) persist when you swap the left panel;
 * - one terminal scope (`terminal:workspace`) instead of `terminal:inbox` +
 *   `terminal:topics`;
 * - a swappable left panel chosen by `activeView` — Inbox's list or Topics' list.
 *
 * PrincipalPortal mounts ONE instance for both the `inbox` and `topics`
 * workspace views, passing `activeView`; switching between them keeps this
 * component (and its terminal/tabs) mounted and only swaps the left panel.
 *
 * Projects is folded into this shell in a later step — it carries far more
 * per-view machinery (see docs/portal-unification.md).
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Inbox, Route, Layers, Footprints, FileText } from 'lucide-react';
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
import { useTerminalLinkHandler } from '../hooks/useTerminalLinkHandler';
import {
  TabbedTerminalPanel,
  type TerminalWorkingState,
  type TerminalPanelActions,
} from '@industry-theme/xterm-terminal-panel';
import { InboxLeftPanel } from '../panels/InboxLeftPanel';
import { TopicsLeftPanel } from '../panels/TopicsLeftPanel';
import { SharedTrailTabContent } from '../projects-view/SharedTrailTabContent';
import { LocalTrailTabContent } from '../projects-view/LocalTrailTabContent';
import { MarkdownDocTabContent } from '../projects-view/MarkdownDocTabContent';
import { TopicTabContent } from '../inbox-view/TopicTabContent';
import { LocalTopicTabContent } from '../topics-view/LocalTopicTabContent';
import {
  useWorkspaceTabs,
  type WorkspaceTab,
} from '../principal-window/PortalTabsContext';
import { usePortalEvents } from '../principal-window/PortalEventContext';
import { DocumentService } from '../services/DocumentService';
import type {
  SharedTrailTab,
  LocalTrailTab,
  MarkdownDocTab,
  TopicTab,
  LocalTopicTab,
} from '../events/portalTabs';

/** Which surface's left panel + landing the shell currently shows. */
export type WorkspaceView = 'inbox' | 'topics';

/** Centered landing hint shown by the `inbox-home` / `topics-home` tabs. */
const HomePanel: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({
  icon,
  title,
  body,
}) => {
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

  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);

  // Refs so renderTabContent stays stable across renders.
  const eventsRef = useRef(events);
  const repositoriesRef = useRef(repositories);
  useEffect(() => {
    eventsRef.current = events;
    repositoriesRef.current = repositories;
  });

  // The shared Inbox+Topics tab bucket (the persistent host's tab list).
  const { tabs, setTabs, activeTabId, setActiveTabId, openMarkdownDoc } =
    useWorkspaceTabs();
  // The left panels emit open intents on the portal bus (PortalIntentBridge
  // turns them into tabs).
  const { events: portalEvents } = usePortalEvents();

  useEffect(() => {
    const loadBaseDirectory = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };
    loadBaseDirectory();
    const unsubscribe = UserPreferencesService.onPreferencesUpdated(
      (preferences) => {
        setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
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
    switch (tab.contentType) {
      case 'inbox-home':
        return <Inbox size={14} />;
      case 'topics-home':
        return <Layers size={14} />;
      case 'shared-trail':
        return <Route size={14} />;
      case 'topic':
        return <Layers size={14} />;
      case 'local-topic':
        return <FileText size={14} />;
      case 'local-trail':
        return <Footprints size={14} />;
      case 'markdown-doc':
        return <FileText size={14} />;
      default:
        return null;
    }
  }, []);

  const renderTabContent = useCallback((tab: WorkspaceTab, _isActive: boolean) => {
    switch (tab.contentType) {
      case 'inbox-home':
        return (
          <HomePanel
            icon={<Inbox size={32} />}
            title="Your trail inbox"
            body="Shared trails sent to you and trails you've recently visited show up in the panel on the left. Pick one to open it here."
          />
        );
      case 'topics-home':
        return (
          <HomePanel
            icon={<Layers size={32} />}
            title="Your topics"
            body="Topics bundle related trails on one subject. Pick a topic from the panel on the left to read its description here."
          />
        );
      case 'shared-trail': {
        const trailTab = tab as SharedTrailTab;
        return (
          <SharedTrailTabContent
            key={trailTab.id}
            trailId={trailTab.trailId}
            events={eventsRef.current}
            repositories={repositoriesRef.current}
            briefSide="leading"
          />
        );
      }
      case 'topic': {
        const topicTab = tab as TopicTab;
        return (
          <TopicTabContent
            key={topicTab.id}
            topicId={topicTab.topicId}
            events={eventsRef.current}
            repositories={repositoriesRef.current}
          />
        );
      }
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
      case 'local-trail': {
        const trailTab = tab as LocalTrailTab;
        return (
          <LocalTrailTabContent
            key={trailTab.id}
            trailId={trailTab.trailId}
            events={eventsRef.current}
          />
        );
      }
      case 'markdown-doc': {
        const docTab = tab as MarkdownDocTab;
        return (
          <MarkdownDocTabContent
            key={docTab.id}
            filePath={docTab.filePath}
            repositoryPath={docTab.repositoryPath}
            events={eventsRef.current}
          />
        );
      }
      default:
        return null;
    }
  }, []);

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

  // Bridge handoff: a doc pushed from the Principal MCP Bridge
  // (POST /api/document/open) opens (or focuses) a markdown tab.
  useEffect(() => {
    return DocumentService.onOpenDocument(({ filePath, repositoryPath }) => {
      if (!filePath) return;
      openMarkdownDoc(filePath, repositoryPath);
    });
  }, [openMarkdownDoc]);

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
        label: activeView === 'inbox' ? 'Inbox' : 'Topics',
        content:
          activeView === 'inbox' ? (
            <InboxLeftPanel events={portalEvents} />
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
              workingStates={workingStates}
              initialTabs={tabs}
              onTabsChange={setTabs}
              activeTabId={activeTabId}
              onActiveTabChange={setActiveTabId}
              renderTabContent={renderTabContent}
              renderTabIcon={renderTabIcon}
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
      terminalPanelContext,
      terminalActions,
      terminalCtx.terminalContext,
      terminalDirectory,
      workingStates,
      tabs,
      activeTabId,
      setTabs,
      setActiveTabId,
      renderTabContent,
      renderTabIcon,
      theme,
    ],
  );

  return (
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
    </div>
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

  // Local repositories — used to resolve a clone for shared-trail file trees.
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetchRepositories = async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        if (!cancelled) setRepositories(repos);
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
