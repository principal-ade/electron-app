import { ipcRenderer } from 'electron';
import {
  SecretsAPI,
  SecretsEvents,
  SecretStoreRequest,
  SecretOperationResult,
  SecretMetadata,
  SecretMetadataOnly,
  CopyResult,
} from '../../shared/main-process-api-interfaces/SecretsAPI';

export const secretsAPI: SecretsAPI = {
  store: (request: SecretStoreRequest): Promise<SecretOperationResult> => {
    return ipcRenderer.invoke(SecretsEvents.STORE, request);
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

  getMetadata: (repoId: string): Promise<SecretMetadataOnly | null> => {
    return ipcRenderer.invoke(SecretsEvents.GET_METADATA, repoId);
  },

  getSingle: (repoId: string, key: string): Promise<string | null> => {
    return ipcRenderer.invoke(SecretsEvents.GET_SINGLE, repoId, key);
  },

  getMultiple: (repoId: string, keys: string[]): Promise<Record<string, string>> => {
    return ipcRenderer.invoke(SecretsEvents.GET_MULTIPLE, repoId, keys);
  },

  copyToClipboard: (repoId: string, key: string): Promise<CopyResult> => {
    return ipcRenderer.invoke(SecretsEvents.COPY_TO_CLIPBOARD, repoId, key);
  },
};
