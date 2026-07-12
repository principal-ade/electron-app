/**
 * SubViewHeader
 *
 * A shared header for sub-views that slide in over the Home panel's overview.
 * Shows a back chevron, icon, label, optional count, and optional trailing
 * content (e.g. a toggle next to the title).
 *
 * Height is locked to SUB_VIEW_HEADER_HEIGHT (40px) so home sub-views and other
 * left-rail headers stay aligned.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { ChevronLeft } from 'lucide-react';

/** Standard left-rail sub-view header height. */
export const SUB_VIEW_HEADER_HEIGHT = 40;

export interface SubViewHeaderProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  onBack: () => void;
  /** Optional control rendered on the right side of the header (e.g. a switch). */
  trailing?: React.ReactNode;
}

export const SubViewHeader: React.FC<SubViewHeaderProps> = ({
  icon: _icon,
  label,
  count,
  onBack,
  trailing,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        height: SUB_VIEW_HEADER_HEIGHT,
        boxSizing: 'border-box',
        padding: '0 12px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.background,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
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
          padding: '0 6px',
          height: 28,
          borderRadius: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: theme.colors.textSecondary,
          transition: 'opacity 0.15s',
          minWidth: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '0.7';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1';
        }}
        title="Back to overview"
        aria-label="Back to overview"
      >
        <ChevronLeft size={16} style={{ flexShrink: 0 }} />
        <span
          style={{
            fontSize: theme.fontSizes[0],
            fontWeight: 600,
            color: theme.colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {label}
        </span>
        {count !== undefined && (
          <span
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textMuted,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {count}
          </span>
        )}
      </button>
      {trailing && (
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            maxHeight: SUB_VIEW_HEADER_HEIGHT,
          }}
        >
          {trailing}
        </div>
      )}
    </div>
  );
};
