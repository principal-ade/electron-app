import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink } from 'lucide-react';

import type { FileCitySequenceEventDef } from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { PierreSnippetView } from './PierreSnippetView';
import { PierreSnippetDiffView } from './PierreSnippetDiffView';

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
const FLOAT_INSET = 16;
const MIN_WIDTH_PX = 360;
const MIN_LEFT_GAP_PX = 80;
const RESIZE_HANDLE_WIDTH = 6;

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
  const lineRangeLabel =
    snippet && snippet.startLine != null && snippet.endLine != null
      ? snippet.startLine === snippet.endLine
        ? `Line ${snippet.startLine}`
        : `Lines ${snippet.startLine}–${snippet.endLine}`
      : null;

  const bottomOffsetCss =
    typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset;

  const localRef = React.useRef<HTMLDivElement | null>(null);
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const [widthPx, setWidthPx] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);
  const [hasEntered, setHasEntered] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const parent = localRef.current?.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      const next = Math.max(
        MIN_WIDTH_PX,
        Math.min(
          parentRect.width - MIN_LEFT_GAP_PX - FLOAT_INSET,
          parentRect.right - FLOAT_INSET - ev.clientX,
        ),
      );
      setWidthPx(next);
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div
      ref={setRef}
      onAnimationEnd={() => setHasEntered(true)}
      style={{
        position: 'absolute',
        top: FLOAT_INSET,
        right: FLOAT_INSET,
        // Anchor the bottom edge (mirroring the markdown overlay) so the
        // panel has a *definite* height — otherwise transient placeholder
        // states like "Loading…" collapse the panel to the content size.
        bottom: `calc(${bottomOffsetCss} + ${FLOAT_INSET}px)`,
        width:
          widthPx != null
            ? `${widthPx}px`
            : `calc(${PANEL_WIDTH_PCT}% - ${FLOAT_INSET}px)`,
        minWidth: MIN_WIDTH_PX,
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1900,
        animation: hasEntered
          ? undefined
          : 'sequenceDetailSlideIn 220ms ease-out',
        userSelect: isResizing ? 'none' : undefined,
      }}
    >
      <style>{`
        @keyframes sequenceDetailSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sequence detail overlay"
        onMouseDown={onResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: -RESIZE_HANDLE_WIDTH / 2,
          width: RESIZE_HANDLE_WIDTH,
          cursor: 'col-resize',
          zIndex: 1,
          background: isResizing
            ? `color-mix(in srgb, ${theme.colors.primary} 40%, transparent)`
            : 'transparent',
        }}
      />

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
        <div
          style={{
            minWidth: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
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

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {!absolutePath ? (
          <Placeholder text="No source path on this event." />
        ) : !snippet ? (
          <Placeholder text="No snippet attached to this event." />
        ) : snippet.kind === 'diff' ? (
          <DiffSnippetBody
            absolutePath={absolutePath}
            fileName={fileName}
            snippet={snippet}
            background={theme.colors.background}
          />
        ) : (
          <PierreSnippetView
            filePath={absolutePath}
            fileName={fileName}
            startLine={snippet.startLine}
            endLine={snippet.endLine}
            focusLine={snippet.focusLine}
            contextLines={snippet.contextLines}
            background={theme.colors.background}
          />
        )}
      </div>

    </div>
  );
});

interface DiffSnippetBodyProps {
  absolutePath: string;
  fileName: string;
  snippet: Extract<
    NonNullable<FileCitySequenceEventDef['snippet']>,
    { kind: 'diff' }
  >;
  background: string;
}

const DiffSnippetBody: React.FC<DiffSnippetBodyProps> = ({
  absolutePath,
  fileName,
  snippet,
  background,
}) => {
  const { theme } = useTheme();
  const [resolvedNew, setResolvedNew] = React.useState<string | null>(
    snippet.newContents ?? null,
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (snippet.newContents != null) {
      setResolvedNew(snippet.newContents);
      setError(null);
      return;
    }
    let cancelled = false;
    setResolvedNew(null);
    setError(null);
    FileSystemService.readFile(absolutePath)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError('File not found');
          return;
        }
        setResolvedNew(result.content);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to read file');
      });
    return () => {
      cancelled = true;
    };
  }, [absolutePath, snippet.newContents]);

  if (error) {
    return (
      <div style={{ padding: 16, color: theme.colors.error }}>{error}</div>
    );
  }
  if (resolvedNew == null) {
    return (
      <div style={{ padding: 16, color: theme.colors.textSecondary }}>
        Loading…
      </div>
    );
  }

  return (
    <PierreSnippetDiffView
      fileName={fileName}
      oldContents={snippet.oldContents}
      newContents={resolvedNew}
      startLine={snippet.startLine}
      endLine={snippet.endLine}
      focusLine={snippet.focusLine}
      contextLines={snippet.contextLines}
      diffStyle={snippet.diffStyle}
      background={background}
    />
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

const iconButtonStyle = (
  color: string,
  disabled = false,
): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  color,
  cursor: disabled ? 'default' : 'pointer',
  lineHeight: 0,
  padding: '4px 6px',
  display: 'flex',
  alignItems: 'center',
  opacity: disabled ? 0.5 : 1,
});
