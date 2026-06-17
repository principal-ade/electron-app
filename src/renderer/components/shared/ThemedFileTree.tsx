import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { FileTree } from '@pierre/trees/react';

type FileTreeModel = React.ComponentProps<typeof FileTree>['model'];

const mix = (color: string, percent: number): string =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`;

export interface ThemedFileTreeProps {
  /** The model produced by `useFileTree(...)`. */
  model: FileTreeModel;
  /**
   * Accent color for the active-selection and hover highlights. The selection
   * fill is this color at 28% and the hover fill at 14%. Defaults to
   * `theme.colors.accent`; the File City surfaces pass `theme.colors.primary`
   * or `theme.colors.info` to match their context.
   */
  accentColor?: string;
  /** Background for the search input. Defaults to `theme.colors.backgroundSecondary`. */
  searchBg?: string;
  /**
   * Font size for the tree rows. A bare number is treated as `px`. Defaults to
   * `theme.fontSizes[1]` (14px) — one step up from the library's `13px` default
   * and the same token the panels use for their empty-state text. Pass a string
   * (e.g. `'0.9rem'`) to use any CSS length.
   */
  fontSize?: number | string;
  /**
   * Font family for the tree rows. Defaults to `theme.fonts.body` (Inter) so the
   * tree matches the panel chrome that wraps it, rather than Pierre's `system-ui`
   * default.
   */
  fontFamily?: string;
  /**
   * Pin git-status colors to theme tokens. The library otherwise derives them
   * via CSS `light-dark()`, which needs an inherited `color-scheme` that doesn't
   * reach these panels — leaving changed files visually unstyled. Overriding
   * makes them deterministic. Defaults to `false`.
   */
  gitStatusColors?: boolean;
  /**
   * Extra styles and CSS-var overrides merged after the themed defaults, so a
   * call site can still tune padding, layout, or any `--trees-*` var without
   * escaping the wrapper.
   */
  style?: React.CSSProperties;
}

/**
 * The Pierre `FileTree` wrapped with this app's theme wiring. Centralizes the
 * `--trees-*` overrides every file tree in the app shared by hand — transparent
 * background, theme-derived selection/hover/search colors, and the optional
 * git-status palette — so they stay consistent in one place.
 */
export const ThemedFileTree: React.FC<ThemedFileTreeProps> = ({
  model,
  accentColor,
  searchBg,
  fontSize,
  fontFamily,
  gitStatusColors = false,
  style,
}) => {
  const { theme } = useTheme();
  const accent = accentColor ?? theme.colors.accent;
  const search = searchBg ?? theme.colors.backgroundSecondary;
  const family = fontFamily ?? theme.fonts.body;
  const resolvedFontSize = fontSize ?? theme.fontSizes[1];
  const fontSizeValue =
    typeof resolvedFontSize === 'number'
      ? `${resolvedFontSize}px`
      : resolvedFontSize;

  return (
    <FileTree
      model={model}
      style={
        {
          flex: 1,
          minHeight: 0,
          '--trees-bg-override': 'transparent',
          '--trees-font-family-override': family,
          '--trees-font-size-override': fontSizeValue,
          '--trees-search-bg-override': search,
          '--trees-theme-list-active-selection-bg': mix(accent, 28),
          '--trees-theme-list-hover-bg': mix(accent, 14),
          ...(gitStatusColors
            ? {
                '--trees-git-modified-color-override': theme.colors.warning,
                '--trees-git-added-color-override': theme.colors.success,
                '--trees-git-untracked-color-override': theme.colors.success,
                '--trees-git-deleted-color-override': theme.colors.error,
                '--trees-git-renamed-color-override': theme.colors.info,
              }
            : {}),
          ...style,
        } as React.CSSProperties
      }
    />
  );
};
