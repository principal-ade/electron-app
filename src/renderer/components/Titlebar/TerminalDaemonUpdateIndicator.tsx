import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Loader2, TerminalSquare, TriangleAlert } from 'lucide-react';
import { TerminalService } from '../../main-process-api/TerminalService';
import type { TerminalDaemonUpdateEvent } from '../../../shared/main-process-api-interfaces/TerminalService';

const UPDATED_VISIBLE_MS = 3000;
const FAILED_VISIBLE_MS = 8000;

/**
 * Transient titlebar pill shown while the app replaces an outdated PTY daemon
 * (after an app update, once the last terminal closes). Hidden otherwise.
 */
export const TerminalDaemonUpdateIndicator: React.FC = () => {
  const { theme } = useTheme();
  const [event, setEvent] = useState<TerminalDaemonUpdateEvent | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearHide = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    const unsubscribe = TerminalService.onDaemonUpdate((next) => {
      clearHide();
      setEvent(next);
      if (next.phase !== 'updating') {
        hideTimer.current = setTimeout(
          () => setEvent(null),
          next.phase === 'failed' ? FAILED_VISIBLE_MS : UPDATED_VISIBLE_MS,
        );
      }
    });
    return () => {
      clearHide();
      unsubscribe();
    };
  }, []);

  if (!event) return null;

  const isUpdating = event.phase === 'updating';
  const isFailed = event.phase === 'failed';
  const background = isFailed
    ? theme.colors.error
    : isUpdating
      ? theme.colors.backgroundSecondary
      : theme.colors.success;
  const foreground = isUpdating ? theme.colors.text : theme.colors.background;
  const label = isUpdating
    ? 'Updating terminal daemon…'
    : isFailed
      ? 'Terminal daemon update failed'
      : 'Terminal daemon updated';
  const title = isFailed
    ? event.error ?? label
    : `${label} (v${event.from?.version ?? 'unknown'} → v${event.to.version})`;
  const StatusIcon = isUpdating ? Loader2 : isFailed ? TriangleAlert : Check;

  return (
    <div
      role="status"
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '6px',
        backgroundColor: background,
        color: foreground,
        border: `1px solid ${isUpdating ? theme.colors.border : background}`,
        fontSize: theme.fontSizes[1],
        fontWeight: 500,
        fontFamily: theme.fonts.body,
        whiteSpace: 'nowrap',
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
      }}
    >
      <TerminalSquare size={14} />
      <span>{label}</span>
      <StatusIcon
        size={14}
        style={isUpdating ? { animation: 'spin 1s linear infinite' } : undefined}
      />
    </div>
  );
};
