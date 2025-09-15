import { EventEmitter } from 'events';
import { Theme } from 'themed-markdown';
export interface ThemeChangeEvent {
    themeName: string;
    theme: Theme;
    colorMode?: 'light' | 'dark';
}
declare class ThemeServiceClass extends EventEmitter {
    private static instance;
    private currentThemeName;
    private currentColorMode;
    private constructor();
    static getInstance(): ThemeServiceClass;
    /**
     * Get the current theme name
     */
    getCurrentThemeName(): string;
    /**
     * Get the current color mode
     */
    getCurrentColorMode(): 'light' | 'dark';
    /**
     * Apply a theme by name
     */
    applyTheme(themeName: string, persist?: boolean): Promise<void>;
    /**
     * Change color mode (light/dark)
     */
    setColorMode(mode: 'light' | 'dark', persist?: boolean): Promise<void>;
    /**
     * Load theme preferences from storage
     */
    loadPreferences(): Promise<void>;
    /**
     * Subscribe to theme changes
     */
    onThemeChange(callback: (event: ThemeChangeEvent) => void): () => void;
}
export declare const ThemeService: ThemeServiceClass;
export {};
//# sourceMappingURL=ThemeService.d.ts.map