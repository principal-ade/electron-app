import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  Shield,
} from 'lucide-react';
import type { Repository } from '../../../../shared/types/repository.types';
import type {
  RepositorySecrets,
  SecretMetadata,
} from '../../../../shared/main-process-api-interfaces/SecretsAPI';
import { SecretsService } from '../../../main-process-api/SecretsService';

interface SecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: Repository;
  selectedSource?: { type: string; location: string } | null;
}

export const SecretsModal: React.FC<SecretsModalProps> = ({
  isOpen,
  onClose,
  repository,
  selectedSource,
}) => {
  const { theme } = useTheme();
  const [secrets, setSecrets] = useState<RepositorySecrets>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SecretMetadata | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Generate repository ID from repository data
  const getRepoId = () => {
    if (repository.owner && repository.name) {
      return `${repository.owner}/${repository.name}`;
    }
    return repository.name || 'unknown';
  };

  // Get repository path (prefer selected local source)
  const getRepoPath = () => {
    if (selectedSource?.type === 'local' && selectedSource.location) {
      return selectedSource.location;
    }
    if (repository.localClones?.length > 0) {
      return repository.localClones[0].path;
    }
    return repository.remoteUrl || '';
  };

  // Load secrets when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSecrets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadSecrets = async () => {
    setLoading(true);
    setError(null);
    try {
      const repoId = getRepoId();
      const storedSecrets = await SecretsService.get(repoId);

      if (storedSecrets) {
        setSecrets(storedSecrets);

        // Get metadata
        const allMetadata = await SecretsService.list();
        const repoMeta = allMetadata.find((m) => m.repoId === repoId);
        setMetadata(repoMeta || null);
      } else {
        setSecrets({});
        setMetadata(null);
      }
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load secrets:', err);
      setError('Failed to load secrets');
    } finally {
      setLoading(false);
    }
  };

  const saveSecrets = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await SecretsService.store({
        repoId: getRepoId(),
        repoPath: getRepoPath(),
        secrets,
      });

      if (result.success) {
        setMetadata(result.metadata || null);
        setHasChanges(false);
        // Show success feedback
        setError(null);
      } else {
        setError(result.error || 'Failed to save secrets');
      }
    } catch (err) {
      console.error('Failed to save secrets:', err);
      setError('Failed to save secrets');
    } finally {
      setSaving(false);
    }
  };

  const addSecret = () => {
    // Validate key format
    if (!newKey || !newValue) {
      setError('Both key and value are required');
      return;
    }

    if (!/^[A-Z_][A-Z0-9_]*$/i.test(newKey)) {
      setError(
        'Key must be a valid environment variable name (letters, numbers, underscore)',
      );
      return;
    }

    if (secrets[newKey]) {
      setError('Key already exists');
      return;
    }

    setSecrets({ ...secrets, [newKey]: newValue });
    setNewKey('');
    setNewValue('');
    setError(null);
    setHasChanges(true);
  };

  const updateSecret = (key: string, value: string) => {
    setSecrets({ ...secrets, [key]: value });
    setEditingKey(null);
    setEditingValue('');
    setHasChanges(true);
  };

  const deleteSecret = (key: string) => {
    const newSecrets = { ...secrets };
    delete newSecrets[key];
    setSecrets(newSecrets);
    setHasChanges(true);
  };

  const toggleShowValue = (key: string) => {
    setShowValues({ ...showValues, [key]: !showValues[key] });
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
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={20} color={theme.colors.primary} />
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              Environment Secrets
            </h2>
            <span
              style={{
                fontSize: '12px',
                color: theme.colors.textSecondary,
                padding: '2px 8px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '4px',
              }}
            >
              {repository.name}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: '24px',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Info Banner */}
        <div
          style={{
            margin: '16px 24px 0',
            padding: '12px',
            backgroundColor: `${theme.colors.primary}10`,
            border: `1px solid ${theme.colors.primary}30`,
            borderRadius: '8px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle
            size={16}
            color={theme.colors.primary}
            style={{ flexShrink: 0, marginTop: '2px' }}
          />
          <div
            style={{
              fontSize: '13px',
              color: theme.colors.text,
              lineHeight: '1.5',
            }}
          >
            <strong>Secure Storage:</strong> Secrets are encrypted using your
            system's secure storage. They are never logged or exposed in plain
            text. Environment files are created only when needed and
            automatically cleaned up.
          </div>
        </div>

        {/* Metadata */}
        {metadata && (
          <div
            style={{
              margin: '12px 24px 0',
              fontSize: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            Last updated: {new Date(metadata.updatedAt).toLocaleString()} •{' '}
            {metadata.secretCount} secret{metadata.secretCount !== 1 ? 's' : ''}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            padding: '16px 24px',
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: theme.colors.textSecondary,
              }}
            >
              Loading secrets...
            </div>
          ) : (
            <>
              {/* Existing Secrets */}
              {Object.keys(secrets).length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '12px',
                    }}
                  >
                    Stored Secrets
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {Object.entries(secrets).map(([key, value]) => (
                      <div
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          backgroundColor: theme.colors.backgroundSecondary,
                          borderRadius: '6px',
                          border: `1px solid ${theme.colors.border}`,
                        }}
                      >
                        <Key size={14} color={theme.colors.textSecondary} />
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: theme.colors.text,
                            minWidth: '150px',
                          }}
                        >
                          {key}
                        </span>

                        {editingKey === key ? (
                          <>
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  updateSecret(key, editingValue);
                                } else if (e.key === 'Escape') {
                                  setEditingKey(null);
                                  setEditingValue('');
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                backgroundColor: theme.colors.background,
                                border: `1px solid ${theme.colors.primary}`,
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontFamily: 'monospace',
                                color: theme.colors.text,
                                outline: 'none',
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => updateSecret(key, editingValue)}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: theme.colors.primary,
                                color: theme.colors.background,
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingKey(null);
                                setEditingValue('');
                              }}
                              style={{
                                padding: '4px 8px',
                                backgroundColor:
                                  theme.colors.backgroundTertiary,
                                color: theme.colors.text,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                flex: 1,
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                color: theme.colors.textSecondary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {showValues[key] ? value : '••••••••'}
                            </div>
                            <button
                              onClick={() => toggleShowValue(key)}
                              style={{
                                padding: '4px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: theme.colors.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title={
                                showValues[key] ? 'Hide value' : 'Show value'
                              }
                            >
                              {showValues[key] ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setEditingKey(key);
                                setEditingValue(value);
                              }}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: 'transparent',
                                color: theme.colors.primary,
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete secret "${key}"?`)) {
                                  deleteSecret(key);
                                }
                              }}
                              style={{
                                padding: '4px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: theme.colors.error || '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title="Delete secret"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Secret */}
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                    marginBottom: '12px',
                  }}
                >
                  Add New Secret
                </h3>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                  }}
                >
                  <input
                    type="text"
                    placeholder="KEY_NAME"
                    value={newKey}
                    onChange={(e) =>
                      setNewKey(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_]/g, '_'),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newKey) {
                        document.getElementById('secret-value-input')?.focus();
                      }
                    }}
                    style={{
                      width: '200px',
                      padding: '8px 12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: theme.colors.text,
                      outline: 'none',
                    }}
                  />
                  <input
                    id="secret-value-input"
                    type="password"
                    placeholder="Secret value"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newKey && newValue) {
                        addSecret();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: theme.colors.text,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={addSecret}
                    disabled={!newKey || !newValue}
                    style={{
                      padding: '8px 16px',
                      backgroundColor:
                        newKey && newValue
                          ? theme.colors.primary
                          : theme.colors.backgroundTertiary,
                      color:
                        newKey && newValue
                          ? theme.colors.background
                          : theme.colors.textSecondary,
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: newKey && newValue ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: newKey && newValue ? 1 : 0.5,
                    }}
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
                {error && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: `${theme.colors.error || '#ef4444'}10`,
                      border: `1px solid ${theme.colors.error || '#ef4444'}30`,
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: theme.colors.error || '#ef4444',
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
            {hasChanges && '• Unsaved changes'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveSecrets}
              disabled={!hasChanges || saving}
              style={{
                padding: '8px 16px',
                backgroundColor: hasChanges
                  ? theme.colors.primary
                  : theme.colors.backgroundTertiary,
                color: hasChanges
                  ? theme.colors.background
                  : theme.colors.textSecondary,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: hasChanges ? 1 : 0.5,
              }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
