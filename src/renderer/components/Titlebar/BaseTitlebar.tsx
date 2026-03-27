import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import './Titlebar.css';
import { ThemeDropdown } from './ThemeDropdown';
import { ThemeCustomizationButton } from './ThemeCustomizationButton';
import { TitlebarUpdateButton } from './TitlebarUpdateButton';

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

export interface BaseTitlebarProps {
  title?: string | React.ReactNode;
  showWindowControls?: boolean;
  showThemeDropdown?: boolean;
  showCustomizeButton?: boolean;
  confirmBeforeClose?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onTitleClick?: () => void;
  onUpdateClick?: () => void;
}

export const BaseTitlebar: React.FC<BaseTitlebarProps> = ({
  title,
  showWindowControls = true,
  showThemeDropdown = false,
  showCustomizeButton = false,
  confirmBeforeClose = false,
  children,
  className = '',
  style,
  onTitleClick,
  onUpdateClick,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const { theme, mode } = useTheme();

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
    mode === 'dark'
      ? theme.modes?.dark?.backgroundSecondary ||
        theme.colors.backgroundSecondary
      : theme.colors.backgroundSecondary;

  const accentColor =
    mode === 'dark'
      ? theme.modes?.dark?.accent || theme.colors.accent
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
        ...style,
      }}
    >
      {/* Update button - positioned below macOS traffic lights */}
      <TitlebarUpdateButton onClick={onUpdateClick} />

      {/* Left-side content container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginLeft: isMac ? '80px' : '20px',
          gap: '8px',
        }}
      >
        {React.Children.toArray(children).filter(
          (child): child is React.ReactElement =>
            React.isValidElement(child) && (child.props as { position?: string }).position === 'left',
        )}
      </div>

      {/* Theme dropdown after left content */}
      {showThemeDropdown && (
        <div style={{ marginLeft: '8px' }}>
          <ThemeDropdown />
        </div>
      )}

      {/* Customize button after theme dropdown */}
      {showCustomizeButton && (
        <div style={{ marginLeft: '8px' }}>
          <ThemeCustomizationButton />
        </div>
      )}

      {/* Center content (replaces title) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitAppRegion: 'drag' as 'drag' | 'no-drag',
        }}
      >
        {React.Children.toArray(children).filter((child) =>
          React.isValidElement(child) &&
          (child.props as { position?: string }).position === 'center',
        )}
        {/* Show title only if no center content */}
        {React.Children.toArray(children).filter((child) =>
          React.isValidElement(child) &&
          (child.props as { position?: string }).position === 'center',
        ).length === 0 &&
          title && (
            <div
              className="titlebar-title"
              style={{
                color: accentColor,
                fontSize: theme.fontSizes[3],
                fontFamily: theme.fonts.heading,
                WebkitAppRegion: 'no-drag' as 'drag' | 'no-drag',
              }}
              onClick={onTitleClick}
            >
              {title}
            </div>
          )}
      </div>

      {/* Right-side content container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginLeft: 'auto',
          marginRight: showWindowControls && !isMac ? '0' : '20px',
        }}
      >
        {React.Children.toArray(children).filter((child) => {
          if (!React.isValidElement(child)) return false;
          const props = child.props as { position?: string };
          return !props.position || props.position === 'right';
        })}
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
            onClick={() => {
              if (confirmBeforeClose) {
                window.electronTitlebar?.closeWithConfirmation();
              } else {
                window.electronTitlebar?.close();
              }
            }}
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
