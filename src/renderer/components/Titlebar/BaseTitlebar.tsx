import React, { useEffect, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import './Titlebar.css';
import { ThemeDropdown } from './ThemeDropdown';

declare global {
  interface Window {
    electronTitlebar?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
    };
  }
}

export interface BaseTitlebarProps {
  title?: string | React.ReactNode;
  showWindowControls?: boolean;
  showThemeDropdown?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onTitleClick?: () => void;
}

export const BaseTitlebar: React.FC<BaseTitlebarProps> = ({
  title,
  showWindowControls = true,
  showThemeDropdown = false,
  children,
  className = '',
  style,
  onTitleClick,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const { theme, colorMode } = useTheme();

  useEffect(() => {
    if (window.electronTitlebar) {
      window.electronTitlebar.isMaximized().then(setIsMaximized);
      window.electronTitlebar.onMaximizeChange(setIsMaximized);
    }
  }, []);

  if (!window.electronTitlebar) {
    return null;
  }

  const backgroundColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.backgroundSecondary ||
        theme.colors.backgroundSecondary
      : theme.colors.backgroundSecondary;

  const accentColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.accent || theme.colors.accent
      : theme.colors.accent;

  return (
    <div
      className={`custom-titlebar ${isMac ? 'platform-darwin' : ''} ${className}`}
      style={{
        backgroundColor,
        height: '56px',
        fontFamily: theme.fonts.body,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        ...style
      }}
    >
      {/* Left-side content container */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginLeft: isMac ? '80px' : '20px',
        gap: '8px',
      }}>
        {React.Children.toArray(children).filter((child: any) =>
          child?.props?.position === 'left'
        )}
      </div>

      {/* Theme dropdown after left content */}
      {showThemeDropdown && (
        <div style={{ marginLeft: '8px' }}>
          <ThemeDropdown />
        </div>
      )}

      {/* Center content (replaces title) */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        WebkitAppRegion: 'drag' as any,
      }}>
        {React.Children.toArray(children).filter((child: any) =>
          child?.props?.position === 'center'
        )}
        {/* Show title only if no center content */}
        {React.Children.toArray(children).filter((child: any) =>
          child?.props?.position === 'center'
        ).length === 0 && title && (
          <div
            className="titlebar-title"
            style={{
              color: accentColor,
              fontSize: theme.fontSizes[3],
              fontFamily: theme.fonts.heading,
              WebkitAppRegion: 'no-drag' as any,
            }}
            onClick={onTitleClick}
          >
            {title}
          </div>
        )}
      </div>

      {/* Right-side content container */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginLeft: 'auto',
        marginRight: showWindowControls && !isMac ? '0' : '20px',
      }}>
        {React.Children.toArray(children).filter((child: any) =>
          !child?.props?.position || child?.props?.position === 'right'
        )}
      </div>

      {showWindowControls && !isMac && (
        <div className="titlebar-controls">
          <button
            className="titlebar-button minimize"
            onClick={() => window.electronTitlebar?.minimize()}
            aria-label="Minimize"
          >
            <svg width="12" height="1" viewBox="0 0 12 1">
              <rect fill="currentColor" width="12" height="1" />
            </svg>
          </button>
          <button
            className="titlebar-button maximize"
            onClick={() => window.electronTitlebar?.maximize()}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
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
            aria-label="Close"
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