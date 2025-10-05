import React, { useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { GitStatusFileTree, type GitFileStatus } from '@a24z/dynamic-file-tree';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import type { EnhancedAlexandriaEntry, GitStatus } from '../../../../../shared/types/repository.types';

interface GitChangesPanelProps {
  repository: EnhancedAlexandriaEntry;
  gitStatus: GitStatus;
  isLoading: boolean;
  onFileClick: (filePath: string) => void;
}

export const GitChangesPanel: React.FC<GitChangesPanelProps> = ({
  repository,
  gitStatus,
  isLoading,
  onFileClick,
}) => {
  const { theme } = useTheme();

  const hasChanges =
    gitStatus.staged.length > 0 ||
    gitStatus.unstaged.length > 0 ||
    gitStatus.untracked.length > 0 ||
    gitStatus.deleted.length > 0;

  const gitChangesData = useMemo(() => {
    if (!hasChanges || isLoading) return null;

    const allChangedFiles = [
      ...gitStatus.staged.map((f) => f.path),
      ...gitStatus.unstaged.map((f) => f.path),
      ...gitStatus.untracked.map((f) => f.path),
      ...gitStatus.deleted.map((f) => f.path),
    ].sort((a, b) => a.localeCompare(b));

    const builder = new PathsFileTreeBuilder();
    const tree = builder.build({
      files: allChangedFiles,
      rootPath: repository.path,
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
  }, [gitStatus, repository.path, hasChanges, isLoading]);

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
        {hasChanges && !isLoading && (
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
        {isLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            Loading git changes...
          </div>
        ) : !hasChanges ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            No git changes to display
          </div>
        ) : (
          gitChangesData && (
            <GitStatusFileTree
              fileTree={gitChangesData.tree}
              theme={theme}
              gitStatusData={gitChangesData.statusData}
              onFileSelect={onFileClick}
              showIcons
            />
          )
        )}
      </div>
    </div>
  );
};
