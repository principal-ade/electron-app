import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Save, X, AlertCircle } from 'lucide-react';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';

interface SaveThreadModalProps {
  isOpen: boolean;
  repositories: AlexandriaEntry[];
  onSave: (workspaceName: string, description?: string) => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}

export const SaveThreadModal: React.FC<SaveThreadModalProps> = ({
  isOpen,
  repositories,
  onSave,
  onDiscard,
  onCancel,
}) => {
  const { theme } = useTheme();
  const [workspaceName, setWorkspaceName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(workspaceName.trim(), description.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workspace');
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

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
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: `1px solid ${theme.colors.border}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Save size={24} color={theme.colors.primary} />
            <h2
              style={{
                margin: 0,
                fontSize: `${theme.fontSizes[4]}px`,
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
              }}
            >
              Save Thread as Workspace
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              background: 'transparent',
              border: 'none',
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
                e.currentTarget.style.backgroundColor = theme.colors.border;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} color={theme.colors.textSecondary} />
          </button>
        </div>

        {/* Warning message */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '12px',
            backgroundColor: `${theme.colors.warning || '#f59e0b'}15`,
            border: `1px solid ${theme.colors.warning || '#f59e0b'}30`,
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          <AlertCircle
            size={20}
            color={theme.colors.warning || '#f59e0b'}
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div>
            <p
              style={{
                margin: '0 0 4px 0',
                fontSize: `${theme.fontSizes[1]}px`,
                color: theme.colors.text,
                fontFamily: theme.fonts.body,
                fontWeight: theme.fontWeights.semibold,
              }}
            >
              This is an ephemeral thread
            </p>
            <p
              style={{
                margin: 0,
                fontSize: `${theme.fontSizes[1]}px`,
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
                lineHeight: theme.lineHeights.relaxed,
              }}
            >
              Closing this window will lose your {repositories.length}{' '}
              {repositories.length === 1 ? 'repository' : 'repositories'}. Save
              as a workspace to keep them.
            </p>
          </div>
        </div>

        {/* Form */}
        <div style={{ marginBottom: '24px' }}>
          <label
            htmlFor="workspace-name"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            Workspace Name *
          </label>
          <input
            id="workspace-name"
            type="text"
            value={workspaceName}
            onChange={(e) => {
              setWorkspaceName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder="My Project Workspace"
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: `${theme.fontSizes[2]}px`,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${error ? theme.colors.error || '#ef4444' : theme.colors.border}`,
              borderRadius: '6px',
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

        <div style={{ marginBottom: '24px' }}>
          <label
            htmlFor="workspace-description"
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
              fontFamily: theme.fonts.body,
            }}
          >
            Description (Optional)
          </label>
          <textarea
            id="workspace-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder="A brief description of this workspace..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              outline: 'none',
              resize: 'vertical',
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

        {/* Repository count */}
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              margin: 0,
              fontSize: `${theme.fontSizes[1]}px`,
              color: theme.colors.textSecondary,
              fontFamily: theme.fonts.body,
            }}
          >
            {repositories.length}{' '}
            {repositories.length === 1 ? 'repository' : 'repositories'} will be
            added to this workspace
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: `${theme.colors.error || '#ef4444'}15`,
              border: `1px solid ${theme.colors.error || '#ef4444'}30`,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} color={theme.colors.error || '#ef4444'} />
            <span
              style={{
                fontSize: `${theme.fontSizes[1]}px`,
                color: theme.colors.error || '#ef4444',
                fontFamily: theme.fonts.body,
              }}
            >
              {error}
            </span>
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
            onClick={onDiscard}
            disabled={isSaving}
            style={{
              padding: '10px 20px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
              backgroundColor: 'transparent',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: isSaving ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = theme.colors.border;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Discard
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              padding: '10px 20px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: isSaving ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = theme.colors.border;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundSecondary;
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !workspaceName.trim()}
            style={{
              padding: '10px 20px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.medium,
              fontFamily: theme.fonts.body,
              color: '#ffffff',
              backgroundColor: theme.colors.primary,
              border: 'none',
              borderRadius: '6px',
              cursor:
                isSaving || !workspaceName.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              opacity: isSaving || !workspaceName.trim() ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSaving && workspaceName.trim()) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving && workspaceName.trim()) {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {isSaving ? 'Saving...' : 'Save Workspace'}
          </button>
        </div>

        {/* Keyboard shortcut hint */}
        <p
          style={{
            marginTop: '16px',
            marginBottom: 0,
            fontSize: `${theme.fontSizes[0]}px`,
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.body,
            textAlign: 'center',
          }}
        >
          Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
        </p>
      </div>
    </div>
  );
};
