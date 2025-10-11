import type { UnifiedSecureStorage } from '../UnifiedSecureStorage';

export interface SecretMetadata {
  repoId: string;
  repoPath: string;
  createdAt: number;
  updatedAt: number;
  secretCount: number;
}

export interface StoredSecret {
  data: Record<string, any>;
  metadata: SecretMetadata;
}

export class SecretsDomain {
  private auditLog: Array<{
    level: string;
    message: string;
    timestamp: number;
    data?: any;
  }> = [];

  constructor(private storage: UnifiedSecureStorage) {}

  private logAudit(level: string, message: string, data?: any): void {
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

  private validateSecrets(secrets: Record<string, any>): boolean {
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
    secrets: Record<string, any>,
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
    } catch (error: any) {
      this.logAudit('error', 'Failed to store secrets', {
        repoId,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async getSecrets(repoId: string): Promise<Record<string, any> | null> {
    try {
      const data = await this.storage.getData();
      const storedSecret = data.secrets[repoId] as StoredSecret | undefined;

      if (!storedSecret) {
        return null;
      }

      this.logAudit('info', 'Retrieved secrets for repository', { repoId });
      return storedSecret.data;
    } catch (error: any) {
      this.logAudit('error', 'Failed to retrieve secrets', {
        repoId,
        error: error.message,
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
    } catch (error: any) {
      this.logAudit('error', 'Failed to retrieve secrets with metadata', {
        repoId,
        error: error.message,
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
    data?: any;
  }> {
    return [...this.auditLog];
  }
}
