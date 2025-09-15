import { ipcRenderer } from 'electron';
export const knipAPI = {
    checkAvailability: () => {
        return ipcRenderer.invoke('knip:check-availability');
    },
    runAnalysis: (directoryPath) => {
        return ipcRenderer.invoke('knip:run-analysis', directoryPath);
    },
};
