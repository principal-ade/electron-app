import type { Theme } from '@principal-ade/industry-theme';
import type { ThemeSchemaProperty } from '../theme/themeSchema';

/**
 * Request payload for updating a theme property
 */
export interface ThemePropertyUpdate {
  /** Property path (e.g., "colors.primary", "fonts.body") */
  propertyPath: string;
  /** New value for the property */
  value: string | number;
  /** Theme name to update (defaults to current theme if not specified) */
  themeName?: string;
}

/**
 * Result of a theme update operation
 */
export interface ThemeUpdateResult {
  success: boolean;
  error?: string;
  updatedProperty?: string;
  themeName?: string;
  /** Warning if the updated theme is not the currently active theme */
  warning?: string;
  /** The currently active theme (if different from updated theme) */
  activeTheme?: string;
}

/**
 * Information about an available theme
 */
export interface ThemeInfo {
  name: string;
  displayName: string;
  description: string;
}

/**
 * Response for theme schema request
 */
export interface ThemeSchemaResponse {
  success: boolean;
  error?: string;
  themeName?: string;
  themeDescription?: string;
  schema?: ThemeSchemaProperty[];
  currentValues?: Theme;
  availableThemes?: ThemeInfo[];
}

