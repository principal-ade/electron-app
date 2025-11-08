import React, { useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { GitStatusFileTree, type GitFileStatus } from '@a24z/dynamic-file-tree';
import { GitFileTreeBuilder } from '@principal-ai/repository-abstraction';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { GitStatus } from '../../../shared/types/repository.types';

interface CodebaseViewFileTreeProps {
  files: string[];
  gitStatus?: GitStatus;
  onFileSelect?: (filePath: string) => void;
  selectedFile?: string;
  defaultOpen?: boolean;
  padding?: string;
}

/**
 * Convert a flat list of file paths into a FileTree structure
 */
function buildFileTreeFromPaths(filePaths: string[]): FileTree {
  const builder = new GitFileTreeBuilder();

  // Create a minimal GitSource with just the file paths
  const gitSource = {
    commitSha: '',
    branch: '',
    rootPath: '',
    isDirty: false,
    files: filePaths.map((path) => ({ path })),
  };

  return builder.build(gitSource);
}

export const CodebaseViewFileTree: React.FC<CodebaseViewFileTreeProps> = ({
  files,
  gitStatus,
  onFileSelect,
  selectedFile,
  defaultOpen = true,
  padding = '0px',
}) => {
  const { theme } = useTheme();

  // Convert git status to GitFileStatus format for files in this tree
  const gitStatusData: GitFileStatus[] = useMemo(() => {
    if (!gitStatus) return [];

    const fileSet = new Set(files);

    return [
      ...gitStatus.staged
        .filter((f) => fileSet.has(f.path))
        .map((f) => ({
          filePath: f.path,
          indexStatus: 'A',
          workingTreeStatus: ' ',
          status: 'A' as const,
        })),
      ...gitStatus.unstaged
        .filter((f) => fileSet.has(f.path))
        .map((f) => ({
          filePath: f.path,
          indexStatus: ' ',
          workingTreeStatus: 'M',
          status: 'M' as const,
        })),
      ...gitStatus.deleted
        .filter((f) => fileSet.has(f.path))
        .map((f) => ({
          filePath: f.path,
          indexStatus: ' ',
          workingTreeStatus: 'D',
          status: 'D' as const,
        })),
      ...gitStatus.untracked
        .filter((f) => fileSet.has(f.path))
        .map((f) => ({
          filePath: f.path,
          indexStatus: '?',
          workingTreeStatus: '?',
          status: '??' as const,
        })),
    ];
  }, [gitStatus, files]);

  if (files.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes[1],
          fontFamily: theme.fonts.body,
        }}
      >
        No files to display
      </div>
    );
  }

  const fileTree = buildFileTreeFromPaths(files);

  return (
    <GitStatusFileTree
      key={`${files.length}-${defaultOpen}-${gitStatusData.length}`}
      fileTree={fileTree}
      theme={theme}
      gitStatusData={gitStatusData}
      onFileSelect={onFileSelect}
      selectedFile={selectedFile}
      openByDefault={defaultOpen}
      transparentBackground={true}
      padding={padding}
    />
  );
};
