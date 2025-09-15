import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'themed-markdown';
/**
 * CanvasOwlIcon - Uses HTML5 Canvas to apply dynamic colors to image layers
 * This approach gives us pixel-perfect control over color replacement
 */
export const CanvasOwlIcon = ({ size = 48, className, basePath = '/assets/icons/owl' }) => {
    const canvasRef = useRef(null);
    const { theme } = useTheme();
    const [imagesLoaded, setImagesLoaded] = useState(false);
    // Store loaded images
    const imagesRef = useRef({});
    // Load all images on mount
    useEffect(() => {
        const loadImage = (src) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        };
        Promise.all([
            loadImage(`${basePath}/owl-body.png`),
            loadImage(`${basePath}/owl-eyes-base.png`),
            loadImage(`${basePath}/owl-eyes-iris.png`),
            loadImage(`${basePath}/owl-eyes-pupils.png`),
            loadImage(`${basePath}/owl-eyes-highlight.png`)
        ]).then(([body, eyesBase, eyesIris, pupils, highlight]) => {
            imagesRef.current = { body, eyesBase, eyesIris, pupils, highlight };
            setImagesLoaded(true);
        }).catch(error => {
            console.error('Failed to load owl icon layers:', error);
        });
    }, [basePath]);
    // Render the icon when images are loaded or theme changes
    useEffect(() => {
        if (!imagesLoaded || !canvasRef.current)
            return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const images = imagesRef.current;
        // Clear canvas
        ctx.clearRect(0, 0, size, size);
        // Draw body layer
        if (images.body) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(images.body, 0, 0, size, size);
            // Apply tint to body based on theme
            if (theme.colors.text === '#FFFFFF') {
                // For dark themes, lighten the body
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(0, 0, size, size);
            }
        }
        // Draw eye base (white part)
        if (images.eyesBase) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(images.eyesBase, 0, 0, size, size);
        }
        // Draw and colorize iris
        if (images.eyesIris) {
            // Create a temporary canvas for the iris
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                // Draw the grayscale iris
                tempCtx.drawImage(images.eyesIris, 0, 0, size, size);
                // Get the iris color based on theme
                const eyeColor = getEyeColorForTheme(theme);
                // Apply color using composite operation
                tempCtx.globalCompositeOperation = 'source-atop';
                tempCtx.fillStyle = eyeColor;
                tempCtx.fillRect(0, 0, size, size);
                // Draw the colored iris back to main canvas
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(tempCanvas, 0, 0);
            }
        }
        // Draw pupils (always black)
        if (images.pupils) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(images.pupils, 0, 0, size, size);
        }
        // Draw highlights
        if (images.highlight) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.8;
            ctx.drawImage(images.highlight, 0, 0, size, size);
            ctx.globalAlpha = 1;
        }
        // Add glow effect for dark themes
        if (theme.colors.text === '#FFFFFF') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowColor = getEyeColorForTheme(theme);
            ctx.shadowBlur = 3;
            // Redraw iris with glow
            if (images.eyesIris) {
                ctx.globalAlpha = 0.3;
                ctx.drawImage(images.eyesIris, 0, 0, size, size);
                ctx.globalAlpha = 1;
            }
            ctx.shadowBlur = 0;
        }
    }, [imagesLoaded, theme, size]);
    // Helper function to get eye color based on theme
    const getEyeColorForTheme = (theme) => {
        // You can map specific themes to colors here
        const themeName = window.__currentThemeName || 'default';
        const eyeColors = {
            default: theme.colors.primary,
            professional: '#003D82',
            ocean: '#0891B2',
            sunset: '#EA580C',
            minimal: theme.colors.textSecondary,
            highContrast: '#0000FF'
        };
        return eyeColors[themeName] || theme.colors.primary;
    };
    return (_jsx("canvas", { ref: canvasRef, width: size, height: size, className: className, style: {
            display: 'block',
            width: size,
            height: size
        } }));
};
