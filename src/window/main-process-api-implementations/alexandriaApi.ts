/**
 * Alexandria API implementation for preload scripts
 *
 * Uses TIPC for type-safe RPC calls and legacy IPC for event subscriptions.
 * Method names are prefixed with 'alexandria_' to avoid collisions with other routers.
 */

import { ipcRenderer } from 'electron';
import type {
  AlexandriaAPI,
  AlexandriaChangeEvent,
} from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import {
  AlexandriaAPIEvent,
  AlexandriaEventType,
} from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library';

/**
 * TIPC-based invoke helper
 * Uses prefixed method names to match the router
 */
const tipcInvoke = <T>(method: string, input?: unknown): Promise<T> => {
  return ipcRenderer.invoke(`alexandria_${method}`, input);
};

export const alexandriaAPI: AlexandriaAPI = {
  // Event subscriptions still use legacy IPC (TIPC doesn't support events)
  onRepositoryChange: (callback: (event: AlexandriaChangeEvent) => void) => {
    const handleAdded = (
      _event: Electron.IpcRendererEvent,
      data: AlexandriaEntry,
    ) => {
      callback({ type: AlexandriaEventType.ADDED, repository: data });
    };
    const handleUpdated = (
      _event: Electron.IpcRendererEvent,
      data: AlexandriaEntry,
    ) => {
      callback({ type: AlexandriaEventType.UPDATED, repository: data });
    };
    const handleRemoved = (
      _event: Electron.IpcRendererEvent,
      data: { name: string },
    ) => {
      callback({ type: AlexandriaEventType.REMOVED, name: data.name });
    };

    ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_ADDED, handleAdded);
    ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_UPDATED, handleUpdated);
    ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_REMOVED, handleRemoved);

    return () => {
      ipcRenderer.removeListener(
        AlexandriaAPIEvent.REPOSITORY_ADDED,
        handleAdded,
      );
      ipcRenderer.removeListener(
        AlexandriaAPIEvent.REPOSITORY_UPDATED,
        handleUpdated,
      );
      ipcRenderer.removeListener(
        AlexandriaAPIEvent.REPOSITORY_REMOVED,
        handleRemoved,
      );
    };
  },

  // All RPC calls use TIPC router methods (with alexandria_ prefix)
  getRepositories: () => tipcInvoke('getRepositories'),

  getRepository: (name: string) => tipcInvoke('getRepository', { name }),

  getRepositoryByPath: (path: string) =>
    tipcInvoke('getRepositoryByPath', { path }),

  registerRepository: (name: string, path: string) =>
    tipcInvoke('registerRepository', { name, path }),

  removeRepository: (name: string, deleteLocal?: boolean) =>
    tipcInvoke('removeRepository', { name, deleteLocal }),

  searchRepositories: (query: string) =>
    tipcInvoke('searchRepositories', { query }),

  getRepositoriesWithViews: () => tipcInvoke('getRepositoriesWithViews'),

  refreshRepository: (name: string) =>
    tipcInvoke('refreshRepository', { name }),

  updateLastOpened: (name: string) =>
    tipcInvoke('updateLastOpened', { name }),

  getRepositoryCount: () => tipcInvoke('getRepositoryCount'),

  getCodebaseViews: (repositoryPath: string) =>
    tipcInvoke('getCodebaseViews', { repositoryPath }),

  getCodebaseView: (repositoryPath: string, viewId: string) =>
    tipcInvoke('getCodebaseView', { repositoryPath, viewId }),
};
