import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, X, PencilLine } from 'lucide-react';

interface RenameTabModalProps {
  isOpen: boolean;
  /** Current effective name, prefilled for editing. */
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => void;
}

/**
 * Rename the active workspace tab.
 *
 * An empty name clears the rename and restores the computed label. The modal
 * owns no tab state itself — the host applies `onRename` (usually `renameTab`
 * from `useWorkspaceTabs`) and closes.
 */
export const RenameTabModal: React.FC<RenameTabModalProps> = ({
  isOpen,
  initialName,
  onClose,
  onRename,
}) => {
  const { theme } = useTheme();
  const [name, setName] = useState(initialName);

  // Prefill (and reset) every time the modal opens.
  useEffect(() => {
    if (isOpen) setName(initialName);
  }, [isOpen, initialName]);

  const handleSubmit = useCallback(() => {
    onRename(name.trim());
    onClose();
  }, [name, onRename, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  if (!isOpen) return null;

  const unchanged = name.trim() === initialName.trim();

  return (
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
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: 12,
          padding: 24,
          width: '90%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.border}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          fontFamily: theme.fonts.body,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PencilLine size={22} color={theme.colors.primary} />
            <h2
              style={{
                margin: 0,
                fontSize: theme.fontSizes[4],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
              }}
            >
              Rename tab
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              color: theme.colors.textSecondary,
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Name input */}
        <label
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            marginBottom: 6,
          }}
        >
          Tab name (empty restores the default)
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder={initialName}
          style={{
            background: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            color: theme.colors.text,
            fontSize: theme.fontSizes[2],
            outline: 'none',
            marginBottom: 18,
          }}
        />

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: 8,
              padding: '8px 14px',
              color: theme.colors.text,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={unchanged}
            style={{
              background: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              cursor: unchanged ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.semibold,
              opacity: unchanged ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Check size={14} />
            Rename
          </button>
        </div>
      </div>
    </div>
  );
};
