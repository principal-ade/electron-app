import React from 'react';
import { FileCode } from 'lucide-react';
import { RepoManagerCodePreview } from '../shared/RepoManagerCodePreview';
import { PanelEmptyState } from './PanelEmptyState';

interface CodeFileViewerPanelProps {
  // File data
  filePath: string | null;
  absolutePath: string | null;
  content: string | null;

  // Loading state
  loading?: boolean;

  // Close handler
  onClose?: () => void;
}

export const CodeFileViewerPanel: React.FC<CodeFileViewerPanelProps> = ({
  filePath,
  absolutePath,
  content,
  loading = false,
  onClose,
}) => {
  if (!filePath) {
    return (
      <PanelEmptyState
        icon={FileCode}
        title="No file selected"
        description="Select a file from the search or file tree to view it here"
      />
    );
  }

  return (
    <RepoManagerCodePreview
      key={filePath} // Force remount when selecting a different file
      filePath={filePath}
      absolutePath={absolutePath}
      content={content}
      loading={loading}
      onClose={onClose}
    />
  );
};
