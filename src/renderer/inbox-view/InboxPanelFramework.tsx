/**
 * InboxPanelFramework
 *
 * Panel framework for the InboxView, mirroring FeedPanelFramework but trimmed
 * to the inbox's needs.
 *
 * Layout:
 * - Left: InboxLeftPanel (Inbox + Recently Visited lists)
 * - Middle: TabbedTerminalPanel (terminal in HOME dir + opened shared-trail tabs)
 * - Right: Placeholder panel (collapsed by default)
 *
 * Tab state lives in InboxTabsContext (above IntegratedShell's conditional
 * InboxView mount) so tabs survive view switches.
 */

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Inbox, Route } from 'lucide-react';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
} from '@principal-ade/panel-layouts';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../contexts/TerminalContext';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import {
  TabbedTerminalPanel,
  type TerminalTab,
  type TerminalWorkingState,
  type TerminalPanelActions,
  type BaseTab,
} from '@industry-theme/xterm-terminal-panel';
import { InboxLeftPanel } from '../panels/InboxLeftPanel';
import { SharedTrailTabContent } from '../feed-view/SharedTrailTabContent';
import { useInboxTabs } from '../principal-window/contexts/InboxTabsContext';

/**
 * Landing tab shown when the inbox view opens — a hint to pick something
 * from the left panel.
 */
export interface InboxHomeTab extends BaseTab {
  contentType: 'inbox-home';
}

/**
 * Shared trail tab — a trail published to web-ade, opened from an inbox or
 * recently-visited row. Carries only the id; the panel self-fetches the payload.
 */
export interface SharedTrailTab extends BaseTab {
  contentType: 'shared-trail';
  trailId: string;
  owner?: string;
  repo?: string;
}

export type InboxTab = TerminalTab | InboxHomeTab | SharedTrailTab;

export interface InboxPanelFrameworkProps {
  /** Local repositories — used to resolve a clone for shared-trail file trees. */
  repositories: AlexandriaEntry[];
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
 * Simple landing content for the `inbox-home` tab.
 */
const InboxHomePanel: React.FC = () => {
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
      <Inbox size={32} color={theme.colors.textSecondary} />
      <div
        style={{
          fontSize: theme.fontSizes[2],
          fontWeight: 600,
          color: theme.colors.text,
        }}
      >
        Your trail inbox
      </div>
      <div style={{ fontSize: theme.fontSizes[1], maxWidth: 420 }}>
        Shared trails sent to you and trails you&apos;ve recently visited show
        up in the panel on the left. Pick one to open it here.
      </div>
    </div>
  );
};

const InboxPanelFrameworkInner: React.FC<InboxPanelFrameworkProps> = ({
  repositories,
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

  // Refs so renderTabContent stays stable across renders
  const eventsRef = useRef(events);
  const repositoriesRef = useRef(repositories);
  useEffect(() => {
    eventsRef.current = events;
    repositoriesRef.current = repositories;
  });

  // Tab state lives in InboxTabsContext (above IntegratedShell's conditional
  // InboxView mount) so tabs survive view switches.
  const { tabs, setTabs, activeTabId, setActiveTabId } = useInboxTabs();

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
  const renderTabIcon = useCallback((tab: InboxTab) => {
    switch (tab.contentType) {
      case 'inbox-home':
        return <Inbox size={14} />;
      case 'shared-trail':
        return <Route size={14} />;
      default:
        return null;
    }
  }, []);

  const renderTabContent = useCallback((tab: InboxTab, _isActive: boolean) => {
    switch (tab.contentType) {
      case 'inbox-home':
        return <InboxHomePanel />;
      case 'shared-trail': {
        const trailTab = tab as SharedTrailTab;
        return (
          <SharedTrailTabContent
            key={trailTab.id}
            trailId={trailTab.trailId}
            events={eventsRef.current}
            repositories={repositoriesRef.current}
          />
        );
      }
      default:
        return null;
    }
  }, []);

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
        id: 'inbox-list',
        label: 'Inbox',
        content: <InboxLeftPanel />,
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
            <TabbedTerminalPanel<InboxTab>
              context={terminalPanelContext}
              actions={terminalActions as TerminalPanelActions}
              events={events}
              terminalContext={terminalCtx.terminalContext}
              directory={terminalDirectory}
              defaultScrollLocked={false}
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
 * InboxPanelFramework — main component with TerminalProvider wrapper.
 */
export const InboxPanelFramework: React.FC<InboxPanelFrameworkProps> = (
  props,
) => {
  return (
    <TerminalProvider
      repositoryPath=""
      terminalContext="terminal:inbox"
      repoName="Inbox"
    >
      <InboxPanelFrameworkInner {...props} />
    </TerminalProvider>
  );
};

export default InboxPanelFramework;
