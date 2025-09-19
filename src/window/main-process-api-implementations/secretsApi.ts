import { ipcRenderer } from 'electron';
import {
  SecretsAPI,
  SecretsEvents,
  SecretStoreRequest,
  SecretOperationResult,
  RepositorySecrets,
  SecretMetadata,
} from '../../shared/main-process-api-interfaces/SecretsAPI';

export const secretsAPI: SecretsAPI = {
  store: (request: SecretStoreRequest): Promise<SecretOperationResult> => {
    return ipcRenderer.invoke(SecretsEvents.STORE, request);
  },

  get: (repoId: string): Promise<RepositorySecrets | null> => {
    return ipcRenderer.invoke(SecretsEvents.GET, repoId);
  },

  delete: (repoId: string): Promise<SecretOperationResult> => {
    return ipcRenderer.invoke(SecretsEvents.DELETE, repoId);
  },

  exists: (repoId: string): Promise<boolean> => {
    return ipcRenderer.invoke(SecretsEvents.EXISTS, repoId);
  },

  list: (): Promise<SecretMetadata[]> => {
    return ipcRenderer.invoke(SecretsEvents.LIST);
  },

  update: (request: SecretStoreRequest): Promise<SecretOperationResult> => {
    return ipcRenderer.invoke(SecretsEvents.UPDATE, request);
  },

  removeKeys: (
    repoId: string,
    keys: string[],
  ): Promise<SecretOperationResult> => {
    return ipcRenderer.invoke(SecretsEvents.REMOVE_KEYS, repoId, keys);
  },

  clearCache: (): Promise<void> => {
    return ipcRenderer.invoke(SecretsEvents.CLEAR_CACHE);
  },
};
