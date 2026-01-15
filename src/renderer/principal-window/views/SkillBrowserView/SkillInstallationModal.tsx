import React, { useState, useEffect } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { X, Check, Loader2 } from 'lucide-react';

interface DetectedDirectory {
  id: string;
  path: string;
  displayName: string;
  icon: string;
  skillCount: number;
  skills: string[];
}

interface SkillInstallationModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName: string;
  detectedDirectories: DetectedDirectory[];
  installedDirectories: string[]; // IDs of directories where skill is currently installed
  onInstall: (directoryIds: string[]) => Promise<void>;
  onUninstall: (directoryIds: string[]) => Promise<void>;
}

export const SkillInstallationModal: React.FC<SkillInstallationModalProps> = ({
  isOpen,
  onClose,
  skillName,
  detectedDirectories,
  installedDirectories,
  onInstall,
  onUninstall,
}) => {
  const { theme } = useTheme();
  const [selectedDirectories, setSelectedDirectories] = useState<Set<string>>(new Set(installedDirectories));
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update selected directories when installedDirectories prop changes
  useEffect(() => {
    setSelectedDirectories(new Set(installedDirectories));
  }, [installedDirectories]);

  const toggleDirectory = (directoryId: string) => {
    const newSelected = new Set(selectedDirectories);
    if (newSelected.has(directoryId)) {
      newSelected.delete(directoryId);
    } else {
      newSelected.add(directoryId);
    }
    setSelectedDirectories(newSelected);
  };

  const handleApply = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const currentInstalled = new Set(installedDirectories);
      const newSelected = selectedDirectories;

      // Determine which directories to install to and uninstall from
      const toInstall: string[] = [];
      const toUninstall: string[] = [];

      newSelected.forEach((dirId) => {
        if (!currentInstalled.has(dirId)) {
          toInstall.push(dirId);
        }
      });

      currentInstalled.forEach((dirId) => {
        if (!newSelected.has(dirId)) {
          toUninstall.push(dirId);
        }
      });

      // Perform installations and uninstallations
      if (toUninstall.length > 0) {
        await onUninstall(toUninstall);
      }

      if (toInstall.length > 0) {
        await onInstall(toInstall);
      }

      onClose();
    } catch (err) {
      console.error('[SkillInstallationModal] Failed to apply changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setIsProcessing(false);
    }
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
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          width: '500px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
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
          <h2
            style={{
              margin: 0,
              fontSize: theme.fontSizes[3],
              fontWeight: theme.fontWeights.semibold,
              color: theme.colors.text,
            }}
          >
            Install to Directories
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Skill Name */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              marginBottom: '4px',
            }}
          >
            Skill
          </div>
          <div
            style={{
              fontSize: theme.fontSizes[2],
              fontWeight: theme.fontWeights.medium,
              color: theme.colors.text,
            }}
          >
            {skillName}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: '12px 24px',
              backgroundColor: theme.colors.error + '20',
              borderBottom: `1px solid ${theme.colors.error}`,
              color: theme.colors.error,
              fontSize: theme.fontSizes[1],
            }}
          >
            {error}
          </div>
        )}

        {/* Directory Selection */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {detectedDirectories.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px',
                color: theme.colors.textSecondary,
                fontSize: theme.fontSizes[1],
              }}
            >
              No agent directories detected. Please set up agent directories first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {detectedDirectories.map((directory) => {
                const isSelected = selectedDirectories.has(directory.id);

                return (
                  <button
                    key={directory.id}
                    onClick={() => toggleDirectory(directory.id)}
                    style={{
                      padding: '16px',
                      border: `2px solid ${
                        isSelected ? theme.colors.primary : theme.colors.border
                      }`,
                      borderRadius: '8px',
                      backgroundColor: isSelected
                        ? `${theme.colors.primary}10`
                        : theme.colors.background,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = theme.colors.backgroundSecondary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = theme.colors.background;
                      }
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        border: `2px solid ${
                          isSelected ? theme.colors.primary : theme.colors.border
                        }`,
                        backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={14} color={theme.colors.background} />}
                    </div>

                    {/* Directory info */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: theme.fontSizes[2],
                          fontWeight: theme.fontWeights.medium,
                          color: theme.colors.text,
                          marginBottom: '4px',
                        }}
                      >
                        {directory.displayName}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          fontFamily: theme.fonts.monospace,
                        }}
                      >
                        {directory.path}
                      </div>
                    </div>
                  </button>
                );
              })}
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
            onClick={onClose}
            disabled={isProcessing}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isProcessing || detectedDirectories.length === 0}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
              cursor: isProcessing || detectedDirectories.length === 0 ? 'not-allowed' : 'pointer',
              opacity: isProcessing || detectedDirectories.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isProcessing && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {isProcessing ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};
