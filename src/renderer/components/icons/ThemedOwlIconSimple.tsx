import React from 'react';
import { useTheme } from 'themed-markdown';
import { iconThemes } from '../../themes/predefinedThemes';
import { ThemeService } from '../../services/ThemeService';

interface ThemedOwlIconSimpleProps {
  size?: number;
  className?: string;
  /** Base path to icon assets */
  basePath?: string;
  /** Use a single combined image instead of layers */
  useSingleImage?: boolean;
}

/**
 * Simplified Themed Owl Icon
 *
 * This component supports two modes:
 * 1. Single Image Mode: Uses pre-colored versions for each theme
 * 2. Layered Mode: Uses CSS filters to colorize specific layers
 */
export const ThemedOwlIconSimple: React.FC<ThemedOwlIconSimpleProps> = ({
  size = 48,
  className,
  basePath = '/assets/icons',
  useSingleImage = false,
}) => {
  const { theme } = useTheme();
  const currentThemeName = ThemeService.getCurrentThemeName();
  const iconTheme = iconThemes[currentThemeName] || iconThemes.default;

  // Single image mode - use pre-made themed versions
  if (useSingleImage) {
    return (
      <img
        src={`${basePath}/owl-${currentThemeName}.png`}
        alt="PrincipleMD Logo"
        width={size}
        height={size}
        className={className}
        style={{
          display: 'block',
          transition: 'opacity 0.3s ease',
        }}
        onError={(e) => {
          // Fallback to default if themed version doesn't exist
          (e.target as HTMLImageElement).src = `${basePath}/owl-default.png`;
        }}
      />
    );
  }

  // Layered mode with CSS filters
  // Calculate CSS filter to transform colors
  const getColorFilter = (targetColor: string) => {
    // For a more accurate color transformation, we'd need to use SVG filters
    // This is a simplified approach using CSS filters

    if (targetColor === '#1976D2') {
      // Default blue
      return 'none';
    } else if (targetColor === '#003D82') {
      // Professional dark blue
      return 'brightness(0.6) sepia(1) hue-rotate(190deg) saturate(5)';
    } else if (targetColor === '#0891B2') {
      // Ocean teal
      return 'brightness(0.8) sepia(1) hue-rotate(160deg) saturate(3)';
    } else if (targetColor === '#EA580C') {
      // Sunset orange
      return 'brightness(1) sepia(1) hue-rotate(350deg) saturate(5)';
    } else if (targetColor === '#6B7280') {
      // Minimal gray
      return 'brightness(0.7) saturate(0)';
    } else if (targetColor === '#0000FF') {
      // High contrast blue
      return 'brightness(0.8) sepia(1) hue-rotate(200deg) saturate(10)';
    }

    return 'none';
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-block',
      }}
    >
      {/* Base owl image (body + features) */}
      <img
        src={`${basePath}/owl-base.png`}
        alt=""
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          zIndex: 1,
          // Adjust brightness for dark/light themes
          filter:
            theme.colors.background === '#FFFFFF'
              ? 'brightness(1)'
              : 'brightness(1.2)',
          transition: 'filter 0.3s ease',
        }}
      />

      {/* Eyes overlay - this will be colorized */}
      <img
        src={`${basePath}/owl-eyes-color.png`}
        alt=""
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          zIndex: 2,
          filter: getColorFilter(iconTheme.eyeColor),
          transition: 'filter 0.3s ease',
          mixBlendMode: 'normal',
        }}
      />

      {/* Optional glow effect for certain themes */}
      {iconTheme.style === 'glow' && (
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            zIndex: 3,
            background: `radial-gradient(circle at 50% 35%, ${iconTheme.eyeColor}40 0%, transparent 50%)`,
            pointerEvents: 'none',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.8; }
          }
        `}
      </style>
    </div>
  );
};
