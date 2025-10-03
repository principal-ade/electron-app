import { UserPreferences } from '../../shared/types/userPreferences.types';

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
        new CustomEvent<UserPreferences>('user-preferences-updated', {
          detail: updated,
        }),
      );
    } catch (error) {
      console.error('Error saving user preferences to electron store:', error);
    }
  }
}
