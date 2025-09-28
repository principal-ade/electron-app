/**
 * Secrets API Interface
 * Manages encrypted environment variables and secrets for repositories
 */

export interface RepositorySecrets {
  [key: string]: string;
}

export interface SecretMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  secretCount: number;
}

export interface SecretMetadataOnly {
  keys: string[];
  count: number;
  updatedAt: number;
  repoId: string;
}

export interface CopyResult {
  success: boolean;
  error?: string;
}

export interface SecretOperationResult {
  success: boolean;
  error?: string;
  metadata?: SecretMetadata;
}

export interface SecretStoreRequest {
  repoId: string;
  repoPath: string;
  secrets: RepositorySecrets;
}

/**
 * IPC event channels for secrets management
 */
export enum SecretsEvents {
  // Core operations
  STORE = 'secrets:store',
  DELETE = 'secrets:delete',
  EXISTS = 'secrets:exists',
  LIST = 'secrets:list',

  // On-demand operations
  GET_METADATA = 'secrets:get-metadata',
  GET_SINGLE = 'secrets:get-single',
  GET_MULTIPLE = 'secrets:get-multiple',
  COPY_TO_CLIPBOARD = 'secrets:copy-to-clipboard',

  // Bulk operations
  UPDATE = 'secrets:update',
  REMOVE_KEYS = 'secrets:remove-keys',

  // Maintenance
  CLEAR_CACHE = 'secrets:clear-cache',
}

/**
 * Secrets management API
 */
export interface SecretsAPI {
  /**
   * Store secrets for a repository
   */
  store: (request: SecretStoreRequest) => Promise<SecretOperationResult>;

  /**
   * Delete all secrets for a repository
   */
  delete: (repoId: string) => Promise<SecretOperationResult>;

  /**
   * Check if secrets exist for a repository
   */
  exists: (repoId: string) => Promise<boolean>;

  /**
   * List metadata for all stored secrets
   */
  list: () => Promise<SecretMetadata[]>;

  /**
   * Update existing secrets (merge with existing)
   */
  update: (request: SecretStoreRequest) => Promise<SecretOperationResult>;

  /**
   * Remove specific secret keys from a repository
   */
  removeKeys: (
    repoId: string,
    keys: string[],
  ) => Promise<SecretOperationResult>;

  /**
   * Clear all in-memory caches
   */
  clearCache: () => Promise<void>;

  /**
   * Get only metadata and keys for a repository (no values)
   */
  getMetadata: (repoId: string) => Promise<SecretMetadataOnly | null>;

  /**
   * Get a single secret value on demand
   */
  getSingle: (repoId: string, key: string) => Promise<string | null>;

  /**
   * Get multiple specific secret values
   */
  getMultiple: (repoId: string, keys: string[]) => Promise<Record<string, string>>;

  /**
   * Copy a secret directly to clipboard without exposing it to renderer
   */
  copyToClipboard: (repoId: string, key: string) => Promise<CopyResult>;
}
