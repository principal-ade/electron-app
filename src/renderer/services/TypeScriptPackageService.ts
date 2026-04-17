/**
 * TypeScript Package Service
 *
 * Provides utilities for detecting TypeScript packages in projects.
 * Uses codebase-composition PackageLayer data.
 */

import type { PackageLayer } from '@principal-ai/codebase-composition';

/**
 * Represents a package with TypeScript configured
 */
export interface TypeScriptPackage {
  /** Package name (e.g., "my-app" or "@org/component-library") */
  name: string;
  /** Absolute path to the package directory */
  path: string;
  /** Absolute path to tsconfig.json */
  tsConfigPath: string;
  /** Display label for UI (e.g., "my-app" or "packages/components") */
  label: string;
}

/**
 * Find all packages with TypeScript configured in a repository.
 *
 * Checks for:
 * 1. A tsconfig.json file in the package
 *
 * @param packages - Array of PackageLayer objects from codebase-composition
 * @param repositoryPath - Repository root path for calculating relative paths
 * @returns Array of packages that have TypeScript configured
 *
 * @example
 * const packagesSlice = context.packages;
 * const tsPackages = findTypeScriptPackages(packagesSlice.data.packages, repoPath);
 * if (tsPackages.length > 0) {
 *   console.info(`Found ${tsPackages.length} packages with TypeScript`);
 * }
 */
export function findTypeScriptPackages(
  packages: PackageLayer[] | undefined,
  repositoryPath: string,
): TypeScriptPackage[] {
  if (!packages || packages.length === 0) {
    console.info('[TypeScriptPackageService] No packages found');
    return [];
  }

  const tsPackages: TypeScriptPackage[] = [];

  for (const pkg of packages) {
    const packageData = pkg.packageData;
    if (!packageData) continue;

    // Check if TypeScript config exists
    const tsConfig = pkg.configFiles?.typescript;
    if (!tsConfig || !tsConfig.exists || !tsConfig.path) {
      continue;
    }

    // Derive the absolute path
    // packageData.path is relative path from repository root (empty string for root package)
    const packagePath = packageData.path
      ? `${repositoryPath}/${packageData.path}`
      : repositoryPath;

    // Use packageData.path for label (it's the relative path)
    const label = packageData.path
      ? `${packageData.name || 'unknown'} (${packageData.path})`
      : packageData.name || 'unknown';

    tsPackages.push({
      name: packageData.name || 'unknown',
      path: packagePath, // Use absolute path
      tsConfigPath: tsConfig.path,
      label,
    });

    console.info(
      `[TypeScriptPackageService] Found TypeScript in package: ${packageData.name} at ${packagePath}`,
      { tsConfigPath: tsConfig.path, relativePath: packageData.path },
    );
  }

  if (tsPackages.length === 0) {
    console.info('[TypeScriptPackageService] No packages with TypeScript found');
  }

  return tsPackages;
}

export const TypeScriptPackageService = {
  findTypeScriptPackages,
};
