/**
 * Theme Schema Definitions
 *
 * Provides documentation for theme properties to educate users
 * on what can be customized via the Principal MCP Bridge.
 */

export interface ThemeSchemaProperty {
  path: string;
  type: 'string' | 'number' | 'array' | 'object';
  description: string;
  example?: string | number;
  category: 'colors' | 'fonts' | 'fontWeights' | 'lineHeights' | 'spacing' | 'other';
}

/**
 * Complete schema of customizable theme properties
 */
export const THEME_SCHEMA: ThemeSchemaProperty[] = [
  // ============ COLORS ============
  {
    path: 'colors.primary',
    type: 'string',
    description: 'Primary brand color used for buttons, links, and highlights',
    example: '#6366f1',
    category: 'colors',
  },
  {
    path: 'colors.secondary',
    type: 'string',
    description: 'Secondary accent color for less prominent elements',
    example: '#8b5cf6',
    category: 'colors',
  },
  {
    path: 'colors.accent',
    type: 'string',
    description: 'Accent color for emphasis and special elements',
    example: '#22d3ee',
    category: 'colors',
  },
  {
    path: 'colors.background',
    type: 'string',
    description: 'Main background color of the application',
    example: '#0a0a0a',
    category: 'colors',
  },
  {
    path: 'colors.backgroundSecondary',
    type: 'string',
    description: 'Secondary background for cards, panels, and nested containers',
    example: '#1a1a1a',
    category: 'colors',
  },
  {
    path: 'colors.backgroundTertiary',
    type: 'string',
    description: 'Tertiary background for deeply nested elements',
    example: '#2a2a2a',
    category: 'colors',
  },
  {
    path: 'colors.backgroundLight',
    type: 'string',
    description: 'Light background variant for contrast',
    example: '#f5f5f5',
    category: 'colors',
  },
  {
    path: 'colors.backgroundHover',
    type: 'string',
    description: 'Background color on hover states',
    example: '#262626',
    category: 'colors',
  },
  {
    path: 'colors.surface',
    type: 'string',
    description: 'Surface color for elevated elements like modals',
    example: '#1f1f1f',
    category: 'colors',
  },
  {
    path: 'colors.text',
    type: 'string',
    description: 'Primary text color for main content',
    example: '#ffffff',
    category: 'colors',
  },
  {
    path: 'colors.textSecondary',
    type: 'string',
    description: 'Secondary text color for less important content',
    example: '#a0a0a0',
    category: 'colors',
  },
  {
    path: 'colors.textTertiary',
    type: 'string',
    description: 'Tertiary text color for subtle content',
    example: '#707070',
    category: 'colors',
  },
  {
    path: 'colors.textMuted',
    type: 'string',
    description: 'Heavily muted text for disabled or placeholder content',
    example: '#666666',
    category: 'colors',
  },
  {
    path: 'colors.textOnPrimary',
    type: 'string',
    description: 'Text color when displayed on primary-colored backgrounds',
    example: '#ffffff',
    category: 'colors',
  },
  {
    path: 'colors.border',
    type: 'string',
    description: 'Primary border color for dividers and outlines',
    example: '#333333',
    category: 'colors',
  },
  {
    path: 'colors.highlight',
    type: 'string',
    description: 'Highlight color for selected or focused elements',
    example: '#fbbf24',
    category: 'colors',
  },
  {
    path: 'colors.highlightBg',
    type: 'string',
    description: 'Background color for highlighted areas',
    example: '#fbbf2420',
    category: 'colors',
  },
  {
    path: 'colors.highlightBorder',
    type: 'string',
    description: 'Border color for highlighted elements',
    example: '#fbbf24',
    category: 'colors',
  },
  {
    path: 'colors.muted',
    type: 'string',
    description: 'Muted background color for subtle emphasis',
    example: '#262626',
    category: 'colors',
  },
  {
    path: 'colors.success',
    type: 'string',
    description: 'Success/positive status color',
    example: '#22c55e',
    category: 'colors',
  },
  {
    path: 'colors.warning',
    type: 'string',
    description: 'Warning/caution status color',
    example: '#f59e0b',
    category: 'colors',
  },
  {
    path: 'colors.error',
    type: 'string',
    description: 'Error/negative status color',
    example: '#ef4444',
    category: 'colors',
  },
  {
    path: 'colors.info',
    type: 'string',
    description: 'Informational status color',
    example: '#3b82f6',
    category: 'colors',
  },

  // ============ FONTS ============
  {
    path: 'fonts.body',
    type: 'string',
    description: 'Font family for body text and general content',
    example: 'Inter, system-ui, -apple-system, sans-serif',
    category: 'fonts',
  },
  {
    path: 'fonts.heading',
    type: 'string',
    description: 'Font family for headings and titles',
    example: 'Inter, system-ui, -apple-system, sans-serif',
    category: 'fonts',
  },
  {
    path: 'fonts.monospace',
    type: 'string',
    description: 'Font family for code and monospace content',
    example: 'JetBrains Mono, Fira Code, monospace',
    category: 'fonts',
  },

  // ============ FONT WEIGHTS ============
  {
    path: 'fontWeights.light',
    type: 'number',
    description: 'Light font weight value',
    example: 300,
    category: 'fontWeights',
  },
  {
    path: 'fontWeights.body',
    type: 'number',
    description: 'Default body text font weight',
    example: 400,
    category: 'fontWeights',
  },
  {
    path: 'fontWeights.medium',
    type: 'number',
    description: 'Medium font weight value',
    example: 500,
    category: 'fontWeights',
  },
  {
    path: 'fontWeights.semibold',
    type: 'number',
    description: 'Semi-bold font weight value',
    example: 600,
    category: 'fontWeights',
  },
  {
    path: 'fontWeights.heading',
    type: 'number',
    description: 'Heading font weight value',
    example: 600,
    category: 'fontWeights',
  },
  {
    path: 'fontWeights.bold',
    type: 'number',
    description: 'Bold font weight value',
    example: 700,
    category: 'fontWeights',
  },

  // ============ LINE HEIGHTS ============
  {
    path: 'lineHeights.tight',
    type: 'number',
    description: 'Tight line height for compact text',
    example: 1.05,
    category: 'lineHeights',
  },
  {
    path: 'lineHeights.heading',
    type: 'number',
    description: 'Line height for headings',
    example: 1.2,
    category: 'lineHeights',
  },
  {
    path: 'lineHeights.body',
    type: 'number',
    description: 'Line height for body text',
    example: 1.6,
    category: 'lineHeights',
  },
  {
    path: 'lineHeights.relaxed',
    type: 'number',
    description: 'Relaxed line height for readable paragraphs',
    example: 1.7,
    category: 'lineHeights',
  },
];

/**
 * Get schema properties by category
 */
export function getSchemaByCategory(category: ThemeSchemaProperty['category']): ThemeSchemaProperty[] {
  return THEME_SCHEMA.filter(prop => prop.category === category);
}

/**
 * Get all unique categories
 */
export function getSchemaCategories(): ThemeSchemaProperty['category'][] {
  return [...new Set(THEME_SCHEMA.map(prop => prop.category))];
}

/**
 * Find a schema property by path
 */
export function getSchemaProperty(path: string): ThemeSchemaProperty | undefined {
  return THEME_SCHEMA.find(prop => prop.path === path);
}

/**
 * Validate that a property path exists in the schema
 */
export function isValidPropertyPath(path: string): boolean {
  return THEME_SCHEMA.some(prop => prop.path === path);
}
