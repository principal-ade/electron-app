import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Check, FolderOpen } from 'lucide-react';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { FileSystemService } from '../main-process-api/FileSystemService';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPath, setFormPath] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      // Reset form
      setFormName('');
      setFormDescription('');
      setFormPath('');
      setFormColor('#3b82f6');
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  // Handle ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, handleClose]);

  const handleBrowseDirectory = async () => {
    try {
      const result = await FileSystemService.selectDirectory({
        title: 'Select Workspace Directory',
        buttonLabel: 'Select Directory',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result && !result.canceled && result.filePaths?.[0]) {
        setFormPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('[CreateWorkspaceModal] Error selecting directory:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      setError('Please enter a workspace name');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await WorkspaceService.createWorkspace({
        name: formName,
        description: formDescription || undefined,
        color: formColor,
        suggestedClonePath: formPath || undefined,
        icon: undefined,
      });

      // Reset form
      setFormName('');
      setFormDescription('');
      setFormPath('');
      setFormColor('#3b82f6');

      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error('[CreateWorkspaceModal] Error creating workspace:', error);
      setError('Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
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
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            Create New Workspace
          </h3>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '4px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
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

            {/* Name */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="workspace-name"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                }}
              >
                Name *
              </label>
              <input
                id="workspace-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Work Projects"
                disabled={isSubmitting}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontFamily: theme.fonts.body,
                  outline: 'none',
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="workspace-description"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                }}
              >
                Description
              </label>
              <textarea
                id="workspace-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontSize: '14px',
                  fontFamily: theme.fonts.body,
                  resize: 'vertical',
                  outline: 'none',
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              />
            </div>

            {/* Color */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="workspace-color"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                }}
              >
                Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  id="workspace-color"
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '60px',
                    height: '40px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                />
                <span
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {formColor}
                </span>
              </div>
            </div>

            {/* Suggested Clone Path */}
            <div style={{ marginBottom: '0' }}>
              <label
                htmlFor="workspace-path"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                }}
              >
                Suggested Clone Path
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="workspace-path"
                  type="text"
                  value={formPath}
                  onChange={(e) => setFormPath(e.target.value)}
                  placeholder="/path/to/workspace"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={handleBrowseDirectory}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.backgroundTertiary,
                    color: theme.colors.text,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontFamily: theme.fonts.body,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  <FolderOpen size={16} />
                  Browse...
                </button>
              </div>
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
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: 'transparent',
                color: theme.colors.text,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: theme.fonts.body,
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formName.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: theme.colors.primary,
                color: 'white',
                cursor:
                  isSubmitting || !formName.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                fontFamily: theme.fonts.body,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSubmitting || !formName.trim() ? 0.5 : 1,
              }}
            >
              <Check size={16} />
              {isSubmitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render using a portal to escape parent overflow and z-index constraints
  return createPortal(modalContent, document.body);
};
