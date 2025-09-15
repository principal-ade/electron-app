/**
 * IconThemeService - Generates and caches themed icon images
 *
 * This service creates themed versions of the owl icon when themes change,
 * avoiding expensive runtime computations. Icons are generated once and cached.
 */
declare class IconThemeServiceClass {
    private static instance;
    private cachedIcons;
    private canvas;
    private ctx;
    private layers;
    private layersLoaded;
    private loadingPromise;
    private constructor();
    static getInstance(): IconThemeServiceClass;
    /**
     * Load all layer images (only done once)
     */
    private loadLayers;
    private loadLayersInternal;
    /**
     * Generate a themed icon for the specified theme
     * Returns a data URL that can be used as an image src
     */
    generateThemedIcon(themeName: string, size?: number, // Generate at higher res for quality
    options?: {
        basePath?: string;
        eyeColorOverride?: string;
        darkMode?: boolean;
    }): Promise<string>;
    /**
     * Pre-generate icons for all themes
     * Call this after theme definitions are loaded
     */
    preGenerateAllThemes(sizes?: number[]): Promise<void>;
    /**
     * Clear cached icons (useful when changing icon assets)
     */
    clearCache(): void;
    /**
     * Get cached icon URL if available
     */
    getCachedIcon(themeName: string, size?: number): string | null;
}
export declare const IconThemeService: IconThemeServiceClass;
export {};
//# sourceMappingURL=IconThemeService.d.ts.map