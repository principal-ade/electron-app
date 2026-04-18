import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import {
  X,
  Trash2,
  Briefcase,
} from 'lucide-react';
import type {
  AlexandriaEntry,
  Workspace,
} from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { ShellService } from '../../main-process-api/ShellService';
import { getWorkspaceThemeColor } from '../../themes/predefinedThemes';

interface DeleteAlexandriaEntryModalProps {
  isOpen: boolean;
  entry: (AlexandriaEntry & { isTracked?: boolean; isDiscovered?: boolean }) | null;
  onClose: () => void;
  onConfirm: (deleteLocal: boolean) => Promise<void>;
  gitStatus?: {
    hasUncommittedChanges: boolean;
    uncommittedCount: number;
    unpushedCommits: number;
    currentBranch: string;
  } | null;
}

export const DeleteAlexandriaEntryModal: React.FC<
  DeleteAlexandriaEntryModalProps
> = ({ isOpen, entry, onClose, onConfirm, gitStatus }) => {
  const { theme } = useTheme();

  // Check if this is a real Alexandria entry (not just a discovered repo)
  // Discovered repos have isDiscovered: true
  const isAlexandriaEntry = !entry?.isDiscovered;

  const [isDeleting, setIsDeleting] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Always delete local files
  const deleteLocal = true;

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(deleteLocal);
    } catch (error) {
      console.error('Error deleting Alexandria entry:', error);
      alert(`Failed to delete repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      onClose(); // Always close the modal
    }
  };

  const handleClose = useCallback(() => {
    if (!isDeleting) {
      onClose();
    }
  }, [isDeleting, onClose]);

  // Fetch workspaces when modal opens
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (!isOpen || !entry) {
        setWorkspaces([]);
        return;
      }

      try {
        setLoadingWorkspaces(true);
        const repoWorkspaces =
          await WorkspaceService.getRepositoryWorkspaces(entry);
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
  }, [isOpen, isDeleting, handleClose]);

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
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
            <Trash2
              size={24}
              style={{ color: theme.colors.error || '#ef4444' }}
            />
            <h3
              style={{
                margin: 0,
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
              }}
            >
              {entry.name}
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
          {/* Info */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: `${theme.colors.info || '#3b82f6'}15`,
              border: `1px solid ${theme.colors.info || '#3b82f6'}40`,
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontSize: theme.fontSizes[2],
                fontFamily: theme.fonts.body,
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.textSecondary,
                marginBottom: '8px',
              }}
            >
              Delete Local Clone
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.monospace,
                marginBottom: '8px',
                wordBreak: 'break-all',
              }}
            >
              {entry.path}
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
                lineHeight: '1.5',
              }}
            >
              This will remove the project folder. You can clone from the remote at any time to recover.
            </div>
          </div>

          {/* Git Status Warning */}
          {gitStatus && (gitStatus.hasUncommittedChanges || gitStatus.unpushedCommits > 0) && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: `${theme.colors.error || '#ef4444'}15`,
                border: `2px solid ${theme.colors.error || '#ef4444'}`,
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[2],
                  fontFamily: theme.fonts.body,
                  fontWeight: theme.fontWeights.semibold,
                  color: theme.colors.error || '#ef4444',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Warning: You will lose uncommitted work!
              </div>
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                  lineHeight: '1.5',
                }}
              >
                {gitStatus.hasUncommittedChanges && (
                  <div style={{ marginBottom: '4px' }}>
                    • <strong>{gitStatus.uncommittedCount}</strong> uncommitted {gitStatus.uncommittedCount === 1 ? 'change' : 'changes'} will be permanently lost
                  </div>
                )}
                {gitStatus.unpushedCommits > 0 && (
                  <div>
                    • <strong>{gitStatus.unpushedCommits}</strong> unpushed {gitStatus.unpushedCommits === 1 ? 'commit' : 'commits'} on <strong>{gitStatus.currentBranch}</strong> will be lost
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workspace Memberships - Only for Alexandria entries */}
          {isAlexandriaEntry && loadingWorkspaces ? (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: theme.colors.backgroundSecondary,
                border: `1px solid ${theme.colors.border}`,
                marginBottom: '20px',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
                textAlign: 'center',
              }}
            >
              Loading workspaces...
            </div>
          ) : isAlexandriaEntry && workspaces.length > 0 ? (
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
                <Briefcase
                  size={14}
                  style={{ color: theme.colors.textSecondary }}
                />
                <span
                  style={{
                    fontSize: theme.fontSizes[1],
                    fontFamily: theme.fonts.body,
                    fontWeight: theme.fontWeights.semibold,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Will be removed from {workspaces.length} workspace
                  {workspaces.length !== 1 ? 's' : ''}:
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                {workspaces.map((workspace) => {
                  const workspaceColor = getWorkspaceThemeColor(
                    workspace.theme,
                    theme.colors.primary,
                  );
                  return (
                    <div
                      key={workspace.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        backgroundColor: `${workspaceColor}20`,
                        border: `1px solid ${workspaceColor}40`,
                        fontSize: theme.fontSizes[1],
                        fontFamily: theme.fonts.body,
                        fontWeight: theme.fontWeights.medium,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {workspace.icon && (
                        <span style={{ fontSize: theme.fontSizes[2] }}>
                          {workspace.icon}
                        </span>
                      )}
                      {workspace.name}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Open in Finder */}
            <button
              onClick={() => ShellService.openPath(entry.path)}
              style={{
                width: '100%',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '8px',
                background: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: theme.fontSizes[2],
                fontWeight: theme.fontWeights.medium,
                fontFamily: theme.fonts.body,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Open in Finder
            </button>

            {/* Open in GitHub */}
            {(() => {
              // Try to get GitHub URL from entry
              const getGitHubUrl = (): string | null => {
                // Try using github metadata first
                if (entry?.github?.owner && entry?.github?.name) {
                  return `https://github.com/${entry.github.owner}/${entry.github.name}`;
                }

                // Fall back to parsing remoteUrl
                if (entry?.remoteUrl) {
                  const url = entry.remoteUrl;
                  // Handle https://github.com/owner/repo.git
                  const httpsMatch = url.match(new RegExp('https://github\\.com/([^/]+)/([^/.]+)'));
                  if (httpsMatch) {
                    return `https://github.com/${httpsMatch[1]}/${httpsMatch[2]}`;
                  }
                  // Handle git@github.com:owner/repo.git
                  const sshMatch = url.match(new RegExp('git@github\\.com:([^/]+)/([^/.]+)'));
                  if (sshMatch) {
                    return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
                  }
                }

                return null;
              };

              const githubUrl = getGitHubUrl();

              return githubUrl ? (
                <button
                  onClick={() => window.open(githubUrl, '_blank')}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '8px',
                    background: theme.colors.backgroundSecondary,
                    color: theme.colors.primary,
                    cursor: 'pointer',
                    fontSize: theme.fontSizes[2],
                    fontWeight: theme.fontWeights.medium,
                    fontFamily: theme.fonts.body,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  Open Remote in GitHub
                </button>
              ) : null;
            })()}
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
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.medium,
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
              backgroundColor: theme.colors.error || '#ef4444',
              color: theme.colors.background,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isDeleting ? 0.5 : 1,
            }}
          >
            <Trash2 size={16} />
            {isDeleting ? 'Deleting...' : 'Delete Project Folder'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
