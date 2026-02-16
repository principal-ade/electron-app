import React, { useState, useEffect, useCallback } from 'react';
import { NavigationSidebar } from './NavigationSidebar';
import { IntegratedTitlebar } from './IntegratedTitlebar';
import { useTheme } from '@principal-ade/industry-theme';
import { Settings } from '../../views/Settings';
import { SystemMonitor } from '../../views/SystemMonitor/SystemMonitor';
import { AuthView } from '../../views/AuthView';
import { ProjectsView } from '../../views/ProjectsView';
import { WorldsView } from '../../views/WorldsView';
import { GitSyncView } from '../../views/GitSyncView';
import { LocalhostProcessesView } from '../../views/LocalhostProcessesView';
import { ConnectionsView } from '../../views/ConnectionsView';
import { SkillBrowserView } from '../../views/SkillBrowserView';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { PresenceService } from '../../../main-process-api/PresenceService';
import { SecureAuthService } from '../../../services/SecureAuthService';
import type { InteractiveShellNavigationView } from '../../../../shared/types/userPreferences.types';
import type { QuickCommand } from '@principal-ade/panel-layouts';
import {
  AgentCommandPalette,
  useAgentCommandPalette,
} from '@principal-ade/panel-layouts';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import './IntegratedShell.css';

export type NavigationView = InteractiveShellNavigationView;

// Available views for switch command
const VIEW_OPTIONS = [
  'workspaces',
  'settings',
  'monitoring',
  'auth',
  'network',
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
  const [activeView, setActiveView] = useState<NavigationView>('workspaces');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const { theme, mode } = useTheme();
  const { events } = usePrincipalEvents();

  // Store collapsed states per view to avoid animation glitches when switching
  const [viewCollapsedStates, setViewCollapsedStates] = useState<
    Record<string, { left: boolean; right: boolean }>
  >({
    auth: { left: false, right: false },
    monitoring: { left: false, right: false },
    search: { left: false, right: false },
    settings: { left: false, right: false },
    workspaces: { left: false, right: false },
    network: { left: false, right: false },
    processes: { left: false, right: false },
    connections: { left: false, right: false },
    skills: { left: false, right: false },
  });

  // Get current view's collapsed states
  const sidebarCollapsed = viewCollapsedStates[activeView]?.left ?? false;
  const rightSidebarCollapsed = viewCollapsedStates[activeView]?.right ?? false;

  // Load saved navigation view and panel states on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();

        // Load active view
        if (prefs.interactiveShell?.activeNavigationView) {
          setActiveView(prefs.interactiveShell.activeNavigationView);
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

  // Auto-connect to presence on startup if enabled
  useEffect(() => {
    const autoConnectPresence = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();

        // Check if auto-connect is disabled (defaults to true if undefined)
        if (prefs.presenceAutoConnect === false) {
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

  const handleToggleRightSidebar = async () => {
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
  };

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
          setActiveView('workspaces');
          setViewCollapsedStates({
            auth: { left: false, right: false },
            monitoring: { left: false, right: false },
            search: { left: false, right: false },
            settings: { left: false, right: false },
            workspaces: { left: false, right: false },
            network: { left: false, right: false },
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
        setActiveView('workspaces');
        setViewCollapsedStates({
          auth: { left: false, right: false },
          monitoring: { left: false, right: false },
          search: { left: false, right: false },
          settings: { left: false, right: false },
          workspaces: { left: false, right: false },
          network: { left: false, right: false },
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
      '/switch workspaces',
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
            {activeView === 'monitoring' && (
              <SystemMonitor sidebarCollapsed={sidebarCollapsed} />
            )}
            {activeView === 'settings' && <Settings />}
            {activeView === 'auth' && <AuthView />}
            {activeView === 'workspaces' && <ProjectsView />}
            {activeView === 'worlds' && <WorldsView />}
            {activeView === 'network' && <GitSyncView />}
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
    </div>
  );
};
