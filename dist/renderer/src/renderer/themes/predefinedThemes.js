import { defaultTheme as coreTheme } from 'themed-markdown';
// Base theme structure to ensure consistency
const baseTheme = {
    space: [0, 4, 8, 16, 32, 64, 128, 256, 512],
    fonts: {
        body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        monospace: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Source Code Pro", monospace'
    },
    fontSizes: [12, 14, 16, 18, 20, 24, 32, 48, 64, 96],
    fontScale: 1,
    fontWeights: {
        body: 400,
        heading: 600,
        bold: 700,
        light: 300,
        medium: 500,
        semibold: 600
    },
    lineHeights: {
        body: 1.5,
        heading: 1.2,
        tight: 1.25,
        relaxed: 1.75
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
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
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
        modes: {
            dark: {
                text: '#FFFFFF',
                background: '#0F1419',
                primary: '#4A90E2',
                secondary: '#64B5F6',
                accent: '#6BA3E8',
                highlight: '#1A3A52',
                muted: '#1A1F2E',
                success: '#4CAF50',
                warning: '#FF9800',
                error: '#F44336',
                info: '#4A90E2',
                border: '#3A4556',
                backgroundSecondary: '#1A1F2E',
                backgroundTertiary: '#2A3441',
                backgroundLight: '#232937',
                backgroundHover: '#2A3441',
                surface: '#1A1F2E',
                textSecondary: '#E0E7FF',
                textTertiary: '#A5B4CD',
                textMuted: '#8B9AAF'
            }
        }
    },
    buttons: {
        primary: {
            color: 'background',
            bg: 'primary',
            '&:hover': {
                bg: 'secondary'
            }
        },
        secondary: {
            color: 'text',
            bg: 'muted',
            '&:hover': {
                bg: 'backgroundSecondary'
            }
        },
        ghost: {
            color: 'primary',
            bg: 'transparent',
            '&:hover': {
                bg: 'muted'
            }
        }
    },
    text: {
        heading: {
            fontFamily: 'heading',
            fontWeight: 'heading',
            lineHeight: 'heading'
        },
        body: {
            fontFamily: 'body',
            fontWeight: 'body',
            lineHeight: 'body'
        },
        caption: {
            fontSize: 1,
            color: 'textSecondary'
        }
    },
    cards: {
        primary: {
            bg: 'background',
            border: '1px solid',
            borderColor: 'border',
            borderRadius: 2
        },
        secondary: {
            bg: 'backgroundSecondary',
            border: '1px solid',
            borderColor: 'border',
            borderRadius: 2
        }
    }
};
// Icon theme configurations for each theme
export const iconThemes = {
    default: {
        eyeColor: '#1976D2', // Matching primary blue
        style: 'gradient'
    },
    professional: {
        eyeColor: '#003D82', // Deep professional blue
        style: 'solid'
    },
    ocean: {
        eyeColor: '#0891B2', // Ocean teal
        style: 'glow'
    },
    sunset: {
        eyeColor: '#EA580C', // Warm orange
        style: 'gradient'
    },
    minimal: {
        eyeColor: '#6B7280', // Subtle gray
        style: 'solid'
    },
    highContrast: {
        eyeColor: '#0000FF', // Pure blue for high contrast
        style: 'solid'
    }
};
export const predefinedThemes = {
    default: {
        name: 'Default',
        description: 'Dark Academia theme with muted gold accents',
        theme: { ...coreTheme },
        iconTheme: iconThemes.default
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
                modes: {
                    dark: {
                        text: '#F9FAFB',
                        background: '#0F172A',
                        primary: '#60A5FA',
                        secondary: '#3B82F6',
                        accent: '#2563EB',
                        highlight: '#1E3A8A',
                        muted: '#1E293B',
                        success: '#10B981',
                        warning: '#F59E0B',
                        error: '#EF4444',
                        info: '#06B6D4',
                        border: '#334155',
                        backgroundSecondary: '#1E293B',
                        backgroundTertiary: '#334155',
                        backgroundLight: '#1E293B',
                        backgroundHover: '#2563EB20',
                        surface: '#1E293B',
                        textSecondary: '#CBD5E1',
                        textTertiary: '#94A3B8',
                        textMuted: '#64748B'
                    }
                }
            }
        }
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
                modes: {
                    dark: {
                        text: '#E0F2FE',
                        background: '#082F49',
                        primary: '#22D3EE',
                        secondary: '#06B6D4',
                        accent: '#0EA5E9',
                        highlight: '#0C4A6E',
                        muted: '#083344',
                        success: '#10B981',
                        warning: '#FBBF24',
                        error: '#F87171',
                        info: '#38BDF8',
                        border: '#0E7490',
                        backgroundSecondary: '#083344',
                        backgroundTertiary: '#164E63',
                        backgroundLight: '#0C4A6E',
                        backgroundHover: '#0891B220',
                        surface: '#083344',
                        textSecondary: '#7DD3C0',
                        textTertiary: '#5EEAD4',
                        textMuted: '#22D3EE'
                    }
                }
            }
        }
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
                modes: {
                    dark: {
                        text: '#FFF7ED',
                        background: '#431407',
                        primary: '#FB923C',
                        secondary: '#F97316',
                        accent: '#EA580C',
                        highlight: '#7C2D12',
                        muted: '#451A03',
                        success: '#10B981',
                        warning: '#FBBF24',
                        error: '#F87171',
                        info: '#A78BFA',
                        border: '#92400E',
                        backgroundSecondary: '#451A03',
                        backgroundTertiary: '#7C2D12',
                        backgroundLight: '#92400E',
                        backgroundHover: '#EA580C20',
                        surface: '#451A03',
                        textSecondary: '#FDBA74',
                        textTertiary: '#FED7AA',
                        textMuted: '#FB923C'
                    }
                }
            }
        }
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
                modes: {
                    dark: {
                        text: '#F9FAFB',
                        background: '#111827',
                        primary: '#D1D5DB',
                        secondary: '#9CA3AF',
                        accent: '#E5E7EB',
                        highlight: '#374151',
                        muted: '#1F2937',
                        success: '#10B981',
                        warning: '#F59E0B',
                        error: '#EF4444',
                        info: '#3B82F6',
                        border: '#4B5563',
                        backgroundSecondary: '#1F2937',
                        backgroundTertiary: '#374151',
                        backgroundLight: '#374151',
                        backgroundHover: '#4B5563',
                        surface: '#1F2937',
                        textSecondary: '#D1D5DB',
                        textTertiary: '#9CA3AF',
                        textMuted: '#6B7280'
                    }
                }
            }
        }
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
                modes: {
                    dark: {
                        text: '#FFFFFF',
                        background: '#000000',
                        primary: '#00FFFF',
                        secondary: '#00CCFF',
                        accent: '#0099FF',
                        highlight: '#FFFF00',
                        muted: '#1A1A1A',
                        success: '#00FF00',
                        warning: '#FFA500',
                        error: '#FF4444',
                        info: '#00FFFF',
                        border: '#FFFFFF',
                        backgroundSecondary: '#1A1A1A',
                        backgroundTertiary: '#333333',
                        backgroundLight: '#0A0A0A',
                        backgroundHover: '#FFFF00',
                        surface: '#1A1A1A',
                        textSecondary: '#CCCCCC',
                        textTertiary: '#999999',
                        textMuted: '#666666'
                    }
                }
            }
        }
    }
};
// Get list of available theme names
export const getThemeNames = () => {
    return Object.keys(predefinedThemes);
};
// Get theme by name
export const getThemeByName = (name) => {
    return predefinedThemes[name]?.theme;
};
// Get theme info (name + description)
export const getThemeInfo = (name) => {
    const theme = predefinedThemes[name];
    if (theme) {
        return { name: theme.name, description: theme.description };
    }
    return undefined;
};
