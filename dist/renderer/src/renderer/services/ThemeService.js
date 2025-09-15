import { EventEmitter } from 'events';
import { getThemeByName } from '../themes/predefinedThemes';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { IconThemeService } from './IconThemeService';
class ThemeServiceClass extends EventEmitter {
    static instance;
    currentThemeName = 'default';
    currentColorMode = 'dark';
    constructor() {
        super();
    }
    static getInstance() {
        if (!ThemeServiceClass.instance) {
            ThemeServiceClass.instance = new ThemeServiceClass();
        }
        return ThemeServiceClass.instance;
    }
    /**
     * Get the current theme name
     */
    getCurrentThemeName() {
        return this.currentThemeName;
    }
    /**
     * Get the current color mode
     */
    getCurrentColorMode() {
        return this.currentColorMode;
    }
    /**
     * Apply a theme by name
     */
    async applyTheme(themeName, persist = true) {
        console.log('[ThemeService] Applying theme:', themeName);
        const theme = getThemeByName(themeName);
        if (!theme) {
            console.error('[ThemeService] Theme not found:', themeName);
            return;
        }
        this.currentThemeName = themeName;
        // Generate themed icon for common sizes
        // This happens asynchronously to not block theme switching
        IconThemeService.generateThemedIcon(themeName, 32).catch(console.error);
        IconThemeService.generateThemedIcon(themeName, 48).catch(console.error);
        IconThemeService.generateThemedIcon(themeName, 64).catch(console.error);
        IconThemeService.generateThemedIcon(themeName, 128).catch(console.error);
        // Emit theme change event
        this.emit('themeChange', {
            themeName,
            theme,
            colorMode: this.currentColorMode
        });
        // Persist to preferences if requested
        if (persist) {
            try {
                await UserPreferencesService.updatePreferences({
                    selectedTheme: themeName
                });
                console.log('[ThemeService] Theme persisted to preferences');
            }
            catch (error) {
                console.error('[ThemeService] Failed to persist theme:', error);
            }
        }
    }
    /**
     * Change color mode (light/dark)
     */
    async setColorMode(mode, persist = true) {
        console.log('[ThemeService] Setting color mode:', mode);
        this.currentColorMode = mode;
        const theme = getThemeByName(this.currentThemeName);
        if (theme) {
            this.emit('themeChange', {
                themeName: this.currentThemeName,
                theme,
                colorMode: mode
            });
        }
        // Persist to preferences if requested
        if (persist) {
            try {
                await UserPreferencesService.updatePreferences({
                    colorMode: mode
                });
                console.log('[ThemeService] Color mode persisted to preferences');
            }
            catch (error) {
                console.error('[ThemeService] Failed to persist color mode:', error);
            }
        }
    }
    /**
     * Load theme preferences from storage
     */
    async loadPreferences() {
        try {
            const preferences = await UserPreferencesService.getPreferences();
            if (preferences.selectedTheme) {
                this.currentThemeName = preferences.selectedTheme;
            }
            if (preferences.colorMode) {
                this.currentColorMode = preferences.colorMode;
            }
            else {
                // Check system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.currentColorMode = prefersDark ? 'dark' : 'light';
            }
            console.log('[ThemeService] Loaded preferences:', {
                theme: this.currentThemeName,
                colorMode: this.currentColorMode
            });
        }
        catch (error) {
            console.error('[ThemeService] Failed to load preferences:', error);
        }
    }
    /**
     * Subscribe to theme changes
     */
    onThemeChange(callback) {
        this.on('themeChange', callback);
        return () => this.off('themeChange', callback);
    }
}
export const ThemeService = ThemeServiceClass.getInstance();
