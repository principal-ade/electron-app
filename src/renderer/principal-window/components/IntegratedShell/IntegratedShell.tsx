import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavigationSidebar } from './NavigationSidebar';
import { IntegratedTitlebar } from './IntegratedTitlebar';
import { useTheme } from '@principal-ade/industry-theme';
import { Settings, type SettingsCategory } from '../../views/Settings';
import { SystemMonitor } from '../../views/SystemMonitor/SystemMonitor';
import { AuthView } from '../../views/AuthView';
import { OnboardingView } from '../../views/OnboardingView';
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
import { useWorkspaceTabs } from '../../PortalTabsContext';
import { topicClient } from '../../../tipc/topicClient';
import { useBridgeBrowserOpen } from '../../../hooks/useBridgeBrowserOpen';
import { useBridgeRequestOpen } from '../../../hooks/useBridgeRequestOpen';
import {
  payloadFromGithub,
  type RepositorySelectedPayload,
} from '../../../events/repositorySelected';
import { OnboardingWizard } from '../../../components/OnboardingWizard/OnboardingWizard';
import {
  emitTerminalOpen,
  type TerminalOpenPayload,
} from '../../../events/portalIntents';
import './IntegratedShell.css';

export type NavigationView = InteractiveShellNavigationView;

/**
 * Standalone views that float *above* the portal rather than living in it:
 * everything that isn't a portal-hosted workspace surface.
 */
export type OverlayView = Exclude<NavigationView, WorkspaceView>;

/** Runtime list behind {@link OverlayView} (used to validate stored ids). */
const OVERLAY_VIEWS: OverlayView[] = [
  'home',
  'onboarding',
  'settings',
  'monitoring',
  'auth',
  'connections',
];

const isOverlayView = (view: string): view is OverlayView =>
  (OVERLAY_VIEWS as string[]).includes(view);

// Available views for switch command
const VIEW_OPTIONS = [
  'home',
  'home-panel',
  'topics',
  'projects',
  'onboarding',
  'settings',
  'monitoring',
  'auth',
  'processes',
  'requests',
  'connections',
  'skills',
  'drawings',
  'subsystem-models',
];

// Cmd+Shift+<letter> jumps straight to a sidebar view. Keys are matched on
// `code` (layout-independent) and mirror the sidebar's item order/mnemonics.
const SIDEBAR_VIEW_SHORTCUTS: Record<string, WorkspaceView> = {
  KeyH: 'home-panel', // Home
  KeyP: 'projects', // Projects
  KeyM: 'subsystem-models', // Models
  KeyT: 'topics', // Topics
  KeyD: 'drawings', // Drawings
  KeyG: 'processes', // Processes (Globe icon)
};

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
  const [selectedRepository, setSelectedRepository] =
    useState<RepositorySelectedPayload | null>(null);
  // Two orthogonal axes, instead of one view enum standing in for both:
  //
  //   surface — the workspace surface hosted by the portal. `null` until the
  //             user first shows one, so a cold start doesn't eagerly mount a
  //             workspace (and its terminals).
  //   overlay — a standalone view floating above the portal. `null` = none.
  //
  // Keeping them separate is what lets an action taken *inside* an overlay
  // (e.g. opening a repo profile from Sky View) dismiss the overlay without
  // also choosing a surface — no left-panel swap, no collapse-state change.
  const [surface, setSurface] = useState<WorkspaceView | null>(null);
  const [overlay, setOverlay] = useState<OverlayView | null>('home');
  const [isRepositoryPanelActive, setIsRepositoryPanelActive] =
    useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory | undefined>(undefined);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const { theme, mode } = useTheme();
  const { events } = usePrincipalEvents();
  const { events: portalEvents } = usePortalEvents();
  const { openTopic: openTopicInTopicsView } = useTopicsTabs();
  const { openRepoExplorer } = useWorkspaceTabs();

  // Live mirrors for the listeners that subscribe once on mount: they need to
  // read which surface / overlay is up without re-subscribing (and risking a
  // missed fire) on every switch.
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const revealBrowserWorkspace = useCallback(() => {
    setOverlay(null);
    if (!surfaceRef.current) setSurface('processes');
  }, []);
  useBridgeBrowserOpen(revealBrowserWorkspace);
  const revealRequestWorkspace = useCallback(() => {
    setOverlay(null);
    setSurface('requests');
    setIsRepositoryPanelActive(false);
  }, []);
  useBridgeRequestOpen(revealRequestWorkspace);

  // Queued when Quick Open asks for a terminal tab before the portal has ever
  // mounted; flushed once a surface is set and WorkspaceShell is up.
  const pendingTerminalOpenRef = useRef<TerminalOpenPayload | null>(null);

  const prevOverlayRef = useRef<string | null>(null);

  const isFirstOverlay = prevOverlayRef.current === null && overlay !== null;
  useEffect(() => {
    prevOverlayRef.current = overlay;
  }, [overlay]);

  // Leaving Settings drops its category, so reopening it starts at the top
  // instead of resuming whatever sub-page was last shown.
  useEffect(() => {
    if (overlay !== 'settings') {
      setSettingsCategory(undefined);
    }
  }, [overlay]);

  // Store collapsed states per view to avoid animation glitches when switching
  const [viewCollapsedStates, setViewCollapsedStates] = useState<
    Record<string, { left: boolean; right: boolean }>
  >({
    topics: { left: false, right: false },
    'home-panel': { left: false, right: false },
    projects: { left: false, right: false },
    onboarding: { left: false, right: false },
    auth: { left: false, right: false },
    monitoring: { left: false, right: false },
    settings: { left: false, right: false },
    processes: { left: false, right: false },
    requests: { left: false, right: false },
    connections: { left: false, right: false },
    skills: { left: false, right: false },
  });

  // The titlebar left-panel toggle controls the visible surface's panel, which
  // is the one showing whether or not an overlay is floating above it.
  const sidebarView = surface ?? 'home-panel';
  const sidebarCollapsed = viewCollapsedStates[sidebarView]?.left ?? false;
  const rightSidebarCollapsed = viewCollapsedStates[sidebarView]?.right ?? false;

  // Load saved navigation view and panel states on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();

        if (prefs.interactiveShell?.activeNavigationView) {
          // Cast to string to handle legacy values from storage
          const savedView = prefs.interactiveShell.activeNavigationView as string;
          // Migrate removed views to a supported workspace surface.
          // 'feed' is the former id for the Projects view, renamed 2026-06-17.
          const legacyViews = ['local-projects', 'remote-projects', 'starred-projects', 'network', 'feed'];
          const view =
            savedView === 'inbox'
              ? 'topics'
              : legacyViews.includes(savedView)
                ? 'projects'
                : savedView;
          // Split the single stored value back onto the two axes: a workspace id
          // restores the surface, an overlay id restores the overlay (with no
          // surface — the portal mounts the first time one is shown).
          if (isWorkspaceView(view)) {
            setSurface(view);
            setOverlay(null);
          } else if (isOverlayView(view)) {
            setOverlay(view);
          }
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
  // surface is active — no need to force the Topics surface and yank the user
  // off whatever they were on. Only dismiss an overlay, where the portal is
  // hidden and the freshly-opened tab would otherwise be invisible.
  useEffect(() => {
    const unsubscribe = topicClient.onTopicActivate(({ topicId, title }) => {
      setOverlay(null);
      // Nothing has ever been mounted, so give the tab somewhere to land.
      if (!surfaceRef.current) {
        setSurface('topics');
      }
      openTopicInTopicsView(topicId, title);
    });
    return unsubscribe;
  }, [openTopicInTopicsView]);

  // Listen for navigate to updates events from other windows
  useEffect(() => {
    const unsubscribe = WindowService.onNavigateToUpdates(() => {
      setSettingsCategory('updates');
      setOverlay('settings');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // GitHub Quick Open results always browse remotely, independent of the
  // destination preference for local repositories.
  useEffect(() => {
    return WindowService.onOpenRepositoryExplorer((payload) => {
      if (!payload?.owner || !payload.name) return;
      setOverlay(null);
      if (!surfaceRef.current) {
        setSurface('projects');
      }
      openRepoExplorer(payloadFromGithub(payload));
    });
  }, [openRepoExplorer]);

  // Quick Open (Command+O) with quickOpenTarget === 'terminal': main sends
  // OPEN_TERMINAL_TAB after focusing the principal window. Ensure a workspace
  // surface is showing (so the terminal host is mounted + visible), then emit
  // terminal:open on the portal bus for WorkspaceShell to materialize the tab.
  useEffect(() => {
    const unsubscribe = WindowService.onOpenTerminalTab((payload) => {
      if (!payload?.directory) return;

      // Take any overlay down so the portal is visible; if the portal has never
      // mounted, showing Projects gives the terminal host somewhere to mount.
      setOverlay(null);
      const portalMounted = surfaceRef.current !== null;
      if (!portalMounted) {
        setSurface('projects');
      }

      if (!portalMounted) {
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
    if (!surface) return;
    const pending = pendingTerminalOpenRef.current;
    if (!pending) return;

    // WorkspaceShell mounts in the same commit as `surface`; its terminal:open
    // listener registers in a useEffect that runs after paint. Defer one
    // macrotask so the emit is not lost.
    const timer = setTimeout(() => {
      if (pendingTerminalOpenRef.current !== pending) return;
      pendingTerminalOpenRef.current = null;
      emitTerminalOpen(portalEvents, 'quick-open', pending);
    }, 0);
    return () => clearTimeout(timer);
  }, [surface, portalEvents]);

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

  // The stored preference stays a single field — whatever the user last saw.
  // The overlay wins when one is up (that is what's on screen); otherwise the
  // surface. Written on both axes so a restart resumes the same place.
  const persistActiveView = useCallback(
    async (view: NavigationView) => {
      if (!preferencesLoaded) return;
      try {
        await UserPreferencesService.updatePreferences({
          interactiveShell: {
            activeNavigationView: view,
          },
        });
      } catch (error) {
        console.error('Failed to save navigation preference:', error);
      }
    },
    [preferencesLoaded],
  );

  // Show a workspace surface. This is *navigation*: any overlay comes down and
  // the repository-panel selection resets, because the user deliberately left.
  const selectSurface = useCallback(
    (view: WorkspaceView) => {
      setSurface(view);
      setOverlay(null);
      setIsRepositoryPanelActive(false);

      // Sidebar Home always lands on the about/overview surface of the home
      // panel — including when Home is already active but a sub-view (Your
      // Projects, Other Clones, …) is showing.
      if (view === 'home-panel') {
        window.dispatchEvent(new CustomEvent('home-panel:show-overview'));
      }

      void persistActiveView(view);
    },
    [persistActiveView],
  );

  // Raise a standalone overlay. The surface underneath is untouched — no panel
  // swap, no collapse-state change, no tab state to reconstruct.
  const openOverlay = useCallback(
    (view: OverlayView) => {
      setOverlay(view);
      void persistActiveView(view);
    },
    [persistActiveView],
  );

  // Take the overlay down and reveal whatever was underneath it. Not
  // navigation: nothing about the surface changes, so an action inside an
  // overlay can dismiss it without moving the user anywhere. The one exception
  // is a cold start, where no surface has ever been mounted — then there is
  // nothing underneath to reveal, so mount the app's home surface.
  const dismissOverlay = useCallback(() => {
    setOverlay(null);
    if (surfaceRef.current) {
      void persistActiveView(surfaceRef.current);
    } else {
      setSurface('home-panel');
      void persistActiveView('home-panel');
    }
  }, [persistActiveView]);

  const toggleOverlay = useCallback(
    (view: OverlayView) => {
      if (overlayRef.current === view) {
        dismissOverlay();
      } else {
        openOverlay(view);
      }
    },
    [dismissOverlay, openOverlay],
  );

  // Route a view id to the right axis — the sidebar, the command palette and
  // the panel-event handlers all speak one flat namespace.
  const requestView = useCallback(
    (view: NavigationView) => {
      if (isWorkspaceView(view)) {
        selectSurface(view);
      } else {
        openOverlay(view);
      }
    },
    [openOverlay, selectSurface],
  );

  const handleOpenRepository = useCallback(
    (repository: RepositorySelectedPayload) => {
      setSelectedRepository(repository);
      setIsRepositoryPanelActive(true);
    },
    [],
  );

  const handleSelectRepository = useCallback(() => {
    if (!selectedRepository) return;
    // The repository panel lives on the surface, so an overlay has to come down
    // for it to be visible. No surface change: the panel is wherever you are.
    if (overlayRef.current) {
      setOverlay(null);
    }
    setIsRepositoryPanelActive(true);
  }, [selectedRepository]);

  const handleCloseRepository = useCallback(() => {
    setSelectedRepository(null);
    setIsRepositoryPanelActive(false);
  }, []);

  // Toggle the Sky View overlay from the titlebar.
  const handleToggleHome = useCallback(() => {
    toggleOverlay('home');
  }, [toggleOverlay]);

  // A card click in the Sky View overlay opens a repo/owner profile tab on the
  // portal bus (PortalIntentBridge materializes it). Dropping the overlay is all
  // it takes to reveal that tab — the surface underneath never moved.
  const handleDismissOverlay = useCallback(() => {
    dismissOverlay();
  }, [dismissOverlay]);

  // Save collapsed states when they change
  const handleToggleSidebar = useCallback(async () => {
    const newCollapsed = !sidebarCollapsed;

    // Update state for the view whose left panel is actually visible.
    setViewCollapsedStates((prev) => {
      const previousState = prev[sidebarView] ?? getViewDefaults(sidebarView);
      return {
        ...prev,
        [sidebarView]: {
          ...previousState,
          left: newCollapsed,
        },
      };
    });

    if (preferencesLoaded) {
      try {
        const viewKey = getViewKey(sidebarView);
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
  }, [sidebarCollapsed, sidebarView, preferencesLoaded]);

  const handlePortalCollapsedChange = useCallback(
    (left: boolean) => {
      if (!surface) return;
      setViewCollapsedStates((prev) => {
        const previousState = prev[surface] ?? getViewDefaults(surface);
        return {
          ...prev,
          [surface]: { ...previousState, left },
        };
      });
    },
    [surface],
  );

  const handleToggleRightSidebar = useCallback(async () => {
    const newCollapsed = !rightSidebarCollapsed;

    // Update state for the visible surface
    setViewCollapsedStates((prev) => {
      const previousState = prev[sidebarView] ?? getViewDefaults(sidebarView);
      return {
        ...prev,
        [sidebarView]: {
          ...previousState,
          right: newCollapsed,
        },
      };
    });

    if (preferencesLoaded) {
      try {
        const viewKey = getViewKey(sidebarView);
        if (viewKey) {
          // AuthView only supports two-panel layout (no right panel)
          // Only save left collapse state for authView
          await UserPreferencesService.updatePreferences({
            panelLayouts: {
              [viewKey]: {
                collapsed: {
                  left:
                    viewCollapsedStates[sidebarView]?.left ??
                    getViewDefaults(sidebarView).left,
                },
              },
            },
          });
        }
      } catch (error) {
        console.error('Failed to save right sidebar collapsed state:', error);
      }
    }
  }, [
    rightSidebarCollapsed,
    sidebarView,
    preferencesLoaded,
    viewCollapsedStates,
  ]);

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
            requestView(viewName);
          }
          return { success: true };
        }
        case 'reset':
          setOverlay('home');
          setViewCollapsedStates({
            projects: { left: false, right: false },
            'home-panel': { left: false, right: false },
            onboarding: { left: false, right: false },
            auth: { left: false, right: false },
            monitoring: { left: false, right: false },
            settings: { left: false, right: false },
            processes: { left: false, right: false },
            requests: { left: false, right: false },
            connections: { left: false, right: false },
            skills: { left: false, right: false },
          });
          return { success: true };
        default:
          return { error: `Unknown command: ${name}` };
      }
    },
    [handleToggleSidebar, handleToggleRightSidebar, requestView],
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
          requestView(payload.view as NavigationView);
        }
      }),
      events.on('panel:reset-layout', () => {
        setOverlay('home');
        setViewCollapsedStates({
          projects: { left: false, right: false },
          'home-panel': { left: false, right: false },
          onboarding: { left: false, right: false },
          auth: { left: false, right: false },
          monitoring: { left: false, right: false },
          settings: { left: false, right: false },
          processes: { left: false, right: false },
          requests: { left: false, right: false },
          connections: { left: false, right: false },
          skills: { left: false, right: false },
        });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events, handleToggleSidebar, handleToggleRightSidebar, requestView]);

  // Cmd+': toggle the Sky View overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'Quote') {
        e.preventDefault();
        toggleOverlay('home');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleOverlay]);

  // Cmd+Shift+<letter>: jump straight to a sidebar view — except
  // Cmd+Shift+S, which toggles Sky View (the overlay has no sidebar item, so it
  // takes the mnemonic here; KeyS is otherwise unused).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        !((e.metaKey || e.ctrlKey) && e.shiftKey) ||
        e.altKey
      ) {
        return;
      }
      if (e.code === 'KeyS') {
        e.preventDefault();
        toggleOverlay('home');
        return;
      }
      const view = SIDEBAR_VIEW_SHORTCUTS[e.code];
      if (!view) return;
      e.preventDefault();
      selectSurface(view);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectSurface, toggleOverlay]);

  // Escape: dismiss a standalone overlay, revealing whatever is beneath it
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayRef.current) {
        dismissOverlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dismissOverlay]);

  // Agent Command Palette - Cmd+Shift+K to open
  const agentPalette = useAgentCommandPalette({
    events,
    keyboard: { key: 'k', metaKey: true, shiftKey: true, altKey: false },
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
        activeView={surface}
        onViewChange={requestView}
        leftPanelCollapsed={sidebarCollapsed}
        onToggleLeftPanel={() => {
          void handleToggleSidebar();
        }}
        repository={
          selectedRepository
            ? {
                owner:
                  selectedRepository.github?.owner ??
                  selectedRepository.localEntry?.github?.owner ??
                  '',
                name:
                  selectedRepository.github?.name ??
                  selectedRepository.localEntry?.github?.name ??
                  'Repository',
              }
            : null
        }
        isRepositoryActive={isRepositoryPanelActive}
        onSelectRepository={handleSelectRepository}
      />

      <div className="main-content">
        <IntegratedTitlebar
          showSidebarControl={false}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          onToggleHome={handleToggleHome}
          isHomeActive={overlay === 'home'}
          showRightSidebarControl={false}
          rightSidebarCollapsed={rightSidebarCollapsed}
          onToggleRightSidebar={handleToggleRightSidebar}
          hideSearch={false}
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
              Persistent base layer: the workspace surface. It stays mounted
              while an overlay is up, so dismissing one is a pure visibility
              flip — no tab/terminal/scroll state to reconstruct. Null until the
              user first shows a surface, so a cold start on Sky View doesn't
              eagerly boot a workspace.
            */}
            {surface && (
              <PrincipalPortal
                workspaceView={surface}
                leftSidebarCollapsed={
                  viewCollapsedStates[surface]?.left ?? false
                }
                onLeftSidebarCollapsedChange={handlePortalCollapsedChange}
                selectedRepository={selectedRepository}
                isRepositoryPanelActive={isRepositoryPanelActive}
                onOpenRepository={handleOpenRepository}
                onCloseRepository={handleCloseRepository}
              />
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
              {overlay && (
                <motion.div
                  key={overlay}
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
                    {overlay === 'home' && (
                      <HomeView onDismissOverlay={handleDismissOverlay} />
                    )}
                    {overlay === 'onboarding' && (
                      <OnboardingView
                        onComplete={() => selectSurface('home-panel')}
                      />
                    )}
                    {overlay === 'monitoring' && (
                      <SystemMonitor sidebarCollapsed={sidebarCollapsed} />
                    )}
                    {overlay === 'settings' && (
                      <Settings initialCategory={settingsCategory} />
                    )}
                    {overlay === 'auth' && <AuthView />}
                    {overlay === 'connections' && <ConnectionsView />}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Agent Command Palette - Cmd+Shift+K to open */}
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
              selectSurface('home-panel');
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
