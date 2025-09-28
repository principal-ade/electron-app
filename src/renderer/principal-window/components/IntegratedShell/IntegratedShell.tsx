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
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const { theme, colorMode } = useTheme();

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

  const backgroundColor = colorMode === 'dark'
    ? theme.colors.modes?.dark?.background || theme.colors.background
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
            backgroundColor: colorMode === 'dark'
              ? theme.colors.modes?.dark?.backgroundSecondary || theme.colors.backgroundSecondary
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
            backgroundColor: colorMode === 'dark'
              ? theme.colors.modes?.dark?.background || theme.colors.background
              : theme.colors.background,
          }}>
            {/* Views will be rendered here based on activeView */}
            {activeView === 'repository' && <RepositoryExplorer sidebarCollapsed={sidebarCollapsed} />}
            {activeView === 'terminal' && <TerminalManager sidebarCollapsed={sidebarCollapsed} />}
            {activeView === 'rooms' && <RoomsManager sidebarCollapsed={sidebarCollapsed} />}
            {activeView === 'search' && <MarkdownSearch />}
            {activeView === 'monitoring' && <SystemMonitor sidebarCollapsed={sidebarCollapsed} />}
            {activeView === 'settings' && <Settings />}
            {activeView === 'auth' && <AuthView />}
            {activeView !== 'repository' && activeView !== 'terminal' && activeView !== 'rooms' && activeView !== 'search' && activeView !== 'settings' && activeView !== 'monitoring' && activeView !== 'workspaces' && activeView !== 'auth' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontSize: '24px',
                opacity: 0.5,
                flexDirection: 'column',
              }}>
                {activeView.charAt(0).toUpperCase() + activeView.slice(1)} View
                <span style={{ fontSize: '14px', marginTop: '8px' }}>
                  (Component will be integrated here)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};