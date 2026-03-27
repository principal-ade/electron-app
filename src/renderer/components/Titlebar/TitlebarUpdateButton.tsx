import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { AppVersionManagerService } from '../../main-process-api/AppVersionManagerService';
import { WindowService } from '../../main-process-api/WindowService';

export interface TitlebarUpdateButtonProps {
  /** Callback when the update button is clicked */
  onClick?: () => void;
  /** Hide the button (e.g., when on settings page) */
  hidden?: boolean;
}

/**
 * A button that appears below the macOS traffic lights when an update is available.
 * Width matches the traffic lights area (~70px).
 */
export const TitlebarUpdateButton: React.FC<TitlebarUpdateButtonProps> = ({
  onClick,
  hidden = false,
}) => {
  const { theme } = useTheme();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    // Check for updates silently on mount
    AppVersionManagerService.checkForUpdateSilently();

    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
      setIsDownloaded(false);
    };

    const handleUpdateNotAvailable = () => {
      // Only clear if not downloaded
      if (!isDownloaded) {
        setUpdateAvailable(false);
      }
    };

    const handleUpdateDownloaded = () => {
      setIsDownloaded(true);
      setUpdateAvailable(true);
    };

    const unsubscribe = [
      AppVersionManagerService.onUpdateAvailable(handleUpdateAvailable),
      AppVersionManagerService.onUpdateNotAvailable(handleUpdateNotAvailable),
      AppVersionManagerService.onUpdateDownloaded(handleUpdateDownloaded),
    ];

    return () => {
      unsubscribe.forEach((fn) => fn());
    };
  }, [isDownloaded]);

  const handleClick = useCallback(async () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: focus/open the main window and navigate to updates settings
      await WindowService.navigateToUpdates();
    }
  }, [onClick]);

  // Only show on macOS when update is available and not hidden
  if (!isMac || !updateAvailable || hidden) {
    return null;
  }

  const buttonText = isDownloaded ? 'Install' : 'Update';
  const backgroundColor = theme.colors.primary;
  const hoverBackgroundColor = theme.colors.primary;

  return (
    <div
      style={{
        position: 'fixed',
        top: '25px', // Position below traffic lights
        left: '12px',
        zIndex: 10000,
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'no-drag',
      }}
    >
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '54px', // Match width of traffic lights area (3 buttons * 12px + gaps)
          height: '22px',
          padding: '0',
          backgroundColor: isHovered ? hoverBackgroundColor : backgroundColor,
          color: theme.colors.background,
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: theme.fonts.body,
          transition: 'all 0.15s ease',
          opacity: isHovered ? 1 : 0.9,
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isHovered
            ? `0 2px 8px ${backgroundColor}40`
            : `0 1px 3px ${backgroundColor}30`,
        }}
        title={isDownloaded ? 'Install update and restart' : 'Update available - click to view'}
      >
        {buttonText}
      </button>
    </div>
  );
};
