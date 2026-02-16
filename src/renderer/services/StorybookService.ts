/**
 * Storybook Service
 *
 * Provides utilities for detecting and managing Storybook in projects.
 * Uses codebase-composition PackageLayer data instead of direct file reads.
 */

import type { PackageLayer } from '@principal-ai/codebase-composition';

/**
 * Represents a package with Storybook available
 */
export interface StorybookPackage {
  /** Package name (e.g., "my-app" or "@org/component-library") */
  name: string;
  /** Absolute path to the package directory */
  path: string;
  /** Whether this package has a "storybook" script */
  hasScript: boolean;
  /** @storybook/* dependencies found in this package */
  storybookDependencies: string[];
  /** Display label for UI (e.g., "my-app" or "packages/components") */
  label: string;
}

/**
 * Find all packages with Storybook configured in a repository.
 *
 * Checks for:
 * 1. A "storybook" script in package.json
 * 2. @storybook/* packages in dependencies or devDependencies
 *
 * @param packages - Array of PackageLayer objects from codebase-composition
 * @param repositoryPath - Repository root path for calculating relative paths
 * @returns Array of packages that have Storybook configured
 *
 * @example
 * const packagesSlice = context.getSlice('packages');
 * const storybookPackages = findStorybookPackages(packagesSlice.data.packages, repoPath);
 * if (storybookPackages.length > 0) {
 *   console.info(`Found ${storybookPackages.length} packages with Storybook`);
 * }
 */
export function findStorybookPackages(
  packages: PackageLayer[] | undefined,
  repositoryPath: string,
): StorybookPackage[] {
  if (!packages || packages.length === 0) {
    console.info('[StorybookService] No packages found');
    return [];
  }

  const storybookPackages: StorybookPackage[] = [];

  for (const pkg of packages) {
    const packageData = pkg.packageData;
    if (!packageData) continue;

    // Derive the absolute path
    // packageData.path is relative path from repository root (empty string for root package)
    const packagePath = packageData.path
      ? `${repositoryPath}/${packageData.path}`
      : repositoryPath;

    // Check for "storybook" script
    const hasScript = packageData.availableCommands?.some(
      (cmd) => cmd.name === 'storybook',
    ) ?? false;

    // Check for @storybook/* packages in dependencies
    const allDeps = {
      ...packageData.dependencies,
      ...packageData.devDependencies,
    };

    const storybookDependencies = Object.keys(allDeps || {}).filter((dep) =>
      dep.startsWith('@storybook/'),
    );

    // If either condition is met, this package has Storybook
    if (hasScript || storybookDependencies.length > 0) {
      // Use packageData.path for label (it's the relative path)
      const label = packageData.path
        ? `${packageData.name || 'unknown'} (${packageData.path})`
        : packageData.name || 'unknown';

      storybookPackages.push({
        name: packageData.name || 'unknown',
        path: packagePath, // Use absolute path
        hasScript,
        storybookDependencies,
        label,
      });

      console.info(
        `[StorybookService] Found Storybook in package: ${packageData.name} at ${packagePath}`,
        { hasScript, storybookDependencies, relativePath: packageData.path },
      );
    }
  }

  if (storybookPackages.length === 0) {
    console.info('[StorybookService] No packages with Storybook found');
  }

  return storybookPackages;
}

/**
 * Get the appropriate command to run Storybook with a specific port.
 *
 * Strategy:
 * 1. If "storybook" script exists: use `npm run storybook -- --port ${port}`
 * 2. Otherwise: use `npx storybook dev --port ${port}`
 *
 * @param storybookPackage - StorybookPackage object with package info
 * @param port - Port number to run Storybook on
 * @returns The command string to execute
 *
 * @example
 * const command = getStorybookCommand(storybookPackage, 6006);
 * console.info(command); // "npm run storybook -- --port 6006"
 */
export function getStorybookCommand(
  storybookPackage: StorybookPackage,
  port: number,
): string {
  let command: string;

  // If "storybook" script exists, use npm run
  if (storybookPackage.hasScript) {
    console.info('[StorybookService] Using npm run storybook command');
    command = `npm run storybook -- --port ${port} --no-open`;
  } else {
    // Fall back to npx storybook dev
    console.info('[StorybookService] Using npx storybook dev command');
    command = `npx storybook dev --port ${port} --no-open`;
  }

  console.info(`[StorybookService] Generated command: ${command}`);
  console.info(`[StorybookService] Will run in directory: ${storybookPackage.path}`);
  return command;
}

export const StorybookService = {
  findStorybookPackages,
  getStorybookCommand,
};
