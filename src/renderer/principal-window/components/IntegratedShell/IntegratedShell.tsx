import React, { useState, useEffect } from 'react';
import { NavigationSidebar } from './NavigationSidebar';
import { IntegratedTitlebar } from './IntegratedTitlebar';
import { useTheme } from 'themed-markdown';
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

export const IntegratedShell: React.FC = () => {
  const [activeView, setActiveView] = useState<NavigationView>('rooms');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const { theme, mode } = useTheme();

  // Load saved navigation view on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await UserPreferencesService.getPreferences();
        if (prefs.interactiveShell?.activeNavigationView) {
          setActiveView(prefs.interactiveShell.activeNavigationView);
        }
      } catch (error) {
        console.error('Failed to load navigation preference:', error);
      } finally {
        setPreferencesLoaded(true);
      }
    };
    loadPreferences();
  }, []);

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
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          showRightSidebarControl={activeView === 'rooms' || activeView === 'repository'}
          rightSidebarCollapsed={rightSidebarCollapsed}
          onToggleRightSidebar={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
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
          }}>
            {/* Views will be rendered here based on activeView */}
            {activeView === 'repository' && <RepositoryExplorer sidebarCollapsed={sidebarCollapsed} rightSidebarCollapsed={rightSidebarCollapsed} />}
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