import React from 'react';
import { FileTreeTab } from './FileTreeTab';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';

interface FileTreePanelContentProps {
  onFileSelect?: (filePath: string) => void;
  onContextMenu?: (event: React.MouseEvent, nodePath: string, isFolder: boolean) => void;
}

/**
 * FileTreePanelContent - Connects FileTreeTab to RepositoryPanelProvider
 *
 * This component gets file tree data from the RepositoryPanelProvider context,
 * which subscribes to cache sync events for automatic updates.
 */
export const FileTreePanelContent: React.FC<FileTreePanelContentProps> = ({
  onFileSelect,
  onContextMenu,
}) => {
  const { fileTree, loading, isSliceLoading } = useRepositoryPanelContext();

  const fileTreeLoading = isSliceLoading('fileTree');

  return (
    <FileTreeTab
      fileTree={fileTree}
      onFileSelect={onFileSelect}
      onContextMenu={onContextMenu}
      loading={fileTreeLoading || loading}
    />
  );
};
