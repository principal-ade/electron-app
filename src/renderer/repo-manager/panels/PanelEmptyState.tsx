import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import type { LucideIcon } from 'lucide-react';

interface PanelEmptyStateAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
}

interface PanelEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconSize?: number;
  actions?: PanelEmptyStateAction[];
}

export const PanelEmptyState: React.FC<PanelEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  iconSize = 48,
  actions,
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
        gap: '16px',
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
      {actions && actions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {action.icon && <action.icon size={16} />}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
