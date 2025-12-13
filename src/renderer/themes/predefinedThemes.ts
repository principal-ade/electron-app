import {
  type Theme,
  terminalTheme,
  regalTheme,
  glassmorphismTheme,
  matrixTheme,
  matrixMinimalTheme,
  slateTheme,
  defaultMarkdownTheme,
  defaultEditorTheme,
  defaultTerminalTheme,
  landingPageTheme,
  landingPageLightTheme,
} from '@principal-ade/industry-theme';

// Re-export themes from the library with metadata
export const predefinedThemes: Record<
  string,
  {
    name: string;
    description: string;
    theme: Theme;
  }
> = {
  principalAI: {
    name: 'Principal AI',
    description:
      'Modern AI-inspired theme with vibrant indigo and cyan accents',
    theme: landingPageTheme,
  },
  principalAILight: {
    name: 'Principal AI Light',
    description: 'Light variant of the Principal AI theme',
    theme: landingPageLightTheme,
  },
  terminal: {
    name: 'Terminal',
    description: 'Minimalistic developer-focused dark theme with transparency',
    theme: terminalTheme,
  },
  regal: {
    name: 'Regal',
    description: 'Dark Academia theme with warm amber gold accents',
    theme: regalTheme,
  },
  glassmorphism: {
    name: 'Glassmorphism',
    description: 'Modern transparent theme with blur effects',
    theme: glassmorphismTheme,
  },
  matrix: {
    name: 'Matrix',
    description: 'Cyberpunk hacker theme with green matrix effects',
    theme: matrixTheme,
  },
  matrixMinimal: {
    name: 'Matrix Minimal',
    description: 'Clean matrix theme without visual effects',
    theme: matrixMinimalTheme,
  },
  slate: {
    name: 'Slate',
    description: 'Professional slate gray theme',
    theme: slateTheme,
  },
  defaultMarkdown: {
    name: 'Default Markdown',
    description: 'Standard markdown theme',
    theme: defaultMarkdownTheme,
  },
  defaultEditor: {
    name: 'Default Editor',
    description: 'Standard editor theme',
    theme: defaultEditorTheme,
  },
  defaultTerminal: {
    name: 'Default Terminal',
    description: 'Standard terminal theme',
    theme: defaultTerminalTheme,
  },
};

// Get list of available theme names
export const getThemeNames = (): string[] => {
  return Object.keys(predefinedThemes);
};

// Get theme by name
export const getThemeByName = (name: string): Theme | undefined => {
  // If theme doesn't exist, fall back to 'principalAI' as default
  if (!predefinedThemes[name]) {
    console.warn(`Theme '${name}' not found, falling back to 'principalAI'`);
    return predefinedThemes['principalAI']?.theme;
  }
  return predefinedThemes[name]?.theme;
};

// Get theme info (name + description)
export const getThemeInfo = (name: string) => {
  const theme = predefinedThemes[name];
  if (theme) {
    return { name: theme.name, description: theme.description };
  }
  return undefined;
};

/**
 * Helper function to get the primary color from a workspace theme name.
 * Falls back to the provided fallback color if theme is not found.
 *
 * @param themeName - The theme name stored in workspace.theme (e.g., 'principalAI', 'regal')
 * @param fallbackColor - Color to use if theme is not found
 * @returns The primary color from the theme or the fallback color
 */
export const getWorkspaceThemeColor = (
  themeName: string | undefined,
  fallbackColor: string,
): string => {
  if (!themeName) {
    return fallbackColor;
  }

  const theme = getThemeByName(themeName);
  return theme?.colors.primary || fallbackColor;
};
