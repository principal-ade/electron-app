import { ipcRenderer } from "electron";
export var A24zAPIEvents;
(function (A24zAPIEvents) {
    A24zAPIEvents["GET_ALL_NOTES"] = "a24z:getAllNotes";
    A24zAPIEvents["GET_NOTES_FOR_PATH"] = "a24z:getNotesForPath";
    A24zAPIEvents["HAS_A24Z_DIRECTORY"] = "a24z:hasA24zDirectory";
    A24zAPIEvents["GET_NOTE_COUNT"] = "a24z:getNoteCount";
})(A24zAPIEvents || (A24zAPIEvents = {}));
export const a24zAPI = {
    getAllNotes: async (repositoryPath) => {
        return await ipcRenderer.invoke(A24zAPIEvents.GET_ALL_NOTES, repositoryPath);
    },
    getNotesForPath: async (filePath, repositoryPath) => {
        return await ipcRenderer.invoke(A24zAPIEvents.GET_NOTES_FOR_PATH, filePath, repositoryPath);
    },
    hasA24zDirectory: async (repositoryPath) => {
        return await ipcRenderer.invoke(A24zAPIEvents.HAS_A24Z_DIRECTORY, repositoryPath);
    },
    getNoteCount: async (repositoryPath) => {
        return await ipcRenderer.invoke(A24zAPIEvents.GET_NOTE_COUNT, repositoryPath);
    },
};
