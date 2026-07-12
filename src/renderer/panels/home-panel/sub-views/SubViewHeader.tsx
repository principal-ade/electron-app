/**
 * SubViewHeader
 *
 * A shared header for sub-views that slide in over the Home panel's overview.
 * Shows a back chevron, icon, label, optional count, and a close button.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronLeft } from 'lucide-react';

export interface SubViewHeaderProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  onBack: () => void;
}

export const SubViewHeader: React.FC<SubViewHeaderProps> = ({
  icon: _icon,
  label,
  count,
  onBack,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.background,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginLeft: -4,
          padding: '4px 6px',
          borderRadius: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: theme.colors.textSecondary,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        title="Back to overview"
        aria-label="Back to overview"
      >
        <ChevronLeft size={16} />
        <span
          style={{
            fontSize: theme.fontSizes[0],
            fontWeight: 600,
            color: theme.colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {label}
        </span>
        {count !== undefined && (
          <span style={{ fontSize: theme.fontSizes[0], color: theme.colors.textMuted }}>
            {count}
          </span>
        )}
      </button>
    </div>
  );
};
