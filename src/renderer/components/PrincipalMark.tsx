import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  FileCityLogo,
  FileCityLogoAnimated,
  type FileCityMark,
} from '@principal-ai/logo-component';

export interface PrincipalMarkProps {
  /** Rendered size in pixels (square). Default 16. */
  size?: number;
  /** Brand mark drawn by the file-city grid. Default "P". */
  mark?: FileCityMark;
  /** Play the heatmap build animation instead of the static mark. */
  animated?: boolean;
  /** Optional color overrides; default to the current theme's brand colors. */
  primary?: string;
  accent?: string;
  /** Base city color (the neutral file squares). */
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The Principal file-city mark, sized for inline use as an icon. Wraps the
 * themed logo from `@principal-ai/logo-component` so call sites don't need to
 * repeat the palette/background wiring. Decorative by default (`aria-hidden`).
 */
export const PrincipalMark: React.FC<PrincipalMarkProps> = ({
  size = 16,
  mark = 'P',
  animated = false,
  primary,
  accent,
  color,
  className,
  style,
}) => {
  const { theme } = useTheme();
  const Logo = animated ? FileCityLogoAnimated : FileCityLogo;

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-flex',
        flex: '0 0 auto',
        lineHeight: 0,
        ...style,
      }}
    >
      <Logo
        mark={mark}
        width={size}
        height={size}
        margin={0}
        primary={primary ?? theme.colors.primary}
        accent={accent ?? theme.colors.accent}
        color={color ?? theme.colors.text}
        background="transparent"
      />
    </span>
  );
};
