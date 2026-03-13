import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';

export type WindowCardProps = {
  id: number;
  title: string;
  thumbnail?: string;
  isSelected: boolean;
  onClick: () => void;
};

export const WindowCard: React.FC<WindowCardProps> = ({
  title,
  thumbnail,
  isSelected,
  onClick,
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const displayTitle = title?.trim() || 'Untitled Window';

  const getCardStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      background: `color-mix(in srgb, ${theme.colors.backgroundSecondary} 60%, transparent)`,
      border: `2px solid ${theme.colors.border}`,
      borderRadius: '16px',
      padding: '24px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '200px',
      position: 'relative',
      color: 'inherit',
      font: 'inherit',
    };

    if (isSelected) {
      return {
        ...baseStyle,
        background: `color-mix(in srgb, ${theme.colors.backgroundTertiary} 90%, transparent)`,
        borderColor: theme.colors.primary,
        boxShadow: `0 0 32px color-mix(in srgb, ${theme.colors.primary} 40%, transparent), 0 8px 24px rgba(0, 0, 0, 0.3)`,
        transform: 'translateY(-4px)',
      };
    }

    if (isHovered) {
      return {
        ...baseStyle,
        background: `color-mix(in srgb, ${theme.colors.backgroundTertiary} 80%, transparent)`,
        borderColor: `color-mix(in srgb, ${theme.colors.primary} 50%, transparent)`,
        transform: 'translateY(-4px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      };
    }

    return baseStyle;
  };

  return (
    <button
      type="button"
      style={getCardStyle()}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          width: '100%',
          height: '120px',
          background: `color-mix(in srgb, ${theme.colors.background} 80%, transparent)`,
          borderRadius: '12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <svg
            style={{
              width: '48px',
              height: '48px',
              color: theme.colors.textSecondary,
              stroke: 'currentColor',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              fill: 'none',
            }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        )}
      </div>
      <span
        style={{
          color: theme.colors.text,
          fontSize: '15px',
          fontWeight: 500,
          fontFamily: theme.fonts.body,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          padding: '0 8px',
        }}
        title={displayTitle}
      >
        {displayTitle}
      </span>
    </button>
  );
};
