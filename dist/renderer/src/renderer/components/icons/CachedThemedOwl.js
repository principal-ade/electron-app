import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ThemeService } from '../../services/ThemeService';
import { IconThemeService } from '../../services/IconThemeService';
/**
 * CachedThemedOwl - Efficient themed owl icon that uses pre-generated cached images
 *
 * This component:
 * 1. Uses cached themed icons that are generated once when theme switches
 * 2. Falls back to a default icon while the themed version is being generated
 * 3. Automatically updates when the theme changes
 */
export const CachedThemedOwl = ({ size = 48, className, fallbackSrc = '/assets/icons/owl-default.png', showLoading = false }) => {
    const [iconSrc, setIconSrc] = useState(fallbackSrc);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // Function to load themed icon
    const loadThemedIcon = async () => {
        const themeName = ThemeService.getCurrentThemeName();
        // Try to get cached icon first
        const cached = IconThemeService.getCachedIcon(themeName, size);
        if (cached) {
            setIconSrc(cached);
            setIsLoading(false);
            return;
        }
        // Generate if not cached
        setIsLoading(true);
        setError(null);
        try {
            const generatedIcon = await IconThemeService.generateThemedIcon(themeName, size);
            if (generatedIcon) {
                setIconSrc(generatedIcon);
            }
            else {
                throw new Error('Failed to generate icon');
            }
        }
        catch (err) {
            console.error('[CachedThemedOwl] Failed to generate icon:', err);
            setError('Failed to load themed icon');
            setIconSrc(fallbackSrc);
        }
        finally {
            setIsLoading(false);
        }
    };
    // Load icon on mount and when size changes
    useEffect(() => {
        loadThemedIcon();
    }, [size]);
    // Subscribe to theme changes
    useEffect(() => {
        const unsubscribe = ThemeService.onThemeChange(() => {
            loadThemedIcon();
        });
        return () => {
            unsubscribe();
        };
    }, [size]);
    // Show loading state if requested
    if (isLoading && showLoading) {
        return (_jsx("div", { className: className, style: {
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f0f0f0',
                borderRadius: '50%'
            }, children: _jsx("div", { style: {
                    width: size * 0.5,
                    height: size * 0.5,
                    border: '2px solid #ddd',
                    borderTopColor: '#333',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                } }) }));
    }
    return (_jsx("img", { src: iconSrc, alt: "PrincipleMD", width: size, height: size, className: className, style: {
            display: 'block',
            transition: 'opacity 0.3s ease',
            opacity: isLoading ? 0.5 : 1
        }, onError: () => {
            // Fallback to default on error
            console.error('[CachedThemedOwl] Image failed to load, using fallback');
            setIconSrc(fallbackSrc);
        } }));
};
