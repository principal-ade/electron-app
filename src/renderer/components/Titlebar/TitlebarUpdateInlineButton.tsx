import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Download, Sparkles } from 'lucide-react';
import { AppVersionManagerService } from '../../main-process-api/AppVersionManagerService';

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

/**
 * Inline titlebar button that mirrors the Updates settings download flow:
 * shows "Download Update" when an update is available, morphs into a
 * percent-with-progress-bar while downloading, then becomes "Install & Restart"
 * when the download completes. Hidden on non-mac and when no update is pending.
 */
export const TitlebarUpdateInlineButton: React.FC = () => {
  const { theme } = useTheme();
  const [state, setState] = useState<UpdateState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const stateRef = useRef<UpdateState>('idle');

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!isMac) {
      return;
    }

    AppVersionManagerService.checkForUpdateSilently();

    const unsubscribe = [
      AppVersionManagerService.onUpdateAvailable(() => {
        // Don't clobber a download already in flight or a completed download.
        if (stateRef.current === 'downloading' || stateRef.current === 'downloaded') {
          return;
        }
        setState('available');
        setProgress(0);
        setErrorMessage(null);
      }),
      AppVersionManagerService.onUpdateNotAvailable(() => {
        if (stateRef.current === 'downloaded' || stateRef.current === 'downloading') {
          return;
        }
        setState('idle');
      }),
      AppVersionManagerService.onUpdateDownloadProgress((info) => {
        const percent =
          typeof info.percent === 'number'
            ? info.percent
            : info.total
              ? ((info.transferred || 0) / info.total) * 100
              : 0;
        setProgress(Math.max(0, Math.min(100, percent)));
        setState('downloading');
      }),
      AppVersionManagerService.onUpdateDownloaded(() => {
        setProgress(100);
        setState('downloaded');
      }),
      AppVersionManagerService.onUpdateError((err) => {
        const message = (err && (err.message || err.toString())) || 'Update failed';
        setErrorMessage(message);
        // Only flip to error visual state if a download was in flight; otherwise
        // a silent check error shouldn't reveal the button at all.
        if (stateRef.current === 'downloading') {
          setState('error');
        }
      }),
    ];

    return () => {
      unsubscribe.forEach((fn) => fn());
    };
  }, [isMac]);

  const handleClick = useCallback(() => {
    if (state === 'available' || state === 'error') {
      setErrorMessage(null);
      setProgress(0);
      setState('downloading');
      AppVersionManagerService.downloadUpdate();
    } else if (state === 'downloaded') {
      AppVersionManagerService.installUpdate();
    }
  }, [state]);

  if (!isMac || state === 'idle') {
    return null;
  }

  const isDownloading = state === 'downloading';
  const isDownloaded = state === 'downloaded';
  const isError = state === 'error';

  const background = isDownloaded
    ? theme.colors.success
    : isError
      ? theme.colors.error
      : theme.colors.warning;
  const foreground = theme.colors.background;

  const label = isDownloading
    ? `${Math.round(progress)}%`
    : isDownloaded
      ? 'Install & Restart'
      : isError
        ? 'Retry Update'
        : 'Download Update';

  const Icon = isDownloaded ? Sparkles : Download;

  const title = isError
    ? errorMessage || 'Update failed — click to retry'
    : isDownloading
      ? `Downloading update… ${Math.round(progress)}%`
      : isDownloaded
        ? 'Install update and restart'
        : 'Download the available update';

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={isDownloading}
      title={title}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '6px',
        backgroundColor: background,
        color: foreground,
        border: 'none',
        cursor: isDownloading ? 'progress' : 'pointer',
        fontSize: theme.fontSizes[1],
        fontWeight: 500,
        fontFamily: theme.fonts.body,
        opacity: isDownloading ? 0.85 : isHovered ? 0.92 : 1,
        transition: 'opacity 0.2s, background-color 0.2s',
        overflow: 'hidden',
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      <Icon size={14} />
      {label}
      {isDownloading && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: '2px',
            width: `${progress}%`,
            backgroundColor: foreground,
            opacity: 0.85,
            transition: 'width 0.2s ease',
          }}
        />
      )}
    </button>
  );
};
