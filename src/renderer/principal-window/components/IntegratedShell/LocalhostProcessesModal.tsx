import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X } from 'lucide-react';
import { LocalhostProcessesView } from '../../views/LocalhostProcessesView';

interface LocalhostProcessesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * LocalhostProcessesModal - Shows the LocalhostProcessesView in a centered modal.
 *
 * Opened from the titlebar indicator when running dev servers are detected.
 * The embedded view manages its own detection/watch lifecycle, so this modal
 * only owns the overlay chrome (header, close affordances).
 */
export const LocalhostProcessesModal: React.FC<LocalhostProcessesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();

  // Close on Escape while the modal is open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          width: '720px',
          maxWidth: '90vw',
          height: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Localhost Processes
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: theme.radii[1],
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <LocalhostProcessesView />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default LocalhostProcessesModal;
