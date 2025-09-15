import { A24zAPI } from "../../shared/main-process-api-interfaces/A24zAPI";
import { ipcRenderer } from "electron";

export enum A24zAPIEvents {
  GET_ALL_NOTES = 'a24z:getAllNotes',
  GET_NOTES_FOR_PATH = 'a24z:getNotesForPath',
  HAS_A24Z_DIRECTORY = 'a24z:hasA24zDirectory',
  GET_NOTE_COUNT = 'a24z:getNoteCount',
}

export const a24zAPI: A24zAPI = {
  getAllNotes: async (repositoryPath: string) => {
    return await ipcRenderer.invoke(A24zAPIEvents.GET_ALL_NOTES, repositoryPath);
  },
  getNotesForPath: async (filePath: string, repositoryPath: string) => {
    return await ipcRenderer.invoke(A24zAPIEvents.GET_NOTES_FOR_PATH, filePath, repositoryPath);
  },
  hasA24zDirectory: async (repositoryPath: string) => {
    return await ipcRenderer.invoke(A24zAPIEvents.HAS_A24Z_DIRECTORY, repositoryPath);
  },
  getNoteCount: async (repositoryPath: string) => {
    return await ipcRenderer.invoke(A24zAPIEvents.GET_NOTE_COUNT, repositoryPath);
  },
};