import React from 'react';

interface PythonVersionBadgeProps {
  version?: string;
  size?: 'small' | 'medium';
}

export const PythonVersionBadge: React.FC<PythonVersionBadgeProps> = ({
  version,
  size = 'small',
}) => {
  if (!version) return null;

  const isSmall = size === 'small';
  const color = '#3776AB'; // Python blue

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: isSmall ? '1px 6px' : '2px 8px',
        backgroundColor: `${color}15`,
        color,
        borderRadius: '3px',
        fontSize: isSmall ? '10px' : '11px',
        fontWeight: '400',
      }}
    >
      <span style={{ fontSize: isSmall ? '10px' : '12px' }}>🐍</span>
      Python {version}
    </span>
  );
};
