import { EventEmitter } from 'events';
import type { Theme } from '@principal-ade/industry-theme';
import { getThemeByName } from '../themes/predefinedThemes';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

export interface ThemeChangeEvent {
  themeName: string;
  theme: Theme;
  colorMode?: 'light' | 'dark';
}

/**
 * Deep merge utility for merging theme overrides
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const output = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      if (key in target && typeof target[key] === 'object') {
        (output as Record<string, unknown>)[key] = deepMerge(
          target[key] as object,
          source[key] as Partial<object>,
        );
      } else {
        (output as Record<string, unknown>)[key] = source[key];
      }
    } else {
      (output as Record<string, unknown>)[key] = source[key];
    }
  }

  return output;
}

class ThemeServiceClass extends EventEmitter {
  private static instance: ThemeServiceClass;
  private currentThemeName: string = 'principalAI';
  private currentColorMode: 'light' | 'dark' = 'dark';
  private currentThemeCache: Theme | null = null;

  private constructor() {
    super();
  }

  static getInstance(): ThemeServiceClass {
    if (!ThemeServiceClass.instance) {
      ThemeServiceClass.instance = new ThemeServiceClass();
    }
    return ThemeServiceClass.instance;
  }

  /**
   * Get the current theme name
   */
  getCurrentThemeName(): string {
    return this.currentThemeName;
  }

  /**
   * Get the current color mode
   */
  getCurrentColorMode(): 'light' | 'dark' {
    return this.currentColorMode;
  }

  /**
   * Get the base theme (without overrides)
   */
  getBaseTheme(themeName: string): Theme | undefined {
    return getThemeByName(themeName);
  }

  /**
   * Get the active theme (with overrides applied)
   */
  async getActiveTheme(themeName?: string): Promise<Theme | undefined> {
    const name = themeName || this.currentThemeName;
    const baseTheme = this.getBaseTheme(name);

    if (!baseTheme) {
      return undefined;
    }

    // Check for customizations
    try {
      const preferences = await UserPreferencesService.getPreferences();
      const customizations = preferences.customThemeOverrides?.[name];

      if (customizations) {
        return deepMerge(baseTheme, customizations.overrides as Partial<Theme>);
      }
    } catch (error) {
      console.error('[ThemeService] Failed to load theme overrides:', error);
    }

    return baseTheme;
  }

  private async updateThemeOverride(
    themeName: string,
    propertyPath: string,
    newValue: unknown,
  ): Promise<void> {
    try {
      const preferences = await UserPreferencesService.getPreferences();
      const existingOverrides = preferences.customThemeOverrides || {};
      const themeOverrides = existingOverrides[themeName] || {
        baseTheme: themeName,
        overrides: {},
        lastModified: Date.now(),
      };

      // Parse property path (e.g., "colors.primary" or "fonts.body")
      const parts = propertyPath.split('.');
      let current: Record<string, unknown> = themeOverrides.overrides as Record<string, unknown>;

      // Navigate/create nested structure
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }

      // Set the value
      current[parts[parts.length - 1]] = newValue;
      themeOverrides.lastModified = Date.now();

      // Save back to preferences
      await UserPreferencesService.updatePreferences({
        customThemeOverrides: {
          ...existingOverrides,
          [themeName]: themeOverrides,
        },
      });

      // If this is the current theme, reload it
      if (themeName === this.currentThemeName) {
        await this.applyTheme(themeName, false);
      }

      console.info(
        `[ThemeService] Updated ${propertyPath} in ${themeName} theme`,
      );
    } catch (error) {
      console.error('[ThemeService] Failed to update theme override:', error);
      throw error;
    }
  }

  /**
   * Update a single color in the theme
   */
  async updateThemeColor(
    themeName: string,
    colorPath: string,
    newValue: string,
  ): Promise<void> {
    await this.updateThemeOverride(themeName, colorPath, newValue);
  }

  /**
   * Update any string based theme setting (fonts, etc.)
   */
  async updateThemeSetting(
    themeName: string,
    propertyPath: string,
    newValue: string,
  ): Promise<void> {
    await this.updateThemeOverride(themeName, propertyPath, newValue);
  }

  /**
   * Clear all overrides for a theme
   */
  async clearThemeOverrides(themeName: string): Promise<void> {
    try {
      const preferences = await UserPreferencesService.getPreferences();
      const existingOverrides = preferences.customThemeOverrides || {};
      delete existingOverrides[themeName];

      await UserPreferencesService.updatePreferences({
        customThemeOverrides: existingOverrides,
      });

      // If this is the current theme, reload it
      if (themeName === this.currentThemeName) {
        await this.applyTheme(themeName, false);
      }

      console.info(`[ThemeService] Cleared overrides for ${themeName} theme`);
    } catch (error) {
      console.error('[ThemeService] Failed to clear theme overrides:', error);
      throw error;
    }
  }

  /**
   * Apply a theme by name
   */
  async applyTheme(themeName: string, persist: boolean = true): Promise<void> {
    console.info('[ThemeService] Applying theme:', themeName);

    const theme = await this.getActiveTheme(themeName);
    if (!theme) {
      console.error('[ThemeService] Theme not found:', themeName);
      return;
    }

    this.currentThemeName = themeName;
    this.currentThemeCache = theme;

    // Emit theme change event
    this.emit('themeChange', {
      themeName,
      theme,
      colorMode: this.currentColorMode,
    } as ThemeChangeEvent);

    // Persist to preferences if requested
    if (persist) {
      try {
        await UserPreferencesService.updatePreferences({
          selectedTheme: themeName,
        });
        console.info('[ThemeService] Theme persisted to preferences');
      } catch (error) {
        console.error('[ThemeService] Failed to persist theme:', error);
      }
    }
  }

  /**
   * Change color mode (light/dark)
   */
  async setColorMode(
    mode: 'light' | 'dark',
    persist: boolean = true,
  ): Promise<void> {
    console.info('[ThemeService] Setting color mode:', mode);

    this.currentColorMode = mode;

    const theme = getThemeByName(this.currentThemeName);
    if (theme) {
      this.emit('themeChange', {
        themeName: this.currentThemeName,
        theme,
        colorMode: mode,
      } as ThemeChangeEvent);
    }

    // Persist to preferences if requested
    if (persist) {
      try {
        await UserPreferencesService.updatePreferences({
          colorMode: mode,
        });
        console.info('[ThemeService] Color mode persisted to preferences');
      } catch (error) {
        console.error('[ThemeService] Failed to persist color mode:', error);
      }
    }
  }

  /**
   * Load theme preferences from storage
   */
  async loadPreferences(): Promise<void> {
    try {
      const preferences = await UserPreferencesService.getPreferences();

      if (preferences.selectedTheme) {
        this.currentThemeName = preferences.selectedTheme;
      }

      if (preferences.colorMode) {
        this.currentColorMode = preferences.colorMode;
      } else {
        // Check system preference
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)',
        ).matches;
        this.currentColorMode = prefersDark ? 'dark' : 'light';
      }

      console.info('[ThemeService] Loaded preferences:', {
        theme: this.currentThemeName,
        colorMode: this.currentColorMode,
      });
    } catch (error) {
      console.error('[ThemeService] Failed to load preferences:', error);
    }
  }

  /**
   * Subscribe to theme changes
   */
  onThemeChange(callback: (event: ThemeChangeEvent) => void): () => void {
    this.on('themeChange', callback);
    return () => this.off('themeChange', callback);
  }
}

export const ThemeService = ThemeServiceClass.getInstance();
