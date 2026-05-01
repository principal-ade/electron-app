import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileDiff } from '@pierre/diffs/react';
import { parseDiffFromFile } from '@pierre/diffs';

export type PierreSnippetDiffStyle = 'unified' | 'split';

export interface PierreSnippetDiffViewProps {
  /** File name used for display + syntax-highlighting language inference. */
  fileName: string;
  /** Pre-change file contents. Pass the full file or a pre-sliced window. */
  oldContents: string;
  /** Post-change file contents. Should align line-wise with `oldContents`. */
  newContents: string;
  /**
   * Optional snippet window applied to both contents before diffing
   * (1-based, inclusive). Use this when `oldContents`/`newContents` are full
   * files and you want the diff scoped to a region. When omitted, the entire
   * diff is rendered.
   */
  startLine?: number;
  endLine?: number;
  /** Line in the post-change window to call out (1-based, relative to the new file). */
  focusLine?: number;
  /** Lines of unchanged context to keep above/below the snippet window. Default 2. */
  contextLines?: number;
  /** Override Pierre's container background. Any CSS color string. */
  background?: string;
  /** Side-by-side or unified rendering. Defaults to `'unified'`. */
  diffStyle?: PierreSnippetDiffStyle;
}

interface Slice {
  oldText: string;
  newText: string;
  windowStart: number; // 1-based line in the new file where this window begins
  focusOffset: number | null; // 1-based offset within the rendered window
}

const sliceWindow = (
  oldContents: string,
  newContents: string,
  startLine: number | undefined,
  endLine: number | undefined,
  focusLine: number | undefined,
  contextLines: number,
): Slice => {
  if (startLine == null || endLine == null) {
    return {
      oldText: oldContents,
      newText: newContents,
      windowStart: 1,
      focusOffset: focusLine ?? null,
    };
  }
  const oldLines = oldContents.split('\n');
  const newLines = newContents.split('\n');
  const totalNew = newLines.length;
  const totalOld = oldLines.length;
  const safeStart = Math.max(1, Math.min(startLine, totalNew));
  const safeEnd = Math.max(safeStart, Math.min(endLine, totalNew));
  const sliceStart = Math.max(1, safeStart - contextLines);
  const sliceEnd = Math.min(Math.max(totalOld, totalNew), safeEnd + contextLines);
  const sliceOldEnd = Math.min(totalOld, sliceEnd);
  const sliceNewEnd = Math.min(totalNew, sliceEnd);
  return {
    oldText: oldLines.slice(sliceStart - 1, sliceOldEnd).join('\n'),
    newText: newLines.slice(sliceStart - 1, sliceNewEnd).join('\n'),
    windowStart: sliceStart,
    focusOffset:
      focusLine == null
        ? null
        : Math.max(1, focusLine - sliceStart + 1),
  };
};

export const PierreSnippetDiffView: React.FC<PierreSnippetDiffViewProps> = ({
  fileName,
  oldContents,
  newContents,
  startLine,
  endLine,
  focusLine,
  contextLines = 2,
  background,
  diffStyle = 'unified',
}) => {
  const { theme } = useTheme();

  const slice = React.useMemo(
    () =>
      sliceWindow(
        oldContents,
        newContents,
        startLine,
        endLine,
        focusLine,
        contextLines,
      ),
    [oldContents, newContents, startLine, endLine, focusLine, contextLines],
  );

  const fileDiff = React.useMemo(() => {
    try {
      return parseDiffFromFile(
        { name: fileName, contents: slice.oldText },
        { name: fileName, contents: slice.newText },
      );
    } catch {
      return null;
    }
  }, [fileName, slice]);

  if (!fileDiff) {
    return (
      <div style={{ padding: 16, color: theme.colors.error }}>
        Failed to compute diff
      </div>
    );
  }

  const rangeLabel =
    startLine != null && endLine != null
      ? startLine === endLine
        ? `Line ${startLine}`
        : `Lines ${startLine}–${endLine}`
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {rangeLabel && (
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
      )}
      <FileDiff
        fileDiff={fileDiff}
        options={{ ...pierreOptionsBase, diffStyle }}
        selectedLines={
          slice.focusOffset != null
            ? { start: slice.focusOffset, end: slice.focusOffset }
            : undefined
        }
        style={
          background
            ? {
                ...pierreStyle,
                // Pierre derives addition/deletion/context/separator surfaces
                // by `color-mix`ing from --diffs-bg, which is keyed off
                // --diffs-light-bg / --diffs-dark-bg. Overriding the source
                // variables recolors the whole palette coherently — addition
                // keeps its green tint, deletion keeps its red tint, just
                // anchored to our theme background.
                ['--diffs-light-bg' as string]: background,
                ['--diffs-dark-bg' as string]: background,
              }
            : pierreStyle
        }
      />
    </div>
  );
};

const pierreOptionsBase = {
  disableFileHeader: true,
} as const;

const pierreStyle: React.CSSProperties = {
  display: 'block',
};
