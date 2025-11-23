import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, AlertTriangle } from 'lucide-react';
import type { Workspace } from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../main-process-api/WorkspaceService';

interface DeleteWorkspaceConfirmationModalProps {
  isOpen: boolean;
  workspace: Workspace | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DeleteWorkspaceConfirmationModal: React.FC<DeleteWorkspaceConfirmationModalProps> = ({
  isOpen,
  workspace,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!isDeleting) {
      setError(null);
      onClose();
    }
  }, [isDeleting, onClose]);

  // Handle ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, handleClose]);

  const handleDelete = async () => {
    if (!workspace) return;

    setError(null);
    setIsDeleting(true);

    try {
      await WorkspaceService.deleteWorkspace(workspace.id);
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('[DeleteWorkspaceConfirmationModal] Error deleting workspace:', error);
      setError('Failed to delete workspace. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !workspace) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          border: `1px solid ${theme.colors.border}`,
          width: '90%',
          maxWidth: '480px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: `${theme.colors.error}15`,
                color: theme.colors.error,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
              }}
            >
              Delete Workspace
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            style={{
              background: 'none',
              border: 'none',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              padding: '4px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              opacity: isDeleting ? 0.5 : 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: `${theme.colors.error}15`,
                border: `1px solid ${theme.colors.error}40`,
                color: theme.colors.error,
                fontSize: '14px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          <p
            style={{
              margin: 0,
              color: theme.colors.text,
              fontSize: '14px',
              fontFamily: theme.fonts.body,
              lineHeight: 1.6,
            }}
          >
            Are you sure you want to delete{' '}
            <strong style={{ fontWeight: 600 }}>{workspace.name}</strong>?
          </p>
          <p
            style={{
              margin: '12px 0 0 0',
              color: theme.colors.textSecondary,
              fontSize: '14px',
              fontFamily: theme.fonts.body,
              lineHeight: 1.6,
            }}
          >
            This action cannot be undone. Repositories in this workspace will not be deleted from your system.
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: 'transparent',
              color: theme.colors.text,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              opacity: isDeleting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: theme.colors.error,
              color: theme.colors.background,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isDeleting ? 0.5 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Workspace'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render using a portal to escape parent overflow and z-index constraints
  return createPortal(modalContent, document.body);
};
