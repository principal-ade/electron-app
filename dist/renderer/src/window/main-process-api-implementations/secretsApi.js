import { ipcRenderer } from 'electron';
import { SecretsEvents, } from '../../shared/main-process-api-interfaces/SecretsAPI';
export const secretsAPI = {
    store: (request) => {
        return ipcRenderer.invoke(SecretsEvents.STORE, request);
    },
    get: (repoId) => {
        return ipcRenderer.invoke(SecretsEvents.GET, repoId);
    },
    delete: (repoId) => {
        return ipcRenderer.invoke(SecretsEvents.DELETE, repoId);
    },
    exists: (repoId) => {
        return ipcRenderer.invoke(SecretsEvents.EXISTS, repoId);
    },
    list: () => {
        return ipcRenderer.invoke(SecretsEvents.LIST);
    },
    update: (request) => {
        return ipcRenderer.invoke(SecretsEvents.UPDATE, request);
    },
    removeKeys: (repoId, keys) => {
        return ipcRenderer.invoke(SecretsEvents.REMOVE_KEYS, repoId, keys);
    },
    clearCache: () => {
        return ipcRenderer.invoke(SecretsEvents.CLEAR_CACHE);
    },
};
