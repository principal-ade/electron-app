import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@principal-ade/industry-theme';
import type { WorkspaceLayout } from '../../shared/types/userPreferences.types';

export interface SaveWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    options?: {
      description?: string;
      includeSizes?: boolean;
      includeCollapsed?: boolean;
    },
  ) => Promise<WorkspaceLayout | void>;
}

export const SaveWorkspaceModal: React.FC<SaveWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeSizes, setIncludeSizes] = useState(true);
  const [includeCollapsed, setIncludeCollapsed] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(name, {
        description: description.trim() || undefined,
        includeSizes,
        includeCollapsed,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workspace');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIncludeSizes(true);
    setIncludeCollapsed(true);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

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
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            Save Workspace
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: isSaving ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            marginBottom: '20px',
            lineHeight: 1.5,
          }}
        >
          Save your current panel layout as a workspace that you can quickly
          switch to later.
        </p>

        {/* Name Input */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="workspace-name"
            style={{
              display: 'block',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              color: theme.colors.text,
              marginBottom: '8px',
            }}
          >
            Name *
          </label>
          <input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="e.g., My Workflow"
            disabled={isSaving}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${error ? theme.colors.error : theme.colors.border}`,
              borderRadius: '4px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = theme.colors.primary;
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = theme.colors.border;
              }
            }}
          />
        </div>

        {/* Description Input */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="workspace-description"
            style={{
              display: 'block',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              color: theme.colors.text,
              marginBottom: '8px',
            }}
          >
            Description (optional)
          </label>
          <textarea
            id="workspace-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this workspace for?"
            disabled={isSaving}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.colors.border;
            }}
          />
        </div>

        {/* Options */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <input
              type="checkbox"
              id="include-sizes"
              checked={includeSizes}
              onChange={(e) => setIncludeSizes(e.target.checked)}
              disabled={isSaving}
              style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
            />
            <label
              htmlFor="include-sizes"
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.text,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Include panel sizes
            </label>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <input
              type="checkbox"
              id="include-collapsed"
              checked={includeCollapsed}
              onChange={(e) => setIncludeCollapsed(e.target.checked)}
              disabled={isSaving}
              style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
            />
            <label
              htmlFor="include-collapsed"
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.text,
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Include collapsed states
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '12px',
              backgroundColor: `${theme.colors.error}20`,
              border: `1px solid ${theme.colors.error}`,
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: theme.fontSizes[1],
                color: theme.colors.error,
              }}
            >
              {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={handleClose}
            disabled={isSaving}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              opacity: isSaving ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '6px',
              cursor: isSaving || !name.trim() ? 'not-allowed' : 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              opacity: isSaving || !name.trim() ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSaving && name.trim()) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving && name.trim()) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {isSaving ? 'Saving...' : 'Save Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
};
