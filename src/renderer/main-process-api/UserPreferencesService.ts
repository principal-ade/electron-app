import { UserPreferences } from '../../shared/types/userPreferences.types';

const USER_PREFERENCES_UPDATED_EVENT = 'user-preferences-updated';

// Subscribe to main process preference changes (e.g., from HTTP API)
// This bridges IPC notifications to the local CustomEvent system
if (typeof window !== 'undefined' && window.mainProcess?.userPreferences?.onPreferencesChanged) {
  window.mainProcess.userPreferences.onPreferencesChanged((preferences) => {
    console.info('[UserPreferencesService] Preferences changed from main process');
    window.dispatchEvent(
      new CustomEvent<UserPreferences>(USER_PREFERENCES_UPDATED_EVENT, {
        detail: preferences,
      }),
    );
  });
}

export class UserPreferencesService {
  static async getPreferences(): Promise<UserPreferences> {
    try {
      const preferences =
        await window.mainProcess.userPreferences.getPreferences();
      if (preferences && typeof preferences === 'object') {
        return { ...preferences };
      }
    } catch (error) {
      console.error(
        'Error reading user preferences from electron store:',
        error,
      );
    }
    return {};
  }

  static async updatePreferences(
    updates: Partial<UserPreferences>,
  ): Promise<void> {
    try {
      await window.mainProcess.userPreferences.updatePreferences(updates);
      const updated = await this.getPreferences();
      window.dispatchEvent(
        new CustomEvent<UserPreferences>(USER_PREFERENCES_UPDATED_EVENT, {
          detail: updated,
        }),
      );
    } catch (error) {
      console.error('Error saving user preferences to electron store:', error);
    }
  }

  static onPreferencesUpdated(
    callback: (preferences: UserPreferences) => void,
  ): () => void {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<UserPreferences>;
      callback(customEvent.detail);
    };

    window.addEventListener(USER_PREFERENCES_UPDATED_EVENT, handler);

    return () => {
      window.removeEventListener(USER_PREFERENCES_UPDATED_EVENT, handler);
    };
  }
}
