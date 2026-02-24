import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, FolderMinus, FolderOutput, AlertCircle, AlertTriangle } from 'lucide-react';
import type {
  AlexandriaEntry,
  Workspace,
} from '@principal-ai/alexandria-core-library/types';
import { WorkspaceService } from '../../main-process-api/WorkspaceService';
import { WindowService } from '../../main-process-api/WindowService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { getWorkspaceThemeColor } from '../../themes/predefinedThemes';

interface RemoveFromWorkspaceModalProps {
  isOpen: boolean;
  entry: AlexandriaEntry | null;
  workspace: Workspace | null;
  onClose: () => void;
  onConfirm: (moveToDefault: boolean) => Promise<void>;
}

export const RemoveFromWorkspaceModal: React.FC<
  RemoveFromWorkspaceModalProps
> = ({ isOpen, entry, workspace, onClose, onConfirm }) => {
  const { theme } = useTheme();
  const [moveToDefault, setMoveToDefault] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isInWorkspaceDirectory, setIsInWorkspaceDirectory] = useState<
    boolean | null
  >(null);
  const [defaultCloneDirectory, setDefaultCloneDirectory] = useState<
    string | null
  >(null);
  const [hasOpenWindow, setHasOpenWindow] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if the repository is in the workspace directory and if default clone directory is set
  useEffect(() => {
    const checkConditions = async () => {
      if (!isOpen || !entry || !workspace) {
        setIsInWorkspaceDirectory(null);
        setDefaultCloneDirectory(null);
        setHasOpenWindow(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Check all conditions in parallel
        const [inWorkspaceDir, prefs, windowOpen] = await Promise.all([
          WorkspaceService.isRepositoryInWorkspaceDirectory(entry, workspace.id),
          UserPreferencesService.getPreferences(),
          WindowService.isRepositoryWindowOpen(entry),
        ]);

        setIsInWorkspaceDirectory(inWorkspaceDir);
        setDefaultCloneDirectory(prefs.defaultCloneDirectory || null);
        setHasOpenWindow(windowOpen);

        // If in workspace directory, default clone directory is set, and no window is open, default to moving
        if (inWorkspaceDir && prefs.defaultCloneDirectory && !windowOpen) {
          setMoveToDefault(true);
        } else {
          setMoveToDefault(false);
        }
      } catch (error) {
        console.error('Error checking removal conditions:', error);
        setIsInWorkspaceDirectory(null);
        setDefaultCloneDirectory(null);
        setHasOpenWindow(false);
      } finally {
        setLoading(false);
      }
    };

    checkConditions();
  }, [isOpen, entry, workspace]);

  const handleConfirm = async () => {
    try {
      setIsRemoving(true);
      await onConfirm(moveToDefault);
      onClose();
    } catch (error) {
      console.error('Error removing from workspace:', error);
    } finally {
      setIsRemoving(false);
      setMoveToDefault(false);
    }
  };

  const handleClose = useCallback(() => {
    if (!isRemoving) {
      setMoveToDefault(false);
      onClose();
    }
  }, [isRemoving, onClose]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRemoving) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRemoving, handleClose]);

  if (!isOpen || !entry || !workspace) return null;

  const workspaceColor = getWorkspaceThemeColor(
    workspace.theme,
    theme.colors.primary,
  );

  // Show move option only if:
  // 1. Repository is in the workspace's suggestedClonePath
  // 2. Default clone directory is configured
  const showMoveOption = isInWorkspaceDirectory === true && defaultCloneDirectory;

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
            <FolderMinus size={24} style={{ color: theme.colors.warning }} />
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
              }}
            >
              Remove from Workspace
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={isRemoving}
            style={{
              background: 'none',
              border: 'none',
              cursor: isRemoving ? 'not-allowed' : 'pointer',
              padding: '4px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              opacity: isRemoving ? 0.5 : 1,
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
              marginBottom: '16px',
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

          {/* Workspace Info */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: `${workspaceColor}10`,
              border: `1px solid ${workspaceColor}30`,
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: theme.colors.text,
              }}
            >
              <span>Removing from workspace:</span>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: `${workspaceColor}20`,
                  border: `1px solid ${workspaceColor}40`,
                  fontWeight: 500,
                }}
              >
                {workspace.icon && (
                  <span style={{ fontSize: '14px' }}>{workspace.icon}</span>
                )}
                {workspace.name}
              </div>
            </div>
          </div>

          {loading ? (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '13px',
              }}
            >
              Checking repository location...
            </div>
          ) : showMoveOption ? (
            <>
              {/* Move Option */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: `${theme.colors.info || '#3b82f6'}10`,
                  border: `1px solid ${theme.colors.info || '#3b82f6'}30`,
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <AlertCircle
                    size={18}
                    style={{
                      color: theme.colors.info || '#3b82f6',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '13px',
                      color: theme.colors.text,
                      lineHeight: '1.5',
                    }}
                  >
                    This repository is located inside the workspace folder. You
                    can move it to your default clone directory.
                  </div>
                </div>
              </div>

              {/* Warning if window is open */}
              {hasOpenWindow && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: `${theme.colors.warning}15`,
                    border: `1px solid ${theme.colors.warning}40`,
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <AlertTriangle
                      size={18}
                      style={{
                        color: theme.colors.warning,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    />
                    <div
                      style={{
                        fontSize: '13px',
                        color: theme.colors.text,
                        lineHeight: '1.5',
                      }}
                    >
                      This repository has an open window. Close it first to enable moving.
                    </div>
                  </div>
                </div>
              )}

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '8px',
                  border: `2px solid ${moveToDefault ? theme.colors.primary : theme.colors.border}`,
                  backgroundColor: moveToDefault
                    ? `${theme.colors.primary}10`
                    : theme.colors.backgroundSecondary,
                  cursor: isRemoving || hasOpenWindow ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: isRemoving || hasOpenWindow ? 0.5 : 1,
                }}
                onClick={() => !isRemoving && !hasOpenWindow && setMoveToDefault(!moveToDefault)}
              >
                <input
                  type="checkbox"
                  checked={moveToDefault}
                  onChange={() => setMoveToDefault(!moveToDefault)}
                  disabled={isRemoving || hasOpenWindow}
                  style={{
                    marginTop: '2px',
                    cursor: isRemoving || hasOpenWindow ? 'not-allowed' : 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <FolderOutput
                      size={16}
                      style={{ color: hasOpenWindow ? theme.colors.textSecondary : theme.colors.primary }}
                    />
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: hasOpenWindow ? theme.colors.textSecondary : theme.colors.text,
                      }}
                    >
                      Move to default directory
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}
                  >
                    {defaultCloneDirectory}
                  </div>
                </div>
              </label>
            </>
          ) : (
            <div
              style={{
                fontSize: '13px',
                color: theme.colors.textSecondary,
                lineHeight: '1.5',
              }}
            >
              The repository will be removed from this workspace. The local
              files will remain in their current location.
            </div>
          )}
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
            disabled={isRemoving}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: 'transparent',
              color: theme.colors.text,
              cursor: isRemoving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              opacity: isRemoving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isRemoving}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: theme.colors.warning,
              color: theme.colors.background,
              cursor: isRemoving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: theme.fonts.body,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isRemoving ? 0.5 : 1,
            }}
          >
            <FolderMinus size={16} />
            {isRemoving
              ? moveToDefault
                ? 'Moving & Removing...'
                : 'Removing...'
              : moveToDefault
                ? 'Move & Remove'
                : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
