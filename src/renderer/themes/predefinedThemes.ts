import { Theme, defaultTheme as coreTheme } from 'themed-markdown';

// Base theme structure to ensure consistency
const baseTheme: Theme = {
  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],
  fonts: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    heading:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    monospace:
      '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", monospace',
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
    body: 1.5,
    heading: 1.2,
    tight: 1.25,
    relaxed: 1.75,
  },
  breakpoints: ['640px', '768px', '1024px', '1280px'],
  sizes: [16, 32, 64, 128, 256, 512, 768, 1024, 1536],
  radii: [0, 2, 4, 6, 8, 12, 16, 24],
  shadows: [
    'none',
    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  ],
  zIndices: [0, 1, 10, 20, 30, 40, 50],
  colors: {
    text: '#0F1419',
    background: '#FFFFFF',
    primary: '#1976D2',
    secondary: '#90CAF9',
    accent: '#42A5F5',
    highlight: '#E3F2FD',
    muted: '#F5F8FB',
    success: '#2E7D32',
    warning: '#F57C00',
    error: '#C62828',
    info: '#1976D2',
    border: '#CBD5E1',
    backgroundSecondary: '#F5F8FB',
    backgroundTertiary: '#EBF2FA',
    backgroundLight: '#F0F4F8',
    backgroundHover: '#E3F2FD',
    surface: '#FFFFFF',
    textSecondary: '#334155',
    textTertiary: '#64748B',
    textMuted: '#94A3B8',
  },
  buttons: {
    primary: {
      color: 'background',
      bg: 'primary',
      '&:hover': {
        bg: 'secondary',
      },
    },
    secondary: {
      color: 'text',
      bg: 'muted',
      '&:hover': {
        bg: 'backgroundSecondary',
      },
    },
    ghost: {
      color: 'primary',
      bg: 'transparent',
      '&:hover': {
        bg: 'muted',
      },
    },
  },
  text: {
    heading: {
      fontFamily: 'heading',
      fontWeight: 'heading',
      lineHeight: 'heading',
    },
    body: {
      fontFamily: 'body',
      fontWeight: 'body',
      lineHeight: 'body',
    },
    caption: {
      fontSize: 1,
      color: 'textSecondary',
    },
  },
  cards: {
    primary: {
      bg: 'background',
      border: '1px solid',
      borderColor: 'border',
      borderRadius: 2,
    },
    secondary: {
      bg: 'backgroundSecondary',
      border: '1px solid',
      borderColor: 'border',
      borderRadius: 2,
    },
  },
};

// Icon theme configurations for each theme
export const iconThemes = {
  default: {
    eyeColor: '#1976D2', // Matching primary blue
    style: 'gradient' as const,
  },
  professional: {
    eyeColor: '#003D82', // Deep professional blue
    style: 'solid' as const,
  },
  ocean: {
    eyeColor: '#0891B2', // Ocean teal
    style: 'glow' as const,
  },
  sunset: {
    eyeColor: '#EA580C', // Warm orange
    style: 'gradient' as const,
  },
  minimal: {
    eyeColor: '#6B7280', // Subtle gray
    style: 'solid' as const,
  },
  highContrast: {
    eyeColor: '#0000FF', // Pure blue for high contrast
    style: 'solid' as const,
  },
};

export const predefinedThemes: Record<
  string,
  {
    name: string;
    description: string;
    theme: Theme;
    iconTheme?: { eyeColor: string; style: 'gradient' | 'solid' | 'glow' };
  }
> = {
  default: {
    name: 'Default',
    description: 'Dark Academia theme with muted gold accents',
    theme: { ...coreTheme },
    iconTheme: iconThemes.default,
  },
  professional: {
    name: 'Professional',
    description: 'Corporate-friendly dark blue theme',
    iconTheme: iconThemes.professional,
    theme: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        text: '#1A202C',
        background: '#FAFBFC',
        primary: '#003D82',
        secondary: '#5B8DC9',
        accent: '#2563EB',
        highlight: '#DBEAFE',
        muted: '#F1F5F9',
        success: '#059669',
        warning: '#D97706',
        error: '#DC2626',
        info: '#0284C7',
        border: '#CBD5E1',
        backgroundSecondary: '#F1F5F9',
        backgroundTertiary: '#E2E8F0',
        backgroundLight: '#F8FAFC',
        backgroundHover: '#E0E7FF',
        surface: '#FFFFFF',
        textSecondary: '#475569',
        textTertiary: '#64748B',
        textMuted: '#94A3B8',
      },
    },
  },
  ocean: {
    name: 'Ocean',
    description: 'Cool ocean blues and teals for a calm, professional look',
    iconTheme: iconThemes.ocean,
    theme: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        text: '#0C4A6E',
        background: '#F0F9FF',
        primary: '#0891B2',
        secondary: '#06B6D4',
        accent: '#0EA5E9',
        highlight: '#BAE6FD',
        muted: '#E0F2FE',
        success: '#059669',
        warning: '#F59E0B',
        error: '#DC2626',
        info: '#0891B2',
        border: '#7DD3C0',
        backgroundSecondary: '#E0F2FE',
        backgroundTertiary: '#CFFAFE',
        backgroundLight: '#F0F9FF',
        backgroundHover: '#BAE6FD',
        surface: '#FFFFFF',
        textSecondary: '#075985',
        textTertiary: '#0C4A6E',
        textMuted: '#0E7490',
      },
    },
  },
  sunset: {
    name: 'Sunset',
    description: 'Warm sunset colors with orange and purple accents',
    iconTheme: iconThemes.sunset,
    theme: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        text: '#451A03',
        background: '#FFF7ED',
        primary: '#EA580C',
        secondary: '#FB923C',
        accent: '#F97316',
        highlight: '#FED7AA',
        muted: '#FFEDD5',
        success: '#059669',
        warning: '#F59E0B',
        error: '#DC2626',
        info: '#8B5CF6',
        border: '#FDBA74',
        backgroundSecondary: '#FFEDD5',
        backgroundTertiary: '#FED7AA',
        backgroundLight: '#FFF7ED',
        backgroundHover: '#FDBA74',
        surface: '#FFFFFF',
        textSecondary: '#7C2D12',
        textTertiary: '#9A3412',
        textMuted: '#C2410C',
      },
    },
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean, minimal styling with subtle grays',
    iconTheme: iconThemes.minimal,
    theme: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        text: '#111827',
        background: '#FFFFFF',
        primary: '#6B7280',
        secondary: '#9CA3AF',
        accent: '#4B5563',
        highlight: '#F3F4F6',
        muted: '#F9FAFB',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        border: '#E5E7EB',
        backgroundSecondary: '#F9FAFB',
        backgroundTertiary: '#F3F4F6',
        backgroundLight: '#FFFFFF',
        backgroundHover: '#E5E7EB',
        surface: '#FFFFFF',
        textSecondary: '#4B5563',
        textTertiary: '#6B7280',
        textMuted: '#9CA3AF',
      },
    },
  },
  highContrast: {
    name: 'High Contrast',
    description: 'Maximum contrast for accessibility',
    iconTheme: iconThemes.highContrast,
    theme: {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        text: '#000000',
        background: '#FFFFFF',
        primary: '#0000FF',
        secondary: '#0066CC',
        accent: '#0033AA',
        highlight: '#FFFF00',
        muted: '#F0F0F0',
        success: '#008000',
        warning: '#FF8C00',
        error: '#FF0000',
        info: '#0000FF',
        border: '#000000',
        backgroundSecondary: '#F0F0F0',
        backgroundTertiary: '#E0E0E0',
        backgroundLight: '#FAFAFA',
        backgroundHover: '#FFFF00',
        surface: '#FFFFFF',
        textSecondary: '#333333',
        textTertiary: '#666666',
        textMuted: '#999999',
      },
    },
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
