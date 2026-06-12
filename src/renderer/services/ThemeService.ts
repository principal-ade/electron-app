import { EventEmitter } from 'events';
import type { Theme } from '@principal-ade/industry-theme';
import { getThemeByName } from '../themes/predefinedThemes';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { deepMerge } from '../../shared/utils/deepMerge';

export interface ThemeChangeEvent {
  themeName: string;
  theme: Theme;
  colorMode?: 'light' | 'dark';
}

class ThemeServiceClass extends EventEmitter {
  private static instance: ThemeServiceClass;
  private currentThemeName: string = 'slateNeon';
  private currentColorMode: 'light' | 'dark' = 'dark';
  private currentThemeCache: Theme | null = null;

  /**
   * Optional scope key (e.g. a repository path). When set, theme selection and
   * customizations read/write a per-scope slice of user preferences
   * (`repoThemeOverrides[scopeKey]`) and fall back to the global theme settings
   * whenever a value is not set for the scope. When null (the default, used by
   * the principal window) the global settings are read/written directly.
   */
  private scopeKey: string | null = null;

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
   * Bind this service to a per-repo/per-scope theme slice. Call once, before the
   * first theme load, in windows that want scoped theming (e.g. dev-workspace).
   * Pass null to use the global settings.
   */
  setScope(scopeKey: string | null): void {
    this.scopeKey = scopeKey || null;
  }

  getScope(): string | null {
    return this.scopeKey;
  }

  /**
   * Set a dotted path (e.g. "colors.primary") on a nested object, creating
   * intermediate objects as needed.
   */
  private setPath(
    target: Record<string, unknown>,
    propertyPath: string,
    value: unknown,
  ): void {
    const parts = propertyPath.split('.');
    let current = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  /**
   * Persist a top-level theme field (selectedTheme / colorMode), writing to the
   * active scope slice when scoped, or to the global preferences otherwise.
   */
  private async persistScoped(patch: {
    selectedTheme?: string;
    colorMode?: 'light' | 'dark';
  }): Promise<void> {
    if (!this.scopeKey) {
      await UserPreferencesService.updatePreferences(patch);
      return;
    }
    const preferences = await UserPreferencesService.getPreferences();
    const scopedSlice = preferences.repoThemeOverrides?.[this.scopeKey] || {};
    await UserPreferencesService.updatePreferences({
      repoThemeOverrides: {
        [this.scopeKey]: {
          ...scopedSlice,
          ...patch,
        },
      },
    });
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
   * Get the active theme with any saved customizations merged in.
   *
   * Reads `customThemeOverrides` from user preferences and deep-merges them
   * onto the base theme, so edits made in the theme customization panel are
   * actually reflected in the rendered UI. Falls back to the base theme when
   * there are no overrides or the lookup fails.
   */
  async getActiveTheme(themeName?: string): Promise<Theme | undefined> {
    const name = themeName || this.currentThemeName;
    const baseTheme = this.getBaseTheme(name);

    if (!baseTheme) {
      return undefined;
    }

    try {
      const preferences = await UserPreferencesService.getPreferences();
      const globalOverrides = preferences.customThemeOverrides?.[name]?.overrides;
      const scopedOverrides = this.scopeKey
        ? preferences.repoThemeOverrides?.[this.scopeKey]?.customThemeOverrides?.[
            name
          ]?.overrides
        : undefined;

      if (!globalOverrides && !scopedOverrides) {
        return baseTheme;
      }

      // Layer order: base theme -> global overrides (the fallback) -> scoped
      // (per-repo) overrides on top. A scope only stores its own deltas, so the
      // global customization remains visible for anything the repo hasn't changed.
      let theme: Theme = baseTheme;
      if (globalOverrides) {
        theme = deepMerge(theme, globalOverrides) as Theme;
      }
      if (scopedOverrides) {
        theme = deepMerge(theme, scopedOverrides) as Theme;
      }
      return theme;
    } catch (error) {
      console.error('[ThemeService] Failed to merge theme overrides:', error);
      return baseTheme;
    }
  }

  private async updateThemeOverride(
    themeName: string,
    propertyPath: string,
    newValue: unknown,
  ): Promise<void> {
    try {
      const preferences = await UserPreferencesService.getPreferences();

      if (this.scopeKey) {
        // Per-scope (e.g. per-repo) override. Stores only this scope's deltas;
        // global overrides remain the fallback via getActiveTheme's merge order.
        const scopedSlice =
          preferences.repoThemeOverrides?.[this.scopeKey] || {};
        const existingOverrides = scopedSlice.customThemeOverrides || {};
        const themeOverrides = existingOverrides[themeName] || {
          baseTheme: themeName,
          overrides: {},
          lastModified: Date.now(),
        };

        this.setPath(
          themeOverrides.overrides as Record<string, unknown>,
          propertyPath,
          newValue,
        );
        themeOverrides.lastModified = Date.now();

        await UserPreferencesService.updatePreferences({
          repoThemeOverrides: {
            [this.scopeKey]: {
              ...scopedSlice,
              customThemeOverrides: {
                ...existingOverrides,
                [themeName]: themeOverrides,
              },
            },
          },
        });
      } else {
        const existingOverrides = preferences.customThemeOverrides || {};
        const themeOverrides = existingOverrides[themeName] || {
          baseTheme: themeName,
          overrides: {},
          lastModified: Date.now(),
        };

        this.setPath(
          themeOverrides.overrides as Record<string, unknown>,
          propertyPath,
          newValue,
        );
        themeOverrides.lastModified = Date.now();

        await UserPreferencesService.updatePreferences({
          customThemeOverrides: {
            ...existingOverrides,
            [themeName]: themeOverrides,
          },
        });
      }

      // If this is the current theme, reload it
      if (themeName === this.currentThemeName) {
        await this.applyTheme(themeName, false);
      }

      console.info(
        `[ThemeService] Updated ${propertyPath} in ${themeName} theme${
          this.scopeKey ? ` (scope: ${this.scopeKey})` : ''
        }`,
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

      if (this.scopeKey) {
        const scopedSlice =
          preferences.repoThemeOverrides?.[this.scopeKey] || {};
        const existingOverrides = {
          ...(scopedSlice.customThemeOverrides || {}),
        };
        delete existingOverrides[themeName];

        await UserPreferencesService.updatePreferences({
          repoThemeOverrides: {
            [this.scopeKey]: {
              ...scopedSlice,
              customThemeOverrides: existingOverrides,
            },
          },
        });
      } else {
        const existingOverrides = preferences.customThemeOverrides || {};
        delete existingOverrides[themeName];

        await UserPreferencesService.updatePreferences({
          customThemeOverrides: existingOverrides,
        });
      }

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

    // Persist to preferences if requested (scoped or global)
    if (persist) {
      try {
        await this.persistScoped({ selectedTheme: themeName });
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

    // Persist to preferences if requested (scoped or global)
    if (persist) {
      try {
        await this.persistScoped({ colorMode: mode });
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
      const scopedSlice = this.scopeKey
        ? preferences.repoThemeOverrides?.[this.scopeKey]
        : undefined;

      // Scope value first, then fall back to the global preference.
      const selectedTheme =
        scopedSlice?.selectedTheme ?? preferences.selectedTheme;
      if (selectedTheme) {
        this.currentThemeName = selectedTheme;
      }

      const colorMode = scopedSlice?.colorMode ?? preferences.colorMode;
      if (colorMode) {
        this.currentColorMode = colorMode;
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
        scope: this.scopeKey ?? '(global)',
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
