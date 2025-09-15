import { UserPreferencesAPIEvents } from "../../shared/main-process-api-interfaces/UserPreferencesAPI";
import { StaticNamespaces } from "../storage-providers/types";
import { ipcMain } from 'electron';
const USER_PREFERENCES_KEY = 'preferences';
export class UserPreferencesHandler {
    typedStore;
    constructor(typedStore) {
        this.typedStore = typedStore;
    }
    async getOrCreatePreferences() {
        const result = await this.typedStore.get(USER_PREFERENCES_KEY, StaticNamespaces.USER_PREFERENCES);
        if (!result.success || !result.data) {
            const defaultPreferences = {
                defaultEditor: 'vscode',
                defaultView: 'projects',
            };
            await this.typedStore.set(USER_PREFERENCES_KEY, defaultPreferences, StaticNamespaces.USER_PREFERENCES);
            return defaultPreferences;
        }
        return result.data;
    }
    async getUserPreferences() {
        return this.getOrCreatePreferences();
    }
    async updateUserPreferences(updates) {
        const current = await this.getOrCreatePreferences();
        const updated = { ...current, ...updates };
        await this.typedStore.set(USER_PREFERENCES_KEY, updated, StaticNamespaces.USER_PREFERENCES);
    }
    registerHandlers() {
        ipcMain.handle(UserPreferencesAPIEvents.GET_PREFERENCES, async () => {
            return this.getUserPreferences();
        });
        ipcMain.handle(UserPreferencesAPIEvents.UPDATE_PREFERENCES, async (_event, updates) => {
            return this.updateUserPreferences(updates);
        });
    }
}
