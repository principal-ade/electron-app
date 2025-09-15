import { UserPreferencesAPI, UserPreferencesAPIEvents } from "../../shared/main-process-api-interfaces/UserPreferencesAPI";
import { UserPreferences } from "../../shared/types/userPreferences.types";
import { ipcRenderer } from "electron";

export const userPreferencesAPI: UserPreferencesAPI = {
  getPreferences: async () => {
    return await ipcRenderer.invoke(UserPreferencesAPIEvents.GET_PREFERENCES);
  },
  updatePreferences: async (updates: Partial<UserPreferences>) => {
    return await ipcRenderer.invoke(UserPreferencesAPIEvents.UPDATE_PREFERENCES, updates);
  },
};
