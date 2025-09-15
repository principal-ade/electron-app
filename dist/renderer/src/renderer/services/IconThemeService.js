import { iconThemes } from '../themes/predefinedThemes';
/**
 * IconThemeService - Generates and caches themed icon images
 *
 * This service creates themed versions of the owl icon when themes change,
 * avoiding expensive runtime computations. Icons are generated once and cached.
 */
class IconThemeServiceClass {
    static instance;
    cachedIcons = new Map(); // theme name -> data URL
    canvas = null;
    ctx = null;
    // Layer images loaded once
    layers = {};
    layersLoaded = false;
    loadingPromise = null;
    constructor() {
        // Initialize canvas for icon generation
        if (typeof document !== 'undefined') {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
        }
    }
    static getInstance() {
        if (!IconThemeServiceClass.instance) {
            IconThemeServiceClass.instance = new IconThemeServiceClass();
        }
        return IconThemeServiceClass.instance;
    }
    /**
     * Load all layer images (only done once)
     */
    async loadLayers(basePath = '/assets/icons/owl') {
        if (this.layersLoaded)
            return;
        // Return existing promise if already loading
        if (this.loadingPromise)
            return this.loadingPromise;
        this.loadingPromise = this.loadLayersInternal(basePath);
        await this.loadingPromise;
        this.loadingPromise = null;
    }
    async loadLayersInternal(basePath) {
        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => {
                    console.warn(`Failed to load image: ${src}`);
                    resolve(img); // Resolve anyway to not break the whole process
                };
                img.src = src;
            });
        };
        try {
            const [body, eyesBase, eyesIris, pupils, highlight] = await Promise.all([
                loadImage(`${basePath}/body.png`),
                loadImage(`${basePath}/eyes-base.png`),
                loadImage(`${basePath}/eyes-iris.png`),
                loadImage(`${basePath}/pupils.png`),
                loadImage(`${basePath}/highlight.png`)
            ]);
            this.layers = { body, eyesBase, eyesIris, pupils, highlight };
            this.layersLoaded = true;
            console.log('[IconThemeService] Layers loaded successfully');
        }
        catch (error) {
            console.error('[IconThemeService] Failed to load layers:', error);
            // Even if some layers fail, mark as loaded to prevent infinite retries
            this.layersLoaded = true;
        }
    }
    /**
     * Generate a themed icon for the specified theme
     * Returns a data URL that can be used as an image src
     */
    async generateThemedIcon(themeName, size = 256, // Generate at higher res for quality
    options = {}) {
        // Check cache first
        const cacheKey = `${themeName}-${size}-${options.eyeColorOverride || ''}`;
        if (this.cachedIcons.has(cacheKey)) {
            console.log('[IconThemeService] Using cached icon for:', cacheKey);
            return this.cachedIcons.get(cacheKey);
        }
        // Ensure layers are loaded
        await this.loadLayers(options.basePath);
        if (!this.canvas || !this.ctx) {
            console.error('[IconThemeService] Canvas not available');
            return '';
        }
        // Set canvas size
        this.canvas.width = size;
        this.canvas.height = size;
        const ctx = this.ctx;
        // Clear canvas
        ctx.clearRect(0, 0, size, size);
        // Get theme-specific colors
        const iconTheme = iconThemes[themeName] || iconThemes.default;
        const eyeColor = options.eyeColorOverride || iconTheme.eyeColor;
        const isDark = options.darkMode ?? themeName.includes('dark');
        // Draw body layer
        if (this.layers.body?.complete) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.filter = isDark ? 'brightness(1.2)' : 'brightness(0.95)';
            ctx.drawImage(this.layers.body, 0, 0, size, size);
            ctx.filter = 'none';
        }
        // Draw eye base (white parts)
        if (this.layers.eyesBase?.complete) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = isDark ? 0.9 : 1;
            ctx.drawImage(this.layers.eyesBase, 0, 0, size, size);
            ctx.globalAlpha = 1;
        }
        // Draw and colorize iris
        if (this.layers.eyesIris?.complete) {
            // Create temporary canvas for coloring
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                // Draw grayscale iris
                tempCtx.drawImage(this.layers.eyesIris, 0, 0, size, size);
                // Apply color overlay
                tempCtx.globalCompositeOperation = 'source-atop';
                tempCtx.fillStyle = eyeColor;
                tempCtx.fillRect(0, 0, size, size);
                // Add gradient for depth
                const gradient = tempCtx.createRadialGradient(size * 0.38, size * 0.35, 0, size * 0.38, size * 0.35, size * 0.15);
                gradient.addColorStop(0, eyeColor + 'CC');
                gradient.addColorStop(1, eyeColor);
                tempCtx.globalCompositeOperation = 'multiply';
                tempCtx.fillStyle = gradient;
                tempCtx.fillRect(0, 0, size, size);
                // Draw colored iris to main canvas
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(tempCanvas, 0, 0);
            }
        }
        // Draw pupils
        if (this.layers.pupils?.complete) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(this.layers.pupils, 0, 0, size, size);
        }
        // Draw highlights
        if (this.layers.highlight?.complete) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.8;
            ctx.drawImage(this.layers.highlight, 0, 0, size, size);
            ctx.globalAlpha = 1;
        }
        // Add theme-specific effects
        if (iconTheme.style === 'glow') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowColor = eyeColor;
            ctx.shadowBlur = size * 0.05;
            ctx.globalAlpha = 0.3;
            // Create glow by drawing a circle at eye positions
            ctx.fillStyle = eyeColor;
            ctx.beginPath();
            ctx.arc(size * 0.38, size * 0.35, size * 0.08, 0, Math.PI * 2);
            ctx.arc(size * 0.62, size * 0.35, size * 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
        }
        // Convert to data URL
        const dataUrl = this.canvas.toDataURL('image/png');
        // Cache the result
        this.cachedIcons.set(cacheKey, dataUrl);
        console.log('[IconThemeService] Generated and cached icon for:', cacheKey);
        return dataUrl;
    }
    /**
     * Pre-generate icons for all themes
     * Call this after theme definitions are loaded
     */
    async preGenerateAllThemes(sizes = [32, 48, 64, 128]) {
        console.log('[IconThemeService] Pre-generating icons for all themes...');
        const themeNames = Object.keys(iconThemes);
        const promises = [];
        for (const themeName of themeNames) {
            for (const size of sizes) {
                promises.push(this.generateThemedIcon(themeName, size));
            }
        }
        await Promise.all(promises);
        console.log('[IconThemeService] Pre-generation complete. Cached', promises.length, 'icons');
    }
    /**
     * Clear cached icons (useful when changing icon assets)
     */
    clearCache() {
        this.cachedIcons.clear();
        console.log('[IconThemeService] Icon cache cleared');
    }
    /**
     * Get cached icon URL if available
     */
    getCachedIcon(themeName, size = 256) {
        const cacheKey = `${themeName}-${size}-`;
        return this.cachedIcons.get(cacheKey) || null;
    }
}
export const IconThemeService = IconThemeServiceClass.getInstance();
