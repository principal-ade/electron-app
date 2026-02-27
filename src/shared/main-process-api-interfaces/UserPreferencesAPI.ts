import { UserPreferences } from '../../shared/types/userPreferences.types';

export enum UserPreferencesAPIEvents {
  GET_PREFERENCES = 'userPreferences:getPreferences',
  UPDATE_PREFERENCES = 'userPreferences:updatePreferences',
  // Notification from main process when preferences change externally
  PREFERENCES_CHANGED = 'userPreferences:changed',
}

export interface UserPreferencesAPI {
  getPreferences: () => Promise<UserPreferences>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  /** Subscribe to preferences changes from main process (e.g., via HTTP API) */
  onPreferencesChanged: (
    callback: (preferences: UserPreferences) => void,
  ) => () => void;
}
