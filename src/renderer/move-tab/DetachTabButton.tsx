/**
 * DetachTabButton
 *
 * Bottom-bar action that moves the active, detachable workspace tab into a
 * standalone window. The source tab is removed only after the destination
 * window claims the transfer and explicitly accepts it, so a failed window
 * creation, load error, timeout, or already-open window never loses the tab.
 */

import React from 'react';
import { SquareArrowOutUpRight } from 'lucide-react';

export const DetachTabButton: React.FC<{
  busy: boolean;
  notice: string | null;
  onDetach: () => void;
}> = ({ busy, notice, onDetach }) => {
  return (
    <button
      type="button"
      onClick={onDetach}
      disabled={busy}
      title={notice ?? 'Move this tab to its own window'}
      style={{
        background: 'none',
        border: 'none',
        cursor: busy ? 'default' : 'pointer',
        color: 'inherit',
        opacity: busy ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        padding: '0 8px',
        whiteSpace: 'nowrap',
      }}
    >
      <SquareArrowOutUpRight size={12} />
      {busy ? 'moving…' : 'move to new window'}
      {notice && (
        <span style={{ opacity: 0.7, marginLeft: 4 }}>· {notice}</span>
      )}
    </button>
  );
};
