/**
 * Storage Namespace Types
 *
 * This file contains the namespace type definitions that are shared between
 * the main and renderer processes.
 */

/**
 * Static/predefined storage namespaces used throughout the application
 * These are the core namespaces that are always available.
 */
export enum StaticNamespaces {
  USER_PREFERENCES = 'user-preferences',
  CACHE = 'cache',
  TEMP = 'temp',

  // Docker Management
  DOCKER_CONTAINERS = 'docker-containers',
  DOCKER_SESSIONS = 'docker-sessions',

  // Secrets Management
  SECRETS_METADATA = 'secrets-metadata',

  // Links Management
  REPOSITORY_LINKS = 'repository-links',
}

/**
 * Type alias for all storage namespaces
 */
export type StorageNamespaces = StaticNamespaces;

/**
 * Type guard to check if a string is a valid static namespace
 */
export function isStaticNamespace(
  namespace: string,
): namespace is StaticNamespaces {
  return Object.values(StaticNamespaces).includes(
    namespace as StaticNamespaces,
  );
}

/**
 * Type guard to check if a string is any valid namespace
 * Currently only static namespaces are supported.
 */
export function isValidNamespace(
  namespace: string,
): namespace is StorageNamespaces {
  return isStaticNamespace(namespace);
}
