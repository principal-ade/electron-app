import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { File } from '@pierre/diffs/react';

import { FileSystemService } from '../../main-process-api/FileSystemService';

export interface PierreFileViewProps {
  filePath: string;
  fileName: string;
  /** Override Pierre's container background. Any CSS color string. */
  background?: string;
}

export const PierreFileView: React.FC<PierreFileViewProps> = ({
  filePath,
  fileName,
  background,
}) => {
  const { theme } = useTheme();
  const [contents, setContents] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Per @pierre/diffs docs: keep the file object stable — the component uses
  // reference equality to detect changes.
  const fileObject = React.useMemo(
    () => (contents !== null ? { name: fileName, contents } : null),
    [fileName, contents],
  );

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
      file={fileObject}
      options={background ? buildPierreOptions(background) : pierreOptions}
      style={pierreStyle}
    />
  );
};

// `:host` rule plus background override on every element the library normally
// paints with --diffs-bg. We can't just override --diffs-bg because the theme's
// own :host rule (in @layer rendered) re-derives backgrounds from --diffs-dark-bg
// via color-mix; @layer unsafe wins outright.
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
