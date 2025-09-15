import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ThemeProvider } from 'themed-markdown';
import { ThemeService } from '../services/ThemeService';
import { getThemeByName } from '../themes/predefinedThemes';
export const CustomThemeProvider = ({ children }) => {
    const [selectedTheme, setSelectedTheme] = useState(undefined);
    const [colorMode, setColorMode] = useState('dark');
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        // Load initial theme preferences
        const loadInitialTheme = async () => {
            await ThemeService.loadPreferences();
            const themeName = ThemeService.getCurrentThemeName();
            const theme = getThemeByName(themeName);
            const mode = ThemeService.getCurrentColorMode();
            if (theme) {
                setSelectedTheme(theme);
            }
            setColorMode(mode);
            setIsLoading(false);
            console.log('[CustomThemeProvider] Initial theme loaded:', themeName, mode);
        };
        loadInitialTheme();
        // Subscribe to theme changes for live switching
        const unsubscribe = ThemeService.onThemeChange((event) => {
            console.log('[CustomThemeProvider] Theme change event received:', event.themeName);
            setSelectedTheme(event.theme);
            if (event.colorMode) {
                setColorMode(event.colorMode);
            }
        });
        return () => {
            unsubscribe();
        };
    }, []);
    // Show loading or use default theme while loading
    if (isLoading || !selectedTheme) {
        const defaultTheme = getThemeByName('default');
        return (_jsx(ThemeProvider, { theme: defaultTheme, initialColorMode: colorMode, children: children }));
    }
    // Render with the selected theme
    return (_jsx(ThemeProvider, { theme: selectedTheme, initialColorMode: colorMode, children: children }));
};
