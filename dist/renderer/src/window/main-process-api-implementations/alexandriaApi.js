import { ipcRenderer } from 'electron';
import { AlexandriaAPIEvent, AlexandriaEventType } from '../../shared/main-process-api-interfaces/AlexandriaAPI';
export const alexandriaAPI = {
    onRepositoryChange: (callback) => {
        // Create IPC listener functions
        const handleAdded = (_event, data) => {
            callback({ type: AlexandriaEventType.ADDED, repository: data });
        };
        const handleUpdated = (_event, data) => {
            callback({ type: AlexandriaEventType.UPDATED, repository: data });
        };
        const handleRemoved = (_event, data) => {
            callback({ type: AlexandriaEventType.REMOVED, name: data.name });
        };
        // Register listeners
        ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_ADDED, handleAdded);
        ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_UPDATED, handleUpdated);
        ipcRenderer.on(AlexandriaAPIEvent.REPOSITORY_REMOVED, handleRemoved);
        // Return unsubscribe function
        return () => {
            ipcRenderer.removeListener(AlexandriaAPIEvent.REPOSITORY_ADDED, handleAdded);
            ipcRenderer.removeListener(AlexandriaAPIEvent.REPOSITORY_UPDATED, handleUpdated);
            ipcRenderer.removeListener(AlexandriaAPIEvent.REPOSITORY_REMOVED, handleRemoved);
        };
    },
    getRepositories: () => ipcRenderer.invoke(AlexandriaAPIEvent.GET_ALL),
    getRepository: (name) => ipcRenderer.invoke(AlexandriaAPIEvent.GET, name),
    getRepositoryByPath: (path) => ipcRenderer.invoke(AlexandriaAPIEvent.GET_BY_PATH, path),
    registerRepository: (name, path) => ipcRenderer.invoke(AlexandriaAPIEvent.REGISTER, name, path),
    removeRepository: (name) => ipcRenderer.invoke(AlexandriaAPIEvent.REMOVE, name),
    searchRepositories: (query) => ipcRenderer.invoke(AlexandriaAPIEvent.SEARCH, query),
    getRepositoriesWithViews: () => ipcRenderer.invoke(AlexandriaAPIEvent.GET_WITH_VIEWS),
    refreshRepository: (name) => ipcRenderer.invoke(AlexandriaAPIEvent.REFRESH, name),
    getRepositoryCount: () => ipcRenderer.invoke(AlexandriaAPIEvent.GET_COUNT),
};
