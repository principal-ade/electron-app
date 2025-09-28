import { useTheme } from 'themed-markdown';
import { useMemo } from 'react';
import type { PanelTheme } from '@a24z/panels';

/**
 * Hook to get the panels theme configuration based on the current app theme
 */
export const usePanelsTheme = (): PanelTheme => {
  const { theme } = useTheme();

  return useMemo<PanelTheme>(() => ({
    background: theme.colors.backgroundSecondary,
    border: theme.colors.border,
    handle: theme.colors.border,
    handleHover: `${theme.colors.primary}40`, // 40 = 25% opacity in hex
    handleActive: theme.colors.primary,
    buttonBackground: theme.colors.backgroundLight,
    buttonHover: theme.colors.backgroundSecondary,
    buttonBorder: theme.colors.border,
    buttonIcon: theme.colors.textSecondary,
  }), [theme]);
};