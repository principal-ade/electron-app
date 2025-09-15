/**
 * Service layer for Secrets management functionality
 * ALL window.mainProcess.secrets calls MUST be encapsulated here
 */

import type {
  RepositorySecrets,
  SecretMetadata,
  SecretStoreRequest,
  SecretOperationResult
} from '../../shared/main-process-api-interfaces/SecretsAPI';

export class SecretsService {
  /**
   * Get a secret by key
   */
  static async get(repoId: string): Promise<RepositorySecrets | null> {
    return window.mainProcess.secrets.get(repoId);
  }

  /**
   * Store a secret
   */
  static async store(request: SecretStoreRequest): Promise<SecretOperationResult> {
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
  static async update(request: SecretStoreRequest): Promise<SecretOperationResult> {
    return window.mainProcess.secrets.update(request);
  }
}