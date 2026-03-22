/**
 * Next.js Service
 *
 * Provides utilities for detecting and managing Next.js apps in projects.
 * Uses codebase-composition PackageLayer data instead of direct file reads.
 */

import type { PackageLayer } from '@principal-ai/codebase-composition';

/**
 * Represents a package with Next.js configured
 */
export interface NextjsPackage {
  /** Package name (e.g., "my-app" or "@org/web-app") */
  name: string;
  /** Absolute path to the package directory */
  path: string;
  /** Whether this package has a "dev" script */
  hasDevScript: boolean;
  /** Display label for UI (e.g., "my-app" or "apps/web") */
  label: string;
}

/**
 * Find all packages with Next.js configured in a repository.
 *
 * Checks for:
 * 1. "next" in dependencies or devDependencies
 * 2. A "dev" script in package.json (to run the dev server)
 *
 * @param packages - Array of PackageLayer objects from codebase-composition
 * @param repositoryPath - Repository root path for calculating relative paths
 * @returns Array of packages that have Next.js configured
 *
 * @example
 * const packagesSlice = context.getSlice('packages');
 * const nextjsPackages = findNextjsPackages(packagesSlice.data.packages, repoPath);
 * if (nextjsPackages.length > 0) {
 *   console.info(`Found ${nextjsPackages.length} packages with Next.js`);
 * }
 */
export function findNextjsPackages(
  packages: PackageLayer[] | undefined,
  repositoryPath: string,
): NextjsPackage[] {
  if (!packages || packages.length === 0) {
    console.info('[NextjsService] No packages found');
    return [];
  }

  const nextjsPackages: NextjsPackage[] = [];

  for (const pkg of packages) {
    const packageData = pkg.packageData;
    if (!packageData) continue;

    // Derive the absolute path
    // packageData.path is relative path from repository root (empty string for root package)
    const packagePath = packageData.path
      ? `${repositoryPath}/${packageData.path}`
      : repositoryPath;

    // Check for "dev" script
    const hasDevScript = packageData.availableCommands?.some(
      (cmd) => cmd.name === 'dev',
    ) ?? false;

    // Check for "next" in dependencies
    const allDeps = {
      ...packageData.dependencies,
      ...packageData.devDependencies,
    };

    const hasNextDependency = allDeps['next'] !== undefined;

    // Both conditions must be met: has Next.js dependency AND has dev script
    if (hasNextDependency && hasDevScript) {
      // Use packageData.path for label (it's the relative path)
      const label = packageData.path
        ? `${packageData.name || 'unknown'} (${packageData.path})`
        : packageData.name || 'unknown';

      nextjsPackages.push({
        name: packageData.name || 'unknown',
        path: packagePath, // Use absolute path
        hasDevScript,
        label,
      });

      console.info(
        `[NextjsService] Found Next.js in package: ${packageData.name} at ${packagePath}`,
        { hasDevScript, relativePath: packageData.path },
      );
    }
  }

  if (nextjsPackages.length === 0) {
    console.info('[NextjsService] No packages with Next.js found');
  }

  return nextjsPackages;
}

/**
 * Get the appropriate command to run Next.js dev server with a specific port.
 *
 * Strategy:
 * 1. If "dev" script exists: use `npm run dev -- -p ${port}`
 * 2. Otherwise: use `npx next dev -p ${port}`
 *
 * @param nextjsPackage - NextjsPackage object with package info
 * @param port - Port number to run the dev server on
 * @returns The command string to execute
 *
 * @example
 * const command = getNextjsCommand(nextjsPackage, 3000);
 * console.info(command); // "npm run dev -- -p 3000"
 */
export function getNextjsCommand(
  nextjsPackage: NextjsPackage,
  port: number,
): string {
  let command: string;

  // If "dev" script exists, use npm run
  if (nextjsPackage.hasDevScript) {
    console.info('[NextjsService] Using npm run dev command');
    command = `npm run dev -- -p ${port}`;
  } else {
    // Fall back to npx next dev
    console.info('[NextjsService] Using npx next dev command');
    command = `npx next dev -p ${port}`;
  }

  console.info(`[NextjsService] Generated command: ${command}`);
  console.info(`[NextjsService] Will run in directory: ${nextjsPackage.path}`);
  return command;
}

export const NextjsService = {
  findNextjsPackages,
  getNextjsCommand,
};
