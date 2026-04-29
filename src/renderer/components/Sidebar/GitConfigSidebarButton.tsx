import React from 'react';
import type { Theme } from '@principal-ade/industry-theme';
import { GitBranch } from 'lucide-react';

export interface GitConfigSidebarButtonProps {
  theme: Theme;
  currentLayout?: { left: string; middle: string; right: string };
  onLayoutChange?: (layout: {
    left: string;
    middle: string;
    right: string;
  }) => void;
}

export const GitConfigSidebarButton: React.FC<GitConfigSidebarButtonProps> = ({
  theme,
  currentLayout,
  onLayoutChange,
}) => {
  const isActive = currentLayout?.right === 'gitConfig';
  const buttonColor = isActive
    ? theme.colors.primary
    : theme.colors.textSecondary;

  const handleClick = () => {
    if (!currentLayout || !onLayoutChange) return;
    onLayoutChange({ ...currentLayout, right: 'gitConfig' });
  };

  return (
    <button
      onClick={handleClick}
      title="Git Config"
      aria-label="Git Config"
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
        color: buttonColor,
        transition: 'all 0.2s ease',
        position: 'relative',
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
          background: isActive ? `${theme.colors.primary}20` : 'transparent',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = theme.colors.border;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <GitBranch size={20} strokeWidth={1.5} />
      </div>
      <span
        style={{
          fontFamily: theme.fonts.body,
          fontSize: theme.fontSizes[0],
          fontWeight: isActive
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
        Config
      </span>
    </button>
  );
};
