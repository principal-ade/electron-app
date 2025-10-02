import React, { useState } from 'react';
import { X, Link2 } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { useTheme } from '@a24z/industry-theme';

interface AddPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableRepositories: AlexandriaEntry[];
  onAddPortal: (repository: AlexandriaEntry, portalName: string, description?: string) => Promise<void>;
}

export const AddPortalModal: React.FC<AddPortalModalProps> = ({
  isOpen,
  onClose,
  availableRepositories,
  onAddPortal,
}) => {
  const { theme } = useTheme();
  const [portalName, setPortalName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRepoPath, setSelectedRepoPath] = useState(
    availableRepositories.length > 0 ? availableRepositories[0].path : ''
  );
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedRepo = availableRepositories.find(r => r.path === selectedRepoPath);
    if (!selectedRepo) {
      setError('Please select a repository');
      return;
    }

    const finalPortalName = portalName.trim() || `Portal to ${selectedRepo.name}`;

    setIsAdding(true);
    setError(null);

    try {
      await onAddPortal(selectedRepo, finalPortalName, description.trim() || undefined);
      // Reset and close
      setPortalName('');
      setDescription('');
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add portal');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: theme.colors.background,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        width: '500px',
        maxWidth: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link2 size={20} style={{ color: theme.colors.primary }} />
            <h2 style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              color: theme.colors.text,
            }}>
              Add Portal Connection
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isAdding}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: isAdding ? 'not-allowed' : 'pointer',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px' }}>
            {/* Repository Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                color: theme.colors.text,
              }}>
                Select Target Repository
              </label>
              {availableRepositories.length === 0 ? (
                <div style={{
                  padding: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '4px',
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                }}>
                  No other repositories available for portal connections.
                </div>
              ) : (
                <select
                  value={selectedRepoPath}
                  onChange={(e) => setSelectedRepoPath(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: theme.fontSizes[1],
                    backgroundColor: theme.colors.backgroundSecondary,
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {availableRepositories.map((repo) => (
                    <option key={repo.path} value={repo.path}>
                      {repo.name} - {repo.path}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Portal Name (Optional) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                color: theme.colors.text,
              }}>
                Portal Name (Optional)
              </label>
              <input
                type="text"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                placeholder={`Portal to ${availableRepositories.find(r => r.path === selectedRepoPath)?.name || 'repository'}`}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: theme.fontSizes[1],
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Description (Optional) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                color: theme.colors.text,
              }}>
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this portal connection..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: theme.fontSizes[1],
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: theme.fonts.body,
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: theme.colors.error + '20',
                color: theme.colors.error,
                borderRadius: '4px',
                fontSize: theme.fontSizes[1],
                marginBottom: '20px',
              }}>
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 20px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isAdding}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                cursor: isAdding ? 'not-allowed' : 'pointer',
                opacity: isAdding ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding || availableRepositories.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                cursor: isAdding || availableRepositories.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isAdding || availableRepositories.length === 0 ? 0.5 : 1,
              }}
            >
              {isAdding ? 'Adding...' : 'Add Portal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};