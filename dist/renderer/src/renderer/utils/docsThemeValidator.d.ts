/**
 * Docs Theme Validator
 * Validates and merges custom theme configurations
 */
import type { Theme } from 'themed-markdown';
import type { DocsThemeConfig, ThemeValidationResult } from '../../shared/types/docsTheme.types';
/**
 * Validate and merge a docs theme configuration
 */
export declare function validateDocsTheme(config: unknown): ThemeValidationResult;
/**
 * Create a merged theme from base and custom config
 */
export declare function createMergedTheme(baseTheme: Theme, config: DocsThemeConfig): Theme;
/**
 * Parse and validate a theme JSON string
 */
export declare function parseThemeJson(jsonString: string): ThemeValidationResult;
//# sourceMappingURL=docsThemeValidator.d.ts.map