import type { FileTree } from "@principal-ai/repository-abstraction";
import type { AgentSessionRecord } from '../../shared/sessionTypes';

/**
 * Normalizes a file path to be relative to the git repository root
 * This is used to match file paths between session events and the city map
 */
export function normalizePathToGitRoot(
  filePath: string,
  gitRoot: string,
  fileName?: string,
  fileSystemTree?: FileTree,
  workingDirectory?: string,
): string | null {
  if (!filePath || !gitRoot) {
    return null;
  }

  // Check if this is already a normalized path from the main process
  // Pre-normalized paths start with / or [EXTERNAL]/
  if (
    (filePath.startsWith('/') && !filePath.startsWith(gitRoot)) ||
    filePath.startsWith('[EXTERNAL]/')
  ) {
    return filePath;
  }

  // If the path starts with the git root, make it relative
  if (filePath.startsWith(gitRoot)) {
    // Remove git root but keep the leading slash
    const relativePath = filePath.slice(gitRoot.length);
    // The city map expects paths like "/electron-react/..." so we need to ensure leading slash
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  }

  // If we have a working directory that's different from git root, handle relative paths
  if (
    workingDirectory &&
    workingDirectory !== gitRoot &&
    workingDirectory.startsWith(gitRoot)
  ) {
    // Working directory is a subdirectory of git root
    const workingDirRelative = workingDirectory.slice(gitRoot.length);

    // Only combine if filePath is relative (doesn't start with /)
    if (!filePath.startsWith('/')) {
      // Relative path - combine with working directory
      const fullPath = `${workingDirRelative}/${filePath}`;
      return fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
    }

    // If path already starts with /, check for duplication
    if (filePath.startsWith(workingDirRelative + workingDirRelative)) {
      // Duplicated path like "/electron-react/electron-react/..." - remove the duplication
      return filePath.replace(
        workingDirRelative + workingDirRelative,
        workingDirRelative,
      );
    }
  }

  // If the path is already relative, add leading slash if needed
  if (!filePath.startsWith('/')) {
    // Add leading slash to match city data format
    return `/${filePath}`;
  }

  // If we have a filesystem tree, use it to find the correct path
  if (fileSystemTree && fileName) {
    const foundPath = findFileInTree(fileSystemTree, fileName);
    if (foundPath) {
      return foundPath.startsWith('/') ? foundPath : `/${foundPath}`;
    }
  }

  // If we can't match it, return the path with leading slash
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
}

/**
 * Recursively searches a filesystem tree for a file by name
 * Returns the relative path from the tree root if found
 */
function findFileInTree(
  tree: FileTree,
  fileName: string,
  currentPath: string = '',
): string | null {
  // This is expensive so last resolrt
  tree.allFiles.forEach(file => {
    if (file.name === fileName) {
      return `${currentPath}/${file.name}`;
    }
  });

  return null;
}
