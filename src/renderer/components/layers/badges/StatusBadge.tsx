import React from 'react';

interface StatusBadgeProps {
  type: 'monorepo' | 'workspace' | 'conflict' | 'warning' | 'info';
  label?: string;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG = {
  monorepo: {
    label: 'Monorepo Root',
    color: '#8B5CF6',
    icon: '📦',
  },
  workspace: {
    label: 'Workspace',
    color: '#10B981',
    icon: '🏢',
  },
  conflict: {
    label: 'Version Conflict',
    color: '#FF9800',
    icon: '⚠️',
  },
  warning: {
    label: 'Warning',
    color: '#FFA726',
    icon: '⚡',
  },
  info: {
    label: 'Info',
    color: '#2196F3',
    icon: 'ℹ️',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  label,
  size = 'small',
}) => {
  const config = STATUS_CONFIG[type];
  const displayLabel = label || config.label;
  const isSmall = size === 'small';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: isSmall ? '1px 6px' : '2px 8px',
        backgroundColor: `${config.color}20`,
        color: config.color,
        borderRadius: '3px',
        fontSize: isSmall ? '10px' : '11px',
        fontWeight: '500',
      }}
    >
      <span style={{ fontSize: isSmall ? '10px' : '12px' }}>{config.icon}</span>
      {displayLabel}
    </span>
  );
};
