import React, { useCallback, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { GitStatusFileTree, type GitFileStatus } from '@a24z/dynamic-file-tree';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';
import type { GitChangeSelectionStatus } from '../../../shared/types/repository.types';
import { GitChangesContextMenu } from '../../components/GitChangesContextMenu';

interface GitChangesPanelProps {
  onFileClick?: (filePath: string, status?: GitChangeSelectionStatus) => void;
  emptyMessage?: string;
  loadingMessage?: string;
  variant?: 'panel' | 'tab'; // panel shows wrapper with border/header, tab shows just the tree
  selectedFile?: string;
}

export const GitChangesPanel: React.FC<GitChangesPanelProps> = ({
  onFileClick,
  emptyMessage = 'No git changes to display',
  loadingMessage = 'Loading git changes...',
  variant = 'panel',
  selectedFile,
}) => {
  const { theme } = useTheme();
  const {
    repository,
    repositoryPath,
    gitStatus,
    gitStatusLoading,
    actions,
    fileTree,
  } = useRepositoryPanelContext();
  const { openGitDiff, openFile } = actions;

  // State for toggling between full tree and changes only
  const [showFullTree, setShowFullTree] = useState(true);

  // Determine file status based on git status data
  const getFileStatus = useCallback(
    (
      filePath: string,
    ): 'staged' | 'unstaged' | 'untracked' | 'deleted' | undefined => {
      // Check staged files
      if (gitStatus.staged.some((f) => f.path === filePath)) {
        return 'staged';
      }
      // Check deleted files
      if (gitStatus.deleted.some((f) => f.path === filePath)) {
        return 'deleted';
      }
      // Check untracked files
      if (gitStatus.untracked.some((f) => f.path === filePath)) {
        return 'untracked';
      }
      // Check unstaged files
      if (gitStatus.unstaged.some((f) => f.path === filePath)) {
        return 'unstaged';
      }
      return undefined;
    },
    [gitStatus],
  );

  const handleFileSelect = useCallback(
    (filePath: string) => {
      const status = getFileStatus(filePath);

      if (onFileClick) {
        onFileClick(filePath, status);
        return;
      }

      // Route based on whether the file has git changes
      // Files with changes → openGitDiff (show diff viewer)
      // Files without changes → openFile (just open in code viewer)
      if (status && openGitDiff) {
        openGitDiff(filePath, status);
        return;
      }

      openFile?.(filePath);
    },
    [getFileStatus, onFileClick, openGitDiff, openFile],
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    filePath: string;
    isFolder: boolean;
    fileStatus?: 'staged' | 'unstaged' | 'untracked' | 'deleted';
  } | null>(null);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, nodePath: string, isFolder: boolean) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        filePath: nodePath,
        isFolder,
        fileStatus: getFileStatus(nodePath),
      });
    },
    [getFileStatus],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRefreshStatus = useCallback(() => {
    // Trigger a refresh of the git status
    // The context provider should handle this automatically via subscription
    // but we can call refresh explicitly if needed
    setContextMenu(null);
  }, []);

  const hasChanges =
    gitStatus.staged.length > 0 ||
    gitStatus.unstaged.length > 0 ||
    gitStatus.untracked.length > 0 ||
    gitStatus.deleted.length > 0;

  const gitChangesData = useMemo(() => {
    if (!repositoryPath || gitStatusLoading) {
      return null;
    }

    // Helper function to expand directories using the fileTree
    const expandDirectories = (paths: string[]): string[] => {
      if (!fileTree?.allFiles) return paths;

      const expandedPaths: string[] = [];

      for (const path of paths) {
        // Normalize path by removing trailing slash (git returns directories with trailing slash)
        const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;

        // Check if this path is a directory by seeing if any files in the tree start with it
        const matchingFiles = fileTree.allFiles.filter(
          (file) =>
            file.path.startsWith(normalizedPath + '/') ||
            file.path === normalizedPath,
        );

        if (matchingFiles.length > 0) {
          // This is a directory - add all matching files
          expandedPaths.push(...matchingFiles.map((f) => f.path));
        } else {
          // This is a file - add it directly
          expandedPaths.push(normalizedPath);
        }
      }

      return expandedPaths;
    };

    // Expand untracked directories to show all files
    const expandedUntracked = expandDirectories(
      gitStatus.untracked.map((f) => f.path),
    );

    const statusData: GitFileStatus[] = [
      ...gitStatus.staged.map((f) => ({
        filePath: f.path,
        indexStatus: 'A',
        workingTreeStatus: ' ',
        status: 'A' as const,
      })),
      ...gitStatus.unstaged.map((f) => ({
        filePath: f.path,
        indexStatus: ' ',
        workingTreeStatus: 'M',
        status: 'M' as const,
      })),
      ...gitStatus.deleted.map((f) => ({
        filePath: f.path,
        indexStatus: ' ',
        workingTreeStatus: 'D',
        status: 'D' as const,
      })),
      ...expandedUntracked.map((filePath) => ({
        filePath,
        indexStatus: '?',
        workingTreeStatus: '?',
        status: '??' as const,
      })),
    ];

    // If showing full tree, use the complete fileTree
    if (showFullTree && fileTree) {
      return { tree: fileTree, statusData };
    }

    // Changes only mode - show only changed files
    // If no changes, return null (unless showing full tree)
    if (!hasChanges) {
      return null;
    }

    const allChangedFiles = [
      ...gitStatus.staged.map((f) => f.path),
      ...gitStatus.unstaged.map((f) => f.path),
      ...expandedUntracked,
      ...gitStatus.deleted.map((f) => f.path),
    ].sort((a, b) => a.localeCompare(b));

    const builder = new PathsFileTreeBuilder();
    const tree = builder.build({
      files: allChangedFiles,
      rootPath: repository?.path ?? repositoryPath,
    });

    return { tree, statusData };
  }, [
    repositoryPath,
    hasChanges,
    gitStatusLoading,
    fileTree,
    gitStatus,
    repository?.path,
    showFullTree,
  ]);

  if (!repositoryPath) {
    const content = (
      <div
        style={{
          padding: variant === 'panel' ? '16px' : '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '160px',
          color: theme.colors.textSecondary,
          textAlign: 'center',
        }}
      >
        Git changes are only available for local repositories.
      </div>
    );

    if (variant === 'tab') {
      return content;
    }

    return (
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        {content}
      </div>
    );
  }

  // Tab variant - just the tree with no wrapper
  if (variant === 'tab') {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Toggle switch at the top */}
          <div
            style={{
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                backgroundColor: theme.colors.backgroundTertiary,
                width: '100%',
              }}
            >
              <button
                onClick={() => setShowFullTree(true)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: theme.fontSizes[1],
                  backgroundColor: showFullTree
                    ? theme.colors.backgroundSecondary
                    : 'transparent',
                  color: showFullTree
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                  border: showFullTree
                    ? `1px solid ${theme.colors.border}`
                    : '1px solid transparent',
                  cursor: 'pointer',
                  fontWeight: showFullTree ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                Full Tree
              </button>
              <button
                onClick={() => setShowFullTree(false)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: theme.fontSizes[1],
                  backgroundColor: !showFullTree
                    ? theme.colors.backgroundSecondary
                    : 'transparent',
                  color: !showFullTree
                    ? theme.colors.text
                    : theme.colors.textSecondary,
                  border: !showFullTree
                    ? `1px solid ${theme.colors.border}`
                    : '1px solid transparent',
                  cursor: 'pointer',
                  fontWeight: !showFullTree ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                Changes Only
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {gitStatusLoading ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                }}
              >
                {loadingMessage}
              </div>
            ) : !hasChanges && !showFullTree ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                }}
              >
                {emptyMessage}
              </div>
            ) : (
              gitChangesData && (
                <GitStatusFileTree
                  key={`${showFullTree}-${gitChangesData.statusData.length}`}
                  fileTree={gitChangesData.tree}
                  theme={theme}
                  gitStatusData={gitChangesData.statusData}
                  onFileSelect={handleFileSelect}
                  onContextMenu={handleContextMenu}
                  selectedFile={selectedFile}
                  transparentBackground={true}
                  padding="16px"
                  openByDefault={!showFullTree}
                />
              )
            )}
          </div>
        </div>
        {contextMenu && repositoryPath && (
          <GitChangesContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            filePath={contextMenu.filePath}
            isFolder={contextMenu.isFolder}
            repositoryPath={repositoryPath}
            fileStatus={contextMenu.fileStatus}
            onClose={handleCloseContextMenu}
            onOpenFile={actions.openFile}
            onRefreshStatus={handleRefreshStatus}
          />
        )}
      </>
    );
  }

  // Panel variant - with wrapper, header, border
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '600px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Git Changes
        </h3>
        {hasChanges && !gitStatusLoading && (
          <span
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
            }}
          >
            {gitChangesData?.statusData.length ?? 0} file
            {(gitChangesData?.statusData.length ?? 0) === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Toggle switch */}
      <div
        style={{
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            backgroundColor: theme.colors.backgroundTertiary,
            width: '100%',
          }}
        >
          <button
            onClick={() => setShowFullTree(true)}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: theme.fontSizes[1],
              backgroundColor: showFullTree
                ? theme.colors.backgroundSecondary
                : 'transparent',
              color: showFullTree
                ? theme.colors.text
                : theme.colors.textSecondary,
              border: showFullTree
                ? `1px solid ${theme.colors.border}`
                : '1px solid transparent',
              cursor: 'pointer',
              fontWeight: showFullTree ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            Full Tree
          </button>
          <button
            onClick={() => setShowFullTree(false)}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: theme.fontSizes[1],
              backgroundColor: !showFullTree
                ? theme.colors.backgroundSecondary
                : 'transparent',
              color: !showFullTree
                ? theme.colors.text
                : theme.colors.textSecondary,
              border: !showFullTree
                ? `1px solid ${theme.colors.border}`
                : '1px solid transparent',
              cursor: 'pointer',
              fontWeight: !showFullTree ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            Changes Only
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {gitStatusLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            {loadingMessage}
          </div>
        ) : !hasChanges && !showFullTree ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          gitChangesData && (
            <GitStatusFileTree
              key={`${showFullTree}-${gitChangesData.statusData.length}`}
              fileTree={gitChangesData.tree}
              theme={theme}
              gitStatusData={gitChangesData.statusData}
              onFileSelect={handleFileSelect}
              onContextMenu={handleContextMenu}
              selectedFile={selectedFile}
              transparentBackground={true}
              openByDefault={!showFullTree}
            />
          )
        )}
      </div>
      {contextMenu && repositoryPath && (
        <GitChangesContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          filePath={contextMenu.filePath}
          isFolder={contextMenu.isFolder}
          repositoryPath={repositoryPath}
          fileStatus={contextMenu.fileStatus}
          onClose={handleCloseContextMenu}
          onOpenFile={actions.openFile}
          onRefreshStatus={handleRefreshStatus}
        />
      )}
    </div>
  );
};

export const GitChangesPanelPreview: React.FC = () => {
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
          color: '#22c55e',
        }}
      >
        <span>+</span>
        <span>new-file.ts</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#f59e0b',
        }}
      >
        <span>M</span>
        <span>modified.ts</span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#ef4444',
        }}
      >
        <span>-</span>
        <span>deleted.ts</span>
      </div>
    </div>
  );
};
