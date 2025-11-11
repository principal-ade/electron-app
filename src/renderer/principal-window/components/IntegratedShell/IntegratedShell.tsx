import React, { useState, useEffect } from 'react';
import { NavigationSidebar } from './NavigationSidebar';
import { IntegratedTitlebar } from './IntegratedTitlebar';
import { useTheme } from '@a24z/industry-theme';
import { MarkdownSearch } from '../../views/MarkdownSearch';
import { Settings } from '../../views/Settings';
import { TerminalManager } from '../../views/TerminalManager';
import { SystemMonitor } from '../../views/SystemMonitor/SystemMonitor';
import { AuthView } from '../../views/AuthView';
import { FeedView } from '../../views/FeedView';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { PresenceService } from '../../../main-process-api/PresenceService';
import { SecureAuthService } from '../../../services/SecureAuthService';
import type { InteractiveShellNavigationView } from '../../../../shared/types/userPreferences.types';
import './IntegratedShell.css';

export type NavigationView = InteractiveShellNavigationView;

// Helper to map view to panel layout key
const getViewKey = (
  view: NavigationView,
): 'terminalManager' | 'authView' | null => {
  switch (view) {
    case 'terminal':
      return 'terminalManager';
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
    case 'terminal':
      return { left: false, right: false }; // No right panel for terminal
    case 'auth':
      return { left: false, right: false }; // No right panel for auth
    default:
      return { left: false, right: false };
  }
};

export const IntegratedShell: React.FC = () => {
  const [activeView, setActiveView] = useState<NavigationView>('feed');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const { theme, mode } = useTheme();

  // Store collapsed states per view to avoid animation glitches when switching
  const [viewCollapsedStates, setViewCollapsedStates] = useState<
    Record<string, { left: boolean; right: boolean }>
  >({
    terminal: { left: false, right: false },
    auth: { left: false, right: false },
    monitoring: { left: false, right: false },
    search: { left: false, right: false },
    settings: { left: false, right: false },
    feed: { left: false, right: false },
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
        const views: NavigationView[] = ['terminal', 'auth'];
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
          console.info('[IntegratedShell] Skipping presence auto-connect: not authenticated');
          return;
        }

        // Auto-connect to presence
        console.info('[IntegratedShell] Auto-connecting to presence on startup');
        const result = await PresenceService.connectToPresence(authResult.token);

        if (result.success) {
          console.info('[IntegratedShell] Successfully auto-connected to presence');
        } else {
          console.warn('[IntegratedShell] Failed to auto-connect to presence:', result.error);
        }
      } catch (error) {
        console.error('[IntegratedShell] Error during presence auto-connect:', error);
      }
    };

    // Only run after preferences are loaded
    if (preferencesLoaded) {
      autoConnectPresence();
    }
  }, [preferencesLoaded]);

  // Save navigation view when it changes
  const handleViewChange = async (view: NavigationView) => {
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
  };

  // Save collapsed states when they change
  const handleToggleSidebar = async () => {
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
  };

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
          await UserPreferencesService.updatePreferences({
            panelLayouts: {
              [viewKey]: {
                collapsed: {
                  left:
                    viewCollapsedStates[activeView]?.left ??
                    getViewDefaults(activeView).left,
                  right: newCollapsed,
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
          showSidebarControl={activeView === 'terminal'}
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
            {activeView === 'terminal' && (
              <TerminalManager sidebarCollapsed={sidebarCollapsed} />
            )}
            {activeView === 'search' && <MarkdownSearch />}
            {activeView === 'monitoring' && (
              <SystemMonitor sidebarCollapsed={sidebarCollapsed} />
            )}
            {activeView === 'settings' && <Settings />}
            {activeView === 'auth' && <AuthView />}
            {activeView === 'feed' && <FeedView />}
          </div>
        </div>
      </div>
    </div>
  );
};
