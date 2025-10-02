import React, { useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Trash2, AlertTriangle } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';

interface RemoveRepositoryDialogProps {
  repository: AlexandriaEntry;
  onConfirm: (deleteLocal: boolean) => void;
  onCancel: () => void;
}

export const RemoveRepositoryDialog: React.FC<RemoveRepositoryDialogProps> = ({
  repository,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const [deleteLocal, setDeleteLocal] = useState(false);

  const handleRemove = () => {
    onConfirm(deleteLocal);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '20px',
            fontWeight: '600',
            color: theme.colors.text,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Trash2 size={20} />
          Remove Repository
        </h3>

        <div
          style={{
            marginBottom: '20px',
          }}
        >
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '14px',
              color: theme.colors.textSecondary,
              lineHeight: '1.5',
            }}
          >
            Remove <strong>{repository.name}</strong> from the Alexandria registry?
          </p>

          {repository.path && (
            <div
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                padding: '12px',
                fontSize: '13px',
                fontFamily: 'monospace',
                color: theme.colors.textSecondary,
                wordBreak: 'break-all',
              }}
            >
              {repository.path}
            </div>
          )}
        </div>

        {/* Removal Options */}
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              cursor: 'pointer',
              marginBottom: '12px',
            }}
          >
            <input
              type="radio"
              name="removeOption"
              checked={!deleteLocal}
              onChange={() => setDeleteLocal(false)}
              style={{
                marginTop: '2px',
                cursor: 'pointer',
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: theme.colors.text,
                  marginBottom: '4px',
                }}
              >
                Remove from registry only
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.4',
                }}
              >
                The repository will be removed from your list, but all local files will be kept.
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="removeOption"
              checked={deleteLocal}
              onChange={() => setDeleteLocal(true)}
              style={{
                marginTop: '2px',
                cursor: 'pointer',
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: theme.colors.error || '#ef4444',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} />
                Delete local files too
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.4',
                }}
              >
                <strong style={{ color: theme.colors.error || '#ef4444' }}>
                  This cannot be undone!
                </strong>{' '}
                All files in the repository directory will be permanently deleted.
              </div>
            </div>
          </label>
        </div>

        {/* Warning for delete option */}
        {deleteLocal && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: `${theme.colors.error || '#ef4444'}15`,
              border: `1px solid ${theme.colors.error || '#ef4444'}40`,
              borderRadius: '4px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle
              size={16}
              style={{
                color: theme.colors.error || '#ef4444',
                marginTop: '2px',
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize: '13px',
                color: theme.colors.error || '#ef4444',
                lineHeight: '1.4',
              }}
            >
              <strong>Warning:</strong> You are about to permanently delete all files at:
              <div
                style={{
                  marginTop: '4px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {repository.path}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: theme.colors.text,
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleRemove}
            style={{
              padding: '8px 16px',
              backgroundColor: deleteLocal
                ? theme.colors.error || '#ef4444'
                : theme.colors.warning || '#f59e0b',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = deleteLocal
                ? '#dc2626'
                : '#ea580c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = deleteLocal
                ? theme.colors.error || '#ef4444'
                : theme.colors.warning || '#f59e0b';
            }}
          >
            <Trash2 size={14} />
            {deleteLocal ? 'Delete Repository' : 'Remove Repository'}
          </button>
        </div>
      </div>
    </div>
  );
};