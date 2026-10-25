import React from 'react';
import type { DocumentRange } from '../../shared/documentRange';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { PierreFileView } from './PierreFileView';
import { MonacoFileTabContent } from './MonacoFileTabContent';
import { getFileDraft } from './fileDrafts';

interface SourceFileTabContentProps {
  filePath: string;
  fileName: string;
  range?: DocumentRange;
  rangeRevision?: number;
  /** Explicit read-only sources must never become editable just because a local path exists. */
  readOnly?: boolean;
}

export const SourceFileTabContent: React.FC<SourceFileTabContentProps> = ({
  filePath,
  fileName,
  range,
  rangeRevision,
  readOnly = false,
}) => {
  const [access, setAccess] = React.useState<{
    path: string;
    writable: boolean;
  } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    FileSystemService.getFileStats(filePath)
      .then((stats) => {
        if (!cancelled)
          setAccess({ path: filePath, writable: stats?.writable === true });
      })
      .catch(() => {
        if (!cancelled) setAccess({ path: filePath, writable: false });
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const save = React.useCallback(
    async (content: string) => {
      const draft = getFileDraft(filePath);
      if (!draft) return;
      const stats = await FileSystemService.getFileStats(filePath);
      if (!stats?.writable)
        throw new Error(
          'This file is no longer writable. Your edits have been kept.',
        );
      const current = await FileSystemService.readFile(filePath);
      if (!current || current.content !== draft.originalContent) {
        throw new Error(
          'The file changed on disk. Your edits have been kept; review the external changes before saving.',
        );
      }
      const result = await FileSystemService.writeFile(filePath, content);
      if (!result?.success)
        throw new Error(
          result?.error ?? 'Failed to save file. Your edits have been kept.',
        );
    },
    [filePath],
  );

  if (!readOnly && access?.path !== filePath)
    return <div style={{ padding: 16 }}>Loading file…</div>;
  if (!readOnly && access?.writable) {
    return (
      <MonacoFileTabContent
        key={filePath}
        filePath={filePath}
        fileName={fileName}
        editable
        preserveUnsavedChanges
        onSave={save}
        range={range}
        rangeRevision={rangeRevision}
      />
    );
  }
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <PierreFileView
        filePath={filePath}
        fileName={fileName}
        range={range}
        rangeRevision={rangeRevision}
      />
    </div>
  );
};
