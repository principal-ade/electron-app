/**
 * Service layer for Secrets management functionality
 * ALL window.mainProcess.secrets calls MUST be encapsulated here
 */

import type {
  RepositorySecrets,
  SecretMetadata,
  SecretStoreRequest,
  SecretOperationResult,
  SecretMetadataOnly,
  CopyResult,
} from '../../shared/main-process-api-interfaces/SecretsAPI';

export class SecretsService {
  /**
   * Store a secret
   */
  static async store(
    request: SecretStoreRequest,
  ): Promise<SecretOperationResult> {
    return window.mainProcess.secrets.store(request);
  }

  /**
   * Delete a secret
   */
  static async delete(repoId: string): Promise<SecretOperationResult> {
    return window.mainProcess.secrets.delete(repoId);
  }

  /**
   * List all secret metadata (without values)
   */
  static async list(): Promise<SecretMetadata[]> {
    return window.mainProcess.secrets.list();
  }

  /**
   * Check if a secret exists
   */
  static async exists(repoId: string): Promise<boolean> {
    return window.mainProcess.secrets.exists(repoId);
  }

  /**
   * Update existing secrets (merge with existing)
   */
  static async update(
    request: SecretStoreRequest,
  ): Promise<SecretOperationResult> {
    return window.mainProcess.secrets.update(request);
  }

  /**
   * Get only metadata and keys for a repository (no values)
   */
  static async getMetadata(repoId: string): Promise<SecretMetadataOnly | null> {
    return window.mainProcess.secrets.getMetadata(repoId);
  }

  /**
   * Get a single secret value on demand
   */
  static async getSingle(repoId: string, key: string): Promise<string | null> {
    return window.mainProcess.secrets.getSingle(repoId, key);
  }

  /**
   * Get multiple specific secret values
   */
  static async getMultiple(
    repoId: string,
    keys: string[],
  ): Promise<Record<string, string>> {
    return window.mainProcess.secrets.getMultiple(repoId, keys);
  }

  /**
   * Copy a secret directly to clipboard without exposing it to renderer
   * The value never enters the renderer process memory
   */
  static async copyToClipboard(
    repoId: string,
    key: string,
  ): Promise<CopyResult> {
    return window.mainProcess.secrets.copyToClipboard(repoId, key);
  }
}
