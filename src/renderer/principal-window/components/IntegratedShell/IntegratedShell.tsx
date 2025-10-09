import React, { useState, useEffect } from 'react';
import { NavigationSidebar } from './NavigationSidebar';
import { IntegratedTitlebar } from './IntegratedTitlebar';
import { useTheme } from '@a24z/industry-theme';
import { RepositoryExplorer } from '../../views/RepositoryExplorer';
import { MarkdownSearch } from '../../views/MarkdownSearch';
import { Settings } from '../../views/Settings';
import { TerminalManager } from '../../views/TerminalManager';
import { RoomsManager } from '../../views/RoomsManager';
import { SystemMonitor } from '../../views/SystemMonitor/SystemMonitor';
import { AuthView } from '../../views/AuthView';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import type { InteractiveShellNavigationView } from '../../../../shared/types/userPreferences.types';
import './IntegratedShell.css';

export type NavigationView = InteractiveShellNavigationView;

// Helper to map view to panel layout key
const getViewKey = (view: NavigationView): 'repositoryExplorer' | 'roomsManager' | 'terminalManager' | 'authView' | null => {
  switch (view) {
    case 'repository':
      return 'repositoryExplorer';
    case 'rooms':
      return 'roomsManager';
    case 'terminal':
      return 'terminalManager';
    case 'auth':
      return 'authView';
    default:
      return null;
  }
};

// Default collapsed states per view
const getViewDefaults = (view: NavigationView): { left: boolean; right: boolean } => {
  switch (view) {
    case 'repository':
      return { left: false, right: false }; // No right panel for repository (uses nested panels instead)
    case 'rooms':
      return { left: false, right: true };
    case 'terminal':
      return { left: false, right: false }; // No right panel for terminal
    case 'auth':
      return { left: false, right: false }; // No right panel for auth
    default:
      return { left: false, right: false };
  }
};

export const IntegratedShell: React.FC = () => {
  const [activeView, setActiveView] = useState<NavigationView>('rooms');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const { theme, mode } = useTheme();

  // Store collapsed states per view to avoid animation glitches when switching
  const [viewCollapsedStates, setViewCollapsedStates] = useState<Record<string, { left: boolean; right: boolean }>>({
    repository: { left: false, right: false }, // No right panel for repository
    rooms: { left: false, right: true },
    terminal: { left: false, right: false },
    auth: { left: false, right: false },
    monitoring: { left: false, right: false },
    search: { left: false, right: false },
    settings: { left: false, right: false },
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
        const views: NavigationView[] = ['repository', 'rooms', 'terminal', 'auth'];
        for (const view of views) {
          const viewKey = getViewKey(view);
          const defaults = getViewDefaults(view);

          if (viewKey && prefs.panelLayouts?.[viewKey]?.collapsed) {
            const collapsed = prefs.panelLayouts[viewKey].collapsed;
            newViewStates[view] = {
              left: collapsed.left ?? defaults.left,
              right: collapsed.right ?? defaults.right,
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
    setViewCollapsedStates(prev => ({
      ...prev,
      [activeView]: {
        ...prev[activeView],
        left: newCollapsed,
      },
    }));

    if (preferencesLoaded) {
      try {
        const viewKey = getViewKey(activeView);
        if (viewKey) {
          await UserPreferencesService.updatePreferences({
            panelLayouts: {
              [viewKey]: {
                collapsed: {
                  left: newCollapsed,
                  right: viewCollapsedStates[activeView]?.right, // Preserve right state
                },
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
    setViewCollapsedStates(prev => ({
      ...prev,
      [activeView]: {
        ...prev[activeView],
        right: newCollapsed,
      },
    }));

    if (preferencesLoaded) {
      try {
        const viewKey = getViewKey(activeView);
        if (viewKey) {
          await UserPreferencesService.updatePreferences({
            panelLayouts: {
              [viewKey]: {
                collapsed: {
                  left: viewCollapsedStates[activeView]?.left, // Preserve left state
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

  const ensureRightSidebarOpen = () => {
    if (!rightSidebarCollapsed) {
      return;
    }

    const currentLeftCollapsed =
      viewCollapsedStates[activeView]?.left ?? getViewDefaults(activeView).left;

    setViewCollapsedStates(prev => ({
      ...prev,
      [activeView]: {
        ...prev[activeView],
        right: false,
      },
    }));

    if (preferencesLoaded) {
      const viewKey = getViewKey(activeView);
      if (viewKey) {
        void UserPreferencesService.updatePreferences({
          panelLayouts: {
            [viewKey]: {
              collapsed: {
                left: currentLeftCollapsed,
                right: false,
              },
            },
          },
        }).catch(error => {
          console.error('Failed to save right sidebar collapsed state:', error);
        });
      }
    }
  };

  const collapseRightSidebar = () => {
    if (rightSidebarCollapsed) {
      return;
    }

    const currentLeftCollapsed =
      viewCollapsedStates[activeView]?.left ?? getViewDefaults(activeView).left;

    setViewCollapsedStates(prev => ({
      ...prev,
      [activeView]: {
        ...prev[activeView],
        right: true,
      },
    }));

    if (preferencesLoaded) {
      const viewKey = getViewKey(activeView);
      if (viewKey) {
        void UserPreferencesService.updatePreferences({
          panelLayouts: {
            [viewKey]: {
              collapsed: {
                left: currentLeftCollapsed,
                right: true,
              },
            },
          },
        }).catch(error => {
          console.error('Failed to save right sidebar collapsed state:', error);
        });
      }
    }
  };

  const backgroundColor = mode === 'dark' && theme.modes?.dark?.background
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
          showSidebarControl={activeView === 'repository' || activeView === 'terminal' || activeView === 'rooms'}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          showRightSidebarControl={activeView === 'rooms'}
          rightSidebarCollapsed={rightSidebarCollapsed}
          onToggleRightSidebar={handleToggleRightSidebar}
        />

        {/* Main content area with rounded corners for Slack-style cutout */}
        <div
          className="content-wrapper"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,  // Start at 0 since parent already starts after sidebar
            right: 0,
            bottom: 0,
            backgroundColor: mode === 'dark' && theme.modes?.dark?.backgroundSecondary
              ? theme.modes.dark.backgroundSecondary
              : theme.colors.backgroundSecondary,
            borderTopLeftRadius: '8px', // Rounded corner creates the cutout effect
            overflow: 'hidden',
            pointerEvents: 'none', // Allow clicks through to titlebar
          }}
        >
          <div className="view-container" style={{
            marginTop: '56px', // Space for titlebar
            marginLeft: '0',
            marginRight: '6px',
            marginBottom: '6px',
            height: 'calc(100% - 62px)', // Account for margins and titlebar
            boxSizing: 'border-box',
            overflow: 'auto',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '8px',
            backgroundColor: mode === 'dark' && theme.modes?.dark?.background
              ? theme.modes.dark.background
              : theme.colors.background,
            pointerEvents: 'auto', // Re-enable pointer events for content
          }}>
            {/* Views will be rendered here based on activeView */}
            {activeView === 'repository' && (
              <RepositoryExplorer
                sidebarCollapsed={sidebarCollapsed}
                rightSidebarCollapsed={rightSidebarCollapsed}
                onEnsureRightPanelOpen={ensureRightSidebarOpen}
                onCollapseRightPanel={collapseRightSidebar}
              />
            )}
            {activeView === 'terminal' && <TerminalManager sidebarCollapsed={sidebarCollapsed} />}
            {activeView === 'rooms' && <RoomsManager sidebarCollapsed={sidebarCollapsed} rightSidebarCollapsed={rightSidebarCollapsed} />}
            {activeView === 'search' && <MarkdownSearch />}
            {activeView === 'monitoring' && <SystemMonitor sidebarCollapsed={sidebarCollapsed} />}
            {activeView === 'settings' && <Settings />}
            {activeView === 'auth' && <AuthView />}
          </div>
        </div>
      </div>
    </div>
  );
};