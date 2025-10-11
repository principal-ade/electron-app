import { UserPreferences } from '../../shared/types/userPreferences.types';
import { UserPreferencesAPIEvents } from '../../shared/main-process-api-interfaces/UserPreferencesAPI';
import { TypedMultiStoreWrapper } from '../storage-providers/typed-multistore-wrapper';
import { StaticNamespaces } from '../storage-providers/types';
import { ipcMain } from 'electron';

const USER_PREFERENCES_KEY = 'preferences';

export class UserPreferencesHandler {
  constructor(private typedStore: TypedMultiStoreWrapper) {}

  private async getOrCreatePreferences(): Promise<UserPreferences> {
    const result = await this.typedStore.get(
      USER_PREFERENCES_KEY,
      StaticNamespaces.USER_PREFERENCES,
    );

    if (!result.success || !result.data) {
      const defaultPreferences: UserPreferences = {
        defaultEditor: 'vscode',
        defaultView: 'projects',
        remoteAgentButtons: {
          jules: false,
          codex: false,
        },
        titlebarButtons: {
          theme: true,
          customize: true,
        },
      };

      await this.typedStore.set(
        USER_PREFERENCES_KEY,
        defaultPreferences,
        StaticNamespaces.USER_PREFERENCES,
      );
      return defaultPreferences;
    }

    return result.data;
  }

  async getUserPreferences(): Promise<UserPreferences> {
    return this.getOrCreatePreferences();
  }

  async updateUserPreferences(
    updates: Partial<UserPreferences>,
  ): Promise<void> {
    const current = await this.getOrCreatePreferences();
    const updated = this.deepMerge(current, updates);
    await this.typedStore.set(
      USER_PREFERENCES_KEY,
      updated,
      StaticNamespaces.USER_PREFERENCES,
    );
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  registerHandlers(): void {
    ipcMain.handle(UserPreferencesAPIEvents.GET_PREFERENCES, async () => {
      return this.getUserPreferences();
    });

    ipcMain.handle(
      UserPreferencesAPIEvents.UPDATE_PREFERENCES,
      async (_event, updates: Partial<UserPreferences>) => {
        return this.updateUserPreferences(updates);
      },
    );
  }
}
