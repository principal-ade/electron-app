import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Plus, Trash2, RefreshCw, FolderOpen, CheckCircle2, Circle, GitBranch, AlertTriangle, Info } from 'lucide-react';
import { FileSystemService } from '../../../main-process-api/FileSystemService';

interface GlobalDirectoriesConfigProps {
  onClose: () => void;
  onDirectoriesChanged?: () => void;
}

interface DirectoryStatus {
  targetExists: boolean;
  targetIsGit: boolean;
  cloneExists: boolean;
  cloneIsGit: boolean;
}

interface Directory {
  id: string;
  path: string;
  displayName: string;
  enabled: boolean;
  isCustom: boolean;
  localClonePath: string;
  lastSyncedAt?: string;
  status?: DirectoryStatus;
}

interface DetectedPreset {
  id: string;
  path: string;
  displayName: string;
  description: string;
  icon?: string;
  skillCount: number;
  skills: string[];
}

export const GlobalDirectoriesConfig: React.FC<GlobalDirectoriesConfigProps> = ({
  onClose,
  onDirectoriesChanged,
}) => {
  const { theme } = useTheme();
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [detectedPresets, setDetectedPresets] = useState<DetectedPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncingDirectoryId, setSyncingDirectoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDirectories();
  }, []);

  // Re-run preset detection whenever directories change
  useEffect(() => {
    detectPresets();
  }, [directories]);

  const loadDirectories = async () => {
    try {
      console.log('[GlobalDirectoriesConfig] Loading directories...');
      const dirs = await FileSystemService.getSkillDirectories();
      console.log('[GlobalDirectoriesConfig] Received directories:', dirs);

      // De-duplicate directories by path
      const uniqueDirs = dirs.reduce((acc: Directory[], dir: Directory) => {
        if (!acc.find(d => d.path === dir.path)) {
          acc.push(dir);
        }
        return acc;
      }, []);

      setDirectories(uniqueDirs || []);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('[GlobalDirectoriesConfig] Failed to load directories:', err);
      setError(`Failed to load directories: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const detectPresets = async () => {
    try {
      const detected = await FileSystemService.detectPresetDirectories();
      // Filter out presets that are already configured
      const configuredPaths = directories.map(d => d.path);
      const unconfigured = detected.filter((p: DetectedPreset) => !configuredPaths.includes(p.path));
      setDetectedPresets(unconfigured || []);
    } catch (err) {
      console.error('Failed to detect presets:', err);
    }
  };

  const handleAddPreset = async (preset: DetectedPreset) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await FileSystemService.addSkillDirectory({
        path: preset.path,
        displayName: preset.displayName,
        enabled: true,
        isCustom: false,
      });

      if (result.success) {
        await loadDirectories();
        await detectPresets();
        onDirectoriesChanged?.();
      } else {
        setError(result.error || 'Failed to add directory');
      }
    } catch (err) {
      console.error('Failed to add preset:', err);
      setError('Failed to add directory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      setError(null);
      const result = await FileSystemService.updateSkillDirectory(id, { enabled });

      if (result.success) {
        await loadDirectories();
        onDirectoriesChanged?.();
      } else {
        setError(result.error || 'Failed to update directory');
      }
    } catch (err) {
      console.error('Failed to toggle directory:', err);
      setError('Failed to update directory');
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this directory from sync?')) {
      return;
    }

    try {
      setError(null);
      const result = await FileSystemService.removeSkillDirectory(id);

      if (result.success) {
        await loadDirectories();
        await detectPresets();
        onDirectoriesChanged?.();
      } else {
        setError(result.error || 'Failed to remove directory');
      }
    } catch (err) {
      console.error('Failed to remove directory:', err);
      setError('Failed to remove directory');
    }
  };

  const handleSync = async (id: string) => {
    try {
      setSyncingDirectoryId(id);
      setError(null);

      const result = await FileSystemService.syncSingleDirectory(id);

      if (result.success) {
        await loadDirectories();
      } else {
        setError(result.error || 'Failed to sync directory');
      }
    } catch (err) {
      console.error('Failed to sync directory:', err);
      setError('Failed to sync directory');
    } finally {
      setSyncingDirectoryId(null);
    }
  };

  // Render status indicator badges
  const renderStatusBadge = (status?: DirectoryStatus) => {
    if (!status) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: theme.colors.backgroundSecondary,
          fontSize: '11px',
          color: theme.colors.textSecondary,
        }}>
          <Info size={12} />
          Checking...
        </div>
      );
    }

    const badges = [];

    // Clone status
    if (!status.cloneExists) {
      badges.push(
        <div key="clone-missing" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: '#f59e0b20',
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: 500,
        }}>
          <AlertTriangle size={12} />
          Clone Missing
        </div>
      );
    } else if (!status.cloneIsGit) {
      badges.push(
        <div key="clone-not-git" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: '#ef444420',
          color: '#ef4444',
          fontSize: '11px',
          fontWeight: 500,
        }}>
          <AlertTriangle size={12} />
          Clone Not Git
        </div>
      );
    } else {
      badges.push(
        <div key="clone-ok" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: '#10b98120',
          color: '#10b981',
          fontSize: '11px',
          fontWeight: 500,
        }}>
          <GitBranch size={12} />
          Clone Ready
        </div>
      );
    }

    // Target directory status
    if (!status.targetExists) {
      badges.push(
        <div key="target-missing" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: '#6b728020',
          color: '#6b7280',
          fontSize: '11px',
          fontWeight: 500,
        }}>
          <FolderOpen size={12} />
          Target Missing
        </div>
      );
    } else if (status.targetIsGit) {
      badges.push(
        <div key="target-git" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: '#3b82f620',
          color: '#3b82f6',
          fontSize: '11px',
          fontWeight: 500,
        }}>
          <GitBranch size={12} />
          Target is Git
        </div>
      );
    }

    return <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{badges}</div>;
  };

  return (
    <>
      {/* Modal backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
      />

      {/* Modal content */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        padding: '24px',
        zIndex: 1000,
        minWidth: '700px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            Configure Global Skill Directories
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: theme.colors.text,
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: theme.colors.error + '20',
            border: `1px solid ${theme.colors.error}`,
            borderRadius: '6px',
            marginBottom: '16px',
            color: theme.colors.error,
          }}>
            {error}
          </div>
        )}

        {/* Detected presets section */}
        {detectedPresets.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '12px',
              color: theme.colors.text,
            }}>
              Detected Directories with Skills
            </h3>
            <p style={{
              fontSize: '14px',
              color: theme.colors.textSecondary,
              marginBottom: '16px',
            }}>
              We found skills in these directories. Add them to enable syncing:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '12px',
            }}>
              {detectedPresets.map((preset) => (
                <div
                  key={preset.id}
                  style={{
                    padding: '16px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    backgroundColor: theme.colors.backgroundSecondary,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontSize: '20px' }}>{preset.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: theme.colors.text,
                      }}>
                        {preset.displayName}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                      }}>
                        {preset.skillCount} skill{preset.skillCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    marginBottom: '12px',
                  }}>
                    {preset.description}
                  </div>
                  <button
                    onClick={() => handleAddPreset(preset)}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.background,
                      border: 'none',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      opacity: isLoading ? 0.5 : 1,
                    }}
                  >
                    <Plus size={16} />
                    Add Directory
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configured directories section */}
        <div>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '12px',
            color: theme.colors.text,
          }}>
            Active Directories
          </h3>
          {directories.length === 0 ? (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: '14px',
            }}>
              No directories configured. Add directories above to start syncing skills.
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {directories.map((dir) => (
                <div
                  key={dir.id}
                  style={{
                    padding: '16px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '6px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <button
                    onClick={() => handleToggle(dir.id, !dir.enabled)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: dir.enabled ? theme.colors.success || theme.colors.primary : theme.colors.textSecondary,
                    }}
                  >
                    {dir.enabled ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </button>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 600,
                      fontSize: '14px',
                      color: theme.colors.text,
                      marginBottom: '4px',
                    }}>
                      {dir.displayName}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}>
                      <FolderOpen size={12} />
                      {dir.path}
                    </div>
                    {renderStatusBadge(dir.status)}
                    {dir.lastSyncedAt && (
                      <div style={{
                        fontSize: '11px',
                        color: theme.colors.textSecondary,
                        marginTop: '4px',
                      }}>
                        Last synced: {new Date(dir.lastSyncedAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleSync(dir.id)}
                    disabled={!dir.enabled || syncingDirectoryId === dir.id}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      color: theme.colors.primary,
                      border: `1px solid ${theme.colors.primary}`,
                      cursor: !dir.enabled || syncingDirectoryId === dir.id ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: !dir.enabled || syncingDirectoryId === dir.id ? 0.5 : 1,
                    }}
                  >
                    <RefreshCw size={14} className={syncingDirectoryId === dir.id ? 'spinning' : ''} />
                    {syncingDirectoryId === dir.id ? 'Syncing...' : 'Sync'}
                  </button>

                  <button
                    onClick={() => handleRemove(dir.id)}
                    style={{
                      padding: '6px',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      color: theme.colors.error || '#ef4444',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              cursor: 'pointer',
              border: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
};
