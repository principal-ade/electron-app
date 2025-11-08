import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import { DynamicFileTree } from '@a24z/dynamic-file-tree';
import { GitFileTreeBuilder } from '@principal-ai/repository-abstraction';
import type { FileTree } from '@principal-ai/repository-abstraction';

interface CodebaseViewFileTreeProps {
  files: string[];
  onFileSelect?: (filePath: string) => void;
  selectedFile?: string;
  defaultOpen?: boolean;
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
  onFileSelect,
  selectedFile,
  defaultOpen = true,
}) => {
  const { theme } = useTheme();

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
    <DynamicFileTree
      key={`${files.length}-${defaultOpen}`}
      fileTree={fileTree}
      theme={theme}
      onFileSelect={onFileSelect}
      selectedFile={selectedFile}
      defaultOpen={defaultOpen}
      padding="0px"
    />
  );
};
