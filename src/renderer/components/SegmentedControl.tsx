/**
 * SegmentedControl Component
 *
 * A tab-style segmented control for switching between two options.
 * Used in ActivityFeedPanel to toggle between "My Activity" and "Watched Activity".
 */

import React from 'react';
import type { Theme } from '@principal-ade/industry-theme';

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  theme: Theme;
}

/**
 * Segmented control component with tab-style switcher design
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  theme,
}) => {
  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
  };

  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radii?.[1] || 4,
        padding: 2,
        gap: 2,
      }}
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              flex: 1,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              color: isActive ? theme.colors.textOnPrimary : theme.colors.textSecondary,
              backgroundColor: isActive ? theme.colors.primary : 'transparent',
              border: 'none',
              borderRadius: theme.radii?.[0] || 2,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = theme.colors.background;
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
