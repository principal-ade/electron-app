import { ipcRenderer } from 'electron';
import { ViolationEvents } from '../../shared/main-process-api-interfaces/ViolationsAPI';
export const violationsAPI = {
    collect: async (sourcePath, packages, options) => {
        return ipcRenderer.invoke(ViolationEvents.COLLECT, sourcePath, packages, options);
    },
    clearCache: async (sourcePath) => {
        return ipcRenderer.invoke(ViolationEvents.CLEAR_CACHE, sourcePath);
    }
};
