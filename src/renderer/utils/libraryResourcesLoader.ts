/**
 * Utility for loading OTEL resources from library.yaml files in the renderer process.
 *
 * This module provides functions to:
 * 1. Load library.yaml files using LibraryLoader and LibraryDiscovery with RendererFileSystemAdapter
 * 2. Extract OTEL resource attributes for trace routing
 * 3. Get all service names across a monorepo's packages
 */

import { LibraryDiscovery } from '@principal-ai/principal-view-core';
import type { ResourceAttributes } from '@principal-ai/principal-view-core';
import type { FileTree } from '@principal-ai/repository-abstraction';
import { createRendererFileSystemAdapter } from './RendererFileSystemAdapter';


/**
 * Get all service names from all library.yaml files across a repository using LibraryDiscovery.
 * This is the recommended way to discover services in monorepos.
 *
 * @param fileTree - FileTree from RepositoryMonitoringService.getFileTree()
 * @param repositoryPath - Absolute path to the repository root
 * @returns Promise<string[]> - Array of all service.name values found across all packages
 *
 * @example
 * ```typescript
 * const fileTree = await RepositoryMonitoringService.getFileTree(repositoryPath);
 * const serviceNames = await getAllServiceNamesFromFileTree(fileTree, repositoryPath);
 * // Returns: ['payment-api', 'payment-worker', 'auth-service']
 * console.log('Found services:', serviceNames);
 * ```
 */
export async function getAllServiceNamesFromFileTree(
  fileTree: FileTree,
  repositoryPath: string
): Promise<string[]> {
  try {
    console.log('[libraryResourcesLoader] Discovering all services from file tree', {
      repositoryPath,
      fileTreeSha: fileTree.sha,
    });

    const fsAdapter = await createRendererFileSystemAdapter();
    const discovery = new LibraryDiscovery(fsAdapter);

    const result = await discovery.discover(fileTree);

    console.log('[libraryResourcesLoader] Discovery result:', {
      repositoryPath,
      librariesCount: result.libraries.length,
      serviceNamesCount: result.allServiceNames.length,
      serviceNames: result.allServiceNames,
      errors: result.errors,
    });

    return result.allServiceNames;
  } catch (error) {
    console.error('[libraryResourcesLoader] Failed to discover services:', error);
    return [];
  }
}

/**
 * Get all OTEL-related resources from all library.yaml files using LibraryDiscovery.
 *
 * @param fileTree - FileTree from RepositoryMonitoringService.getFileTree()
 * @param repositoryPath - Absolute path to the repository root
 * @returns Promise<Record<string, ResourceAttributes>> - All discovered service resources
 *
 * @example
 * ```typescript
 * const fileTree = await RepositoryMonitoringService.getFileTree(repositoryPath);
 * const resources = await getOtelResourcesFromFileTree(fileTree, repositoryPath);
 * for (const [serviceId, attrs] of Object.entries(resources)) {
 *   console.log('Service:', attrs['service.name']);
 * }
 * ```
 */
export async function getOtelResourcesFromFileTree(
  fileTree: FileTree,
  repositoryPath: string
): Promise<Record<string, ResourceAttributes>> {
  try {
    const fsAdapter = await createRendererFileSystemAdapter();
    const discovery = new LibraryDiscovery(fsAdapter);

    const result = await discovery.discover(fileTree);

    // Flatten all resources from all libraries into a single map
    const allResources: Record<string, ResourceAttributes> = {};

    for (const lib of result.libraries) {
      if (lib.library.resources) {
        // Merge resources, prefixing keys with package name to avoid collisions
        for (const [serviceId, attrs] of Object.entries(lib.library.resources)) {
          const key = lib.packageName === 'root' ? serviceId : `${lib.packageName}/${serviceId}`;
          allResources[key] = attrs;
        }
      }
    }

    return allResources;
  } catch (error) {
    console.error('[libraryResourcesLoader] Failed to get resources:', error);
    return {};
  }
}

