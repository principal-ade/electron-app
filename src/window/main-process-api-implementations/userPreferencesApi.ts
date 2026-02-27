import {
  UserPreferencesAPI,
  UserPreferencesAPIEvents,
} from '../../shared/main-process-api-interfaces/UserPreferencesAPI';
import { UserPreferences } from '../../shared/types/userPreferences.types';
import { ipcRenderer, IpcRendererEvent } from 'electron';

export const userPreferencesAPI: UserPreferencesAPI = {
  getPreferences: async () => {
    return await ipcRenderer.invoke(UserPreferencesAPIEvents.GET_PREFERENCES);
  },
  updatePreferences: async (updates: Partial<UserPreferences>) => {
    return await ipcRenderer.invoke(
      UserPreferencesAPIEvents.UPDATE_PREFERENCES,
      updates,
    );
  },
  onPreferencesChanged: (callback: (preferences: UserPreferences) => void) => {
    const subscription = (
      _event: IpcRendererEvent,
      preferences: UserPreferences,
    ) => {
      callback(preferences);
    };
    ipcRenderer.on(UserPreferencesAPIEvents.PREFERENCES_CHANGED, subscription);
    return () => {
      ipcRenderer.removeListener(
        UserPreferencesAPIEvents.PREFERENCES_CHANGED,
        subscription,
      );
    };
  },
};
