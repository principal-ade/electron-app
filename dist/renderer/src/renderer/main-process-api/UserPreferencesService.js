export class UserPreferencesService {
    static async getPreferences() {
        try {
            const preferences = await window.mainProcess.userPreferences.getPreferences();
            if (preferences && typeof preferences === 'object') {
                return { ...preferences };
            }
        }
        catch (error) {
            console.error('Error reading user preferences from electron store:', error);
        }
        return {};
    }
    static async updatePreferences(updates) {
        try {
            const current = await this.getPreferences();
            const updated = { ...current, ...updates };
            await window.mainProcess.userPreferences.updatePreferences(updated);
        }
        catch (error) {
            console.error('Error saving user preferences to electron store:', error);
        }
    }
}
