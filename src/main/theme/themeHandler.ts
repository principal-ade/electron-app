import type { Theme } from '@principal-ade/industry-theme';
import {
  ThemePropertyUpdate,
  ThemeUpdateResult,
  ThemeSchemaResponse,
  ThemeInfo,
} from '../../shared/main-process-api-interfaces/ThemeAPI';
import { THEME_SCHEMA } from '../../shared/theme/themeSchema';
import {
  getAvailableThemeNames,
  getThemeByName,
  getThemeMetadata,
} from '../../shared/theme/predefinedThemesMeta';
import { UserPreferencesHandler } from '../stores/userPreferencesHandler';

/**
 * Theme Handler for Main Process
 *
 * Handles theme-related operations for the Principal MCP Bridge.
 * - Schema/theme info: Retrieved directly from predefined themes
 * - Theme updates: Updates UserPreferences directly, notifies renderer to reload
 */
export class ThemeHandler {
  private static instance: ThemeHandler | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): ThemeHandler {
    if (!ThemeHandler.instance) {
      ThemeHandler.instance = new ThemeHandler();
    }
    return ThemeHandler.instance;
  }

  /**
   * Update a theme property
   * Updates preferences directly in main process, then notifies renderer to reload
   */
  async updateProperty(update: ThemePropertyUpdate): Promise<ThemeUpdateResult> {
    try {
      const { propertyPath, value, themeName } = update;
      const targetThemeName = themeName || 'principalAI';

      // Get UserPreferencesHandler singleton
      const prefsHandler = UserPreferencesHandler.getInstance();
      const currentPrefs = await prefsHandler.getUserPreferences();

      // Get or create theme overrides
      const customThemeOverrides = currentPrefs.customThemeOverrides || {};
      const existingOverride = customThemeOverrides[targetThemeName];

      // Build the new override entry
      const overrides = existingOverride?.overrides || {};

      // Set the nested property value (e.g., "colors.primary" -> { colors: { primary: value } })
      this.setNestedProperty(overrides, propertyPath, value);

      // Update the theme override entry
      customThemeOverrides[targetThemeName] = {
        baseTheme: existingOverride?.baseTheme || targetThemeName,
        overrides,
        customName: existingOverride?.customName,
        lastModified: Date.now(),
      };

      // Save to preferences (this broadcasts to all renderers automatically)
      await prefsHandler.updateUserPreferences({
        customThemeOverrides,
      });

      // Check if the updated theme is the currently active theme
      const activeTheme = currentPrefs.selectedTheme || 'principalAI';
      const isActiveTheme = activeTheme === targetThemeName;

      const result: ThemeUpdateResult = {
        success: true,
        updatedProperty: propertyPath,
        themeName: targetThemeName,
      };

      if (!isActiveTheme) {
        result.warning = `Updated theme "${targetThemeName}" is not the currently active theme. Switch to "${targetThemeName}" to see changes.`;
        result.activeTheme = activeTheme;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set a nested property value using dot notation path
   */
  private setNestedProperty(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Get theme schema with current values
   * Can be done directly in main process using predefined themes
   */
  async getSchema(themeName?: string): Promise<ThemeSchemaResponse> {
    try {
      // If no theme specified, use the user's currently selected theme
      let targetThemeName = themeName;
      if (!targetThemeName) {
        const prefsHandler = UserPreferencesHandler.getInstance();
        const prefs = await prefsHandler.getUserPreferences();
        targetThemeName = prefs.selectedTheme || 'principalAI';
      }
      const themeMetadata = getThemeMetadata(targetThemeName);

      if (!themeMetadata) {
        return {
          success: false,
          error: `Theme '${targetThemeName}' not found`,
          availableThemes: this.getAvailableThemes(),
        };
      }

      // Get current values with any overrides applied
      const currentValues = await this.getActiveTheme(targetThemeName);

      return {
        success: true,
        themeName: targetThemeName,
        themeDescription: themeMetadata.description,
        schema: THEME_SCHEMA,
        currentValues: currentValues || themeMetadata.theme,
        availableThemes: this.getAvailableThemes(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a theme by name (base theme without overrides)
   */
  getBaseTheme(themeName: string): Theme | undefined {
    return getThemeByName(themeName);
  }

  /**
   * Get active theme with overrides applied
   */
  async getActiveTheme(themeName?: string): Promise<Theme | undefined> {
    try {
      const targetThemeName = themeName || 'principalAI';
      const baseTheme = this.getBaseTheme(targetThemeName);

      if (!baseTheme) {
        return undefined;
      }

      // Get overrides from preferences
      const prefsHandler = UserPreferencesHandler.getInstance();
      const prefs = await prefsHandler.getUserPreferences();
      const overrides = prefs.customThemeOverrides?.[targetThemeName]?.overrides;

      if (!overrides) {
        return baseTheme;
      }

      // Deep merge base theme with overrides
      return this.deepMerge(baseTheme, overrides) as Theme;
    } catch (error) {
      console.error('[ThemeHandler] Failed to get active theme:', error);
      return themeName ? this.getBaseTheme(themeName) : undefined;
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends object>(target: T, source: object): T {
    const output = { ...target } as Record<string, unknown>;

    for (const key of Object.keys(source)) {
      const sourceValue = (source as Record<string, unknown>)[key];
      const targetValue = (target as Record<string, unknown>)[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        output[key] = this.deepMerge(
          targetValue as object,
          sourceValue as object,
        );
      } else {
        output[key] = sourceValue;
      }
    }

    return output as T;
  }

  /**
   * Get list of available themes
   * Can be done directly in main process
   */
  getAvailableThemes(): ThemeInfo[] {
    return getAvailableThemeNames().map((name) => {
      const metadata = getThemeMetadata(name);
      return {
        name,
        displayName: metadata?.displayName || name,
        description: metadata?.description || '',
      };
    });
  }
}

/**
 * Get the theme handler singleton
 */
export function getThemeHandler(): ThemeHandler {
  return ThemeHandler.getInstance();
}

/**
 * Initialize the theme handler (call during app startup)
 */
export function initializeThemeHandler(): ThemeHandler {
  return ThemeHandler.getInstance();
}
