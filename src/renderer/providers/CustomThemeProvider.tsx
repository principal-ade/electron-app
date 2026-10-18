import React, { useEffect, useState } from 'react';
import {
  ThemeProvider,
  slateNeonTheme,
  type Theme,
} from '@principal-ade/industry-theme';
import { ThemeService, ThemeChangeEvent } from '../services/ThemeService';
import { getThemeByName } from '../themes/predefinedThemes';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';

interface CustomThemeProviderProps {
  children: React.ReactNode;
  /**
   * Optional workspace theme name to override user's global theme preference.
   * Used in workspace-specific windows to apply the workspace's theme.
   */
  workspaceThemeName?: string;
}

/**
 * Resolve a real theme synchronously so the app never renders under a stub.
 *
 * The user's saved theme is loaded asynchronously (`ThemeService.loadPreferences`),
 * but `ThemeService` already carries a sane default (`slateNeon`, dark) before
 * that resolves. Seeding from it means the first frame paints a normal theme and
 * simply swaps once the preference lands — instead of rendering a fully
 * transparent placeholder (which painted no background, so surfaces that draw
 * with `theme.colors.background` let the raw window show through — a white
 * screen).
 */
function initialTheme(workspaceThemeName?: string): Theme {
  const name = workspaceThemeName || ThemeService.getCurrentThemeName();
  return getThemeByName(name) ?? slateNeonTheme;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({
  children,
  workspaceThemeName,
}) => {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(() =>
    initialTheme(workspaceThemeName),
  );

  useEffect(() => {
    // Load initial theme preferences and swap in the resolved theme.
    const loadInitialTheme = async () => {
      await ThemeService.loadPreferences();

      // Use workspace theme if provided, otherwise use user's global preference
      const themeName =
        workspaceThemeName || ThemeService.getCurrentThemeName();
      const theme = await ThemeService.getActiveTheme(themeName);

      if (theme) {
        setSelectedTheme(theme);
      }

      console.info(
        '[CustomThemeProvider] Initial theme loaded:',
        themeName,
        workspaceThemeName ? '(workspace override)' : '(user preference)',
      );
    };

    loadInitialTheme();

    // Only subscribe to theme changes if not using workspace override
    // Workspace windows should maintain their theme regardless of global changes
    if (workspaceThemeName) {
      return undefined;
    }

    // Subscribe to theme changes for live switching
    const unsubscribeTheme = ThemeService.onThemeChange(
      (event: ThemeChangeEvent) => {
        console.info(
          '[CustomThemeProvider] Theme change event received:',
          event.themeName,
        );
        setSelectedTheme(event.theme);
      },
    );

    // Subscribe to preference changes (e.g., from HTTP API via main process)
    // Re-apply theme when customThemeOverrides change
    const unsubscribePrefs = UserPreferencesService.onPreferencesUpdated(
      async (prefs) => {
        if (prefs.customThemeOverrides) {
          console.info(
            '[CustomThemeProvider] Preferences updated, re-applying theme',
          );
          const currentThemeName = ThemeService.getCurrentThemeName();
          const theme = await ThemeService.getActiveTheme(currentThemeName);
          if (theme) {
            setSelectedTheme(theme);
          }
        }
      },
    );

    return () => {
      unsubscribeTheme();
      unsubscribePrefs();
    };
  }, [workspaceThemeName]);

  return (
    <ThemeProvider theme={selectedTheme} initialMode="light">
      {children}
    </ThemeProvider>
  );
};
