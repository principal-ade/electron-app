import { useTheme } from '@principal-ade/industry-theme';
import { Trash2 } from 'lucide-react';

interface FileDeleteConfirmDialogProps {
  filePath: string;
  fileName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const FileDeleteConfirmDialog: React.FC<
  FileDeleteConfirmDialogProps
> = ({ filePath, fileName, onConfirm, onCancel }) => {
  const { theme } = useTheme();
  const displayName = fileName || filePath.split('/').pop() || 'this file';

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <Trash2
            size={24}
            style={{ color: theme.colors.error || '#ef4444' }}
          />
          <h3
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: theme.colors.text,
            }}
          >
            Delete File?
          </h3>
        </div>

        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: theme.colors.textSecondary,
            lineHeight: '1.5',
          }}
        >
          Are you sure you want to delete <strong>{displayName}</strong>?
        </p>

        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '13px',
            color: theme.colors.textSecondary,
            fontFamily: 'monospace',
            padding: '8px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '4px',
            wordBreak: 'break-all',
          }}
        >
          {filePath}
        </p>

        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: theme.colors.error || '#ef4444',
            fontWeight: '500',
          }}
        >
          ⚠️ This action cannot be undone.
        </p>

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
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.error || '#ef4444',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.error || '#ef4444';
            }}
          >
            Delete File
          </button>
        </div>
      </div>
    </div>
  );
};
