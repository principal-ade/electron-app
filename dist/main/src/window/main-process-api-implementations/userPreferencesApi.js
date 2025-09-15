import { UserPreferencesAPIEvents } from "../../shared/main-process-api-interfaces/UserPreferencesAPI";
import { ipcRenderer } from "electron";
export const userPreferencesAPI = {
    getPreferences: async () => {
        return await ipcRenderer.invoke(UserPreferencesAPIEvents.GET_PREFERENCES);
    },
    updatePreferences: async (updates) => {
        return await ipcRenderer.invoke(UserPreferencesAPIEvents.UPDATE_PREFERENCES, updates);
    },
};
