import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { ThemeDropdown } from './ThemeDropdown';
import { ThemeCustomizationButton } from '../../../components/Titlebar/ThemeCustomizationButton';
import { ViewSidebarControls } from '../ViewSidebarControls/ViewSidebarControls';
import { Bot } from 'lucide-react';
import { remoteAgentService } from '../../../services/RemoteAgentService';
import type { RemoteAgentConfig } from '../../../../shared/types/remoteAgent.types';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import type { UserPreferences } from '../../../../shared/types/userPreferences.types';

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
}

export const IntegratedTitlebar: React.FC<IntegratedTitlebarProps> = ({
  sidebarCollapsed = false,
  onToggleSidebar,
  showSidebarControl = false,
  rightSidebarCollapsed = false,
  onToggleRightSidebar,
  showRightSidebarControl = false,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [openAgentIds, setOpenAgentIds] = useState<Set<string>>(new Set());
  const [remoteAgentButtonVisibility, setRemoteAgentButtonVisibility] =
    useState({
      jules: false,
      codex: false,
    });
  const [showThemeButton, setShowThemeButton] = useState(true);
  const [showCustomizeButton, setShowCustomizeButton] = useState(true);
  const { theme, mode } = useTheme();
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    if (window.electronTitlebar) {
      window.electronTitlebar.isMaximized().then(setIsMaximized);
      window.electronTitlebar.onMaximizeChange(setIsMaximized);
    }
  }, []);

  useEffect(() => {
    const updateAgentIds = (agents: RemoteAgentConfig[]) => {
      setOpenAgentIds(new Set(agents.map((agent) => agent.id)));
    };

    const unsubscribe = remoteAgentService.onAgentListChange(
      (agents, _activeAgentId) => {
        updateAgentIds(agents);
      },
    );

    remoteAgentService
      .listRemoteAgents()
      .then(updateAgentIds)
      .catch((error) => {
        console.error('Failed to fetch remote agent list:', error);
      });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applyPreferences = (preferences: UserPreferences) => {
      if (!isMounted) {
        return;
      }

      setRemoteAgentButtonVisibility({
        jules: preferences.remoteAgentButtons?.jules ?? false,
        codex: preferences.remoteAgentButtons?.codex ?? false,
      });
      setShowThemeButton(preferences.titlebarButtons?.theme ?? true);
      setShowCustomizeButton(preferences.titlebarButtons?.customize ?? true);
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

  const accentColor =
    mode === 'dark' && theme.modes?.dark?.accent
      ? theme.modes.dark.accent
      : theme.colors.accent;

  const agentDefinitions = useMemo(
    () => ({
      jules: {
        id: 'jules',
        name: 'Jules',
        url: 'https://jules.google.com',
        buttonLabel: 'Jules',
      },
      chatgpt: {
        id: 'chatgpt',
        name: 'ChatGPT Codex',
        url: 'https://chatgpt.com/codex',
        buttonLabel: 'Codex',
      },
    }),
    [],
  );

  const isAgentOpen = useCallback(
    (agentId: string) => openAgentIds.has(agentId),
    [openAgentIds],
  );

  const openRemoteAgent = useCallback(
    async (type: 'jules' | 'chatgpt') => {
      const config = agentDefinitions[type];

      try {
        await remoteAgentService.openRemoteAgent(config);
      } catch (error) {
        console.error(
          `Error opening ${type === 'jules' ? 'Jules' : 'Codex'}:`,
          error,
        );
      }
    },
    [agentDefinitions],
  );

  // Static title - Principal View

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
      {/* Left spacer */}
      <div style={{ flex: 1 }} />

      {/* Centered Title */}
      <div
        style={{
          fontSize: theme.fontSizes[3],
          fontWeight: 600,
          color: accentColor,
          fontFamily: theme.fonts.heading,
          WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
          marginRight: '100px',
        }}
      >
        Principal View
      </div>

      {/* Right spacer with controls */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            WebkitAppRegion:
              'no-drag' as React.CSSProperties['WebkitAppRegion'],
          }}
        >
          {remoteAgentButtonVisibility.jules && (
            <button
              onClick={() => openRemoteAgent('jules')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                opacity: isAgentOpen(agentDefinitions.jules.id) ? 0.85 : 1,
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = isAgentOpen(
                  agentDefinitions.jules.id,
                )
                  ? '0.85'
                  : '1';
              }}
              title={
                isAgentOpen(agentDefinitions.jules.id)
                  ? 'Focus the existing Jules remote agent window'
                  : 'Open a Jules remote agent window'
              }
            >
              <Bot size={14} />
              {isAgentOpen(agentDefinitions.jules.id)
                ? 'Focus Jules'
                : agentDefinitions.jules.buttonLabel}
            </button>
          )}

          {remoteAgentButtonVisibility.codex && (
            <button
              onClick={() => openRemoteAgent('chatgpt')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: theme.colors.secondary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                opacity: isAgentOpen(agentDefinitions.chatgpt.id) ? 0.85 : 1,
                transition: 'opacity 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = isAgentOpen(
                  agentDefinitions.chatgpt.id,
                )
                  ? '0.85'
                  : '1';
              }}
              title={
                isAgentOpen(agentDefinitions.chatgpt.id)
                  ? 'Focus the existing Codex remote agent window'
                  : 'Open a Codex remote agent window'
              }
            >
              <Bot size={14} />
              {isAgentOpen(agentDefinitions.chatgpt.id)
                ? 'Focus Codex'
                : agentDefinitions.chatgpt.buttonLabel}
            </button>
          )}
        </div>
        {showThemeButton && <ThemeDropdown />}
        {showCustomizeButton && <ThemeCustomizationButton />}
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
    </div>
  );
};
