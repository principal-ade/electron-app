import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Trash2, AlertTriangle, FileX, Database, Briefcase } from 'lucide-react';
import type { AlexandriaEntry, Workspace } from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';

interface DeleteAlexandriaEntryModalProps {
  isOpen: boolean;
  entry: AlexandriaEntry | null;
  onClose: () => void;
  onConfirm: (deleteLocal: boolean) => Promise<void>;
}

export const DeleteAlexandriaEntryModal: React.FC<DeleteAlexandriaEntryModalProps> = ({
  isOpen,
  entry,
  onClose,
  onConfirm,
}) => {
  const { theme } = useTheme();
  const [deleteLocal, setDeleteLocal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(deleteLocal);
      onClose();
    } catch (error) {
      console.error('Error deleting Alexandria entry:', error);
    } finally {
      setIsDeleting(false);
      setDeleteLocal(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setDeleteLocal(false);
      onClose();
    }
  };

  // Fetch workspaces when modal opens
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!isOpen || !entry) {
        setWorkspaces([]);
        return;
      }

      try {
        setLoadingWorkspaces(true);
        const repoWorkspaces = await WorkspaceService.getRepositoryWorkspaces(entry);
        setWorkspaces(repoWorkspaces || []);
      } catch (error) {
        console.error('Error fetching repository workspaces:', error);
        setWorkspaces([]);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, [isOpen, entry]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting]);

  if (!isOpen || !entry) return null;

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
          maxWidth: '500px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Trash2 size={24} style={{ color: theme.colors.error || '#ef4444' }} />
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
              }}
            >
              Delete Repository Entry
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
          {/* Repository Info */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '4px',
              }}
            >
              {entry.name}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {entry.path}
            </div>
          </div>

          {/* Warning */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: `${theme.colors.warning || '#f59e0b'}15`,
              border: `1px solid ${theme.colors.warning || '#f59e0b'}40`,
              marginBottom: '20px',
            }}
          >
            <AlertTriangle
              size={20}
              style={{ color: theme.colors.warning || '#f59e0b', flexShrink: 0, marginTop: '2px' }}
            />
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  marginBottom: '4px',
                }}
              >
                Choose deletion option
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                You can either remove this entry from Alexandria while keeping the local files, or permanently delete everything.
              </div>
            </div>
          </div>

          {/* Workspace Memberships */}
          {loadingWorkspaces ? (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                marginBottom: '20px',
                fontSize: '13px',
                color: theme.colors.textSecondary,
                textAlign: 'center',
              }}
            >
              Loading workspaces...
            </div>
          ) : workspaces.length > 0 ? (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <Briefcase size={14} style={{ color: theme.colors.textSecondary }} />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  Will be removed from {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}:
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      backgroundColor: workspace.color
                        ? `${workspace.color}20`
                        : theme.colors.backgroundTertiary,
                      border: `1px solid ${workspace.color || theme.colors.border}40`,
                      fontSize: '12px',
                      fontWeight: 500,
                      color: theme.colors.text,
                    }}
                  >
                    {workspace.icon && <span style={{ fontSize: '14px' }}>{workspace.icon}</span>}
                    {workspace.name}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                marginBottom: '20px',
                fontSize: '13px',
                color: theme.colors.textSecondary,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={14} style={{ color: theme.colors.textSecondary }} />
                Not currently in any workspaces
              </div>
            </div>
          )}

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Option 1: Just Unregister */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                borderRadius: '8px',
                border: `2px solid ${!deleteLocal ? theme.colors.primary : theme.colors.border}`,
                backgroundColor: !deleteLocal
                  ? `${theme.colors.primary}10`
                  : theme.colors.backgroundSecondary,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isDeleting ? 0.6 : 1,
              }}
              onClick={() => !isDeleting && setDeleteLocal(false)}
            >
              <input
                type="radio"
                name="deleteOption"
                checked={!deleteLocal}
                onChange={() => setDeleteLocal(false)}
                disabled={isDeleting}
                style={{
                  marginTop: '2px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Database size={16} style={{ color: theme.colors.primary }} />
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Unregister Only
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: `${theme.colors.success || '#10b981'}20`,
                      color: theme.colors.success || '#10b981',
                    }}
                  >
                    SAFE
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    lineHeight: '1.5',
                  }}
                >
                  Remove from Alexandria registry but keep all local files intact. The repository will also be removed from all workspaces. You can re-add this repository later.
                </div>
              </div>
            </label>

            {/* Option 2: Delete Everything */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                borderRadius: '8px',
                border: `2px solid ${deleteLocal ? theme.colors.error : theme.colors.border}`,
                backgroundColor: deleteLocal
                  ? `${theme.colors.error || '#ef4444'}10`
                  : theme.colors.backgroundSecondary,
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isDeleting ? 0.6 : 1,
              }}
              onClick={() => !isDeleting && setDeleteLocal(true)}
            >
              <input
                type="radio"
                name="deleteOption"
                checked={deleteLocal}
                onChange={() => setDeleteLocal(true)}
                disabled={isDeleting}
                style={{
                  marginTop: '2px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <FileX size={16} style={{ color: theme.colors.error || '#ef4444' }} />
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    Delete Local Clone
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: `${theme.colors.error || '#ef4444'}20`,
                      color: theme.colors.error || '#ef4444',
                    }}
                  >
                    PERMANENT
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    lineHeight: '1.5',
                  }}
                >
                  Permanently delete all local files and remove from Alexandria. This action cannot be undone.
                </div>
              </div>
            </label>
          </div>
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
            onClick={handleConfirm}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: deleteLocal
                ? theme.colors.error || '#ef4444'
                : theme.colors.primary,
              color: 'white',
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
            <Trash2 size={16} />
            {isDeleting
              ? 'Deleting...'
              : deleteLocal
                ? 'Delete Everything'
                : 'Unregister'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
