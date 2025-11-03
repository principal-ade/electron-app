import type { UnifiedSecureStorage } from '../UnifiedSecureStorage';

export interface TokenMetadata {
  [key: string]: unknown;
}

export interface TokenData {
  token: string;
  metadata?: TokenMetadata;
  savedAt: number;
}

export class TokenDomain {
  constructor(private storage: UnifiedSecureStorage) {}

  async setToken(
    key: string,
    token: string,
    metadata?: TokenMetadata,
  ): Promise<void> {
    await this.storage.updateData((data) => {
      data.tokens[key] = {
        token,
        metadata: metadata || {},
        savedAt: Date.now(),
      };
      console.log(`[TokenDomain] Stored token: ${key}`);
      return data;
    });
  }

  async getToken(key: string): Promise<string | null> {
    const data = await this.storage.getData();
    const tokenData = data.tokens[key] as TokenData | undefined;

    if (!tokenData) {
      return null;
    }

    return tokenData.token;
  }

  async getTokenWithMetadata(
    key: string,
  ): Promise<{ token: string; metadata?: TokenMetadata } | null> {
    const data = await this.storage.getData();
    const tokenData = data.tokens[key] as TokenData | undefined;

    if (!tokenData) {
      return null;
    }

    return {
      token: tokenData.token,
      metadata: tokenData.metadata,
    };
  }

  async deleteToken(key: string): Promise<void> {
    await this.storage.updateData((data) => {
      delete data.tokens[key];
      console.log(`[TokenDomain] Deleted token: ${key}`);
      return data;
    });
  }

  async hasToken(key: string): Promise<boolean> {
    const data = await this.storage.getData();
    return key in data.tokens;
  }

  async getAllKeys(): Promise<string[]> {
    const data = await this.storage.getData();
    return Object.keys(data.tokens);
  }

  async clearAll(): Promise<void> {
    await this.storage.updateData((data) => {
      data.tokens = {};
      console.log('[TokenDomain] Cleared all tokens');
      return data;
    });
  }
}
