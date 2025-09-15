import React from 'react';

interface TypeScriptBadgeProps {
  variant?: 'solid' | 'outline';
  size?: 'small' | 'medium';
}

export const TypeScriptBadge: React.FC<TypeScriptBadgeProps> = ({
  variant = 'outline',
  size = 'small',
}) => {
  const isSmall = size === 'small';
  const color = '#3178c6';

  if (variant === 'solid') {
    return (
      <span
        style={{
          padding: isSmall ? '1px 6px' : '2px 8px',
          backgroundColor: color,
          color: 'white',
          borderRadius: '3px',
          fontSize: isSmall ? '9px' : '11px',
          fontWeight: '500',
        }}
      >
        TypeScript
      </span>
    );
  }

  // Outline variant
  return (
    <span
      style={{
        padding: isSmall ? '2px 6px' : '3px 8px',
        backgroundColor: `${color}20`,
        color,
        borderRadius: '3px',
        border: `1px solid ${color}40`,
        fontSize: isSmall ? '9px' : '10px',
        fontWeight: '500',
      }}
    >
      TypeScript
    </span>
  );
};
