import React from 'react';
import { useTheme } from 'themed-markdown';

interface SyncMessageProps {
  syncMessage: { type: 'success' | 'error'; message: string } | null;
  onDismiss: () => void;
}

export const SyncMessage: React.FC<SyncMessageProps> = ({ syncMessage, onDismiss }) => {
  const { theme } = useTheme();

  if (!syncMessage) return null;

  return (
    <div
      style={{
        padding: '12px 20px',
        backgroundColor:
          syncMessage.type === 'success'
            ? `${theme.colors.success}10`
            : `${theme.colors.error}10`,
        borderBottom: `1px solid ${
          syncMessage.type === 'success' ? theme.colors.success : theme.colors.error
        }30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color:
            syncMessage.type === 'success' ? theme.colors.success : theme.colors.error,
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        {syncMessage.type === 'success' ? (
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.background,
              fontSize: '11px',
            }}
          >
            ✓
          </div>
        ) : (
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: theme.colors.error,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.background,
              fontSize: '11px',
            }}
          >
            !
          </div>
        )}
        {syncMessage.message}
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: syncMessage.type === 'success' ? theme.colors.success : theme.colors.error,
          cursor: 'pointer',
          padding: '4px',
          fontSize: '16px',
          lineHeight: '1',
          opacity: 0.6,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.6';
        }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
};