import React from 'react';

interface FrameworkBadgeProps {
  name: string;
  color: string;
  variant?: 'solid' | 'outline';
  size?: 'small' | 'medium';
}

export const FrameworkBadge: React.FC<FrameworkBadgeProps> = ({
  name,
  color,
  variant = 'outline',
  size = 'small',
}) => {
  const isSmall = size === 'small';

  if (variant === 'solid') {
    return (
      <span
        style={{
          padding: isSmall ? '2px 6px' : '3px 8px',
          backgroundColor: color,
          color: 'white',
          borderRadius: '3px',
          fontSize: isSmall ? '10px' : '11px',
          fontWeight: '500',
        }}
      >
        {name}
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
        fontSize: isSmall ? '10px' : '11px',
        fontWeight: '500',
      }}
    >
      {name}
    </span>
  );
};
