import type React from 'react';
import type { Theme } from '@principal-ade/industry-theme';

export function getAcpThemeStyle(theme: Theme): React.CSSProperties {
  const { colors } = theme;
  const fontScale = theme.fontScale ?? 1;
  const themeFontSizes = Object.fromEntries(
    theme.fontSizes.map((size, index) => [
      `--acp-font-size-${index}`,
      `${size * fontScale}px`,
    ]),
  );
  const themeRadii = Object.fromEntries(
    theme.radii.map((radius, index) => [
      `--acp-radius-${index}`,
      `${radius}px`,
    ]),
  );
  const themeShadows = Object.fromEntries(
    theme.shadows.map((shadow, index) => [`--acp-shadow-${index}`, shadow]),
  );

  return {
    ...themeFontSizes,
    ...themeRadii,
    ...themeShadows,
    '--acp-bg': colors.background,
    '--acp-surface': colors.surface,
    '--acp-surface-soft': colors.backgroundSecondary,
    '--acp-surface-raised': colors.backgroundTertiary,
    '--acp-text': colors.text,
    '--acp-muted': colors.textSecondary,
    '--acp-faint': colors.textTertiary,
    '--acp-border': colors.border,
    '--acp-accent': colors.primary,
    '--acp-accent-soft': `color-mix(in srgb, ${colors.primary} 12%, ${colors.background})`,
    '--acp-green': colors.success,
    '--acp-warning': colors.warning,
    '--acp-error': colors.error,
    '--acp-hover': colors.backgroundHover,
    '--acp-text-on-primary': colors.textOnPrimary,
    '--acp-font-body': theme.fonts.body,
    '--acp-font-heading': theme.fonts.heading,
    '--acp-font-mono': theme.fonts.monospace,
  } as React.CSSProperties;
}
