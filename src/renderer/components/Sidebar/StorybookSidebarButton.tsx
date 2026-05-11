import React from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import { BookOpen } from 'lucide-react';
import type { StorybookManager } from '../../hooks/useStorybookManager';

export interface StorybookSidebarButtonProps {
  theme: Theme;
  storybook: StorybookManager;
}

/**
 * Sidebar button that toggles whether the running Storybook is visible in the
 * right panel. Only rendered while Storybook is actually running — start/stop
 * lives in the dev-workspace header button.
 */
export const StorybookSidebarButton: React.FC<StorybookSidebarButtonProps> = ({
  theme,
  storybook,
}) => {
  const { isRunning, isStorybookVisible, showPanel, hidePanel, selectedPackage } =
    storybook;

  if (!isRunning) return null;

  const label = isStorybookVisible ? 'Hide SB' : 'Show SB';
  const title = isStorybookVisible
    ? `Hide Storybook${selectedPackage ? ` (${selectedPackage.name})` : ''}`
    : `Show Storybook${selectedPackage ? ` (${selectedPackage.name})` : ''}`;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={() => (isStorybookVisible ? hidePanel() : showPanel())}
        title={title}
        aria-label={title}
        style={{
          width: 'calc(100% - 20px)',
          height: '64px',
          margin: '4px 10px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: theme.colors.success,
          transition: 'all 0.2s ease',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            background: isStorybookVisible
              ? `${theme.colors.success}20`
              : 'transparent',
            border: isStorybookVisible
              ? 'none'
              : `1px solid ${theme.colors.success}40`,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isStorybookVisible) {
              e.currentTarget.style.background = `${theme.colors.success}15`;
            }
          }}
          onMouseLeave={(e) => {
            if (!isStorybookVisible) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <BookOpen size={20} strokeWidth={1.5} />
        </div>
        <span
          style={{
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[0],
            fontWeight: isStorybookVisible
              ? theme.fontWeights.semibold
              : theme.fontWeights.body,
            lineHeight: theme.lineHeights.tight,
            textAlign: 'center',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </button>
    </div>
  );
};
