import React from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { LucideIcon } from 'lucide-react';

interface PanelEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconSize?: number;
}

export const PanelEmptyState: React.FC<PanelEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  iconSize = 48,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.colors.textSecondary,
        fontSize: '14px',
        gap: '8px',
        backgroundColor: theme.colors.background,
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <Icon size={iconSize} style={{ opacity: 0.3 }} />
      <div style={{ fontWeight: 500 }}>{title}</div>
      {description && (
        <div style={{ fontSize: '12px', opacity: 0.7, maxWidth: '400px' }}>
          {description}
        </div>
      )}
    </div>
  );
};
