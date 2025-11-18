import React, { useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FolderTree, FileCode } from 'lucide-react';
import { FileTreeTab } from './FileTreeTab';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';
import { FileTreeContextMenu } from '../../components/FileTreeContextMenu';

interface FileTreePanelContentProps {
  onFileSelect?: (filePath: string) => void;
}

/**
 * FileTreePanelContent - Connects FileTreeTab to RepositoryPanelProvider
 *
 * This component gets file tree data from the RepositoryPanelProvider context,
 * which subscribes to cache sync events for automatic updates.
 * It also manages the file tree context menu internally.
 */
export const FileTreePanelContent: React.FC<FileTreePanelContentProps> = ({
  onFileSelect,
}) => {
  const { fileTree, loading, isSliceLoading, repositoryPath } =
    useRepositoryPanelContext();

  const fileTreeLoading = isSliceLoading('fileTree');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    filePath: string;
    isFolder: boolean;
  } | null>(null);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, nodePath: string, isFolder: boolean) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        filePath: nodePath,
        isFolder,
      });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleFileDeleted = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <>
      <FileTreeTab
        fileTree={fileTree}
        onFileSelect={onFileSelect}
        onContextMenu={handleContextMenu}
        loading={fileTreeLoading || loading}
      />
      {contextMenu && (
        <FileTreeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={contextMenu.filePath}
          isFolder={contextMenu.isFolder}
          repositoryPath={repositoryPath || undefined}
          onClose={handleCloseContextMenu}
          onDelete={handleFileDeleted}
        />
      )}
    </>
  );
};

export const FileTreePanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '12px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <FolderTree size={14} style={{ color: theme.colors.primary }} />
        <span style={{ fontWeight: 600 }}>src/</span>
      </div>
      <div
        style={{
          paddingLeft: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <FileCode size={12} />
          <span>index.ts</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <FileCode size={12} />
          <span>utils.ts</span>
        </div>
      </div>
    </div>
  );
};
