import { UserPreferences } from '../../shared/types/userPreferences.types';
import { UserPreferencesAPIEvents } from '../../shared/main-process-api-interfaces/UserPreferencesAPI';
import { TypedMultiStoreWrapper } from '../storage-providers/typed-multistore-wrapper';
import { StaticNamespaces } from '../storage-providers/types';
import { ipcMain } from 'electron';

const USER_PREFERENCES_KEY = 'preferences';

export class UserPreferencesHandler {
  private static instance: UserPreferencesHandler | null = null;

  constructor(private typedStore: TypedMultiStoreWrapper) {
    // Store singleton instance
    UserPreferencesHandler.instance = this;
  }

  /**
   * Get the singleton instance of UserPreferencesHandler
   * Must be called after initialization
   */
  static getInstance(): UserPreferencesHandler {
    if (!UserPreferencesHandler.instance) {
      throw new Error(
        'UserPreferencesHandler not initialized. Call constructor first.',
      );
    }
    return UserPreferencesHandler.instance;
  }

  private async getOrCreatePreferences(): Promise<UserPreferences> {
    const result = await this.typedStore.get(
      USER_PREFERENCES_KEY,
      StaticNamespaces.USER_PREFERENCES,
    );

    if (!result.success || !result.data) {
      const defaultPreferences: UserPreferences = {
        defaultEditor: 'vscode',
        defaultView: 'projects',
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

  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const output = { ...target } as Record<string, unknown>;

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        const sourceValue = (source as Record<string, unknown>)[key];
        const targetValue = (target as Record<string, unknown>)[key];

        if (this.isObject(sourceValue)) {
          if (!(key in target)) {
            output[key] = sourceValue;
          } else {
            output[key] = this.deepMerge(
              targetValue as object,
              sourceValue as Partial<object>,
            );
          }
        } else {
          output[key] = sourceValue;
        }
      });
    }

    return output as T;
  }

  private isObject(item: unknown): item is Record<string, unknown> {
    return !!item && typeof item === 'object' && !Array.isArray(item);
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
