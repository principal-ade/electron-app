import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { File } from '@pierre/diffs/react';

import { FileSystemService } from '../../main-process-api/FileSystemService';

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
}

export const PierreSnippetView: React.FC<PierreSnippetViewProps> = ({
  filePath,
  fileName,
  startLine,
  endLine,
  focusLine,
  contextLines = 2,
  background,
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

  // Rewrite gutter line numbers so they reflect the original file range
  // (e.g. 28..50) instead of Pierre's default 1..N over the slice. Each gutter
  // row carries a `data-line-index` (0-based, slice-local), so we can compute
  // the desired number idempotently as `lineIndex + 1 + offset`.
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
        if (el.dataset.columnNumber !== display) {
          el.dataset.columnNumber = display;
        }
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

  const options = React.useMemo(() => {
    const base = background ? buildPierreOptions(background) : pierreOptions;
    return { ...base, onPostRender };
  }, [background, onPostRender]);

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
