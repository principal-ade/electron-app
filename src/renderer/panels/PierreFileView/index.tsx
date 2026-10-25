import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { File } from '@pierre/diffs/react';

import { FileSystemService } from '../../main-process-api/FileSystemService';
import type { DocumentRange } from '../../../shared/documentRange';

export interface PierreFileViewProps {
  filePath: string;
  fileName: string;
  /** Override Pierre's container background. Any CSS color string. */
  background?: string;
  range?: DocumentRange;
  rangeRevision?: number;
}

export const PierreFileView: React.FC<PierreFileViewProps> = ({
  filePath,
  fileName,
  background,
  range,
  rangeRevision,
}) => {
  const { theme } = useTheme();
  const [contents, setContents] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fileObject = React.useMemo(
    () => (contents !== null ? { name: fileName, contents } : null),
    [fileName, contents],
  );
  const navigation = React.useMemo(() => {
    if (!fileObject || !range) return {};
    const { startLineNumber, endLineNumber, endColumn } = range;
    const lineCount = Math.max(1, fileObject.contents.split('\n').length);
    const start = Math.min(startLineNumber, lineCount);
    const end = Math.max(
      start,
      Math.min(
        endLineNumber -
          (endColumn === 1 && endLineNumber > startLineNumber ? 1 : 0),
        lineCount,
      ),
    );
    let revealedNode: HTMLElement | undefined;
    return {
      selectedLines: { start, end },
      onPostRender: (node: HTMLElement) => {
        if (revealedNode === node) return;
        const root = node.shadowRoot ?? node;
        const line = root.querySelector<HTMLElement>(`[data-line="${start}"]`);
        if (!line) return;
        revealedNode = node;
        line.scrollIntoView({ block: 'center', inline: 'nearest' });
      },
    };
  }, [fileObject, range]);

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

  if (error) {
    return (
      <div style={{ padding: 16, color: theme.colors.error }}>{error}</div>
    );
  }
  if (fileObject === null) {
    return (
      <div style={{ padding: 16, color: theme.colors.textSecondary }}>
        Loading…
      </div>
    );
  }
  return (
    <File
      key={rangeRevision}
      file={fileObject}
      selectedLines={navigation.selectedLines}
      options={{
        ...(background ? buildPierreOptions(background) : pierreOptions),
        onPostRender: navigation.onPostRender,
      }}
      style={pierreStyle}
    />
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
  disableFileHeader: false,
} as const;

const buildPierreOptions = (background: string) => ({
  disableFileHeader: false,
  unsafeCSS: buildBackgroundCSS(background),
});

const pierreStyle: React.CSSProperties = {
  display: 'block',
};
