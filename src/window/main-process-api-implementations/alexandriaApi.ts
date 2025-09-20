import { ipcRenderer } from 'electron';
import type {
  AlexandriaAPI,
  AlexandriaChangeEvent,
} from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import {
  AlexandriaAPIEvent,
  AlexandriaEventType,
} from '../../shared/main-process-api-interfaces/AlexandriaAPI';
import type { AlexandriaEntry } from '@a24z/core-library';

export const alexandriaAPI: AlexandriaAPI = {
  onRepositoryChange: (callback: (event: AlexandriaChangeEvent) => void) => {
    // Create IPC listener functions
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

    // Register listeners
    ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_ADDED, handleAdded);
    ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_UPDATED, handleUpdated);
    ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_REMOVED, handleRemoved);

    // Return unsubscribe function
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
  getRepositories: () => ipcRenderer.invoke(AlexandriaAPIEvent.GET_ALL),
  getRepository: (name: string) =>
    ipcRenderer.invoke(AlexandriaAPIEvent.GET, name),
  getRepositoryByPath: (path: string) =>
    ipcRenderer.invoke(AlexandriaAPIEvent.GET_BY_PATH, path),
  registerRepository: (name: string, path: string) =>
    ipcRenderer.invoke(AlexandriaAPIEvent.REGISTER, name, path),
  removeRepository: (name: string, deleteLocal?: boolean) =>
    ipcRenderer.invoke(AlexandriaAPIEvent.REMOVE, name, deleteLocal),
  searchRepositories: (query: string) =>
    ipcRenderer.invoke(AlexandriaAPIEvent.SEARCH, query),
  getRepositoriesWithViews: () =>
    ipcRenderer.invoke(AlexandriaAPIEvent.GET_WITH_VIEWS),
  refreshRepository: (name: string) =>
    ipcRenderer.invoke(AlexandriaAPIEvent.REFRESH, name),
  getRepositoryCount: () => ipcRenderer.invoke(AlexandriaAPIEvent.GET_COUNT),
};
