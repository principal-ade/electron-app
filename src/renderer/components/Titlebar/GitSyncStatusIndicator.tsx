import React, { useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { useGitSyncConnection } from '../../hooks/useGitSyncConnection';

export interface GitSyncStatusIndicatorProps {
  repositoryPath?: string;
  branch?: string;
}

/**
 * Displays the git-sync connection status in the titlebar
 */
export const GitSyncStatusIndicator: React.FC<GitSyncStatusIndicatorProps> = ({
  repositoryPath,
  branch,
}) => {
  const { theme } = useTheme();
  const { isConnected, connectionCount, isAuthenticated } =
    useGitSyncConnection(repositoryPath, branch);
  const [showModal, setShowModal] = useState(false);

  // Don't show indicator if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const Icon = isConnected ? Wifi : WifiOff;
  const color = isConnected ? theme.colors.success : theme.colors.textSecondary;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          width: '32px',
          height: '32px',
          WebkitAppRegion: 'no-drag' as any,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            theme.colors.backgroundTertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title={
          isConnected
            ? `Git-Sync Connected (${connectionCount} ${connectionCount === 1 ? 'room' : 'rooms'})`
            : 'Git-Sync Disconnected'
        }
      >
        <Icon
          size={16}
          color={color}
          style={{
            animation: isConnected ? 'none' : 'pulse 2s ease-in-out infinite',
          }}
        />
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
      </button>

      {/* Modal */}
      {showModal && (
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
            WebkitAppRegion: 'no-drag' as any,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              border: `1px solid ${theme.colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <Icon size={24} color={color} />
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Git-Sync Status
              </h2>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    color: theme.colors.textSecondary,
                    marginBottom: '4px',
                  }}
                >
                  Status
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: color,
                  }}
                >
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>
              </div>

              {isConnected && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Active Rooms
                  </div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      color: theme.colors.text,
                    }}
                  >
                    {connectionCount}{' '}
                    {connectionCount === 1 ? 'room' : 'rooms'}
                  </div>
                </div>
              )}

              {repositoryPath && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Repository
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: theme.colors.text,
                      wordBreak: 'break-all',
                    }}
                  >
                    {repositoryPath}
                  </div>
                </div>
              )}

              {branch && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                      marginBottom: '4px',
                    }}
                  >
                    Branch
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      color: theme.colors.text,
                    }}
                  >
                    {branch}
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '6px',
                marginBottom: '20px',
              }}
            >
              <h3
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                What is Git-Sync?
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: theme.colors.textSecondary,
                }}
              >
                Git-Sync enables real-time collaboration by syncing your
                repository changes with other developers. When connected, you
                can see live updates from your team members working on the same
                repository and branch.
              </p>
            </div>

            <button
              onClick={() => setShowModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: theme.colors.primary,
                color: theme.colors.background,
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
