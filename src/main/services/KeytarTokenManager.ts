import keytar from 'keytar';

const KEYTAR_SERVICE = 'com.principal-ade.electron-app';

interface StoredTokenValue {
  token: string;
  metadata?: Record<string, unknown>;
  savedAt: number;
}

export class KeytarTokenManager {
  async setToken(
    key: string,
    token: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const value: StoredTokenValue = {
      token,
      metadata,
      savedAt: Date.now(),
    };
    await keytar.setPassword(KEYTAR_SERVICE, key, JSON.stringify(value));
  }

  async getToken(key: string): Promise<string | null> {
    const raw = await keytar.getPassword(KEYTAR_SERVICE, key);
    if (!raw) return null;
    const parsed: StoredTokenValue = JSON.parse(raw);
    return parsed.token;
  }

  async getTokenWithMetadata(
    key: string,
  ): Promise<{ token: string; metadata?: Record<string, unknown> } | null> {
    const raw = await keytar.getPassword(KEYTAR_SERVICE, key);
    if (!raw) return null;
    const parsed: StoredTokenValue = JSON.parse(raw);
    return { token: parsed.token, metadata: parsed.metadata };
  }

  async deleteToken(key: string): Promise<boolean> {
    return keytar.deletePassword(KEYTAR_SERVICE, key);
  }

  async hasToken(key: string): Promise<boolean> {
    const value = await keytar.getPassword(KEYTAR_SERVICE, key);
    return value !== null;
  }

  async getAllKeys(): Promise<string[]> {
    const creds = await keytar.findCredentials(KEYTAR_SERVICE);
    return creds.map((c) => c.account);
  }

  async clearAll(): Promise<void> {
    const creds = await keytar.findCredentials(KEYTAR_SERVICE);
    await Promise.all(
      creds.map((c) => keytar.deletePassword(KEYTAR_SERVICE, c.account)),
    );
  }
}
