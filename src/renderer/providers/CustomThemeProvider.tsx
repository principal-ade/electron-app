import React, { useEffect, useState } from 'react';
import { ThemeProvider } from '@principal-ade/industry-theme';
import type { Theme } from '@principal-ade/industry-theme';
import { ThemeService, ThemeChangeEvent } from '../services/ThemeService';
import { getThemeByName } from '../themes/predefinedThemes';

interface CustomThemeProviderProps {
  children: React.ReactNode;
  /**
   * Optional workspace theme name to override user's global theme preference.
   * Used in workspace-specific windows to apply the workspace's theme.
   */
  workspaceThemeName?: string;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({
  children,
  workspaceThemeName,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<Theme | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial theme preferences
    const loadInitialTheme = async () => {
      await ThemeService.loadPreferences();

      // Use workspace theme if provided, otherwise use user's global preference
      const themeName = workspaceThemeName || ThemeService.getCurrentThemeName();
      const theme = await ThemeService.getActiveTheme(themeName);

      if (theme) {
        setSelectedTheme(theme);
      }
      setIsLoading(false);

      console.info('[CustomThemeProvider] Initial theme loaded:', themeName, workspaceThemeName ? '(workspace override)' : '(user preference)');
    };

    loadInitialTheme();

    // Only subscribe to theme changes if not using workspace override
    // Workspace windows should maintain their theme regardless of global changes
    if (workspaceThemeName) {
      return undefined;
    }

    // Subscribe to theme changes for live switching
    const unsubscribe = ThemeService.onThemeChange(
      (event: ThemeChangeEvent) => {
        console.info(
          '[CustomThemeProvider] Theme change event received:',
          event.themeName,
        );
        setSelectedTheme(event.theme);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [workspaceThemeName]);

  // Show loading or use default theme while loading
  if (isLoading || !selectedTheme) {
    const defaultTheme = getThemeByName('principalAI');
    return <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>;
  }

  // Render with the selected theme
  return <ThemeProvider theme={selectedTheme}>{children}</ThemeProvider>;
};
