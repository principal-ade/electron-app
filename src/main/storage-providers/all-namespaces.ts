/**
 * All Storage Namespaces
 *
 * This module defines all known storage namespaces
 */

import {
  StaticNamespaces,
  StorageNamespaces as SharedStorageNamespaces,
} from '../../shared/types/namespaces.types';

/**
 * Re-export the StorageNamespaces type from shared
 */
export type StorageNamespaces = SharedStorageNamespaces;

/**
 * Get all valid namespaces as an array
 */
export function getAllNamespaces(): StorageNamespaces[] {
  return Object.values(StaticNamespaces) as StorageNamespaces[];
}

/**
 * Re-export type guards from shared
 */
export {
  isStaticNamespace,
  isValidNamespace,
} from '../../shared/types/namespaces.types';
