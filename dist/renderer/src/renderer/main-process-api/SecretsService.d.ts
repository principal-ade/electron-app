/**
 * Service layer for Secrets management functionality
 * ALL window.mainProcess.secrets calls MUST be encapsulated here
 */
import type { RepositorySecrets, SecretMetadata, SecretStoreRequest, SecretOperationResult } from '../../shared/main-process-api-interfaces/SecretsAPI';
export declare class SecretsService {
    /**
     * Get a secret by key
     */
    static get(repoId: string): Promise<RepositorySecrets | null>;
    /**
     * Store a secret
     */
    static store(request: SecretStoreRequest): Promise<SecretOperationResult>;
    /**
     * Delete a secret
     */
    static delete(repoId: string): Promise<SecretOperationResult>;
    /**
     * List all secret metadata (without values)
     */
    static list(): Promise<SecretMetadata[]>;
    /**
     * Check if a secret exists
     */
    static exists(repoId: string): Promise<boolean>;
    /**
     * Update existing secrets (merge with existing)
     */
    static update(request: SecretStoreRequest): Promise<SecretOperationResult>;
}
//# sourceMappingURL=SecretsService.d.ts.map