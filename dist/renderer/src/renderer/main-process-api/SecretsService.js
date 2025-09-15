/**
 * Service layer for Secrets management functionality
 * ALL window.mainProcess.secrets calls MUST be encapsulated here
 */
export class SecretsService {
    /**
     * Get a secret by key
     */
    static async get(repoId) {
        return window.mainProcess.secrets.get(repoId);
    }
    /**
     * Store a secret
     */
    static async store(request) {
        return window.mainProcess.secrets.store(request);
    }
    /**
     * Delete a secret
     */
    static async delete(repoId) {
        return window.mainProcess.secrets.delete(repoId);
    }
    /**
     * List all secret metadata (without values)
     */
    static async list() {
        return window.mainProcess.secrets.list();
    }
    /**
     * Check if a secret exists
     */
    static async exists(repoId) {
        return window.mainProcess.secrets.exists(repoId);
    }
    /**
     * Update existing secrets (merge with existing)
     */
    static async update(request) {
        return window.mainProcess.secrets.update(request);
    }
}
