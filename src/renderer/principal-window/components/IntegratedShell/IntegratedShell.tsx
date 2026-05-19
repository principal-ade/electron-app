import React, { useState, useEffect, useCallback } from 'react';
import { NavigationSidebar } from './NavigationSidebar';
import { IntegratedTitlebar } from './IntegratedTitlebar';
import { useTheme } from '@principal-ade/industry-theme';
import { Settings, type SettingsCategory } from '../../views/Settings';
import { SystemMonitor } from '../../views/SystemMonitor/SystemMonitor';
import { AuthView } from '../../views/AuthView';
import { FeedView } from '../../views/FeedView';
import { OnboardingView } from '../../views/OnboardingView';
import { LocalhostProcessesView } from '../../views/LocalhostProcessesView';
import { ConnectionsView } from '../../views/ConnectionsView';
import { SkillBrowserView } from '../../views/SkillBrowserView';
import { TrailsView } from '../../views/TrailsView';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { PresenceService } from '../../../main-process-api/PresenceService';
import { WindowService } from '../../../main-process-api/WindowService';
import { SecureAuthService } from '../../../services/SecureAuthService';
import { TrailService } from '../../../services/TrailService';
import type { InteractiveShellNavigationView } from '../../../../shared/types/userPreferences.types';
import type { QuickCommand } from '@principal-ade/panel-layouts';
import {
  AgentCommandPalette,
  useAgentCommandPalette,
} from '@principal-ade/panel-layouts';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import { OnboardingWizard } from '../../../components/OnboardingWizard/OnboardingWizard';
import './IntegratedShell.css';

export type NavigationView = InteractiveShellNavigationView;

// Available views for switch command
const VIEW_OPTIONS = [
  'trails',
  'feed',
  'onboarding',
  'settings',
  'monitoring',
  'auth',
  'processes',
  'connections',
  'skills',
];

// Quick commands for the command palette autocomplete
const QUICK_COMMANDS: QuickCommand[] = [
  {
    name: 'toggle',
    description: 'Toggle a sidebar panel',
    args: [
      {
        name: 'panel',
        description: 'Which panel to toggle',
        required: true,
        options: ['left', 'right'],
      },
    ],
  },
  {
    name: 'collapse',
    description: 'Collapse all sidebars',
  },
  {
    name: 'expand',
    description: 'Expand all sidebars',
  },
  {
    name: 'switch',
    description: 'Switch to a different view',
    args: [
      {
        name: 'view',
        description: 'View to switch to',
        required: true,
        options: VIEW_OPTIONS,
      },
    ],
  },
  {
    name: 'reset',
    description: 'Reset to default view',
  },
];

// Helper to map view to panel layout key
const getViewKey = (view: NavigationView): 'authView' | null => {
  switch (view) {
    case 'auth':
      return 'authView';
    default:
      return null;
  }
};

// Default collapsed states per view
const getViewDefaults = (
  view: NavigationView,
): { left: boolean; right: boolean } => {
  switch (view) {
    case 'auth':
      return { left: false, right: false }; // No right panel for auth
    default:
      return { left: false, right: false };
  }
};

export const IntegratedShell: React.FC = () => {
  const [activeView, setActiveView] = useState<NavigationView>('trails');
  // Trail id this window was opened with (cold-start URL hash) or routed
  // to (warm-start SHOW_IN_PRINCIPAL IPC). Flows down to TrailsView so it
  // boots on the Recent grid with the activated trail surfaced. Lifted
  // here because TrailsView is conditionally mounted — subscribing to the
  // IPC inside TrailsView would miss the warm-start fire that races
  // ahead of mount.
  const [bootstrapTrailId, setBootstrapTrailId] = useState<string | null>(
    () => TrailService.getOpenTrailId(),
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory | undefined>(undefined);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const { theme, mode } = useTheme();
  const { events } = usePrincipalEvents();

  // Store collapsed states per view to avoid animation glitches when switching
  const [viewCollapsedStates, setViewCollapsedStates] = useState<
    Record<string, { left: boolean; right: boolean }>
  >({
    trails: { left: false, right: false },
    feed: { left: false, right: false },
    onboarding: { left: false, right: false },
    auth: { left: false, right: false },
    monitoring: { left: false, right: false },
    settings: { left: false, right: false },
    processes: { left: false, right: false },
    connections: { left: false, right: false },
    skills: { left: false, right: false },
  });

  // Get current view's collapsed states
  const sidebarCollapsed = viewCollapsedStates[activeView]?.left ?? false;
  const rightSidebarCollapsed = viewCollapsedStates[activeView]?.right ?? false;

  // Load saved navigation view and panel states on mount
  useEffect(() => {
    // Cold-start handoff from main: if this window was opened via
    // focusOrCreateMainWindow({ openTrailId }) the trail id sits on the URL
    // hash. Force the Trails view so the trail surfaces in Recents; the
    // saved pref doesn't get to override the explicit bootstrap.
    const bootstrapTrailId = TrailService.getOpenTrailId();
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();

        if (bootstrapTrailId) {
          setActiveView('trails');
        } else if (prefs.interactiveShell?.activeNavigationView) {
          // Cast to string to handle legacy values from storage
          const savedView = prefs.interactiveShell.activeNavigationView as string;
          // Migrate removed views to 'feed' (removed 2026-04-19 in commit b742f44b2)
          const legacyViews = ['local-projects', 'remote-projects', 'starred-projects', 'network'];
          const view = legacyViews.includes(savedView) ? 'feed' : savedView;
          setActiveView(view as NavigationView);
        }

        // Load collapsed states for all views
        const newViewStates = { ...viewCollapsedStates };

        // Load each view's collapsed state
        const views: NavigationView[] = ['auth'];
        for (const view of views) {
          const viewKey = getViewKey(view);
          const defaults = getViewDefaults(view);

          if (viewKey && prefs.panelLayouts?.[viewKey]?.collapsed) {
            const collapsed = prefs.panelLayouts[viewKey].collapsed;
            const left = collapsed.left ?? defaults.left;
            const right = defaults.right;
            newViewStates[view] = {
              left,
              right,
            };
          } else {
            newViewStates[view] = defaults;
          }
        }

        setViewCollapsedStates(newViewStates);
      } catch (error) {
        console.error('Failed to load navigation preference:', error);
      } finally {
        setPreferencesLoaded(true);
      }
    };
    loadPreferences();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm-start handoff from the bridge: trailRoutes sends SHOW_IN_PRINCIPAL
  // after focusOrCreateMainWindow when the principal window was already
  // open (cold starts ride the URL hash above instead). Force the Trails
  // view and stash the trail id so TrailsView boots on the Recent grid.
  useEffect(() => {
    const unsubscribe = TrailService.onShowInPrincipal(({ trailId }) => {
      setActiveView('trails');
      setBootstrapTrailId(trailId);
    });
    return unsubscribe;
  }, []);

  // Listen for navigate to updates events from other windows
  useEffect(() => {
    const unsubscribe = WindowService.onNavigateToUpdates(() => {
      setSettingsCategory('updates');
      setActiveView('settings');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-connect to presence on startup if enabled
  useEffect(() => {
    const autoConnectPresence = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();

        // Check if auto-connect is disabled (defaults to false if undefined)
        if (prefs.presenceAutoConnect !== true) {
          return;
        }

        // Check if user is authenticated
        const authService = SecureAuthService.getInstance();
        const authResult = await authService.checkAuth();

        if (!authResult.authenticated || !authResult.token) {
          console.info(
            '[IntegratedShell] Skipping presence auto-connect: not authenticated',
          );
          return;
        }

        // Auto-connect to presence
        console.info(
          '[IntegratedShell] Auto-connecting to presence on startup',
        );
        const result = await PresenceService.connectToPresence(
          authResult.token,
        );

        if (result.success) {
          console.info(
            '[IntegratedShell] Successfully auto-connected to presence',
          );
        } else {
          console.warn(
            '[IntegratedShell] Failed to auto-connect to presence:',
            result.error,
          );
        }
      } catch (error) {
        console.error(
          '[IntegratedShell] Error during presence auto-connect:',
          error,
        );
      }
    };

    // Only run after preferences are loaded
    if (preferencesLoaded) {
      autoConnectPresence();
    }
  }, [preferencesLoaded]);

  // Save navigation view when it changes
  const handleViewChange = useCallback(async (view: NavigationView) => {
    setActiveView(view);

    // Clear settings category when navigating away from settings
    if (view !== 'settings') {
      setSettingsCategory(undefined);
    }

    // Only save preference after initial load to avoid race conditions
    if (preferencesLoaded) {
      try {
        await UserPreferencesService.updatePreferences({
          interactiveShell: {
            activeNavigationView: view,
          },
        });
      } catch (error) {
        console.error('Failed to save navigation preference:', error);
      }
    }
  }, [preferencesLoaded]);

  // Save collapsed states when they change
  const handleToggleSidebar = useCallback(async () => {
    const newCollapsed = !sidebarCollapsed;

    // Update state for current view
    setViewCollapsedStates((prev) => {
      const previousState = prev[activeView] ?? getViewDefaults(activeView);
      return {
        ...prev,
        [activeView]: {
          ...previousState,
          left: newCollapsed,
        },
      };
    });

    if (preferencesLoaded) {
      try {
        const viewKey = getViewKey(activeView);
        if (viewKey) {
          const collapsedUpdate: { left?: boolean; right?: boolean } = {
            left: newCollapsed,
          };
          await UserPreferencesService.updatePreferences({
            panelLayouts: {
              [viewKey]: {
                collapsed: collapsedUpdate,
              },
            },
          });
        }
      } catch (error) {
        console.error('Failed to save sidebar collapsed state:', error);
      }
    }
  }, [sidebarCollapsed, activeView, preferencesLoaded]);

  const handleToggleRightSidebar = useCallback(async () => {
    const newCollapsed = !rightSidebarCollapsed;

    // Update state for current view
    setViewCollapsedStates((prev) => {
      const previousState = prev[activeView] ?? getViewDefaults(activeView);
      return {
        ...prev,
        [activeView]: {
          ...previousState,
          right: newCollapsed,
        },
      };
    });

    if (preferencesLoaded) {
      try {
        const viewKey = getViewKey(activeView);
        if (viewKey) {
          // AuthView only supports two-panel layout (no right panel)
          // Only save left collapse state for authView
          await UserPreferencesService.updatePreferences({
            panelLayouts: {
              [viewKey]: {
                collapsed: {
                  left:
                    viewCollapsedStates[activeView]?.left ??
                    getViewDefaults(activeView).left,
                },
              },
            },
          });
        }
      } catch (error) {
        console.error('Failed to save right sidebar collapsed state:', error);
      }
    }
  }, [rightSidebarCollapsed, activeView, preferencesLoaded, viewCollapsedStates]);

  // Handle quick commands from Agent Command Palette
  const handleQuickCommand = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      switch (name) {
        case 'toggle': {
          const panel = (args.args as string[])?.[0];
          if (panel === 'left') {
            handleToggleSidebar();
          } else if (panel === 'right') {
            handleToggleRightSidebar();
          }
          return { success: true };
        }
        case 'collapse':
          setViewCollapsedStates((prev) => {
            const newStates = { ...prev };
            Object.keys(newStates).forEach((key) => {
              newStates[key] = { left: true, right: true };
            });
            return newStates;
          });
          return { success: true };
        case 'expand':
          setViewCollapsedStates((prev) => {
            const newStates = { ...prev };
            Object.keys(newStates).forEach((key) => {
              newStates[key] = { left: false, right: false };
            });
            return newStates;
          });
          return { success: true };
        case 'switch': {
          const viewName = (args.args as string[])?.[0] as NavigationView;
          if (viewName) {
            handleViewChange(viewName);
          }
          return { success: true };
        }
        case 'reset':
          setActiveView('trails');
          setViewCollapsedStates({
            trails: { left: false, right: false },
            feed: { left: false, right: false },
            onboarding: { left: false, right: false },
            auth: { left: false, right: false },
            monitoring: { left: false, right: false },
            settings: { left: false, right: false },
            processes: { left: false, right: false },
            connections: { left: false, right: false },
            skills: { left: false, right: false },
          });
          return { success: true };
        default:
          return { error: `Unknown command: ${name}` };
      }
    },
    [handleToggleSidebar, handleToggleRightSidebar, handleViewChange],
  );

  // Event listeners for panel events from Agent Command Palette
  useEffect(() => {
    if (!events) return;

    const unsubscribers = [
      events.on('panel:toggle', (event) => {
        const payload = event.payload as { panel?: string };
        const panelId = payload.panel;
        if (panelId === 'left') {
          handleToggleSidebar();
        } else if (panelId === 'right') {
          handleToggleRightSidebar();
        }
      }),
      events.on('panel:collapse-all', () => {
        setViewCollapsedStates((prev) => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach((key) => {
            newStates[key] = { left: true, right: true };
          });
          return newStates;
        });
      }),
      events.on('panel:expand-all', () => {
        setViewCollapsedStates((prev) => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach((key) => {
            newStates[key] = { left: false, right: false };
          });
          return newStates;
        });
      }),
      events.on('panel:switch', (event) => {
        const payload = event.payload as { view?: string };
        if (payload.view) {
          handleViewChange(payload.view as NavigationView);
        }
      }),
      events.on('panel:reset-layout', () => {
        setActiveView('trails');
        setViewCollapsedStates({
          trails: { left: false, right: false },
          feed: { left: false, right: false },
          onboarding: { left: false, right: false },
          auth: { left: false, right: false },
          monitoring: { left: false, right: false },
          settings: { left: false, right: false },
          processes: { left: false, right: false },
          connections: { left: false, right: false },
          skills: { left: false, right: false },
        });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events, handleToggleSidebar, handleToggleRightSidebar, handleViewChange]);

  // Agent Command Palette - Cmd+Shift+P to open
  const agentPalette = useAgentCommandPalette({
    events,
    keyboard: { key: 'p', metaKey: true, shiftKey: true, altKey: false },
    config: {
      placeholder: 'Type / for commands or describe what you want',
      autoCloseDelay: 1500,
    },
    onExecuteTool: handleQuickCommand,
    quickCommands: QUICK_COMMANDS,
    agentAvailable: false,
    initialSuggestions: [
      '/switch feed',
      '/switch settings',
      '/collapse',
      '/reset',
    ],
  });

  const backgroundColor =
    mode === 'dark' && theme.modes?.dark?.background
      ? theme.modes.dark.background
      : theme.colors.background;

  return (
    <div
      className="integrated-shell"
      style={{
        backgroundColor,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <NavigationSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      <div className="main-content">
        <IntegratedTitlebar
          showSidebarControl={false}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          showRightSidebarControl={false}
          rightSidebarCollapsed={rightSidebarCollapsed}
          onToggleRightSidebar={handleToggleRightSidebar}
          hideSearch={false}
          onAddProject={
            activeView === 'trails'
              ? () =>
                  window.dispatchEvent(new CustomEvent('trails:add-project'))
              : undefined
          }
        />

        {/* Main content area with rounded corners for Slack-style cutout */}
        <div
          className="content-wrapper"
          style={{
            position: 'absolute',
            top: 0,
            left: 0, // Start at 0 since parent already starts after sidebar
            right: 0,
            bottom: 0,
            backgroundColor:
              mode === 'dark' && theme.modes?.dark?.backgroundSecondary
                ? theme.modes.dark.backgroundSecondary
                : theme.colors.backgroundSecondary,
            borderTopLeftRadius: '8px', // Rounded corner creates the cutout effect
            overflow: 'hidden',
            pointerEvents: 'none', // Allow clicks through to titlebar
          }}
        >
          <div
            className="view-container"
            style={{
              marginTop: '56px', // Space for titlebar
              marginLeft: '0',
              marginRight: '6px',
              marginBottom: '6px',
              height: 'calc(100% - 62px)', // Account for margins and titlebar
              boxSizing: 'border-box',
              overflow: 'auto',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              backgroundColor:
                mode === 'dark' && theme.modes?.dark?.background
                  ? theme.modes.dark.background
                  : theme.colors.background,
              pointerEvents: 'auto', // Re-enable pointer events for content
            }}
          >
            {/* Views will be rendered here based on activeView */}
            {activeView === 'trails' && (
              <TrailsView bootstrapTrailId={bootstrapTrailId} />
            )}
            {activeView === 'feed' && <FeedView />}
            {activeView === 'onboarding' && (
              <OnboardingView onComplete={() => handleViewChange('feed')} />
            )}
            {activeView === 'monitoring' && (
              <SystemMonitor sidebarCollapsed={sidebarCollapsed} />
            )}
            {activeView === 'settings' && <Settings initialCategory={settingsCategory} />}
            {activeView === 'auth' && <AuthView />}
            {activeView === 'processes' && <LocalhostProcessesView />}
            {activeView === 'connections' && <ConnectionsView />}
            {activeView === 'skills' && <SkillBrowserView />}
          </div>
        </div>
      </div>

      {/* Agent Command Palette - Cmd+Shift+P to open */}
      <AgentCommandPalette
        palette={agentPalette}
        config={{
          placeholder: 'What would you like to do?',
        }}
      />

      {/* Onboarding Wizard Overlay */}
      {showOnboardingWizard && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000
        }}>
          <OnboardingWizard
            onComplete={() => {
              setShowOnboardingWizard(false);
            }}
          />
        </div>
      )}
    </div>
  );
};
