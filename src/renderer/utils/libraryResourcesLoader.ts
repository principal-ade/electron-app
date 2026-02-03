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
    console.log('[libraryResourcesLoader] Loading library resources from:', baseDir);

    // Create and initialize the file system adapter
    const fsAdapter = await createRendererFileSystemAdapter();
    console.log('[libraryResourcesLoader] Created file system adapter');

    // Create LibraryLoader with the adapter
    const loader = new LibraryLoader(fsAdapter);

    // Load the library from baseDir/.principal-views/
    const loadResult = await loader.load(baseDir);
    console.log('[libraryResourcesLoader] LibraryLoader.load result:', {
      success: loadResult.success,
      hasLibrary: !!loadResult.library,
      error: loadResult.error,
      path: loadResult.path,
    });

    if (!loadResult.success || !loadResult.library) {
      console.warn('[libraryResourcesLoader] Failed to load library:', loadResult.error);
      return {
        success: false,
        error: loadResult.error || 'Failed to load library',
        path: loadResult.path,
      };
    }

    // Extract resources from the library
    const resources = loadResult.library.resources || {};
    console.log('[libraryResourcesLoader] Extracted resources:', resources);

    return {
      success: true,
      resources,
      path: loadResult.path,
    };
  } catch (error) {
    console.error('[libraryResourcesLoader] Exception while loading library:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get the service.name resource from a library.yaml file.
 * This is the primary attribute used for trace routing in dev tools.
 *
 * @param baseDir - The base directory to search for library.yaml
 * @returns Promise<string | null> - The service.name value or null if not found
 *
 * @example
 * ```typescript
 * const serviceName = await getServiceName('/Users/griever/Developer/web-ade/web-ade');
 * if (serviceName) {
 *   console.log('Register for service:', serviceName);
 * }
 * ```
 */
export async function getServiceName(baseDir: string): Promise<string | null> {
  console.log('[libraryResourcesLoader] getServiceName called with baseDir:', baseDir);
  const result = await loadLibraryResources(baseDir);
  console.log('[libraryResourcesLoader] loadLibraryResources result:', {
    success: result.success,
    hasResources: !!result.resources,
    resources: result.resources,
    error: result.error,
    path: result.path,
  });
  if (result.success && result.resources) {
    const serviceName = result.resources['service.name'] || null;
    console.log('[libraryResourcesLoader] Extracted service.name:', serviceName);
    return serviceName;
  }
  console.log('[libraryResourcesLoader] Failed to load service.name, returning null');
  return null;
}

/**
 * @deprecated Use getServiceName() instead. This function will be removed in a future version.
 */
export async function getDevServerUrl(baseDir: string): Promise<string | null> {
  return getServiceName(baseDir);
}

/**
 * Get all OTEL-related resources from a library.yaml file.
 * Includes service.name, service.version, deployment.environment, etc.
 *
 * @param baseDir - The base directory to search for library.yaml
 * @returns Promise<Record<string, string>> - All OTEL resources, or empty object if none found
 *
 * @example
 * ```typescript
 * const resources = await getOtelResources('/Users/griever/Developer/web-ade/web-ade');
 * console.log('Service name:', resources['service.name']);
 * console.log('Service version:', resources['service.version']);
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
