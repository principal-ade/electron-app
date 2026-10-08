import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  Check,
  ChevronDown,
  Code2,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import type { Theme } from '@principal-ade/industry-theme';
import {
  ShellService,
  type StudioLaunchMode,
} from '../../main-process-api/ShellService';

export interface StudioHeaderButtonProps {
  theme: Theme;
}

type LaunchStatus = 'idle' | 'launching' | 'opened' | 'error';

/**
 * Header button that opens Subsystems Studio. Clicking reveals a small menu so
 * the user can choose between the local source checkout (dev) and the
 * published build (installed).
 */
export const StudioHeaderButton: React.FC<StudioHeaderButtonProps> = ({
  theme,
}) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<LaunchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const openedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (openedTimerRef.current) clearTimeout(openedTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const isLaunching = status === 'launching';
  const hasError = status === 'error';
  const isOpened = status === 'opened';

  const handleLaunch = async (mode: StudioLaunchMode) => {
    if (isLaunching) return;
    setOpen(false);
    setStatus('launching');
    setError(null);
    try {
      const result = await ShellService.launchStudio({ mode });
      if (result.success) {
        console.info('[StudioHeaderButton] Launched:', result.target);
        setStatus('opened');
        if (openedTimerRef.current) clearTimeout(openedTimerRef.current);
        openedTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
      } else {
        setStatus('error');
        setError(result.error ?? 'Failed to launch Studio');
        setOpen(true);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to launch Studio');
      setOpen(true);
    }
  };

  const accent = hasError
    ? theme.colors.error
    : isOpened
      ? theme.colors.success
      : theme.colors.textSecondary;
  const border = hasError
    ? theme.colors.error
    : isOpened
      ? theme.colors.success
      : theme.colors.border;

  const buttonLabel = isLaunching
    ? 'Starting…'
    : isOpened
      ? 'Opened'
      : 'Studio';

  const options: {
    mode: StudioLaunchMode;
    label: string;
    description: string;
    Icon: React.ComponentType<{ size?: number }>;
  }[] = [
    {
      mode: 'dev',
      label: 'Run dev (source)',
      description: 'bun start in the local checkout',
      Icon: Code2,
    },
    {
      mode: 'installed',
      label: 'Run installed',
      description: 'Published @principal-ai/subsystems-studio',
      Icon: PackageCheck,
    },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        // @ts-ignore - WebkitAppRegion is not in CSSProperties
        WebkitAppRegion: 'no-drag',
      }}
    >
      <button
        onClick={() => {
          if (isLaunching) return;
          setOpen((prev) => !prev);
        }}
        disabled={isLaunching}
        title={
          hasError && error ? `Studio: ${error}` : 'Open Subsystems Studio'
        }
        style={{
          // @ts-ignore - WebkitAppRegion is not in CSSProperties
          WebkitAppRegion: 'no-drag',
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${border}`,
          color: accent,
          cursor: isLaunching ? 'wait' : 'pointer',
          padding: '6px 12px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.2s',
          fontSize: theme.fontSizes[1],
          fontWeight: 500,
          fontFamily: theme.fonts.body,
          opacity: isLaunching ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (isLaunching) return;
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundTertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundSecondary;
        }}
      >
        {isLaunching ? (
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
        ) : isOpened ? (
          <Check size={14} />
        ) : (
          <Boxes size={14} />
        )}
        <span>{buttonLabel}</span>
        <ChevronDown size={12} />
      </button>

      {open && !isLaunching && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            zIndex: 1000,
            minWidth: '240px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: theme.fonts.body,
            overflow: 'hidden',
          }}
        >
          {hasError && error && (
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${theme.colors.border}`,
                color: theme.colors.error,
                fontSize: theme.fontSizes[0],
              }}
            >
              {error}
            </div>
          )}
          {options.map(({ mode, label, description, Icon }, idx) => (
            <button
              key={mode}
              onClick={() => void handleLaunch(mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderBottom:
                  idx === options.length - 1
                    ? 'none'
                    : `1px solid ${theme.colors.border}`,
                background: 'transparent',
                color: theme.colors.text,
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: theme.fontSizes[1],
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={16} />
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: theme.fontWeights.medium }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: theme.fontSizes[0],
                    color: theme.colors.textTertiary,
                    marginTop: '2px',
                  }}
                >
                  {description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
