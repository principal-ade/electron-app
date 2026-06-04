/**
 * OnboardingPanelFramework
 *
 * Panel framework for the OnboardingView, using ConfigurablePanelLayout.
 *
 * Layout:
 * - Left: WelcomePanel (welcome message and progress)
 * - Middle: TabbedTerminalPanel (terminal for agent interaction)
 * - Right: OnboardingCardPanel (draggable concept cards)
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  ConfigurablePanelLayout,
  type PanelLayout,
  type ConfigurablePanelLayoutHandle,
} from '@principal-ade/panel-layouts';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import {
  TerminalProvider,
  useTerminalProvider,
  useTerminalActivity,
} from '../../../contexts/TerminalContext';
import {
  TabbedTerminalPanel,
  type TerminalTab,
  type BaseTab,
  type TerminalWorkingState,
  type TerminalPanelActions,
} from '@industry-theme/xterm-terminal-panel';
import { WelcomePanel } from './components/WelcomePanel';
import { OnboardingCardPanel } from './components/OnboardingCardPanel';
import { BaseDirectorySetupPanel } from './components/BaseDirectorySetupPanel';
import { ONBOARDING_CARDS } from './data/onboardingCards';
import type { OnboardingState } from './types/onboarding.types';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { useTerminalLinkHandler } from '../../../hooks/useTerminalLinkHandler';

/**
 * Tab type for base directory setup
 */
interface BaseDirectorySetupTab extends BaseTab {
  contentType: 'base-directory-setup';
}

/**
 * Union type for all onboarding tabs
 */
type OnboardingTab = TerminalTab | BaseDirectorySetupTab;

export interface OnboardingPanelFrameworkProps {
  /** Current onboarding state */
  onboardingState: OnboardingState;
  /** Callback when a card is marked completed */
  onMarkCompleted: (cardId: string) => void;
  /** Callback when user dismisses onboarding */
  onDismiss: () => void;
  /** Callback when user resets onboarding */
  onReset: () => void;
  /** Callback when base directory is configured */
  onBaseDirectoryConfigured?: (directory: string) => void;
  /** Collapsed state for left/right panels */
  collapsed?: { left: boolean; right: boolean };
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: { left: boolean; right: boolean }) => void;
}

interface OnboardingPanelFrameworkInnerProps {
  onboardingState: OnboardingState;
  onMarkCompleted: (cardId: string) => void;
  onDismiss: () => void;
  onReset: () => void;
  onBaseDirectoryConfigured?: (directory: string) => void;
  collapsed: { left: boolean; right: boolean };
  onCollapsedChange: (collapsed: { left: boolean; right: boolean }) => void;
}

/**
 * Inner component that uses TerminalProvider context
 */
const OnboardingPanelFrameworkInner: React.FC<OnboardingPanelFrameworkInnerProps> = ({
  onboardingState,
  onMarkCompleted,
  onDismiss,
  onReset,
  onBaseDirectoryConfigured,
  collapsed,
  onCollapsedChange,
}) => {
  const { theme } = useTheme();
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  // Create event bus for panel communication
  const events = useMemo(() => new PanelEventBus(), []);

  // Open links clicked in the terminal in the default browser
  useTerminalLinkHandler(events);

  // Terminal context
  const { context: terminalCtx, actions: terminalActions, activityActions } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local collapsed state tracking
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);
  const [isRightCollapsed, setIsRightCollapsed] = useState(collapsed.right);

  // Panel sizes
  const [panelSizes] = useState({ left: 25, middle: 50, right: 25 });

  // Tab state
  const [tabs, setTabs] = useState<OnboardingTab[]>([]);
  const [focusTabId, setFocusTabId] = useState<string | null>(null);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);

  // Layout configuration
  const layout: PanelLayout = useMemo(
    () => ({
      left: 'welcome',
      middle: 'terminal',
      right: 'cards',
    }),
    [],
  );

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

  // Terminal directory - use HOME
  const terminalDirectory = process.env.HOME || '/';

  // Calculate completion counts
  const completedCount = Object.values(onboardingState.cardStates).filter(
    (state) => state.completed,
  ).length;
  const totalCount = ONBOARDING_CARDS.length;

  // Check if user has started a terminal
  const hasTerminal = terminalCtx.terminalSessions.length > 0;

  // Handle panel resize
  const handlePanelResize = useCallback(
    (sizes: { left: number; middle: number; right: number }) => {
      const leftCollapsed = sizes.left < 5;
      const rightCollapsed = sizes.right < 5;

      if (leftCollapsed !== isLeftCollapsed) {
        setIsLeftCollapsed(leftCollapsed);
        onCollapsedChange({ left: leftCollapsed, right: isRightCollapsed });
      }
      if (rightCollapsed !== isRightCollapsed) {
        setIsRightCollapsed(rightCollapsed);
        onCollapsedChange({ left: isLeftCollapsed, right: rightCollapsed });
      }
    },
    [isLeftCollapsed, isRightCollapsed, onCollapsedChange],
  );

  // Tab management handlers
  const handleStepClick = useCallback(
    (stepId: string) => {
      if (stepId === 'base-directory') {
        // Check if tab already exists
        const existingTab = tabs.find((t) => t.contentType === 'base-directory-setup');

        if (existingTab) {
          setFocusTabId(existingTab.id);
        } else {
          // Create new setup tab
          const newTab: BaseDirectorySetupTab = {
            id: 'base-directory-setup-tab',
            label: 'Base Directory Setup',
            contentType: 'base-directory-setup',
            closable: true,
          };
          setTabs((prev) => [...prev, newTab]);
          setFocusTabId(newTab.id);
        }
      }
    },
    [tabs],
  );

  const handleDirectorySelected = useCallback(
    async (directory: string) => {
      // Save to preferences
      await UserPreferencesService.updatePreferences({
        baseDefaultDirectory: directory,
      });

      // Notify parent
      onBaseDirectoryConfigured?.(directory);

      // Close the setup tab
      setTabs((prev) => prev.filter((t) => t.contentType !== 'base-directory-setup'));
    },
    [onBaseDirectoryConfigured],
  );

  const handleSkipBaseDirectory = useCallback(() => {
    // Just close the tab without saving
    setTabs((prev) => prev.filter((t) => t.contentType !== 'base-directory-setup'));
  }, []);

  const handleTabsChange = useCallback((newTabs: OnboardingTab[]) => {
    setTabs(newTabs);
  }, []);

  const handleFocusTabHandled = useCallback(() => {
    setFocusTabId(null);
  }, []);

  // Render custom content for non-terminal tabs
  const renderTabContent = useCallback(
    (tab: OnboardingTab, _isActive: boolean) => {
      switch (tab.contentType) {
        case 'terminal':
          return null; // Use default terminal rendering

        case 'base-directory-setup':
          return (
            <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
              <BaseDirectorySetupPanel
                onDirectorySelected={handleDirectorySelected}
                onSkip={handleSkipBaseDirectory}
                currentDirectory={baseDefaultDirectory}
              />
            </div>
          );

        default:
          return null;
      }
    },
    [baseDefaultDirectory, handleDirectorySelected, handleSkipBaseDirectory],
  );

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

  // Load base directory from preferences
  useEffect(() => {
    const loadBaseDirectory = async () => {
      const preferences = await UserPreferencesService.getPreferences();
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };

    loadBaseDirectory();

    const unsubscribe = UserPreferencesService.onPreferencesUpdated((preferences) => {
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    });

    return unsubscribe;
  }, []);

  // Define all panels - not memoized to ensure fresh renders on state changes
  const allPanels = [
    {
      id: 'welcome',
      label: 'Welcome',
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
          <WelcomePanel
            completedCount={completedCount}
            totalCount={totalCount}
            onDismiss={onDismiss}
            onReset={onReset}
            hasTerminal={hasTerminal}
            onStepClick={handleStepClick}
            baseDirectoryConfigured={onboardingState.baseDirectoryConfigured}
          />
        </div>
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
          <TabbedTerminalPanel<OnboardingTab>
            context={terminalPanelContext}
            actions={terminalActions as TerminalPanelActions}
            events={events}
            terminalContext={terminalCtx.terminalContext}
            directory={terminalDirectory}
            defaultScrollLocked={false}
            workingStates={workingStates}
            initialTabs={tabs}
            onTabsChange={handleTabsChange}
            renderTabContent={renderTabContent}
            requestFocusTabId={focusTabId}
            onFocusTabHandled={handleFocusTabHandled}
          />
        </div>
      ),
    },
    {
      id: 'cards',
      label: 'Learn',
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
          <OnboardingCardPanel
            onboardingState={onboardingState}
            onMarkCompleted={onMarkCompleted}
          />
        </div>
      ),
    },
  ];

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
        defaultSizes={panelSizes}
        collapsed={collapsed}
        showCollapseButtons={false}
        theme={theme}
        onPanelResize={handlePanelResize}
      />
    </div>
  );
};

/**
 * OnboardingPanelFramework - Main component with TerminalProvider wrapper
 */
export const OnboardingPanelFramework: React.FC<OnboardingPanelFrameworkProps> = ({
  onboardingState,
  onMarkCompleted,
  onDismiss,
  onReset,
  onBaseDirectoryConfigured,
  collapsed = { left: false, right: false },
  onCollapsedChange = () => {},
}) => {
  return (
    <TerminalProvider
      repositoryPath=""
      terminalContext="terminal:onboarding"
      repoName="Onboarding"
    >
      <OnboardingPanelFrameworkInner
        onboardingState={onboardingState}
        onMarkCompleted={onMarkCompleted}
        onDismiss={onDismiss}
        onReset={onReset}
        onBaseDirectoryConfigured={onBaseDirectoryConfigured}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
      />
    </TerminalProvider>
  );
};

export default OnboardingPanelFramework;
