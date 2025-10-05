import React, { useCallback, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { GitStatusFileTree, type GitFileStatus } from '@a24z/dynamic-file-tree';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { useRepositoryPanelContext } from '../RepositoryPanelProvider';

interface GitChangesPanelProps {
  onFileClick?: (filePath: string) => void;
  emptyMessage?: string;
  loadingMessage?: string;
}

export const GitChangesPanel: React.FC<GitChangesPanelProps> = ({
  onFileClick,
  emptyMessage = 'No git changes to display',
  loadingMessage = 'Loading git changes...',
}) => {
  const { theme } = useTheme();
  const {
    repository,
    repositoryPath,
    gitStatus,
    gitStatusLoading,
    actions,
  } = useRepositoryPanelContext();

  const handleFileSelect = useCallback(
    (filePath: string) => {
      if (onFileClick) {
        onFileClick(filePath);
        return;
      }

      actions.openFile?.(filePath);
    },
    [actions.openFile, onFileClick],
  );

  if (!repositoryPath) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
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
  }

  const hasChanges =
    gitStatus.staged.length > 0 ||
    gitStatus.unstaged.length > 0 ||
    gitStatus.untracked.length > 0 ||
    gitStatus.deleted.length > 0;

  const gitChangesData = useMemo(() => {
    if (!hasChanges || gitStatusLoading) return null;

    const allChangedFiles = [
      ...gitStatus.staged.map((f) => f.path),
      ...gitStatus.unstaged.map((f) => f.path),
      ...gitStatus.untracked.map((f) => f.path),
      ...gitStatus.deleted.map((f) => f.path),
    ].sort((a, b) => a.localeCompare(b));

    const builder = new PathsFileTreeBuilder();
    const tree = builder.build({
      files: allChangedFiles,
      rootPath: repository?.path ?? repositoryPath,
    });

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
      ...gitStatus.untracked.map((f) => ({
        filePath: f.path,
        indexStatus: '?',
        workingTreeStatus: '?',
        status: '??' as const,
      })),
    ];

    return { tree, statusData };
  }, [
    gitStatus,
    repository?.path,
    repositoryPath,
    hasChanges,
    gitStatusLoading,
  ]);

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
        ) : !hasChanges ? (
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
              fileTree={gitChangesData.tree}
              theme={theme}
              gitStatusData={gitChangesData.statusData}
              onFileSelect={handleFileSelect}
              showIcons
            />
          )
        )}
      </div>
    </div>
  );
};
