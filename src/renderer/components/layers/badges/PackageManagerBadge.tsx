import React from 'react';

interface PackageManagerBadgeProps {
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  pythonTool?: 'pip' | 'poetry' | 'pipenv' | 'conda';
  variant?: 'solid' | 'outline';
  size?: 'small' | 'medium';
}

const PACKAGE_MANAGER_CONFIG = {
  npm: { color: '#cb3837', label: 'npm' },
  yarn: { color: '#2c8ebb', label: 'yarn' },
  pnpm: { color: '#f69220', label: 'pnpm' },
  poetry: { color: '#60A5FA', label: 'poetry' },
  pip: { color: '#3776AB', label: 'pip' },
  pipenv: { color: '#4B8BBE', label: 'pipenv' },
  conda: { color: '#44A833', label: 'conda' },
};

export const PackageManagerBadge: React.FC<PackageManagerBadgeProps> = ({
  packageManager,
  pythonTool,
  variant = 'solid',
  size = 'small',
}) => {
  const tool =
    pythonTool || (packageManager !== 'unknown' ? packageManager : null);
  if (!tool) return null;

  const config =
    PACKAGE_MANAGER_CONFIG[tool as keyof typeof PACKAGE_MANAGER_CONFIG];
  if (!config) return null;

  const isSmall = size === 'small';

  if (variant === 'solid') {
    return (
      <span
        style={{
          padding: isSmall ? '1px 6px' : '2px 8px',
          backgroundColor: config.color,
          color: 'white',
          borderRadius: '3px',
          fontSize: isSmall ? '9px' : '11px',
          fontWeight: '500',
          textTransform: 'uppercase',
        }}
      >
        {config.label}
      </span>
    );
  }

  // Outline variant
  return (
    <span
      style={{
        padding: isSmall ? '2px 6px' : '3px 8px',
        backgroundColor: `${config.color}20`,
        color: config.color,
        borderRadius: '3px',
        border: `1px solid ${config.color}40`,
        fontSize: isSmall ? '9px' : '10px',
        fontWeight: '500',
      }}
    >
      {config.label}
    </span>
  );
};
