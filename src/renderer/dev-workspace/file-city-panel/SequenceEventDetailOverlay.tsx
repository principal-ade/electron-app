import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ExternalLink } from 'lucide-react';

import type {
  FileCitySequenceEventDef,
  SequenceNote,
} from '../../../shared/main-process-api-interfaces/FileCitySequenceAPI';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { SequenceNotesService } from '../../services/SequenceNotesService';
import { PierreSnippetView } from './PierreSnippetView';
import { PierreSnippetDiffView } from './PierreSnippetDiffView';
import {
  SnippetNotePanel,
  computeThreadKey,
  type ComposerRange,
  type SnippetNote,
  type SnippetUiRange,
  type NotesSelection,
} from './SnippetNotes';

const toUiNote = (n: SequenceNote): SnippetNote | null => {
  if (n.kind !== 'snippet') return null;
  if (n.anchor.kind !== 'slice') return null; // diff anchor support comes later
  const ranges: SnippetUiRange[] = n.anchor.ranges.map((r) => ({
    startLine: r.startLine,
    endLine: r.endLine,
  }));
  return {
    id: n.id,
    threadKey: computeThreadKey(ranges),
    ranges,
    body: n.body,
    author: n.author,
    createdAt: new Date(n.createdAt).getTime(),
  };
};

export interface SequenceEventDetailOverlayProps {
  event: FileCitySequenceEventDef;
  /** Absolute path to the source file (already resolved against the repo). */
  absolutePath: string | null;
  /** Bottom inset (number → px, string → CSS) so the panel sits above the sequence drawer. */
  bottomOffset: number | string;
  /** Stable id of the active payload — required to mutate notes. */
  payloadId: string | undefined;
  /** Notes attached to the active payload (overlay filters by event.id). */
  payloadNotes: SequenceNote[] | undefined;
  onClose: () => void;
  onOpenInTab?: () => void;
}

const PANEL_WIDTH_PCT = 38;
const FLOAT_INSET = 16;
// Clears the FileCityExplorer focus bar (canvas mounts at top: 56) plus a
// small gap so the overlay reads as "below the top chrome".
const TOP_INSET = 72;
const MIN_WIDTH_PX = 360;
const MIN_LEFT_GAP_PX = 80;
const RESIZE_HANDLE_WIDTH = 6;

export const SequenceEventDetailOverlay = React.forwardRef<
  HTMLDivElement,
  SequenceEventDetailOverlayProps
>(function SequenceEventDetailOverlay(
  {
    event,
    absolutePath,
    bottomOffset,
    payloadId,
    payloadNotes,
    onClose,
    onOpenInTab,
  },
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

  // Notes filtered to this event + projected to the UI shape consumed by
  // SnippetNoteIndicator / SnippetNotePanel. Diff-anchor notes are dropped
  // for now — slice-only is what PierreSnippetView wires up.
  const notes = React.useMemo<SnippetNote[]>(() => {
    if (!payloadNotes) return [];
    return payloadNotes
      .filter(
        (n): n is SequenceNote & { kind: 'snippet' } =>
          n.kind === 'snippet' && n.scope.eventId === event.id,
      )
      .map(toUiNote)
      .filter((n): n is SnippetNote => n != null);
  }, [payloadNotes, event.id]);

  const [notesSelection, setNotesSelection] =
    React.useState<NotesSelection | null>(null);
  React.useEffect(() => {
    setNotesSelection(null);
  }, [event.id]);

  const composerOpen = notesSelection?.kind === 'composer';

  /**
   * Append a range to the in-progress composer (or open one if none active).
   * Same range (matching start+end) is a no-op so dragging twice over the
   * same span doesn't add duplicate chips. Removing a range is its inverse.
   */
  const appendComposerRange = React.useCallback((range: ComposerRange) => {
    setNotesSelection((prev) => {
      if (prev?.kind !== 'composer') {
        return { kind: 'composer', ranges: [range] };
      }
      const exists = prev.ranges.some(
        (r) => r.startLine === range.startLine && r.endLine === range.endLine,
      );
      if (exists) return prev;
      return { kind: 'composer', ranges: [...prev.ranges, range] };
    });
  }, []);

  const removeComposerRange = React.useCallback((range: SnippetUiRange) => {
    setNotesSelection((prev) => {
      if (prev?.kind !== 'composer') return prev;
      const next = prev.ranges.filter(
        (r) =>
          !(r.startLine === range.startLine && r.endLine === range.endLine),
      );
      if (next.length === 0) return null;
      return { kind: 'composer', ranges: next };
    });
  }, []);

  /** Pick fingerprint endpoints from an existing thread's anchor for replies. */
  const lineTextsFromThread = React.useCallback(
    (
      threadKey: string,
    ): { startLineText: string; endLineText: string }[] | null => {
      const head = (payloadNotes ?? []).find(
        (n) =>
          n.kind === 'snippet' &&
          n.scope.eventId === event.id &&
          n.anchor.kind === 'slice' &&
          computeThreadKey(
            n.anchor.ranges.map((r) => ({
              startLine: r.startLine,
              endLine: r.endLine,
            })),
          ) === threadKey,
      );
      if (!head || head.anchor.kind !== 'slice') return null;
      return head.anchor.ranges.map((r) => ({
        startLineText: r.startLineText,
        endLineText: r.endLineText,
      }));
    },
    [payloadNotes, event.id],
  );

  const createSnippetNote = React.useCallback(
    async (ranges: ComposerRange[], body: string) => {
      if (!payloadId || ranges.length === 0) return;
      await SequenceNotesService.create(payloadId, {
        kind: 'snippet',
        scope: { eventId: event.id },
        anchor: {
          kind: 'slice',
          ranges: ranges.map((r) => ({
            startLine: r.startLine,
            endLine: r.endLine,
            startLineText: r.startLineText,
            endLineText: r.endLineText,
          })),
        },
        body,
        author: 'You',
      });
    },
    [payloadId, event.id],
  );

  const handleSubmitNote = React.useCallback(
    async (ranges: ComposerRange[], body: string) => {
      await createSnippetNote(ranges, body);
      const uiRanges: SnippetUiRange[] = ranges.map((r) => ({
        startLine: r.startLine,
        endLine: r.endLine,
      }));
      setNotesSelection({
        kind: 'thread',
        threadKey: computeThreadKey(uiRanges),
      });
    },
    [createSnippetNote],
  );

  const handleReplyNote = React.useCallback(
    async (threadKey: string, body: string) => {
      // Replies share the head note's anchor — copy its ranges + fingerprints.
      const fingerprints = lineTextsFromThread(threadKey);
      const head = (payloadNotes ?? []).find(
        (n) =>
          n.kind === 'snippet' &&
          n.scope.eventId === event.id &&
          n.anchor.kind === 'slice' &&
          computeThreadKey(
            n.anchor.ranges.map((r) => ({
              startLine: r.startLine,
              endLine: r.endLine,
            })),
          ) === threadKey,
      );
      if (!head || head.anchor.kind !== 'slice' || !fingerprints) return;
      const ranges: ComposerRange[] = head.anchor.ranges.map((r, i) => ({
        startLine: r.startLine,
        endLine: r.endLine,
        startLineText: fingerprints[i]?.startLineText ?? r.startLineText,
        endLineText: fingerprints[i]?.endLineText ?? r.endLineText,
      }));
      await createSnippetNote(ranges, body);
    },
    [lineTextsFromThread, payloadNotes, event.id, createSnippetNote],
  );

  const handleDeleteNote = React.useCallback(
    async (id: string) => {
      if (!payloadId) return;
      await SequenceNotesService.remove(payloadId, id);
    },
    [payloadId],
  );

  // Detail-overlay width fed to the notes side panel so it docks just to the
  // left of the snippet drawer and follows when the user drags the resizer.
  const detailWidthCss =
    widthPx != null
      ? `${widthPx}px`
      : `calc(${PANEL_WIDTH_PCT}% - ${FLOAT_INSET}px)`;
  const NOTES_PANEL_WIDTH = 320;
  const NOTES_PANEL_GAP = 12;
  const notesPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: TOP_INSET,
    bottom: `calc(${bottomOffsetCss} + ${FLOAT_INSET}px)`,
    width: NOTES_PANEL_WIDTH,
    right: `calc(${detailWidthCss} + ${FLOAT_INSET}px + ${NOTES_PANEL_GAP}px)`,
    // Above the markdown overlay (z 1900) so an open thread wins when the
    // snippet drawer is dragged wide enough that the notes panel reaches the
    // left side of the workspace. The leader-line dot (z 1901) anchors at the
    // snippet drawer's right edge and doesn't share screen space with the
    // notes panel, so their z order doesn't matter visually.
    zIndex: 1950,
  };

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
    <>
    <div
      ref={setRef}
      onAnimationEnd={() => setHasEntered(true)}
      style={{
        position: 'absolute',
        top: TOP_INSET,
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
            notes={notes}
            activeThreadKey={
              notesSelection?.kind === 'thread'
                ? notesSelection.threadKey
                : null
            }
            composerOpen={composerOpen}
            onOpenThread={(threadKey) =>
              setNotesSelection({ kind: 'thread', threadKey })
            }
            onCloseThread={() => setNotesSelection(null)}
            onOpenComposer={(input) => appendComposerRange(input)}
          />
        )}
      </div>

    </div>
    {notesSelection && (
      <SnippetNotePanel
        selection={notesSelection}
        notes={notes}
        style={notesPanelStyle}
        onClose={() => setNotesSelection(null)}
        onSubmitNote={handleSubmitNote}
        onReplyNote={handleReplyNote}
        onDeleteNote={handleDeleteNote}
        onRemoveComposerRange={removeComposerRange}
      />
    )}
    </>
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
