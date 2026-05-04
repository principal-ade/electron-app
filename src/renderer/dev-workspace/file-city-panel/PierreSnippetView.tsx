import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { File } from '@pierre/diffs/react';
import type { LineAnnotation, SelectedLineRange } from '@pierre/diffs';

import { FileSystemService } from '../../main-process-api/FileSystemService';
import {
  SnippetNoteIndicator,
  type SnippetNote,
  type SnippetUiRange,
} from './SnippetNotes';

interface SliceAnnotationMetadata {
  /** Absolute line in the source file (always equals range.startLine). */
  absoluteLine: number;
  /** Notes in the thread anchored to this range. */
  notes: SnippetNote[];
  /** The specific range this pill marks (one pill per range). */
  range: SnippetUiRange;
  /** threadKey of the underlying thread — used by the click handler. */
  threadKey: string;
  active: boolean;
  disabled: boolean;
}

export interface PierreSnippetViewProps {
  filePath: string;
  fileName: string;
  /** First line of the snippet (1-based, inclusive). */
  startLine: number;
  /** Last line of the snippet (1-based, inclusive). */
  endLine: number;
  /** Line to call out as the focus point; defaults to `startLine`. */
  focusLine?: number;
  /** Lines of context above/below the snippet; defaults to 2. */
  contextLines?: number;
  /** Override Pierre's container background. Any CSS color string. */
  background?: string;
  /** Notes anchored to absolute file ranges. */
  notes?: SnippetNote[];
  /** Thread whose notes panel is currently open (renders matching indicators as active). */
  activeThreadKey?: string | null;
  /** While true, indicators are dimmed and don't respond to clicks. */
  composerOpen?: boolean;
  /** Open the side panel in thread-view mode for the given threadKey. */
  onOpenThread?: (threadKey: string) => void;
  /** Close the side panel — wired to indicator clicks on the active thread. */
  onCloseThread?: () => void;
  /**
   * Open or extend the side panel composer with a range. Called when the
   * user uses Pierre's gutter "+" (with or without a multi-line drag-select).
   * The line text endpoints are captured so the consumer can persist them as
   * re-anchor fingerprints on the note's anchor.
   */
  onOpenComposer?: (input: {
    startLine: number;
    endLine: number;
    startLineText: string;
    endLineText: string;
  }) => void;
}

export const PierreSnippetView: React.FC<PierreSnippetViewProps> = ({
  filePath,
  fileName,
  startLine,
  endLine,
  focusLine,
  contextLines = 2,
  background,
  notes,
  activeThreadKey,
  composerOpen,
  onOpenThread,
  onCloseThread,
  onOpenComposer,
}) => {
  const { theme } = useTheme();
  const [contents, setContents] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setContents(null);
    setError(null);
    FileSystemService.readFile(filePath)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setError('File not found');
          return;
        }
        setContents(result.content);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to read file');
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Slice the file contents to the requested window. Pierre's React `<File>`
  // doesn't accept `renderRange`, so we compute it ourselves and offset the
  // gutter line numbers back to the file's true range via `onPostRender`.
  const slice = React.useMemo(() => {
    if (contents == null) return null;
    const allLines = contents.split('\n');
    const total = allLines.length;
    const safeStart = Math.max(1, Math.min(startLine, total));
    const safeEnd = Math.max(safeStart, Math.min(endLine, total));
    const sliceStart = Math.max(1, safeStart - contextLines);
    const sliceEnd = Math.min(total, safeEnd + contextLines);
    return {
      contents: allLines.slice(sliceStart - 1, sliceEnd).join('\n'),
      sliceStart,
      sliceEnd,
      focusOffset:
        focusLine == null
          ? null
          : Math.max(1, focusLine - sliceStart + 1),
    };
  }, [contents, startLine, endLine, contextLines, focusLine]);

  const fileObject = React.useMemo(
    () => (slice ? { name: fileName, contents: slice.contents } : null),
    [fileName, slice],
  );

  // Rewrite the *visible* gutter numbers so they show the original file range
  // (e.g. 320..334) instead of Pierre's default 1..N over the slice. Each
  // gutter row carries a `data-line-index` (0-based, slice-local), so the
  // desired number is `lineIndex + 1 + offset`.
  //
  // Critically we do NOT rewrite `data-column-number`. Pierre's
  // InteractionManager reads that attribute to build `SelectedLineRange` for
  // the gutter-utility callback (and probably other features) — overwriting
  // it would feed absolute file lines back into Pierre's slice-local model
  // and break the math in `onGutterUtilityClick`.
  const lineNumberOffset = slice ? slice.sliceStart - 1 : 0;
  const onPostRender = React.useCallback(
    (fileContainer: HTMLElement) => {
      if (lineNumberOffset === 0) return;
      const root: ParentNode = fileContainer.shadowRoot ?? fileContainer;
      const items = root.querySelectorAll<HTMLElement>(
        '[data-column-number][data-line-index]',
      );
      items.forEach((el) => {
        const idxStr = el.dataset.lineIndex;
        if (idxStr == null) return;
        const idx = Number.parseInt(idxStr, 10);
        if (Number.isNaN(idx)) return;
        const display = String(idx + 1 + lineNumberOffset);
        const span = el.querySelector<HTMLElement>(
          '[data-line-number-content]',
        );
        if (span && span.textContent !== display) {
          span.textContent = display;
        }
      });
    },
    [lineNumberOffset],
  );

  // Group notes into threads (matching ranges arrays). Each thread renders
  // one pill per range start. Pierre supports multiple annotations per line
  // (AnnotationLineMap), so two threads sharing a startLine stack naturally.
  const lineAnnotations = React.useMemo<
    LineAnnotation<SliceAnnotationMetadata>[]
  >(() => {
    if (!slice) return [];
    const threadsByKey = new Map<string, SnippetNote[]>();
    for (const n of notes ?? []) {
      const arr = threadsByKey.get(n.threadKey) ?? [];
      arr.push(n);
      threadsByKey.set(n.threadKey, arr);
    }
    const result: LineAnnotation<SliceAnnotationMetadata>[] = [];
    for (const [threadKey, threadNotes] of threadsByKey) {
      const head = threadNotes[0];
      const active = activeThreadKey === threadKey;
      const seen = new Set<string>();
      for (const range of head.ranges) {
        const key = `${range.startLine}-${range.endLine}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const sliceLocal = range.startLine - slice.sliceStart + 1;
        if (sliceLocal < 1) continue;
        result.push({
          lineNumber: sliceLocal,
          metadata: {
            absoluteLine: range.startLine,
            notes: threadNotes,
            range,
            threadKey,
            active,
            disabled: !!composerOpen,
          },
        });
      }
    }
    return result;
  }, [slice, notes, activeThreadKey, composerOpen]);

  const renderAnnotation = React.useCallback(
    (annotation: LineAnnotation<SliceAnnotationMetadata>) => {
      if (!annotation.metadata) return null;
      const {
        notes: threadNotes,
        range,
        threadKey,
        active,
        disabled,
      } = annotation.metadata;
      return (
        <SnippetNoteIndicator
          notes={threadNotes}
          range={range}
          active={active}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (active) onCloseThread?.();
            else onOpenThread?.(threadKey);
          }}
        />
      );
    },
    [onOpenThread, onCloseThread],
  );

  const onGutterUtilityClick = React.useCallback(
    (range: SelectedLineRange) => {
      if (!slice || !onOpenComposer) return;
      const startLine = range.start + slice.sliceStart - 1;
      const endLine = range.end + slice.sliceStart - 1;
      const sliceLines = slice.contents.split('\n');
      const startLineText = sliceLines[startLine - slice.sliceStart] ?? '';
      const endLineText = sliceLines[endLine - slice.sliceStart] ?? '';
      onOpenComposer({ startLine, endLine, startLineText, endLineText });
    },
    [slice, onOpenComposer],
  );

  const options = React.useMemo(() => {
    const base = background ? buildPierreOptions(background) : pierreOptions;
    return {
      ...base,
      onPostRender,
      enableGutterUtility: !!onOpenComposer,
      enableLineSelection: !!onOpenComposer,
      onGutterUtilityClick,
    };
  }, [background, onPostRender, onOpenComposer, onGutterUtilityClick]);

  if (error) {
    return (
      <div style={{ padding: 16, color: theme.colors.error }}>{error}</div>
    );
  }
  if (!fileObject || !slice) {
    return (
      <div style={{ padding: 16, color: theme.colors.textSecondary }}>
        Loading…
      </div>
    );
  }

  const rangeLabel =
    slice.sliceStart === slice.sliceEnd
      ? `Line ${slice.sliceStart}`
      : `Lines ${slice.sliceStart}–${slice.sliceEnd}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          padding: '4px 14px 6px',
          fontFamily: theme.fonts.monospace,
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {rangeLabel}
      </div>
      <File
        file={fileObject}
        options={options}
        lineAnnotations={lineAnnotations}
        renderAnnotation={renderAnnotation}
        selectedLines={
          slice.focusOffset != null
            ? { start: slice.focusOffset, end: slice.focusOffset }
            : undefined
        }
        style={pierreStyle}
      />
    </div>
  );
};

const buildBackgroundCSS = (color: string) => `
  :host {
    background: ${color} !important;
  }
  pre, code,
  [data-gutter], [data-content],
  [data-line], [data-column-number],
  [data-gutter-buffer], [data-line-annotation], [data-no-newline],
  [data-separator], [data-separator-wrapper] {
    background: ${color} !important;
  }
  [data-line] span {
    background: ${color} !important;
  }
`;

const pierreOptions = {
  disableFileHeader: true,
} as const;

const buildPierreOptions = (background: string) => ({
  disableFileHeader: true,
  unsafeCSS: buildBackgroundCSS(background),
});

const pierreStyle: React.CSSProperties = {
  display: 'block',
};
