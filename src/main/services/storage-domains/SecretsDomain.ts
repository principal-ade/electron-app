import type { UnifiedSecureStorage } from '../UnifiedSecureStorage';

/** Value of a secret (can be string, number, object, array, etc.) */
export type SecretValue = unknown;

/** Contextual data attached to audit log entries (e.g., repoId, error details) */
type AuditLogData = unknown;

export interface SecretMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  secretCount: number;
}

export interface StoredSecret {
  data: Record<string, SecretValue>;
  metadata: SecretMetadata;
}

export class SecretsDomain {
  private auditLog: Array<{
    level: string;
    message: string;
    timestamp: number;
    data?: AuditLogData;
  }> = [];

  constructor(private storage: UnifiedSecureStorage) {}

  private logAudit(level: string, message: string, data?: AuditLogData): void {
    const entry = {
      level,
      message,
      timestamp: Date.now(),
      data,
    };
    this.auditLog.push(entry);
    console.log(
      `[SecretsDomain Audit] ${level.toUpperCase()}: ${message}`,
      data || '',
    );

    if (this.auditLog.length > 100) {
      this.auditLog = this.auditLog.slice(-50);
    }
  }

  private validateSecrets(secrets: Record<string, SecretValue>): boolean {
    if (!secrets || typeof secrets !== 'object') {
      return false;
    }

    for (const [key, value] of Object.entries(secrets)) {
      if (typeof key !== 'string' || key.length === 0) {
        return false;
      }
      if (value === undefined) {
        return false;
      }
    }

    return true;
  }

  async storeSecrets(
    repoId: string,
    repoPath: string,
    secrets: Record<string, SecretValue>,
  ): Promise<{ success: boolean; error?: string; metadata?: SecretMetadata }> {
    try {
      if (!this.validateSecrets(secrets)) {
        return { success: false, error: 'Invalid secrets format' };
      }

      const metadata: SecretMetadata = {
        repoId,
        repoPath,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        secretCount: Object.keys(secrets).length,
      };

      await this.storage.updateData((data) => {
        const existingSecret = data.secrets[repoId] as StoredSecret | undefined;

        if (existingSecret) {
          metadata.createdAt = existingSecret.metadata.createdAt;
          // Preserve repoPath if not provided (for updates)
          if (!repoPath && existingSecret.metadata.repoPath) {
            metadata.repoPath = existingSecret.metadata.repoPath;
          }
        }

        data.secrets[repoId] = {
          data: secrets,
          metadata,
        };

        return data;
      });

      this.logAudit(
        'info',
        `Stored ${metadata.secretCount} secrets for repository`,
        { repoId },
      );

      return { success: true, metadata };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logAudit('error', 'Failed to store secrets', {
        repoId,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  async getSecrets(repoId: string): Promise<Record<string, SecretValue> | null> {
    try {
      const data = await this.storage.getData();
      const storedSecret = data.secrets[repoId] as StoredSecret | undefined;

      if (!storedSecret) {
        return null;
      }

      this.logAudit('info', 'Retrieved secrets for repository', { repoId });
      return storedSecret.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logAudit('error', 'Failed to retrieve secrets', {
        repoId,
        error: errorMessage,
      });
      return null;
    }
  }

  async getSecretsWithMetadata(repoId: string): Promise<StoredSecret | null> {
    try {
      const data = await this.storage.getData();
      const storedSecret = data.secrets[repoId] as StoredSecret | undefined;

      if (!storedSecret) {
        return null;
      }

      return storedSecret;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logAudit('error', 'Failed to retrieve secrets with metadata', {
        repoId,
        error: errorMessage,
      });
      return null;
    }
  }

  async deleteSecrets(repoId: string): Promise<void> {
    await this.storage.updateData((data) => {
      delete data.secrets[repoId];
      this.logAudit('info', 'Deleted secrets for repository', { repoId });
      return data;
    });
  }

  async hasSecrets(repoId: string): Promise<boolean> {
    const data = await this.storage.getData();
    return repoId in data.secrets;
  }

  async getAllRepoIds(): Promise<string[]> {
    const data = await this.storage.getData();
    return Object.keys(data.secrets);
  }

  async getAllMetadata(): Promise<SecretMetadata[]> {
    const data = await this.storage.getData();
    return Object.values(data.secrets).map(
      (secret) => (secret as StoredSecret).metadata,
    );
  }

  async clearAll(): Promise<void> {
    await this.storage.updateData((data) => {
      data.secrets = {};
      this.logAudit('info', 'Cleared all secrets');
      return data;
    });
  }

  getAuditLog(): Array<{
    level: string;
    message: string;
    timestamp: number;
    data?: AuditLogData;
  }> {
    return [...this.auditLog];
  }
}
