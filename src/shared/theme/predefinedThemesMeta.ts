/**
 * Predefined Theme Metadata
 *
 * This file contains the metadata for predefined themes, usable from both
 * main process and renderer process. The actual theme objects are imported
 * from @principal-ade/industry-theme.
 */

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
} from '@principal-ade/industry-theme';

export interface ThemeMetadata {
  name: string;
  displayName: string;
  description: string;
  theme: Theme;
}

/**
 * Predefined themes with metadata
 */
export const predefinedThemesMeta: Record<string, ThemeMetadata> = {
  principalAI: {
    name: 'principalAI',
    displayName: 'Principal AI',
    description: 'Modern AI-inspired theme with vibrant indigo and cyan accents',
    theme: landingPageTheme,
  },
  principalAILight: {
    name: 'principalAILight',
    displayName: 'Principal AI Light',
    description: 'Light variant of the Principal AI theme',
    theme: landingPageLightTheme,
  },
  terminal: {
    name: 'terminal',
    displayName: 'Terminal',
    description: 'Minimalistic developer-focused dark theme with transparency',
    theme: terminalTheme,
  },
  regal: {
    name: 'regal',
    displayName: 'Regal',
    description: 'Dark Academia theme with warm amber gold accents',
    theme: regalTheme,
  },
  matrix: {
    name: 'matrix',
    displayName: 'Matrix',
    description: 'Cyberpunk hacker theme with green matrix effects',
    theme: matrixTheme,
  },
  matrixMinimal: {
    name: 'matrixMinimal',
    displayName: 'Matrix Minimal',
    description: 'Clean matrix theme without visual effects',
    theme: matrixMinimalTheme,
  },
  slate: {
    name: 'slate',
    displayName: 'Slate',
    description: 'Professional slate gray theme',
    theme: slateTheme,
  },
  slateNeon: {
    name: 'slateNeon',
    displayName: 'Slate Neon',
    description: 'Slate theme with vibrant neon accents',
    theme: slateNeonTheme,
  },
  slateGold: {
    name: 'slateGold',
    displayName: 'Slate Gold',
    description: 'Slate theme with warm gold accents',
    theme: slateGoldTheme,
  },
  defaultMarkdown: {
    name: 'defaultMarkdown',
    displayName: 'Default Markdown',
    description: 'Standard markdown theme',
    theme: defaultMarkdownTheme,
  },
  defaultEditor: {
    name: 'defaultEditor',
    displayName: 'Default Editor',
    description: 'Standard editor theme',
    theme: defaultEditorTheme,
  },
  defaultTerminal: {
    name: 'defaultTerminal',
    displayName: 'Default Terminal',
    description: 'Standard terminal theme',
    theme: defaultTerminalTheme,
  },
};

/**
 * Get list of available theme names (excluding transparent)
 */
export function getAvailableThemeNames(): string[] {
  return Object.keys(predefinedThemesMeta);
}

/**
 * Get theme metadata by name
 */
export function getThemeMetadata(name: string): ThemeMetadata | undefined {
  return predefinedThemesMeta[name];
}

/**
 * Get theme object by name
 */
export function getThemeByName(name: string): Theme | undefined {
  return predefinedThemesMeta[name]?.theme;
}
