import React from 'react';
import { ThemedOwlIcon } from './ThemedOwlIcon';
import { useTheme } from 'themed-markdown';

interface AppLogoProps {
  size?: number;
  showText?: boolean;
  compact?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 48,
  showText = true,
  compact = false,
}) => {
  const { theme } = useTheme();

  if (compact) {
    return <ThemedOwlIcon size={size} />;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: showText ? '12px' : 0,
      }}
    >
      <ThemedOwlIcon size={size} />
      {showText && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span
            style={{
              fontSize: size * 0.4,
              fontWeight: 700,
              color: theme.colors.text,
              letterSpacing: '-0.02em',
            }}
          >
            PrincipleMD
          </span>
          <span
            style={{
              fontSize: size * 0.25,
              color: theme.colors.textSecondary,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}
          >
            Repository Manager
          </span>
        </div>
      )}
    </div>
  );
};
