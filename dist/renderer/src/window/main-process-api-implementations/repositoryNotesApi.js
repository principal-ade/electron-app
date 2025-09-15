import { ipcRenderer } from 'electron';
import { RepositoryNotesAPIEvent } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
export const repositoryNotesApi = {
    getNotesForRepository: (remoteUrl) => ipcRenderer.invoke(RepositoryNotesAPIEvent.GET_FOR_REPOSITORY, remoteUrl),
    getNotesForPath: (path, includeParentNotes = true) => ipcRenderer.invoke(RepositoryNotesAPIEvent.GET_FOR_PATH, path, includeParentNotes),
    storeNote: (request) => ipcRenderer.invoke(RepositoryNotesAPIEvent.STORE_NOTE, request),
    deleteNote: (remoteUrl, noteId) => ipcRenderer.invoke(RepositoryNotesAPIEvent.DELETE_NOTE, remoteUrl, noteId),
    updateNote: (remoteUrl, noteId, updates) => ipcRenderer.invoke(RepositoryNotesAPIEvent.UPDATE_NOTE, remoteUrl, noteId, updates)
};
