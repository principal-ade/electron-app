import React, { useEffect, useState } from 'react';
import { ThemeProvider, type Theme } from 'themed-markdown';
import { ThemeService, ThemeChangeEvent } from '../services/ThemeService';
import { getThemeByName } from '../themes/predefinedThemes';

interface CustomThemeProviderProps {
  children: React.ReactNode;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({
  children,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<Theme | undefined>(undefined);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('dark');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial theme preferences
    const loadInitialTheme = async () => {
      await ThemeService.loadPreferences();

      const themeName = ThemeService.getCurrentThemeName();
      const theme = await ThemeService.getActiveTheme(themeName);
      const mode = ThemeService.getCurrentColorMode();

      if (theme) {
        setSelectedTheme(theme);
      }
      setColorMode(mode);
      setIsLoading(false);

      console.info(
        '[CustomThemeProvider] Initial theme loaded:',
        themeName,
        mode,
      );
    };

    loadInitialTheme();

    // Subscribe to theme changes for live switching
    const unsubscribe = ThemeService.onThemeChange(
      (event: ThemeChangeEvent) => {
        console.info(
          '[CustomThemeProvider] Theme change event received:',
          event.themeName,
        );
        setSelectedTheme(event.theme);
        if (event.colorMode) {
          setColorMode(event.colorMode);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Show loading or use default theme while loading
  if (isLoading || !selectedTheme) {
    const defaultTheme = getThemeByName('default');
    return (
      <ThemeProvider theme={defaultTheme}>
        {children}
      </ThemeProvider>
    );
  }

  // Render with the selected theme
  return (
    <ThemeProvider theme={selectedTheme}>
      {children}
    </ThemeProvider>
  );
};
