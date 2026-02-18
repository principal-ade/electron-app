/**
 * Docs Theme Validator
 * Validates and merges custom theme configurations
 */

import type { Theme } from '@principal-ade/industry-theme';
import type {
  DocsThemeConfig,
  ThemeValidationResult,
} from '../../shared/types/docsTheme.types';
import { defaultTheme } from 'themed-markdown';

/**
 * Validate a color string (hex, rgb, rgba, hsl, etc.)
 */
function isValidColor(color: string): boolean {
  if (!color || typeof color !== 'string') return false;

  // Check for common color formats
  const patterns = [
    /^#[0-9A-Fa-f]{3}$/, // #RGB
    /^#[0-9A-Fa-f]{6}$/, // #RRGGBB
    /^#[0-9A-Fa-f]{8}$/, // #RRGGBBAA
    /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i, // rgb(r, g, b)
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i, // rgba(r, g, b, a)
    /^hsl\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*\)$/i, // hsl(h, s, l)
    /^hsla\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*,\s*[\d.]+\s*\)$/i, // hsla(h, s, l, a)
  ];

  return patterns.some((pattern) => pattern.test(color.trim()));
}

/**
 * Validate font family string
 */
function isValidFontFamily(font: string): boolean {
  if (!font || typeof font !== 'string') return false;
  return font.length > 0 && font.length < 500; // Basic sanity check
}

/**
 * Deep merge two objects, with source overriding target
 */
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.hasOwn(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue === undefined) continue;

      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge objects
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        // Override with source value
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Validate and merge a docs theme configuration
 */
export function validateDocsTheme(config: unknown): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if config is an object
  if (!config || typeof config !== 'object') {
    return {
      valid: false,
      errors: ['Theme configuration must be a valid JSON object'],
    };
  }

  const themeConfig = config as DocsThemeConfig;

  // Validate colors if provided
  if (themeConfig.colors) {
    if (typeof themeConfig.colors !== 'object') {
      errors.push('colors must be an object');
    } else {
      for (const [key, value] of Object.entries(themeConfig.colors)) {
        if (value !== undefined && !isValidColor(value)) {
          errors.push(`Invalid color value for colors.${key}: "${value}"`);
        }
      }
    }
  }

  // Validate fonts if provided
  if (themeConfig.fonts) {
    if (typeof themeConfig.fonts !== 'object') {
      errors.push('fonts must be an object');
    } else {
      for (const [key, value] of Object.entries(themeConfig.fonts)) {
        if (value !== undefined && !isValidFontFamily(value)) {
          errors.push(`Invalid font value for fonts.${key}`);
        }
      }
    }
  }

  // Validate font sizes if provided
  if (themeConfig.fontSizes) {
    if (!Array.isArray(themeConfig.fontSizes)) {
      errors.push('fontSizes must be an array');
    } else if (
      !themeConfig.fontSizes.every(
        (size) => typeof size === 'number' && size > 0,
      )
    ) {
      errors.push('fontSizes must be an array of positive numbers');
    }
  }

  // Validate font scale if provided
  if (themeConfig.fontScale !== undefined) {
    if (
      typeof themeConfig.fontScale !== 'number' ||
      themeConfig.fontScale <= 0 ||
      themeConfig.fontScale > 3
    ) {
      errors.push('fontScale must be a number between 0 and 3');
    }
  }

  // Validate font weights if provided
  if (themeConfig.fontWeights) {
    if (typeof themeConfig.fontWeights !== 'object') {
      errors.push('fontWeights must be an object');
    } else {
      for (const [key, value] of Object.entries(themeConfig.fontWeights)) {
        if (
          value !== undefined &&
          (typeof value !== 'number' || value < 100 || value > 900)
        ) {
          errors.push(
            `Invalid font weight for fontWeights.${key}: must be between 100 and 900`,
          );
        }
      }
    }
  }

  // Validate line heights if provided
  if (themeConfig.lineHeights) {
    if (typeof themeConfig.lineHeights !== 'object') {
      errors.push('lineHeights must be an object');
    } else {
      for (const [key, value] of Object.entries(themeConfig.lineHeights)) {
        if (
          value !== undefined &&
          (typeof value !== 'number' || value <= 0 || value > 5)
        ) {
          errors.push(
            `Invalid line height for lineHeights.${key}: must be between 0 and 5`,
          );
        }
      }
    }
  }

  // Add warnings for unknown properties
  const knownTopLevelKeys = [
    'name',
    'description',
    'colors',
    'fonts',
    'fontSizes',
    'fontScale',
    'fontWeights',
    'lineHeights',
  ];
  for (const key of Object.keys(themeConfig)) {
    if (!knownTopLevelKeys.includes(key)) {
      warnings.push(`Unknown property "${key}" will be ignored`);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  // Merge with default theme
  try {
    const mergedTheme = createMergedTheme(defaultTheme, themeConfig);

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      mergedTheme,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Failed to merge theme: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
      warnings,
    };
  }
}

/**
 * Create a merged theme from base and custom config
 */
export function createMergedTheme(
  baseTheme: Theme,
  config: DocsThemeConfig,
): Theme {
  const mergedTheme = { ...baseTheme };

  // Merge colors
  if (config.colors) {
    mergedTheme.colors = deepMerge(mergedTheme.colors, {
      ...config.colors,
    } as any);
  }

  // Merge fonts
  if (config.fonts) {
    mergedTheme.fonts = { ...mergedTheme.fonts, ...config.fonts };
  }

  // Override font sizes
  if (config.fontSizes) {
    mergedTheme.fontSizes = config.fontSizes;
  }

  // Apply font scale
  if (config.fontScale !== undefined) {
    mergedTheme.fontScale = config.fontScale;
  }

  // Merge font weights
  if (config.fontWeights) {
    mergedTheme.fontWeights = {
      ...mergedTheme.fontWeights,
      ...config.fontWeights,
    };
  }

  // Merge line heights
  if (config.lineHeights) {
    mergedTheme.lineHeights = {
      ...mergedTheme.lineHeights,
      ...config.lineHeights,
    };
  }

  return mergedTheme;
}

/**
 * Parse and validate a theme JSON string
 */
export function parseThemeJson(jsonString: string): ThemeValidationResult {
  try {
    const parsed = JSON.parse(jsonString);
    return validateDocsTheme(parsed);
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`,
      ],
    };
  }
}
