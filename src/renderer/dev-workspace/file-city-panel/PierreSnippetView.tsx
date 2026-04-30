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
  /** Override Pierre's container background to transparent. */
  transparent?: boolean;
}

export const PierreSnippetView: React.FC<PierreSnippetViewProps> = ({
  filePath,
  fileName,
  startLine,
  endLine,
  focusLine,
  contextLines = 2,
  transparent = false,
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
  // doesn't accept `renderRange`, so we compute it ourselves. The gutter then
  // numbers from 1; the original line range is shown in our own header above.
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
        options={transparent ? pierreOptionsTransparent : pierreOptions}
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

const transparentBgCSS = `
  :host {
    background: transparent !important;
  }
  pre, code,
  [data-gutter], [data-content],
  [data-line], [data-column-number],
  [data-gutter-buffer], [data-line-annotation], [data-no-newline],
  [data-separator], [data-separator-wrapper] {
    background: transparent !important;
  }
  [data-line] span {
    background: transparent !important;
  }
`;

const pierreOptions = {
  disableFileHeader: true,
} as const;

const pierreOptionsTransparent = {
  disableFileHeader: true,
  unsafeCSS: transparentBgCSS,
} as const;

const pierreStyle: React.CSSProperties = {
  display: 'block',
};
