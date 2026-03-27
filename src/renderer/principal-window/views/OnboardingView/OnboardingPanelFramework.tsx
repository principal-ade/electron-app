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
  type TerminalWorkingState,
  type TerminalPanelActions,
} from '@industry-theme/xterm-terminal-panel';
import { WelcomePanel } from './components/WelcomePanel';
import { OnboardingCardPanel } from './components/OnboardingCardPanel';
import { ONBOARDING_CARDS } from './data/onboardingCards';
import type { OnboardingState } from './types/onboarding.types';

export interface OnboardingPanelFrameworkProps {
  /** Current onboarding state */
  onboardingState: OnboardingState;
  /** Callback when a card is marked completed */
  onMarkCompleted: (cardId: string) => void;
  /** Callback when user dismisses onboarding */
  onDismiss: () => void;
  /** Callback when user resets onboarding */
  onReset: () => void;
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
  collapsed,
  onCollapsedChange,
}) => {
  const { theme } = useTheme();
  const panelLayoutRef = useRef<ConfigurablePanelLayoutHandle>(null);

  // Create event bus for panel communication
  const events = useMemo(() => new PanelEventBus(), []);

  // Terminal context
  const { context: terminalCtx, actions: terminalActions, activityActions } = useTerminalProvider();
  const { activities: terminalActivities } = useTerminalActivity();

  // Local collapsed state tracking
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(collapsed.left);
  const [isRightCollapsed, setIsRightCollapsed] = useState(collapsed.right);

  // Panel sizes
  const [panelSizes] = useState({ left: 25, middle: 50, right: 25 });

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
          <TabbedTerminalPanel<TerminalTab>
            context={terminalPanelContext}
            actions={terminalActions as TerminalPanelActions}
            events={events}
            terminalContext={terminalCtx.terminalContext}
            directory={terminalDirectory}
            defaultScrollLocked={false}
            workingStates={workingStates}
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
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
      />
    </TerminalProvider>
  );
};

export default OnboardingPanelFramework;
