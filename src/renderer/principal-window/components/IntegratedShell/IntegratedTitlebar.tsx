import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ThemeSelector } from './ThemeSelector';
import { TitlebarUpdateInlineButton } from '../../../components/Titlebar/TitlebarUpdateInlineButton';
import { ViewSidebarControls } from '../ViewSidebarControls/ViewSidebarControls';
import { PullMailbox } from '../PullMailbox';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import type { UserPreferences } from '../../../../shared/types/userPreferences.types';
import { Layers, FolderPlus, FilePlus2, Server } from 'lucide-react';
import { WindowService } from '../../../main-process-api/WindowService';
import { TitlebarGitHubSearch } from './TitlebarGitHubSearch';
import { CreateRepositoryInWorkspaceModal } from '../../../panels/components/CreateRepositoryInWorkspaceModal';
import { LocalhostProcessesModal } from './LocalhostProcessesModal';
import { LocalhostDetectionService } from '../../../main-process-api/LocalhostDetectionService';

declare global {
  interface Window {
    electronTitlebar?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      closeWithConfirmation: () => Promise<boolean>;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
    };
  }
}

interface IntegratedTitlebarProps {
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  showSidebarControl?: boolean;
  rightSidebarCollapsed?: boolean;
  onToggleRightSidebar?: () => void;
  showRightSidebarControl?: boolean;
  onShowOnboardingWizard?: () => void;
  hideSearch?: boolean;
  onAddProject?: () => void;
}

export const IntegratedTitlebar: React.FC<IntegratedTitlebarProps> = ({
  sidebarCollapsed = false,
  onToggleSidebar,
  showSidebarControl = false,
  rightSidebarCollapsed = false,
  onToggleRightSidebar,
  showRightSidebarControl = false,
  onShowOnboardingWizard,
  hideSearch = false,
  onAddProject,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showPullMailbox, setShowPullMailbox] = useState(false);
  const [showOpenThreadButton, setShowOpenThreadButton] = useState(false);
  const [showCreateRepoButton, setShowCreateRepoButton] = useState(false);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);
  const [showCreateRepoModal, setShowCreateRepoModal] = useState(false);
  const [localhostServerCount, setLocalhostServerCount] = useState(0);
  const [showLocalhostModal, setShowLocalhostModal] = useState(false);
  const { theme } = useTheme();
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    if (window.electronTitlebar) {
      window.electronTitlebar.isMaximized().then(setIsMaximized);
      window.electronTitlebar.onMaximizeChange(setIsMaximized);
    }
  }, []);

  // Background watch for running localhost dev servers so the titlebar can
  // surface an indicator (and the modal) only when there's something to view.
  useEffect(() => {
    let watchId: string | null = null;

    const unsubscribe = LocalhostDetectionService.onServersUpdated((result) => {
      setLocalhostServerCount(result.servers.length);
    });

    LocalhostDetectionService.detectRunningServers()
      .then((result) => setLocalhostServerCount(result.servers.length))
      .catch(() => {
        /* detection unavailable — leave count at 0 */
      });

    LocalhostDetectionService.startWatching(undefined, 5000)
      .then(({ watchId: id }) => {
        watchId = id;
      })
      .catch(() => {
        /* watch unavailable — initial scan still populated the count */
      });

    return () => {
      unsubscribe();
      if (watchId) {
        LocalhostDetectionService.stopWatching(watchId).catch(() => {
          /* best-effort cleanup */
        });
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applyPreferences = (preferences: UserPreferences) => {
      if (!isMounted) {
        return;
      }

      setShowPullMailbox(preferences.titlebarButtons?.pullMailbox ?? false);
      setShowOpenThreadButton(preferences.titlebarButtons?.openThread ?? false);
      setShowCreateRepoButton(
        preferences.titlebarButtons?.createRepository ?? false,
      );
      setBaseDefaultDirectory(preferences.baseDefaultDirectory || null);
    };

    void UserPreferencesService.getPreferences().then(applyPreferences);

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<UserPreferences>).detail;
      if (detail) {
        applyPreferences(detail);
      }
    };

    window.addEventListener(
      'user-preferences-updated',
      handlePreferencesUpdated as EventListener,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        'user-preferences-updated',
        handlePreferencesUpdated as EventListener,
      );
    };
  }, []);

  // Static title - Principal Workspace

  return (
    <div
      className="integrated-titlebar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        backgroundColor: 'transparent', // No background - let content define it
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '0px', // No left padding - let flexbox handle centering
        paddingRight: !isMac ? '156px' : '16px', // Account for Windows controls width
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
        zIndex: 100,
      }}
    >
      {/* Centered GitHub Search Bar */}
      {!hideSearch && (
        <div
          style={{
            position: 'fixed',
            left: '50vw',
            transform: 'translateX(-50%)',
            top: '0',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
            zIndex: 101,
          }}
        >
          <TitlebarGitHubSearch />
        </div>
      )}

      {/* Right controls */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Onboarding Wizard Button */}
        {onShowOnboardingWizard && (
          <button
            onClick={onShowOnboardingWizard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: theme.colors.primary,
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              transition: 'all 0.2s',
              WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            title="Test Onboarding Wizard"
          >
            Onboarding Wizard
          </button>
        )}
        {/* Update — visible only when an update is pending; downloads in place. */}
        <TitlebarUpdateInlineButton />
        {/* Localhost processes — visible only when dev servers are detected.
            Opens the LocalhostProcessesView in a modal. */}
        {localhostServerCount > 0 && (
          <button
            onClick={() => setShowLocalhostModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              transition: 'all 0.2s',
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
            title={`${localhostServerCount} localhost ${
              localhostServerCount === 1 ? 'process' : 'processes'
            } running`}
          >
            <Server size={14} color={theme.colors.primary} />
            <span
              style={{
                fontFamily: theme.fonts.monospace,
                fontSize: theme.fontSizes[0],
              }}
            >
              {localhostServerCount}
            </span>
          </button>
        )}
        {/* Add a project — only rendered when the host view wires it up
            (currently TrailsView via a window-event bridge). */}
        {onAddProject && (
          <button
            onClick={onAddProject}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              transition: 'all 0.2s',
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
            title="Pick a folder to add — we'll find any git repos inside"
          >
            <FolderPlus size={14} />
            Add a project
          </button>
        )}
        {/* Create Repository — gated by titlebarButtons.createRepository.
            Opens the modal in owner-subdir mode: skips workspace pick,
            clones under {baseDefaultDirectory}/{owner}/{repoName}. */}
        {showCreateRepoButton && baseDefaultDirectory && (
          <button
            onClick={() => setShowCreateRepoModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              transition: 'all 0.2s',
              WebkitAppRegion:
                'no-drag' as React.CSSProperties['WebkitAppRegion'],
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
            title="Create a new GitHub repository under your base directory"
          >
            <FilePlus2 size={14} />
            Create
          </button>
        )}
        {/* Open Thread button */}
        {showOpenThreadButton && (
          <button
            onClick={() => WindowService.openEmptyThread()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              transition: 'all 0.2s',
              WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
            }}
            title="Open a new thread"
          >
            <Layers size={14} />
            Open Thread
          </button>
        )}
        {showPullMailbox && <PullMailbox />}
        <ThemeSelector />
        {showSidebarControl && onToggleSidebar && (
          <ViewSidebarControls
            isCollapsed={sidebarCollapsed}
            onToggle={onToggleSidebar}
          />
        )}
        {showRightSidebarControl && onToggleRightSidebar && (
          <ViewSidebarControls
            isCollapsed={rightSidebarCollapsed}
            onToggle={onToggleRightSidebar}
            side="right"
          />
        )}
      </div>

      {/* Window controls for Windows */}
      {!isMac && window.electronTitlebar && (
        <div
          className="window-controls"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            WebkitAppRegion:
              'no-drag' as React.CSSProperties['WebkitAppRegion'],
          }}
        >
          <button
            className="titlebar-button"
            onClick={() => window.electronTitlebar?.minimize()}
            style={{
              width: '46px',
              height: '100%',
              border: 'none',
              background: 'transparent',
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="12" height="1" viewBox="0 0 12 1">
              <rect fill="currentColor" width="12" height="1" />
            </svg>
          </button>

          <button
            className="titlebar-button"
            onClick={() => window.electronTitlebar?.maximize()}
            style={{
              width: '46px',
              height: '100%',
              border: 'none',
              background: 'transparent',
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {isMaximized ? (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path
                  fill="currentColor"
                  d="M2.4 0v2.4H0v9.6h9.6V9.6h2.4V0H2.4zm1.2 3.6h4.8v4.8H1.2V3.6h2.4zm4.8 1.2H3.6v3.6h4.8V4.8z"
                />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect
                  fill="currentColor"
                  width="12"
                  height="12"
                  strokeWidth="1"
                  stroke="currentColor"
                />
              </svg>
            )}
          </button>

          <button
            className="titlebar-button close"
            onClick={() => window.electronTitlebar?.close()}
            style={{
              width: '46px',
              height: '100%',
              border: 'none',
              background: 'transparent',
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e81123';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = theme.colors.text;
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                fill="currentColor"
                d="M1.69 0L6 4.31 10.31 0 12 1.69 7.69 6 12 10.31 10.31 12 6 7.69 1.69 12 0 10.31 4.31 6 0 1.69 1.69 0z"
              />
            </svg>
          </button>
        </div>
      )}

      <CreateRepositoryInWorkspaceModal
        isOpen={showCreateRepoModal}
        onClose={() => setShowCreateRepoModal(false)}
        baseDefaultDirectory={baseDefaultDirectory}
        useOwnerSubdir
      />

      <LocalhostProcessesModal
        isOpen={showLocalhostModal}
        onClose={() => setShowLocalhostModal(false)}
      />
    </div>
  );
};
