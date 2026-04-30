import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink } from 'lucide-react';

import type { FileCitySequenceEventDef } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { PierreSnippetView } from './PierreSnippetView';

export interface SequenceEventDetailOverlayProps {
  event: FileCitySequenceEventDef;
  /** Absolute path to the source file (already resolved against the repo). */
  absolutePath: string | null;
  /** Bottom inset (number → px, string → CSS) so the panel sits above the sequence drawer. */
  bottomOffset: number | string;
  onClose: () => void;
  onOpenInTab?: () => void;
}

const PANEL_WIDTH_PCT = 38;

export const SequenceEventDetailOverlay = React.forwardRef<
  HTMLDivElement,
  SequenceEventDetailOverlayProps
>(function SequenceEventDetailOverlay(
  { event, absolutePath, bottomOffset, onClose, onOpenInTab },
  forwardedRef,
) {
  const { theme } = useTheme();
  const fileName = absolutePath
    ? (absolutePath.split('/').pop() ?? absolutePath)
    : '';

  const snippet = event.snippet;
  const lineRangeLabel = snippet
    ? snippet.startLine === snippet.endLine
      ? `Line ${snippet.startLine}`
      : `Lines ${snippet.startLine}–${snippet.endLine}`
    : null;

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={forwardedRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: bottomOffset,
        width: `${PANEL_WIDTH_PCT}%`,
        minWidth: 360,
        backgroundColor: `color-mix(in srgb, ${theme.colors.background} 88%, transparent)`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderLeft: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1900,
        animation: 'sequenceDetailSlideIn 220ms ease-out',
      }}
    >
      <style>{`
        @keyframes sequenceDetailSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[1],
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: theme.fonts.body,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={event.label ?? event.name}
          >
            {event.label ?? event.name}
          </span>
          <span
            style={{
              fontFamily: theme.fonts.monospace,
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={absolutePath ?? undefined}
          >
            {fileName}
            {lineRangeLabel ? ` · ${lineRangeLabel}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onOpenInTab && (
            <button
              type="button"
              onClick={onOpenInTab}
              aria-label="Open in tab"
              title="Open in tab"
              style={iconButtonStyle(theme.colors.textSecondary)}
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              ...iconButtonStyle(theme.colors.textSecondary),
              fontSize: theme.fontSizes[3],
              lineHeight: 1,
              padding: '2px 8px',
            }}
          >
            ×
          </button>
        </div>
      </div>

      <EventMetadata event={event} />

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {!absolutePath ? (
          <Placeholder text="No source path on this event." />
        ) : !snippet ? (
          <Placeholder text="No snippet attached to this event." />
        ) : (
          <PierreSnippetView
            filePath={absolutePath}
            fileName={fileName}
            startLine={snippet.startLine}
            endLine={snippet.endLine}
            focusLine={snippet.focusLine}
            contextLines={snippet.contextLines}
            transparent
          />
        )}
      </div>
    </div>
  );
});

const EventMetadata: React.FC<{ event: FileCitySequenceEventDef }> = ({
  event,
}) => {
  const { theme } = useTheme();
  const rows: Array<[string, string]> = [];
  if (event.participant) rows.push(['Participant', event.participant]);
  if (event.type) rows.push(['Type', event.type]);
  if (event.name && event.name !== event.label) rows.push(['Name', event.name]);
  if (rows.length === 0) return null;
  return (
    <div
      style={{
        padding: '8px 14px',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 14px',
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[0],
        color: theme.colors.textSecondary,
        flexShrink: 0,
      }}
    >
      {rows.map(([k, v]) => (
        <span key={k}>
          <span style={{ opacity: 0.7 }}>{k}: </span>
          <span style={{ color: theme.colors.text }}>{v}</span>
        </span>
      ))}
    </div>
  );
};

const Placeholder: React.FC<{ text: string }> = ({ text }) => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: 16,
        color: theme.colors.textSecondary,
        fontFamily: theme.fonts.body,
        fontSize: theme.fontSizes[1],
      }}
    >
      {text}
    </div>
  );
};

const iconButtonStyle = (color: string): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  color,
  cursor: 'pointer',
  lineHeight: 0,
  padding: '4px 6px',
  display: 'flex',
  alignItems: 'center',
});
