/**
 * Utility for loading OTEL resources from library.yaml files in the renderer process.
 *
 * This module provides functions to:
 * 1. Load library.yaml files using LibraryLoader with RendererFileSystemAdapter
 * 2. Extract OTEL resource attributes for trace routing
 * 3. Get specific resource values like dev.server.url
 */

import { LibraryLoader } from '@principal-ai/principal-view-core';
import type { ComponentLibrary } from '@principal-ai/principal-view-core';
import { createRendererFileSystemAdapter } from './RendererFileSystemAdapter';

/**
 * Result of loading library resources
 */
export interface LibraryResourcesResult {
  success: boolean;
  resources?: Record<string, string>;
  error?: string;
  path?: string;
}

/**
 * Load OTEL resources from a library.yaml file.
 *
 * @param baseDir - The base directory to search for library.yaml (usually the repository root)
 * @returns Promise<LibraryResourcesResult>
 *
 * @example
 * ```typescript
 * const result = await loadLibraryResources('/Users/griever/Developer/web-ade/web-ade');
 * if (result.success) {
 *   console.log('OTEL resources:', result.resources);
 *   console.log('Dev server URL:', result.resources?.['dev.server.url']);
 * }
 * ```
 */
export async function loadLibraryResources(baseDir: string): Promise<LibraryResourcesResult> {
  try {
    // Create and initialize the file system adapter
    const fsAdapter = await createRendererFileSystemAdapter();

    // Create LibraryLoader with the adapter
    const loader = new LibraryLoader(fsAdapter);

    // Load the library from baseDir/.principal-views/
    const loadResult = loader.load(baseDir);

    if (!loadResult.success || !loadResult.library) {
      return {
        success: false,
        error: loadResult.error || 'Failed to load library',
        path: loadResult.path,
      };
    }

    // Extract resources from the library
    const resources = loadResult.library.resources || {};

    return {
      success: true,
      resources,
      path: loadResult.path,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the dev.server.url resource from a library.yaml file.
 * This is the primary attribute used for trace routing in dev tools.
 *
 * @param baseDir - The base directory to search for library.yaml
 * @returns Promise<string | null> - The dev.server.url value or null if not found
 *
 * @example
 * ```typescript
 * const devServerUrl = await getDevServerUrl('/Users/griever/Developer/web-ade/web-ade');
 * if (devServerUrl) {
 *   console.log('Register for sourceUrl:', devServerUrl);
 * }
 * ```
 */
export async function getDevServerUrl(baseDir: string): Promise<string | null> {
  const result = await loadLibraryResources(baseDir);
  if (result.success && result.resources) {
    return result.resources['dev.server.url'] || null;
  }
  return null;
}

/**
 * Get all OTEL-related resources from a library.yaml file.
 * Includes service.name, service.version, dev.server.url, deployment.environment, etc.
 *
 * @param baseDir - The base directory to search for library.yaml
 * @returns Promise<Record<string, string>> - All OTEL resources, or empty object if none found
 *
 * @example
 * ```typescript
 * const resources = await getOtelResources('/Users/griever/Developer/web-ade/web-ade');
 * console.log('Service name:', resources['service.name']);
 * console.log('Service version:', resources['service.version']);
 * console.log('Dev server URL:', resources['dev.server.url']);
 * console.log('Environment:', resources['deployment.environment']);
 * ```
 */
export async function getOtelResources(baseDir: string): Promise<Record<string, string>> {
  const result = await loadLibraryResources(baseDir);
  return result.resources || {};
}

/**
 * Load the complete ComponentLibrary from library.yaml.
 * Use this if you need access to nodeComponents, edgeComponents, etc.
 *
 * @param baseDir - The base directory to search for library.yaml
 * @returns Promise<ComponentLibrary | null>
 *
 * @example
 * ```typescript
 * const library = await loadComponentLibrary('/Users/griever/Developer/web-ade/web-ade');
 * if (library) {
 *   console.log('Library name:', library.name);
 *   console.log('Node components:', Object.keys(library.nodeComponents));
 *   console.log('OTEL resources:', library.resources);
 * }
 * ```
 */
export async function loadComponentLibrary(baseDir: string): Promise<ComponentLibrary | null> {
  try {
    const fsAdapter = await createRendererFileSystemAdapter();
    const loader = new LibraryLoader(fsAdapter);
    const loadResult = loader.load(baseDir);

    if (!loadResult.success || !loadResult.library) {
      console.error('[libraryResourcesLoader] Failed to load library:', loadResult.error);
      return null;
    }

    return loadResult.library;
  } catch (error) {
    console.error('[libraryResourcesLoader] Error loading component library:', error);
    return null;
  }
}
