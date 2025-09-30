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
} from '@a24z/industry-theme';

// Icon theme configurations for each theme
export const iconThemes = {
  default: {
    eyeColor: '#66b3ff', // Terminal blue to match the theme
    style: 'gradient' as const,
  },
  regal: {
    eyeColor: '#d4a574', // Warm amber gold from regal theme
    style: 'gradient' as const,
  },
  glassmorphism: {
    eyeColor: '#6366f1', // Indigo from glassmorphism theme
    style: 'glow' as const,
  },
  matrix: {
    eyeColor: '#00ff00', // Classic matrix green
    style: 'glow' as const,
  },
  matrixMinimal: {
    eyeColor: '#00ff00', // Classic matrix green
    style: 'solid' as const,
  },
  slate: {
    eyeColor: '#94a3b8', // Slate blue-gray
    style: 'solid' as const,
  },
  defaultMarkdown: {
    eyeColor: '#66b3ff', // Standard blue
    style: 'gradient' as const,
  },
  defaultEditor: {
    eyeColor: '#66b3ff', // Standard blue
    style: 'gradient' as const,
  },
  defaultTerminal: {
    eyeColor: '#66b3ff', // Terminal blue
    style: 'gradient' as const,
  },
};

// Re-export themes from the library with metadata
export const predefinedThemes: Record<
  string,
  {
    name: string;
    description: string;
    theme: Theme;
    iconTheme?: { eyeColor: string; style: 'gradient' | 'solid' | 'glow' };
  }
> = {
  terminal: {
    name: 'Terminal',
    description: 'Minimalistic developer-focused dark theme with transparency',
    theme: terminalTheme,
    iconTheme: iconThemes.default,
  },
  regal: {
    name: 'Regal',
    description: 'Dark Academia theme with warm amber gold accents',
    theme: regalTheme,
    iconTheme: iconThemes.regal,
  },
  glassmorphism: {
    name: 'Glassmorphism',
    description: 'Modern transparent theme with blur effects',
    theme: glassmorphismTheme,
    iconTheme: iconThemes.glassmorphism,
  },
  matrix: {
    name: 'Matrix',
    description: 'Cyberpunk hacker theme with green matrix effects',
    theme: matrixTheme,
    iconTheme: iconThemes.matrix,
  },
  matrixMinimal: {
    name: 'Matrix Minimal',
    description: 'Clean matrix theme without visual effects',
    theme: matrixMinimalTheme,
    iconTheme: iconThemes.matrixMinimal,
  },
  slate: {
    name: 'Slate',
    description: 'Professional slate gray theme',
    theme: slateTheme,
    iconTheme: iconThemes.slate,
  },
  defaultMarkdown: {
    name: 'Default Markdown',
    description: 'Standard markdown theme',
    theme: defaultMarkdownTheme,
    iconTheme: iconThemes.defaultMarkdown,
  },
  defaultEditor: {
    name: 'Default Editor',
    description: 'Standard editor theme',
    theme: defaultEditorTheme,
    iconTheme: iconThemes.defaultEditor,
  },
  defaultTerminal: {
    name: 'Default Terminal',
    description: 'Standard terminal theme',
    theme: defaultTerminalTheme,
    iconTheme: iconThemes.defaultTerminal,
  },
};

// Get list of available theme names
export const getThemeNames = (): string[] => {
  return Object.keys(predefinedThemes);
};

// Get theme by name
export const getThemeByName = (name: string): Theme | undefined => {
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