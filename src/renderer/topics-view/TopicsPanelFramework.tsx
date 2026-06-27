/**
 * TopicsPanelFramework
 *
 * Panel framework for the TopicsView, mirroring InboxPanelFramework: a left list
 * of local topics, a middle tabbed-terminal panel where selected topics open as
 * markdown tabs, and a collapsed-by-default right placeholder.
 *
 * Tab state lives in TopicsTabsContext (above IntegratedShell's conditional
 * TopicsView mount) so tabs survive view switches.
 */

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Layers, FileText, Footprints } from 'lucide-react';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
} from '@principal-ade/panel-layouts';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../contexts/TerminalContext';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { useTerminalLinkHandler } from '../hooks/useTerminalLinkHandler';
import {
  TabbedTerminalPanel,
  type TerminalTab,
  type TerminalWorkingState,
  type TerminalPanelActions,
  type BaseTab,
} from '@industry-theme/xterm-terminal-panel';
import { TopicsLeftPanel } from '../panels/TopicsLeftPanel';
import { LocalTopicTabContent } from './LocalTopicTabContent';
import { LocalTrailTabContent } from '../projects-view/LocalTrailTabContent';
import { useTopicsTabs } from '../principal-window/contexts/TopicsTabsContext';
import {
  PORTAL_INTENTS,
  type TrailOpenPayload,
  type TopicOpenPayload,
} from '../events/portalIntents';

/**
 * Landing tab shown when the topics view opens — a hint to pick a topic from
 * the left panel.
 */
export interface TopicsHomeTab extends BaseTab {
  contentType: 'topics-home';
}

/**
 * Local topic tab — a topic from the on-disk topic store, opened from a left
 * panel row. Carries the id (the body self-fetches) plus the title for the tab
 * label / header.
 */
export interface LocalTopicTab extends BaseTab {
  contentType: 'local-topic';
  topicId: string;
  title?: string;
}

/**
 * Local trail tab — a trail belonging to a topic, opened from the topic tab's
 * Trails dropdown. Carries only the id; `LocalTrailTabContent` self-fetches the
 * payload from the on-disk library.
 */
export interface LocalTrailTab extends BaseTab {
  contentType: 'local-trail';
  trailId: string;
}

export type TopicsTab =
  | TerminalTab
  | TopicsHomeTab
  | LocalTopicTab
  | LocalTrailTab;

export interface TopicsPanelFrameworkProps {
  /** Event bus for panel communication. */
  events: PanelEventEmitter;
  /** Collapsed state for left/right panels. */
  collapsed: { left: boolean; right: boolean };
  /** Callback when collapsed state changes. */
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
  /** Panel layout configuration. */
  layout: PanelLayout;
  /** Optional panel sizes. */
  panelSizes?: { left: number; middle: number; right: number };
  /** Callback when panel sizes change. */
  onPanelSizesChange?: (sizes: {
    left: number;
    middle: number;
    right: number;
  }) => void;
}

/**
 * Simple landing content for the `topics-home` tab.
 */
const TopicsHomePanel: React.FC = () => {
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
      <Layers size={32} color={theme.colors.textSecondary} />
      <div
        style={{
          fontSize: theme.fontSizes[2],
          fontWeight: 600,
          color: theme.colors.text,
        }}
      >
        Your topics
      </div>
      <div style={{ fontSize: theme.fontSizes[1], maxWidth: 420 }}>
        Topics bundle related trails on one subject. Pick a topic from the panel
        on the left to read its description here.
      </div>
    </div>
  );
};

const TopicsPanelFrameworkInner: React.FC<TopicsPanelFrameworkProps> = ({
  events,
  collapsed,
  onCollapsedChange,
  layout,
  panelSizes,
  onPanelSizesChange,
}) => {
  const { theme } = useTheme();
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  // Terminal context
  const {
    context: terminalCtx,
    actions: terminalActions,
    activityActions,
  } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local collapsed state tracking
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);

  // Base directory from user preferences (terminal cwd)
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);

  // Ref so renderTabContent stays stable across renders
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  });

  // Tab state lives in TopicsTabsContext (above IntegratedShell's conditional
  // TopicsView mount) so tabs survive view switches.
  const {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    openTopic,
    openLocalTrail,
  } = useTopicsTabs();

  // Load base directory from user preferences
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

  const terminalDirectory = baseDefaultDirectory || process.env.HOME || '/';

  // Tab rendering callbacks
  const renderTabIcon = useCallback((tab: TopicsTab) => {
    switch (tab.contentType) {
      case 'topics-home':
        return <Layers size={14} />;
      case 'local-topic':
        return <FileText size={14} />;
      case 'local-trail':
        return <Footprints size={14} />;
      default:
        return null;
    }
  }, []);

  const renderTabContent = useCallback((tab: TopicsTab, _isActive: boolean) => {
    switch (tab.contentType) {
      case 'topics-home':
        return <TopicsHomePanel />;
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
      default:
        return null;
    }
  }, []);

  // Open links clicked in the terminal in the default browser
  useTerminalLinkHandler(events);

  // Listen for terminal activity events
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

  // Intent bridge (portal-unification Increment 1): the left panel / topic tab
  // emit view-agnostic `topic:open` / `trail:open` intents on the bus; this
  // framework is the sole listener that turns them into Topics tabs via the
  // existing tab context. Topics only hosts local trails, so a `shared` trail
  // intent is ignored here. Temporary — folds into one PortalTabsContext
  // listener in Increment 2.
  useEffect(() => {
    const handleTopicOpen = (event: { payload: TopicOpenPayload }) => {
      openTopic(event.payload.topicId, event.payload.title);
    };
    const handleTrailOpen = (event: { payload: TrailOpenPayload }) => {
      if (event.payload.source === 'local') {
        openLocalTrail(event.payload.trailId, event.payload.title);
      }
    };
    events.on(PORTAL_INTENTS.topicOpen, handleTopicOpen);
    events.on(PORTAL_INTENTS.trailOpen, handleTrailOpen);
    return () => {
      events.off(PORTAL_INTENTS.topicOpen, handleTopicOpen);
      events.off(PORTAL_INTENTS.trailOpen, handleTrailOpen);
    };
  }, [events, openTopic, openLocalTrail]);

  // Handle panel resize (detect left collapse)
  const handlePanelResize = useCallback(
    (sizes: { left: number; middle: number; right: number }) => {
      const leftCollapsed = sizes.left < 5;
      if (leftCollapsed !== isLeftCollapsed) {
        setIsLeftCollapsed(leftCollapsed);
        onCollapsedChange({ left: leftCollapsed, right: false });
      }
      onPanelSizesChange?.(sizes);
    },
    [isLeftCollapsed, onCollapsedChange, onPanelSizesChange],
  );

  // Define all three panels (terminal must sit in the middle)
  const allPanels = useMemo(
    () => [
      {
        id: 'topics-list',
        label: 'Topics',
        content: <TopicsLeftPanel events={events} />,
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
            <TabbedTerminalPanel<TopicsTab>
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
 * TopicsPanelFramework — main component with TerminalProvider wrapper.
 */
export const TopicsPanelFramework: React.FC<TopicsPanelFrameworkProps> = (
  props,
) => {
  return (
    <TerminalProvider
      repositoryPath=""
      terminalContext="terminal:topics"
      repoName="Topics"
    >
      <TopicsPanelFrameworkInner {...props} />
    </TerminalProvider>
  );
};

export default TopicsPanelFramework;
