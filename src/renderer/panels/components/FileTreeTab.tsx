import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { DynamicFileTree } from '@principal-ade/dynamic-file-tree';
import type { FileTree } from '@principal-ai/repository-abstraction';

interface FileTreeTabProps {
  fileTree: FileTree | null;
  onFileSelect?: (filePath: string) => void;
  onContextMenu?: (
    event: React.MouseEvent,
    nodePath: string,
    isFolder: boolean,
  ) => void;
  loading?: boolean;
  selectedFile?: string;
}

/**
 * File Tree Tab Component
 *
 * Features:
 * - Starts with all folders closed by default for better performance
 * - Uses transparent background for better theming
 * - Custom padding for visual spacing
 */
export const FileTreeTab: React.FC<FileTreeTabProps> = ({
  fileTree,
  onFileSelect,
  onContextMenu,
  loading = false,
  selectedFile,
}) => {
  const { theme } = useTheme();

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
        }}
      >
        Loading file tree...
      </div>
    );
  }

  if (!fileTree) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.textSecondary,
        }}
      >
        No file tree available
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
      }}
      onContextMenu={(e) => {
        // Always prevent default browser context menu when we have a custom handler
        if (onContextMenu) {
          e.preventDefault();
        }
      }}
    >
      <DynamicFileTree
        key={fileTree.allFiles?.length || 0}
        fileTree={fileTree}
        theme={theme}
        onFileSelect={onFileSelect}
        onContextMenu={onContextMenu}
        selectedFile={selectedFile}
        defaultOpen={false}
        horizontalNodePadding="16px"
      />
    </div>
  );
};
