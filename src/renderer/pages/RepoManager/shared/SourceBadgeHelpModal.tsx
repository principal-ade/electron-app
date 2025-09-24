import React from 'react';
import { useTheme } from 'themed-markdown';
import {
  FolderOpen,
  GitBranch,
  ArrowUp,
  ArrowDown,
  FastForward,
  Wifi,
} from 'lucide-react';

export const SourceBadgeHelpModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();

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
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Source Badge Indicators
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Source Types Section */}
          <div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '12px',
              }}
            >
              Source Types
            </h3>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <FolderOpen size={18} color={theme.colors.primary} />
                <div>
                  <div
                    style={{
                      fontWeight: 500,
                      color: theme.colors.text,
                      fontSize: '13px',
                    }}
                  >
                    Local Clone
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginTop: '2px',
                    }}
                  >
                    A local copy of the repository on your machine. Shows
                    real-time git status and enables development features.
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <GitBranch size={18} color={theme.colors.primary} />
                <div>
                  <div
                    style={{
                      fontWeight: 500,
                      color: theme.colors.text,
                      fontSize: '13px',
                    }}
                  >
                    Remote Source
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      marginTop: '2px',
                    }}
                  >
                    A branch, tag, or commit from the remote repository.
                    Read-only access via GitHub API.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Git Status Indicators Section */}
          <div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '12px',
              }}
            >
              Git Status Indicators (Local Sources Only)
            </h3>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#f59e0b22',
                    color: '#f59e0b',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  main ●
                </span>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Branch name with orange dot (●) indicates uncommitted changes
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ArrowUp
                    size={14}
                    color={theme.colors.success || '#4caf50'}
                  />
                  <span
                    style={{
                      fontSize: '11px',
                      color: theme.colors.success || '#4caf50',
                    }}
                  >
                    3
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Number of commits ahead of remote (ready to push)
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ArrowDown size={14} color="#ff9800" />
                  <span style={{ fontSize: '11px', color: '#ff9800' }}>2</span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Number of commits behind remote (available to pull)
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <FastForward size={14} color="#ff9800" />
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Fast-forward available - click to merge remote changes
                </div>
              </div>
            </div>
          </div>

          {/* Sync Indicators Section */}
          <div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '12px',
              }}
            >
              Sync Indicators (Local Sources Only)
            </h3>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <Wifi size={14} color={theme.colors.success || '#4caf50'} />
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Connected to sync network (real-time collaboration active)
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Wifi size={14} color={theme.colors.success || '#4caf50'} />
                  <span
                    style={{
                      fontSize: '11px',
                      color: theme.colors.success || '#4caf50',
                    }}
                  >
                    3
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Number of peers in the sync room (including you)
                </div>
              </div>
            </div>
          </div>

          {/* Badge Colors Section */}
          <div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '12px',
              }}
            >
              Badge Border Colors
            </h3>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid ${theme.colors.primary}`,
                    backgroundColor: theme.colors.primary + '22',
                  }}
                />
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Default - No special status
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid #f59e0b`,
                    backgroundColor: '#f59e0b22',
                  }}
                />
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Orange - Has uncommitted changes
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid #ff9800`,
                    backgroundColor: '#ff980022',
                  }}
                />
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Orange/Warning - Behind remote (needs pull)
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '20px',
                    borderRadius: '4px',
                    border: `2px solid ${theme.colors.success || '#4caf50'}`,
                    backgroundColor: `${theme.colors.success || '#4caf50'}22`,
                  }}
                />
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  Green - Sync connected or ahead of remote
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};