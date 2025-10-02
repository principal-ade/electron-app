import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { AlexandriaEntry } from '@a24z/core-library';
import { useTheme } from '@a24z/industry-theme';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: AlexandriaEntry[];
  onCreate: (name: string, repository: AlexandriaEntry) => Promise<void>;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  repositories,
  onCreate,
}) => {
  const { theme } = useTheme();
  const [roomName, setRoomName] = useState('');
  const [selectedRepoPath, setSelectedRepoPath] = useState(
    repositories.length > 0 ? repositories[0].path : ''
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomName.trim()) {
      setError('Please enter a room name');
      return;
    }

    const selectedRepo = repositories.find(r => r.path === selectedRepoPath);
    if (!selectedRepo) {
      setError('Please select a repository');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreate(roomName.trim(), selectedRepo);
      // Reset and close
      setRoomName('');
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
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
          <h2 style={{
            margin: 0,
            fontSize: theme.fontSizes[3],
            fontWeight: 600,
            color: theme.colors.text,
          }}>
            Create New Room
          </h2>
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: isCreating ? 'not-allowed' : 'pointer',
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
            {/* Room Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                color: theme.colors.text,
              }}>
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter room name"
                autoFocus
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

            {/* Repository Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                color: theme.colors.text,
              }}>
                Select Repository
              </label>
              {repositories.length === 0 ? (
                <div style={{
                  padding: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '4px',
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                }}>
                  No repositories available. Please add a repository first.
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
                  {repositories.map((repo) => (
                    <option key={repo.path} value={repo.path}>
                      {repo.name} - {repo.path}
                    </option>
                  ))}
                </select>
              )}
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
              disabled={isCreating}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.colors.backgroundSecondary,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || repositories.length === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '4px',
                fontSize: theme.fontSizes[1],
                fontWeight: 500,
                cursor: isCreating || repositories.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isCreating || repositories.length === 0 ? 0.5 : 1,
              }}
            >
              {isCreating ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};