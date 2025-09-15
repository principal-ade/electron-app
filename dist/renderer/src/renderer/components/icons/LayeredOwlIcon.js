import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useTheme } from 'themed-markdown';
/**
 * Converts a hex color to CSS filter that transforms black to that color
 * This allows us to colorize grayscale images
 */
function hexToFilter(hex) {
    // Remove # if present
    const color = hex.replace('#', '');
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    // Create a filter that colorizes the image
    // This uses a combination of filters to achieve the color
    const brightness = ((r + g + b) / 3) / 255;
    const hue = Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI;
    const saturation = Math.max(r, g, b) === 0 ? 0 : (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b);
    return `brightness(${brightness}) sepia(1) hue-rotate(${hue}deg) saturate(${saturation * 5})`;
}
/**
 * LayeredOwlIcon Component
 *
 * Expects the following image files in the basePath directory:
 * - owl-body.png (grayscale base layer)
 * - owl-eyes-base.png (white eye backgrounds)
 * - owl-eyes-iris.png (grayscale iris layer - will be colorized)
 * - owl-eyes-pupils.png (black pupils)
 * - owl-eyes-highlight.png (white highlights)
 * - owl-accessories.png (optional accessories layer)
 *
 * For best results, use grayscale PNGs with transparency
 */
export const LayeredOwlIcon = ({ size = 48, className, basePath = '/assets/icons/owl' }) => {
    const { theme } = useTheme();
    // Get the current theme name for specific customizations
    const themeName = window.__currentThemeName || 'default';
    // Calculate colors and filters based on theme
    const filters = useMemo(() => {
        // Define theme-specific eye colors
        const eyeColors = {
            default: theme.colors.primary,
            professional: '#003D82',
            ocean: '#0891B2',
            sunset: '#EA580C',
            minimal: theme.colors.textSecondary,
            highContrast: '#0000FF'
        };
        const eyeColor = eyeColors[themeName] || theme.colors.primary;
        return {
            body: `brightness(${theme.colors.text === '#FFFFFF' ? 1.2 : 0.8}) contrast(1.1)`,
            eyeIris: hexToFilter(eyeColor),
            glow: theme.colors.text === '#FFFFFF' ? 'drop-shadow(0 0 3px rgba(255,255,255,0.3))' : 'none'
        };
    }, [theme, themeName]);
    return (_jsxs("div", { className: className, style: {
            position: 'relative',
            width: size,
            height: size,
            display: 'inline-block'
        }, children: [_jsx("img", { src: `${basePath}/owl-body.png`, alt: "", style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    filter: filters.body,
                    transition: 'filter 0.3s ease'
                } }), _jsx("img", { src: `${basePath}/owl-eyes-base.png`, alt: "", style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    opacity: theme.colors.text === '#FFFFFF' ? 0.9 : 1
                } }), _jsx("img", { src: `${basePath}/owl-eyes-iris.png`, alt: "", style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    filter: filters.eyeIris,
                    mixBlendMode: 'normal',
                    transition: 'filter 0.3s ease'
                } }), _jsx("img", { src: `${basePath}/owl-eyes-pupils.png`, alt: "", style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%'
                } }), _jsx("img", { src: `${basePath}/owl-eyes-highlight.png`, alt: "", style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    opacity: 0.8,
                    filter: filters.glow
                } }), themeName === 'professional' && (_jsx("img", { src: `${basePath}/owl-glasses.png`, alt: "", style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%'
                } }))] }));
};
