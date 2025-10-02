import { useTheme } from '@a24z/industry-theme';

interface ThemedOwlIconProps {
  size?: number;
  className?: string;
  // Allow override of specific colors
  eyeColor?: string;
  bodyColor?: string;
  accentColor?: string;
}

export const ThemedOwlIcon: React.FC<ThemedOwlIconProps> = ({
  size = 48,
  className,
  eyeColor,
  bodyColor,
  accentColor,
}) => {
  const { theme } = useTheme();

  // Use theme colors or overrides
  const colors = {
    eye: eyeColor || theme.colors.primary,
    eyeGlow: theme.colors.accent,
    body: bodyColor || theme.colors.textSecondary,
    bodyLight: theme.colors.textTertiary,
    accent: accentColor || theme.colors.accent,
    beak: theme.colors.warning,
    feet: theme.colors.textMuted,
    // For dark themes, we might want lighter body colors
    bodyStroke: theme.colors.border,
    highlight: theme.colors.backgroundLight,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Definitions for gradients and effects */}
      <defs>
        {/* Eye gradient for depth */}
        <radialGradient id={`eye-gradient-${theme.colors.primary}`}>
          <stop offset="0%" stopColor={colors.eyeGlow} stopOpacity="0.8" />
          <stop offset="50%" stopColor={colors.eye} />
          <stop offset="100%" stopColor={colors.eye} stopOpacity="0.9" />
        </radialGradient>

        {/* Body gradient */}
        <linearGradient
          id={`body-gradient-${theme.colors.textSecondary}`}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor={colors.bodyLight} />
          <stop offset="100%" stopColor={colors.body} />
        </linearGradient>

        {/* Glow effect for eyes */}
        <filter id="eye-glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Owl Body */}
      <ellipse
        cx="50"
        cy="60"
        rx="30"
        ry="35"
        fill={`url(#body-gradient-${theme.colors.textSecondary})`}
        stroke={colors.bodyStroke}
        strokeWidth="1"
      />

      {/* Owl Head */}
      <circle
        cx="50"
        cy="35"
        r="25"
        fill={`url(#body-gradient-${theme.colors.textSecondary})`}
        stroke={colors.bodyStroke}
        strokeWidth="1"
      />

      {/* Ear Tufts */}
      <path
        d="M 30 20 L 25 10 L 35 15 Z"
        fill={colors.body}
        stroke={colors.bodyStroke}
        strokeWidth="0.5"
      />
      <path
        d="M 70 20 L 75 10 L 65 15 Z"
        fill={colors.body}
        stroke={colors.bodyStroke}
        strokeWidth="0.5"
      />

      {/* Eye Backgrounds (white part) */}
      <circle
        cx="38"
        cy="35"
        r="10"
        fill={colors.highlight}
        stroke={colors.bodyStroke}
        strokeWidth="0.5"
      />
      <circle
        cx="62"
        cy="35"
        r="10"
        fill={colors.highlight}
        stroke={colors.bodyStroke}
        strokeWidth="0.5"
      />

      {/* Themed Eyes (iris) */}
      <circle
        cx="38"
        cy="35"
        r="7"
        fill={`url(#eye-gradient-${theme.colors.primary})`}
        filter="url(#eye-glow)"
        style={{
          transition: 'fill 0.3s ease',
        }}
      />
      <circle
        cx="62"
        cy="35"
        r="7"
        fill={`url(#eye-gradient-${theme.colors.primary})`}
        filter="url(#eye-glow)"
        style={{
          transition: 'fill 0.3s ease',
        }}
      />

      {/* Pupils */}
      <circle cx="38" cy="35" r="3" fill="#000000" />
      <circle cx="62" cy="35" r="3" fill="#000000" />

      {/* Eye highlights for life */}
      <circle cx="40" cy="33" r="1.5" fill="#FFFFFF" opacity="0.8" />
      <circle cx="64" cy="33" r="1.5" fill="#FFFFFF" opacity="0.8" />

      {/* Beak */}
      <path
        d="M 50 40 L 45 45 L 50 48 L 55 45 Z"
        fill={colors.beak}
        stroke={colors.bodyStroke}
        strokeWidth="0.5"
      />

      {/* Wings (simple) */}
      <ellipse
        cx="25"
        cy="60"
        rx="10"
        ry="20"
        fill={colors.body}
        stroke={colors.bodyStroke}
        strokeWidth="0.5"
        transform="rotate(-15 25 60)"
      />
      <ellipse
        cx="75"
        cy="60"
        rx="10"
        ry="20"
        fill={colors.body}
        stroke={colors.bodyStroke}
        strokeWidth="0.5"
        transform="rotate(15 75 60)"
      />

      {/* Feet */}
      <path
        d="M 40 85 L 40 92 M 35 92 L 45 92"
        stroke={colors.feet}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 60 85 L 60 92 M 55 92 L 65 92"
        stroke={colors.feet}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
