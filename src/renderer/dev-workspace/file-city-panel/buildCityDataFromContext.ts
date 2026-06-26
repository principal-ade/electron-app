import {
  buildCityDataFromFileTree,
  enrichWithLineCounts,
  type CityData,
} from './cityDataBuilders';
import type { FileTree as RepoFileTree } from '@principal-ai/repository-abstraction';

export interface BuildCityDataInput {
  fileTree: RepoFileTree;
  repositoryPath?: string | null;
}

/**
 * Builds CityData from a repo file tree, fetching real line counts from the
 * main process when a repositoryPath is available. When real counts aren't
 * available the city data is returned without line counts (we no longer
 * estimate them from file size).
 *
 * Building paths come out repo-relative (e.g. "src/x.ts"), matching the
 * documented LayerItem.path contract ("relative to repository root"). We
 * deliberately pass an empty rootPath into the city builder so it doesn't
 * leak the FileTree's generated `metadata.id` ("git-<sha>-<dirty>-<ts>") onto
 * every building. Main-process line counts come back keyed by the repo
 * name (e.g. "electron-app/src/x.ts") and we strip that prefix to match.
 */
export async function buildCityDataFromContext(
  input: BuildCityDataInput,
): Promise<CityData> {
  const { fileTree, repositoryPath } = input;
  const rawCityData = buildCityDataFromFileTree(fileTree, '');

  const countLines = window.mainProcess?.fileCityImage?.countLines;
  if (!repositoryPath || !countLines) {
    return rawCityData;
  }

  try {
    const rawLineCounts = await countLines(repositoryPath);
    const repoName = repositoryPath.split('/').pop() || '';
    const lineCounts: Record<string, number> = {};
    for (const [filePath, count] of Object.entries(rawLineCounts)) {
      if (typeof count !== 'number' || count < 0) continue;
      const key = filePath.startsWith(repoName + '/')
        ? filePath.slice(repoName.length + 1)
        : filePath;
      lineCounts[key] = count;
    }
    return enrichWithLineCounts(rawCityData, lineCounts);
  } catch {
    return rawCityData;
  }
}

/**
 * Strip the FileTree's generated rootPath ("git-<sha>-<dirty>-<ts>") from a
 * path. Kept for callers that still see prefixed paths (e.g. file-tree
 * selection paths sourced from `tree.allFiles[].path`). Building paths
 * produced by buildCityDataFromContext are already repo-relative so this is a
 * no-op there.
 */
export function stripRootPath(path: string, rootPath: string): string {
  if (rootPath && path.startsWith(rootPath + '/')) {
    return path.slice(rootPath.length + 1);
  }
  return path;
}
