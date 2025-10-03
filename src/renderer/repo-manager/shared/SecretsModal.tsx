import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  Shield,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import type { Repository } from '../../../shared/types/repository.types';
import type {
  RepositorySecrets,
  SecretMetadata,
} from '../../../shared/main-process-api-interfaces/SecretsAPI';
import { SecretsService } from '../../main-process-api/SecretsService';

interface SecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: Repository;
  selectedSource?: { type: string; location: string } | null;
}

interface SecretValue {
  value: string;
  fetchedAt: number;
  autoHideTimeout?: NodeJS.Timeout;
}

export const SecretsModal: React.FC<SecretsModalProps> = ({
  isOpen,
  onClose,
  repository,
  selectedSource,
}) => {
  const { theme } = useTheme();
  // State for on-demand secret fetching
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [loadedSecrets, setLoadedSecrets] = useState<Record<string, SecretValue>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());

  // State for editing and adding
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [localChanges, setLocalChanges] = useState<RepositorySecrets>({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<SecretMetadata | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Auto-hide timeout (30 seconds)
  const AUTO_HIDE_TIMEOUT = 30000;

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

  // Load only metadata when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSecretMetadata();
    } else {
      // Clear all loaded secrets when modal closes
      clearAllLoadedSecrets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadSecretMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const repoId = getRepoId();
      const metadataOnly = await SecretsService.getMetadata(repoId);

      if (metadataOnly) {
        setSecretKeys(metadataOnly.keys);

        // Get full metadata for display
        const allMetadata = await SecretsService.list();
        const repoMeta = allMetadata.find((m) => m.repoId === repoId);
        setMetadata(repoMeta || null);
      } else {
        setSecretKeys([]);
        setMetadata(null);
      }
      setHasChanges(false);
      setLocalChanges({});
    } catch (err) {
      console.error('Failed to load secret metadata:', err);
      setError('Failed to load secrets');
    } finally {
      setLoading(false);
    }
  };

  const fetchSecretValue = async (key: string) => {
    // Don't refetch if already loaded and recent
    if (loadedSecrets[key] && Date.now() - loadedSecrets[key].fetchedAt < 5000) {
      return;
    }

    setLoadingKeys(prev => new Set(prev).add(key));

    try {
      const repoId = getRepoId();
      const value = await SecretsService.getSingle(repoId, key);

      if (value !== null) {
        // Clear existing timeout if any
        if (loadedSecrets[key]?.autoHideTimeout) {
          clearTimeout(loadedSecrets[key].autoHideTimeout);
        }

        // Set auto-hide timeout
        const timeout = setTimeout(() => {
          hideSecretValue(key);
        }, AUTO_HIDE_TIMEOUT);

        setLoadedSecrets(prev => ({
          ...prev,
          [key]: {
            value,
            fetchedAt: Date.now(),
            autoHideTimeout: timeout
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch secret ${key}:`, err);
      setError(`Failed to load secret: ${key}`);
    } finally {
      setLoadingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const toggleShowValue = async (key: string) => {
    const isShowing = showValues[key];

    if (!isShowing) {
      // Fetch the value if not already loaded
      if (!loadedSecrets[key]) {
        await fetchSecretValue(key);
      }
      setShowValues({ ...showValues, [key]: true });
    } else {
      // Hide and optionally clear from memory
      setShowValues({ ...showValues, [key]: false });
    }
  };

  const hideSecretValue = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: false }));
    // Clear from memory after hiding
    clearSecretFromMemory(key);
  };

  const clearSecretFromMemory = (key: string) => {
    setLoadedSecrets(prev => {
      const newSecrets = { ...prev };
      if (newSecrets[key]?.autoHideTimeout) {
        clearTimeout(newSecrets[key].autoHideTimeout);
      }
      delete newSecrets[key];
      return newSecrets;
    });
  };

  const clearAllLoadedSecrets = () => {
    // Clear all timeouts
    Object.values(loadedSecrets).forEach(secret => {
      if (secret.autoHideTimeout) {
        clearTimeout(secret.autoHideTimeout);
      }
    });
    setLoadedSecrets({});
    setShowValues({});
  };

  const copyToClipboard = async (key: string) => {
    try {
      const repoId = getRepoId();
      const result = await SecretsService.copyToClipboard(repoId, key);

      if (result.success) {
        // Show success feedback
        setCopiedKeys(prev => new Set(prev).add(key));

        // Clear success indicator after 2 seconds
        setTimeout(() => {
          setCopiedKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }, 2000);
      } else {
        setError(result.error || 'Failed to copy to clipboard');
      }
    } catch (err) {
      console.error('Failed to copy secret:', err);
      setError('Failed to copy secret');
    }
  };

  const saveSecrets = async () => {
    setSaving(true);
    setError(null);

    try {
      // Build the complete secrets object
      // Start with existing keys that haven't been modified
      const keysToFetch = secretKeys.filter(
        key => !loadedSecrets[key] && !localChanges.hasOwnProperty(key)
      );

      let allSecrets: RepositorySecrets = {};

      // Fetch unloaded secrets if needed
      if (keysToFetch.length > 0) {
        const unloadedSecrets = await SecretsService.getMultiple(getRepoId(), keysToFetch);
        allSecrets = { ...unloadedSecrets };
      }

      // Add loaded secrets
      Object.entries(loadedSecrets).forEach(([key, secretValue]) => {
        if (secretKeys.includes(key) || localChanges.hasOwnProperty(key)) {
          allSecrets[key] = secretValue.value;
        }
      });

      // Apply local changes (edits and new secrets)
      allSecrets = { ...allSecrets, ...localChanges };

      const result = await SecretsService.store({
        repoId: getRepoId(),
        repoPath: getRepoPath(),
        secrets: allSecrets,
      });

      if (result.success) {
        setMetadata(result.metadata || null);
        setHasChanges(false);
        setLocalChanges({});
        // Reload metadata to get updated keys
        await loadSecretMetadata();
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

    if (secretKeys.includes(newKey) || localChanges[newKey]) {
      setError('Key already exists');
      return;
    }

    // Add to local changes and keys list
    setLocalChanges({ ...localChanges, [newKey]: newValue });
    setSecretKeys([...secretKeys, newKey]);

    // Also add to loaded secrets for immediate display
    setLoadedSecrets(prev => ({
      ...prev,
      [newKey]: {
        value: newValue,
        fetchedAt: Date.now(),
      }
    }));

    setNewKey('');
    setNewValue('');
    setError(null);
    setHasChanges(true);
  };

  const updateSecret = (key: string, value: string) => {
    // Update local changes
    setLocalChanges({ ...localChanges, [key]: value });

    // Update loaded secret if it exists
    if (loadedSecrets[key]) {
      setLoadedSecrets(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          value,
          fetchedAt: Date.now(),
        }
      }));
    }

    setEditingKey(null);
    setEditingValue('');
    setHasChanges(true);
  };

  const deleteSecret = (key: string) => {
    // Remove from keys list
    setSecretKeys(secretKeys.filter(k => k !== key));

    // Mark for deletion in local changes (empty value)
    setLocalChanges({ ...localChanges, [key]: '' });

    // Remove from loaded secrets
    clearSecretFromMemory(key);

    setHasChanges(true);
  };

  if (!isOpen) return null;

  // Add CSS animation for spinner
  const spinnerStyle = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  return (
    <>
      <style>{spinnerStyle}</style>
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
              {secretKeys.length > 0 && (
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
                    {secretKeys.map((key) => {
                      const isLoading = loadingKeys.has(key);
                      const secretValue = loadedSecrets[key]?.value;
                      const isShowing = showValues[key];
                      const isCopied = copiedKeys.has(key);

                      return (
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
                              {isLoading ? (
                                <span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite' }}>
                                  <Loader2 size={14} />
                                </span>
                              ) : isShowing && secretValue ? (
                                secretValue
                              ) : (
                                '••••••••'
                              )}
                            </div>

                            {/* Copy button - direct to clipboard without loading in renderer */}
                            <button
                              onClick={() => copyToClipboard(key)}
                              style={{
                                padding: '4px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: isCopied ? theme.colors.success || '#10b981' : theme.colors.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              title={isCopied ? 'Copied!' : 'Copy to clipboard'}
                            >
                              {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            </button>

                            {/* View/Hide button - loads value into renderer */}
                            <button
                              onClick={() => toggleShowValue(key)}
                              disabled={isLoading}
                              style={{
                                padding: '4px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                color: theme.colors.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                                opacity: isLoading ? 0.5 : 1,
                              }}
                              title={isShowing ? 'Hide value' : 'Show value'}
                            >
                              {isShowing ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>

                            {/* Edit button - needs to fetch first */}
                            <button
                              onClick={async () => {
                                if (!secretValue) {
                                  await fetchSecretValue(key);
                                }
                                const value = loadedSecrets[key]?.value || localChanges[key] || '';
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
                      );
                    })}
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
    </>
  );
};
