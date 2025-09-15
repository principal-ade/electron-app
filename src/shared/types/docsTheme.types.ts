/**
 * Docs Theme Types
 * Custom theme configuration for documentation/readme display
 */

import type { Theme } from 'themed-markdown';

/**
 * Simplified theme configuration for docs
 * Users can provide partial theme overrides
 */
export interface DocsThemeConfig {
  name?: string;
  description?: string;
  
  // Allow partial theme overrides
  colors?: Partial<{
    text: string;
    background: string;
    primary: string;
    secondary: string;
    accent: string;
    highlight: string;
    muted: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    border: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    backgroundLight: string;
    backgroundHover: string;
    surface: string;
    textSecondary: string;
    textTertiary: string;
    textMuted: string;
  }>;
  
  fonts?: Partial<{
    body: string;
    heading: string;
    monospace: string;
  }>;
  
  fontSizes?: number[];
  fontScale?: number;
  
  fontWeights?: Partial<{
    body: number;
    heading: number;
    bold: number;
    light: number;
    medium: number;
    semibold: number;
  }>;
  
  lineHeights?: Partial<{
    body: number;
    heading: number;
    tight: number;
    relaxed: number;
  }>;
}

/**
 * Validation result for theme config
 */
export interface ThemeValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  mergedTheme?: Theme;
}

/**
 * Theme file metadata
 */
export interface ThemeFileMetadata {
  path: string;
  lastModified?: number;
  fileSize?: number;
}