/**
 * InProgressBar
 *
 * Full-width status row for the Home left panel: "X in progress" (or "Nothing in
 * progress") on one line, with an "Open" button on the right that opens the In
 * Progress workspace tab.
 */

import React from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitIcon } from '../../components/GitIcon';

export interface InProgressBarProps {
  /** Number of repositories with uncommitted changes / unpushed commits. */
  count: number;
  onOpen: () => void;
  /** When true the In Progress tab is already open, so hide the Open button. */
  isOpen?: boolean;
}

export const InProgressBar: React.FC<InProgressBarProps> = ({
  count,
  onOpen,
  isOpen = false,
}) => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        background: theme.colors.background,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}
    >
      <span style={{ flexShrink: 0, color: theme.colors.textSecondary }}>
        <GitIcon size={18} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: theme.fontSizes[2],
          fontWeight: 600,
          color: theme.colors.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {count > 0 ? `${count} in progress` : 'Nothing in progress'}
      </span>
      {!isOpen && (
        <button
          type="button"
          onClick={onOpen}
          title="Open In Progress"
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: theme.colors.primary,
            color: theme.colors.textOnAccent,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          Open
        </button>
      )}
    </div>
  );
};

export default InProgressBar;
