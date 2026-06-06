import {
  type Theme,
  terminalTheme,
  regalTheme,
  matrixTheme,
  matrixMinimalTheme,
  slateTheme,
  slateNeonTheme,
  slateGoldTheme,
  defaultMarkdownTheme,
  defaultEditorTheme,
  defaultTerminalTheme,
  landingPageTheme,
  landingPageLightTheme,
  iceTangerineTheme,
  iceTangerineDarkTheme,
} from '@principal-ade/industry-theme';

// Custom slate theme with our overrides
const customSlateTheme: Theme = {
  ...slateTheme,
  colors: {
    ...slateTheme.colors,
    accent: '#a8c5db', // Light blue tint
    primary: '#5b8bb8', // Steel blue - stronger blue
  },
  fonts: {
    ...slateTheme.fonts,
  },
};

// Transparent theme for loading state
const transparentTheme: Theme = {
  space: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 100, 128],
  fonts: {
    body: 'system-ui, -apple-system, sans-serif',
    heading: 'system-ui, -apple-system, sans-serif',
    monospace: 'monospace',
  },
  fontSizes: [12, 14, 16, 18, 20, 24, 32, 48, 64, 96],
  fontScale: 1,
  fontWeights: {
    body: 400,
    heading: 600,
    bold: 700,
    light: 300,
    medium: 500,
    semibold: 600,
  },
  lineHeights: {
    body: 1.6,
    heading: 1.2,
    tight: 1.05,
    relaxed: 1.7,
  },
  breakpoints: ['640px', '768px', '1024px', '1280px', '1400px'],
  sizes: [16, 32, 64, 128, 200, 240, 256, 300, 512, 740, 768, 820, 900, 1024, 1200, 1400, 1536],
  radii: [0, 2, 4, 6, 7, 8, 9, 10, 12, 14, 16, 24],
  shadows: ['none', 'none', 'none', 'none', 'none', 'none'],
  zIndices: [0, 1, 10, 20, 30, 40, 50, 1000],
  colors: {
    text: 'transparent',
    background: 'transparent',
    primary: 'transparent',
    secondary: 'transparent',
    accent: 'transparent',
    highlight: 'transparent',
    muted: 'transparent',
    success: 'transparent',
    warning: 'transparent',
    error: 'transparent',
    info: 'transparent',
    border: 'transparent',
    backgroundSecondary: 'transparent',
    backgroundTertiary: 'transparent',
    backgroundLight: 'transparent',
    backgroundHover: 'transparent',
    surface: 'transparent',
    textSecondary: 'transparent',
    textTertiary: 'transparent',
    textMuted: 'transparent',
    highlightBg: 'transparent',
    highlightBorder: 'transparent',
    textOnPrimary: 'transparent',
    textOnSecondary: 'transparent',
    textOnAccent: 'transparent',
  },
  buttons: {
    primary: {
      color: 'transparent',
      bg: 'transparent',
      borderWidth: 0,
      padding: '8px 20px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      '&:hover': {
        bg: 'transparent',
      },
    },
    secondary: {
      color: 'transparent',
      bg: 'transparent',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'transparent',
      padding: '8px 16px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      '&:hover': {
        bg: 'transparent',
        borderColor: 'transparent',
      },
    },
    ghost: {
      color: 'transparent',
      bg: 'transparent',
      borderWidth: 0,
      padding: '8px 16px',
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer',
      '&:hover': {
        color: 'transparent',
        bg: 'transparent',
      },
    },
  },
  text: {
    heading: {
      fontFamily: 'heading',
      fontWeight: 'heading',
      lineHeight: 'heading',
      color: 'transparent',
    },
    body: {
      fontFamily: 'body',
      fontWeight: 'body',
      lineHeight: 'body',
      color: 'transparent',
    },
    caption: {
      fontSize: 1,
      color: 'transparent',
    },
  },
  cards: {
    primary: {
      bg: 'transparent',
      border: '1px solid',
      borderColor: 'transparent',
      borderRadius: 4,
    },
    secondary: {
      bg: 'transparent',
      border: '1px solid',
      borderColor: 'transparent',
      borderRadius: 4,
    },
  },
};

// Re-export themes from the library with metadata
export const predefinedThemes: Record<
  string,
  {
    name: string;
    description: string;
    theme: Theme;
  }
> = {
  transparent: {
    name: 'Transparent',
    description: 'Transparent theme used during loading',
    theme: transparentTheme,
  },
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
  iceTangerine: {
    name: 'Ice Tangerine',
    description: 'Cool ice blue backgrounds with vibrant tangerine accents',
    theme: iceTangerineTheme,
  },
  iceTangerineDark: {
    name: 'Ice Tangerine Dark',
    description: 'Deep navy backgrounds with vibrant tangerine accents',
    theme: iceTangerineDarkTheme,
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
    theme: customSlateTheme,
  },
  slateNeon: {
    name: 'Slate Neon',
    description: 'Slate theme with vibrant neon accents',
    theme: slateNeonTheme,
  },
  slateGold: {
    name: 'Slate Gold',
    description: 'Slate theme with warm gold accents',
    theme: slateGoldTheme,
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

// Get list of available theme names. Excludes `transparent`, which is only
// used as a loading-state theme and shouldn't appear in user pickers.
export const getThemeNames = (): string[] => {
  return Object.keys(predefinedThemes).filter((name) => name !== 'transparent');
};

// Get theme by name
export const getThemeByName = (name: string): Theme | undefined => {
  // If theme doesn't exist, fall back to 'slateNeon' as default
  if (!predefinedThemes[name]) {
    console.warn(`Theme '${name}' not found, falling back to 'slateNeon'`);
    return predefinedThemes['slateNeon']?.theme;
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

// Export transparent theme for use as loading state
export { transparentTheme };
