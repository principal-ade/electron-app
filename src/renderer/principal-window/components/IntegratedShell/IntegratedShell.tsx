import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavigationSidebar } from './NavigationSidebar';
import { IntegratedTitlebar } from './IntegratedTitlebar';
import { useTheme } from '@principal-ade/industry-theme';
import { Settings, type SettingsCategory } from '../../views/Settings';
import { SystemMonitor } from '../../views/SystemMonitor/SystemMonitor';
import { AuthView } from '../../views/AuthView';
import { OnboardingView } from '../../views/OnboardingView';
import { LocalhostProcessesView } from '../../views/LocalhostProcessesView';
import { ConnectionsView } from '../../views/ConnectionsView';
import { HomeView } from '../../views/HomeView';
import {
  PrincipalPortal,
  isWorkspaceView,
  type WorkspaceView,
} from '../PrincipalPortal';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { PresenceService } from '../../../main-process-api/PresenceService';
import { WindowService } from '../../../main-process-api/WindowService';
import { SecureAuthService } from '../../../services/SecureAuthService';
import type { InteractiveShellNavigationView } from '../../../../shared/types/userPreferences.types';
import type { QuickCommand } from '@principal-ade/panel-layouts';
import {
  AgentCommandPalette,
  useAgentCommandPalette,
} from '@principal-ade/panel-layouts';
import { usePrincipalEvents } from '../../PrincipalEventContext';
import { usePortalEvents } from '../../PortalEventContext';
import { useTopicsTabs } from '../../contexts/TopicsTabsContext';
import { topicClient } from '../../../tipc/topicClient';
import { OnboardingWizard } from '../../../components/OnboardingWizard/OnboardingWizard';
import {
  emitTerminalOpen,
  type TerminalOpenPayload,
} from '../../../events/portalIntents';
import './IntegratedShell.css';

export type NavigationView = InteractiveShellNavigationView;

// Available views for switch command
const VIEW_OPTIONS = [
  'home',
  'home-panel',
  'inbox',
  'topics',
  'projects',
  'onboarding',
  'settings',
  'monitoring',
  'auth',
  'processes',
  'connections',
  'skills',
  'drawings',
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
  const [activeView, setActiveView] = useState<NavigationView>('home');
  // The workspace surface (projects/inbox/topics) shown in the
  // persistent PrincipalPortal beneath any standalone overlay. Stays `null`
  // until the user first visits a workspace view, so a cold start that lands
  // on Home doesn't eagerly mount a workspace (and its terminals). Once set it
  // stays mounted under overlays, so returning from Home/Settings/etc. is a
  // pure visibility flip with no tab/terminal/scroll state to reconstruct.
  const [lastWorkspaceView, setLastWorkspaceView] =
    useState<WorkspaceView | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory | undefined>(undefined);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const { theme, mode } = useTheme();
  const { events } = usePrincipalEvents();
  const { events: portalEvents } = usePortalEvents();
  const { openTopic: openTopicInTopicsView } = useTopicsTabs();

  // Live mirror of activeView so the SHOW_IN_PRINCIPAL listener — which
  // subscribes once on mount — can read the view the user is currently on
  // without re-subscribing (and risking a missed fire) on every switch.
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  // Mirror of lastWorkspaceView so the open-terminal-tab IPC handler can tell
  // whether the portal (and WorkspaceShell terminal host) is already mounted.
  const lastWorkspaceViewRef = useRef(lastWorkspaceView);
  lastWorkspaceViewRef.current = lastWorkspaceView;

  // Queued when Quick Open asks for a terminal tab before the portal has ever
  // mounted; flushed once lastWorkspaceView is set and WorkspaceShell is up.
  const pendingTerminalOpenRef = useRef<TerminalOpenPayload | null>(null);

  const prevOverlayRef = useRef<string | null>(null);

  // Remember the most recent workspace surface so the portal keeps showing it
  // beneath standalone overlays. Standalone views (home, settings, …) leave
  // this untouched — that's what makes them feel like overlays you pop back
  // out of rather than full navigations.
  useEffect(() => {
    if (isWorkspaceView(activeView)) {
      setLastWorkspaceView(activeView);
    }
  }, [activeView]);

  const overlayView = isWorkspaceView(activeView) ? null : activeView;
  const isFirstOverlay = prevOverlayRef.current === null && overlayView !== null;
  useEffect(() => {
    prevOverlayRef.current = overlayView;
  }, [overlayView]);

  // Store collapsed states per view to avoid animation glitches when switching
  const [viewCollapsedStates, setViewCollapsedStates] = useState<
    Record<string, { left: boolean; right: boolean }>
  >({
    inbox: { left: false, right: false },
    topics: { left: false, right: false },
    'home-panel': { left: false, right: false },
    projects: { left: false, right: false },
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
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();

        if (prefs.interactiveShell?.activeNavigationView) {
          // Cast to string to handle legacy values from storage
          const savedView = prefs.interactiveShell.activeNavigationView as string;
          // Migrate removed views to 'projects' (removed 2026-04-19 in commit b742f44b2).
          // 'feed' is the former id for the Projects view, renamed 2026-06-17.
          const legacyViews = ['local-projects', 'remote-projects', 'starred-projects', 'network', 'feed'];
          let view = legacyViews.includes(savedView) ? 'projects' : savedView;
          // Legacy Projects side-nav is hidden by default (showProjectsButton).
          // If the saved surface is projects but the button is off, land on Home.
          if (view === 'projects' && !(prefs.showProjectsButton ?? false)) {
            view = 'home-panel';
          }
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

        // Show onboarding wizard on first launch
        if (!prefs.onboardingCompleted) {
          setShowOnboardingWizard(true);
        }
      } catch (error) {
        console.error('Failed to load navigation preference:', error);
      } finally {
        setPreferencesLoaded(true);
      }
    };
    loadPreferences();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Topic activate from the bridge: topicRoutes' POST /api/topics/:id/activate
  // targeted this (focused) window. Topics share the one workspace tab bucket
  // (useTopicsTabs → useWorkspaceTabs), so the tab opens regardless of which
  // surface is active — no need to force the Topics view and yank the user off
  // whatever workspace surface they were on. Only switch when they're on a
  // standalone overlay (home/settings/…), where the workspace portal is hidden
  // and the freshly-opened tab would otherwise be invisible.
  useEffect(() => {
    const unsubscribe = topicClient.onTopicActivate(({ topicId, title }) => {
      if (!isWorkspaceView(activeViewRef.current)) {
        setActiveView('topics');
      }
      openTopicInTopicsView(topicId, title);
    });
    return unsubscribe;
  }, [openTopicInTopicsView]);

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

  // Quick Open (Command+O) with quickOpenTarget === 'terminal': main sends
  // OPEN_TERMINAL_TAB after focusing the principal window. Ensure a workspace
  // surface is showing (so the terminal host is mounted + visible), then emit
  // terminal:open on the portal bus for WorkspaceShell to materialize the tab.
  useEffect(() => {
    const unsubscribe = WindowService.onOpenTerminalTab((payload) => {
      if (!payload?.directory) return;

      // Leave overlays (home/settings/…) so the portal is visible; if the
      // portal has never mounted, landing on projects also sets lastWorkspaceView.
      if (!isWorkspaceView(activeViewRef.current)) {
        setActiveView('projects');
      }

      if (!lastWorkspaceViewRef.current) {
        // WorkspaceShell isn't mounted yet — queue and flush after it mounts.
        pendingTerminalOpenRef.current = {
          directory: payload.directory,
          label: payload.label,
        };
        return;
      }

      emitTerminalOpen(portalEvents, 'quick-open', {
        directory: payload.directory,
        label: payload.label,
      });
    });
    return unsubscribe;
  }, [portalEvents]);

  // Flush a terminal-open that arrived before the portal first mounted.
  useEffect(() => {
    if (!lastWorkspaceView) return;
    const pending = pendingTerminalOpenRef.current;
    if (!pending) return;

    // WorkspaceShell mounts in the same commit as lastWorkspaceView; its
    // terminal:open listener registers in a useEffect that runs after paint.
    // Defer one macrotask so the emit is not lost.
    const timer = setTimeout(() => {
      if (pendingTerminalOpenRef.current !== pending) return;
      pendingTerminalOpenRef.current = null;
      emitTerminalOpen(portalEvents, 'quick-open', pending);
    }, 0);
    return () => clearTimeout(timer);
  }, [lastWorkspaceView, portalEvents]);

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

    // Sidebar Home always lands on the about/overview surface of the home
    // panel — including when Home is already active but a sub-view (Your
    // Projects, Other Clones, …) is showing.
    if (view === 'home-panel') {
      window.dispatchEvent(new CustomEvent('home-panel:show-overview'));
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

  // Toggle the Dashboard overlay from the titlebar: open Dashboard if we're not already
  // on it, otherwise drop back to the last workspace surface (or Projects on a
  // cold start that never opened one).
  const handleToggleHome = useCallback(() => {
    handleViewChange(
      activeView === 'home' ? (lastWorkspaceView ?? 'home-panel') : 'home'
    );
  }, [activeView, lastWorkspaceView, handleViewChange]);

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
          setActiveView('home');
          setViewCollapsedStates({
            projects: { left: false, right: false },
            'home-panel': { left: false, right: false },
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
        setActiveView('home');
        setViewCollapsedStates({
          projects: { left: false, right: false },
          'home-panel': { left: false, right: false },
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

  // Cmd+': toggle dashboard overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'Quote') {
        e.preventDefault();
        handleViewChange(activeViewRef.current === 'home' ? (lastWorkspaceView ?? 'home-panel') : 'home');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lastWorkspaceView, handleViewChange]);

  // Escape: dismiss a standalone overlay (always back to workspace)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isWorkspaceView(activeViewRef.current)) {
        handleViewChange(lastWorkspaceView ?? 'home-panel');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lastWorkspaceView, handleViewChange]);

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
      '/switch projects',
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
          onToggleHome={handleToggleHome}
          isHomeActive={activeView === 'home'}
          showRightSidebarControl={false}
          rightSidebarCollapsed={rightSidebarCollapsed}
          onToggleRightSidebar={handleToggleRightSidebar}
          hideSearch={false}
          onShowOnboardingWizard={() => setShowOnboardingWizard(true)}
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
              position: 'relative', // Positioning context for the portal overlay
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
            {/*
              Persistent base layer. The active workspace surface stays mounted
              beneath standalone overlays, so switching to Home/Settings/etc.
              and back is a pure visibility flip — no tab/terminal/scroll state
              to reconstruct. (Workspace surfaces still swap among themselves
              via activeView for now; the single-tab-host merge is a later
              slice.) Null until the user first opens a workspace view, so a
              cold start on Home doesn't eagerly boot a workspace.
            */}
            {lastWorkspaceView && (
              <PrincipalPortal workspaceView={lastWorkspaceView} />
            )}

            {/*
              Standalone views render on top of the portal as a scrim + card.
              The portal stays put; only this overlay moves. The scrim
              (translucent dark, fades in/out) dims the portal behind it so
              there's real contrast between the two layers — this is what makes
              the overlay read as floating *on top* rather than just replacing
              the view. The card is inset with rounded corners + a shadow so the
              dimmed portal frames it at the edges. AnimatePresence keeps both
              mounted through the exit animation. The enter animation only
              plays when an overlay first appears (not when switching between
              overlays like Home → Settings).
            */}
            <AnimatePresence>
              {overlayView && (
                <motion.div
                  key={overlayView}
                  className="portal-overlay-scrim"
                  initial={isFirstOverlay ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2,
                    backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  }}
                >
                  <motion.div
                    className="portal-overlay-card"
                    initial={isFirstOverlay ? { y: 20, scale: 0.98 } : false}
                    animate={{ y: 0, scale: 1 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      inset: 12,
                      overflow: 'auto',
                      backgroundColor,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 10,
                      // Soft drop shadow so the card visibly sits above the
                      // scrimmed portal beneath it.
                      boxShadow: '0 12px 48px rgba(0, 0, 0, 0.45)',
                    }}
                  >
                    {overlayView === 'home' && <HomeView />}
                    {overlayView === 'onboarding' && (
                      <OnboardingView
                        onComplete={() => handleViewChange('home-panel')}
                      />
                    )}
                    {overlayView === 'monitoring' && (
                      <SystemMonitor sidebarCollapsed={sidebarCollapsed} />
                    )}
                    {overlayView === 'settings' && (
                      <Settings initialCategory={settingsCategory} />
                    )}
                    {overlayView === 'auth' && <AuthView />}
                    {overlayView === 'processes' && <LocalhostProcessesView />}
                    {overlayView === 'connections' && <ConnectionsView />}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
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
            onComplete={async () => {
              setShowOnboardingWizard(false);
              handleViewChange('home-panel');
              try {
                await UserPreferencesService.updatePreferences({
                  onboardingCompleted: true
                });
              } catch (error) {
                console.error('Failed to save onboarding completion:', error);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};
