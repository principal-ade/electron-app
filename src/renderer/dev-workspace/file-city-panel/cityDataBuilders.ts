/**
 * Utilities for building CityData from a FileTree for the File City /
 * architecture-map visualizations.
 *
 * These were previously imported from
 * `@industry-theme/repository-composition-panels`, but that library removed its
 * bundled FileCity3D panel (and these helpers) in 0.7.91. They were always thin
 * wrappers over `@principal-ai/file-city-builder` — which we already depend on —
 * so they now live here, alongside their only consumers.
 */

import { CodeCityBuilderWithGrid } from '@principal-ai/file-city-builder';
import type { CityData } from '@principal-ai/file-city-builder';
import type { FileTree } from '@principal-ai/repository-abstraction';

export type { CityData };

/**
 * Per-file line counts used to enrich buildings, keyed by repo-relative path.
 */
export interface LineCountData {
  [filePath: string]: number;
}

/**
 * Build CityData from a FileTree using file-city-builder. The builder already
 * returns buildings carrying `size`/`fileExtension` (and an optional
 * `lineCount`), so we return its output directly.
 */
export function buildCityDataFromFileTree(
  fileTree: FileTree,
  rootPath: string = '',
): CityData {
  const builder = new CodeCityBuilderWithGrid();
  return builder.buildCityFromFileSystem(fileTree, rootPath);
}

/**
 * Enrich CityData with line count information, adding `lineCount` to each
 * building from the provided data. Buildings without a real count are left
 * as-is (we no longer estimate counts from file size).
 */
export function enrichWithLineCounts(
  cityData: CityData,
  lineCounts: LineCountData,
): CityData {
  return {
    ...cityData,
    buildings: cityData.buildings.map((building) => ({
      ...building,
      lineCount: lineCounts[building.path],
    })),
  };
}
