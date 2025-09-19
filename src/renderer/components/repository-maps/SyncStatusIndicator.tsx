import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Users,
  Circle,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  LogOut,
  Wifi,
  WifiOff,
  UserPlus,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { GitSyncClient } from '../../services/git-sync/GitSyncClient';
import { gitSyncConnectionManager } from '../../services/git-sync/GitSyncConnectionManager';
import { AuthenticationService } from '../../main-process-api/AuthenticationService';
import { GIT_SYNC_CONFIG } from '../../config/git-sync';

interface SyncStatusIndicatorProps {
  repoPath: string;
  clonePath: string;
  branchName: string;
  repository: any;
  isAuthenticated: boolean;
  currentUser?: string;
  compact?: boolean;
}

interface PeerInfo {
  agentId: string;
  userId: string;
  branch: string;
}

// Add CSS animation styles
const pulseAnimation = `
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    }
    70% {
      box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    }
  }
`;

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  repoPath,
  clonePath,
  branchName,
  repository,
  isAuthenticated: isAuthenticatedProp,
  currentUser: currentUserProp,
  compact = false,
}) => {
  const { theme } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(isAuthenticatedProp);
  const [currentUser, setCurrentUser] = useState(currentUserProp);
  const [authChecking, setAuthChecking] = useState(!isAuthenticatedProp); // Only check if not authenticated
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([]);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const gitSyncClientRef = useRef<GitSyncClient | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Sync with prop changes
  useEffect(() => {
    console.log(
      '[SyncStatusIndicator] Props changed - isAuthenticated:',
      isAuthenticatedProp,
      'currentUser:',
      currentUserProp,
    );
    setIsAuthenticated(isAuthenticatedProp);
    setCurrentUser(currentUserProp);
    setAuthChecking(false);

    // Reset connection state when auth changes
    if (!isAuthenticatedProp) {
      setIsConnected(false);
      setConnectedPeers([]);
      setConnectionAttempted(false);
      if (gitSyncClientRef.current) {
        gitSyncClientRef.current.disconnect();
        gitSyncClientRef.current = null;
      }
    }
  }, [isAuthenticatedProp, currentUserProp]);

  // Auto-connect when authenticated
  useEffect(() => {
    const autoConnect = async () => {
      if (isAuthenticated && !authChecking && !connectionAttempted) {
        setConnectionAttempted(true);
        setIsCheckingConnection(true);

        try {
          console.log(
            '[SyncStatusIndicator] Auto-connecting to git-sync room...',
          );

          // Get or create connection through the manager
          const client = await gitSyncConnectionManager.getConnection(
            clonePath,
            branchName,
            repository,
          );

          if (client) {
            console.log('[SyncStatusIndicator] Successfully connected to room');
            gitSyncClientRef.current = client;

            // Update status immediately
            const status = client.getStatus();
            setIsConnected(status.connected && status.authenticated);
            setConnectedPeers(status.peers || []);
          } else {
            console.log('[SyncStatusIndicator] Failed to auto-connect');
          }
        } catch (error) {
          console.error('[SyncStatusIndicator] Auto-connect error:', error);
        } finally {
          setIsCheckingConnection(false);
        }
      }
    };

    autoConnect();
  }, [isAuthenticated, authChecking, clonePath, branchName, repository]);

  // Check connection status from the connection manager
  useEffect(() => {
    if (!isAuthenticated || authChecking) {
      setIsConnected(false);
      setConnectedPeers([]);
      return;
    }

    // Function to update connection state from manager
    const updateConnectionState = () => {
      const connections = gitSyncConnectionManager.getActiveConnections();

      // Generate repo ID using the same logic as GitSyncConnectionManager
      const repoId =
        repository && repository.owner && repository.name
          ? `${repository.owner}/${repository.name}`
          : `${currentUser}/${clonePath.split('/').pop() || 'unknown-repo'}`;
      const connectionKey = `${repoId}:${branchName}`;

      const connection = connections.get(connectionKey);

      if (connection && connection.status) {
        const isConnectedNow =
          connection.status.connected && connection.status.authenticated;
        setIsConnected(isConnectedNow);
        setConnectedPeers(connection.status.peers || []);
        console.log(
          `[SyncStatusIndicator] Connection status for ${connectionKey}: connected=${isConnectedNow}, peers=${connection.status.peers?.length || 0}`,
        );
      } else {
        setIsConnected(false);
        setConnectedPeers([]);
      }
    };

    // Initial check
    updateConnectionState();

    // Listen for connection status changes
    const handleConnectionChange = (connectionKey: string, status: any) => {
      // Generate repo ID using the same logic as GitSyncConnectionManager
      const repoId =
        repository && repository.owner && repository.name
          ? `${repository.owner}/${repository.name}`
          : `${currentUser}/${clonePath.split('/').pop() || 'unknown-repo'}`;
      const expectedKey = `${repoId}:${branchName}`;

      console.log(
        `[SyncStatusIndicator] Connection change event - connectionKey: ${connectionKey}, expectedKey: ${expectedKey}`,
      );

      if (connectionKey === expectedKey) {
        const isConnectedNow = status.connected && status.authenticated;
        setIsConnected(isConnectedNow);
        setConnectedPeers(status.peers || []);
        console.log(
          `[SyncStatusIndicator] Status updated for ${connectionKey}: connected=${isConnectedNow}, peers=${status.peers?.length || 0}`,
        );
      }
    };

    gitSyncConnectionManager.on(
      'connection-status-changed',
      handleConnectionChange,
    );

    // Check every 5 seconds as a fallback
    const interval = setInterval(updateConnectionState, 5000);

    return () => {
      gitSyncConnectionManager.off(
        'connection-status-changed',
        handleConnectionChange,
      );
      clearInterval(interval);
    };
  }, [
    isAuthenticated,
    authChecking,
    clonePath,
    branchName,
    currentUser,
    repository,
  ]);

  // Removed showAuthModal - no longer using manual token flow

  const handleButtonClick = () => {
    if (!isAuthenticated) {
      // If not authenticated, start the auth flow directly
      handleAuthenticate();
    } else if (compact) {
      // If in compact mode, always toggle expanded view (for both joining and leaving)
      setIsExpanded(!isExpanded);
    } else {
      // If authenticated but not in compact mode, open the collaboration panel
      window.dispatchEvent(new CustomEvent('open-turn-based-sync'));
    }
  };

  const handleLeaveRoom = async () => {
    setIsLeavingRoom(true);
    try {
      // Disconnect from the room
      if (gitSyncClientRef.current) {
        await gitSyncClientRef.current.disconnect();
        gitSyncClientRef.current = null;
      }

      // Clear connection from manager
      gitSyncConnectionManager.disconnectConnection(
        repository && repository.owner && repository.name
          ? `${repository.owner}/${repository.name}`
          : `${currentUser}/${clonePath.split('/').pop() || 'unknown-repo'}`,
        branchName,
      );

      setIsConnected(false);
      setConnectedPeers([]);
      setConnectionAttempted(false);
      setIsExpanded(false);

      console.log('[SyncStatusIndicator] Left room successfully');
    } catch (error) {
      console.error('[SyncStatusIndicator] Error leaving room:', error);
    } finally {
      setIsLeavingRoom(false);
    }
  };

  const handleJoinRoom = async () => {
    setIsJoiningRoom(true);
    try {
      console.log('[SyncStatusIndicator] Joining git-sync room...');

      // Get or create connection through the manager
      const client = await gitSyncConnectionManager.getConnection(
        clonePath,
        branchName,
        repository,
      );

      if (client) {
        console.log('[SyncStatusIndicator] Successfully connected to room');
        gitSyncClientRef.current = client;

        // Update status immediately
        const status = client.getStatus();
        setIsConnected(status.connected && status.authenticated);
        setConnectedPeers(status.peers || []);
        setConnectionAttempted(true);

        // Close panel after successful join
        setTimeout(() => {
          setIsExpanded(false);
        }, 500);
      } else {
        console.log('[SyncStatusIndicator] Failed to connect to room');
        alert('Failed to join room. Please try again.');
      }
    } catch (error) {
      console.error('[SyncStatusIndicator] Join room error:', error);
      alert('Failed to join room. Please check your connection and try again.');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleAuthenticate = async () => {
    try {
      // Use CLI-style authentication (opens browser and polls for completion)
      console.log('Starting CLI-style authentication (user initiated)...');

      // Pass forceNew: true to cancel any in-progress auth and start fresh
      const result = await AuthenticationService.login({ forceNew: true });

      if (result.success && result.token) {
        // Authentication successful
        console.log('CLI authentication successful:', result.user?.login);

        // Store the token and user info directly
        // The CLI auth already verified the token with GitHub
        const authData = {
          token: result.token,
          user: {
            githubHandle: result.user.login,
            email: result.user.email,
            name: result.user.name,
            id: result.user.id,
          },
          timestamp: Date.now(),
        };

        // Save to localStorage for persistence
        localStorage.setItem('orbit_auth', JSON.stringify(authData));

        // Auth is complete from CLI
        setIsAuthenticated(true);
        setCurrentUser(result.user.login);
        // No need to show modal - auth is complete!
      } else {
        console.error('CLI authentication failed:', result.error);

        // Show error message to user instead of fallback
        if (result.error && !result.error.includes('canceled')) {
          alert(`Authentication failed: ${result.error}\n\nPlease try again.`);
        }
      }
    } catch (error) {
      console.error('Failed to start authentication:', error);
      alert('Failed to start authentication. Please try again.');
    }
  };

  // Determine overall status for the button
  const getButtonStatus = () => {
    if (authChecking) return 'checking';
    if (!isAuthenticated) return 'need-auth';
    if (isCheckingConnection) return 'checking-room';
    if (isConnected) return 'in-room';
    return 'ready-to-join';
  };

  const buttonStatus = getButtonStatus();
  const totalPeople = connectedPeers.length + (isConnected ? 1 : 0);

  // Debug logging
  console.log(
    `[SyncStatusIndicator] Render - authChecking: ${authChecking}, isAuthenticated: ${isAuthenticated}, isCheckingConnection: ${isCheckingConnection}, isConnected: ${isConnected}, buttonStatus: ${buttonStatus}, peers: ${connectedPeers.length}`,
  );

  // Button colors based on status
  const getButtonColors = () => {
    switch (buttonStatus) {
      case 'checking':
      case 'checking-room':
        return {
          border: theme.colors.border,
          background: theme.colors.backgroundTertiary,
          text: theme.colors.textSecondary,
        };
      case 'need-auth':
        return {
          border: theme.colors.primary,
          background: `${theme.colors.primary}15`,
          text: theme.colors.primary,
        };
      case 'in-room':
        return {
          border: theme.colors.success,
          background: `${theme.colors.success}15`,
          text: theme.colors.success,
        };
      case 'ready-to-join':
        return {
          border: theme.colors.primary,
          background: `${theme.colors.primary}15`,
          text: theme.colors.primary,
        };
      default:
        return {
          border: theme.colors.border,
          background: theme.colors.backgroundTertiary,
          text: theme.colors.textSecondary,
        };
    }
  };

  const colors = getButtonColors();

  // Inject animation styles
  React.useEffect(() => {
    const styleId = 'sync-status-animation-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = pulseAnimation;
      document.head.appendChild(style);
    }
  }, []);

  // Close expanded view on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isExpanded &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Render compact version for header
  if (compact) {
    return (
      <>
        <div style={{ position: 'relative' }}>
          <button
            onClick={handleButtonClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '13px',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.border}25`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.background;
            }}
            title={
              buttonStatus === 'in-room'
                ? `${totalPeople} ${totalPeople === 1 ? 'person' : 'people'} in room - click to configure`
                : buttonStatus === 'need-auth'
                  ? 'Sign in to GitHub to join project room'
                  : 'Click to join project room'
            }
          >
            {/* Icon */}
            {buttonStatus === 'checking' || buttonStatus === 'checking-room' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : buttonStatus === 'in-room' ? (
              <Users size={12} />
            ) : (
              <Users size={12} />
            )}

            {/* Text */}
            <span style={{ color: colors.text }}>
              {buttonStatus === 'checking'
                ? 'Checking...'
                : buttonStatus === 'checking-room'
                  ? 'Connecting...'
                  : buttonStatus === 'in-room'
                    ? `🟢 In Room (${totalPeople})`
                    : buttonStatus === 'need-auth'
                      ? 'Sign In Required'
                      : 'Join Project Room'}
            </span>

            {/* Animated pulse for connected state */}
            {buttonStatus === 'in-room' && (
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.success,
                  animation: 'pulse 2s infinite',
                }}
              />
            )}

            {/* Static dot for other states */}
            {buttonStatus !== 'in-room' && (
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor:
                    buttonStatus === 'need-auth'
                      ? theme.colors.warning || theme.colors.primary
                      : buttonStatus === 'checking' ||
                          buttonStatus === 'checking-room'
                        ? theme.colors.info || theme.colors.primary
                        : theme.colors.textTertiary,
                }}
              />
            )}
          </button>

          {/* Expanded panel */}
          {isExpanded && (
            <div
              ref={panelRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '400px',
                maxHeight: 'calc(100vh - 100px)',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: 600,
                      color: theme.colors.text,
                    }}
                  >
                    {isConnected
                      ? '🟢 Connected to Room'
                      : '🔌 Join Collaboration Room'}
                  </h3>
                  <button
                    onClick={() => setIsExpanded(false)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: theme.colors.textSecondary,
                      fontSize: '20px',
                      lineHeight: 1,
                    }}
                    title="Close"
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                  }}
                >
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Repository:</strong> {repository?.owner}/
                    {repository?.name}
                  </div>
                  <div>
                    <strong>Branch:</strong> {branchName}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  padding: '20px',
                  overflowY: 'auto',
                }}
              >
                {/* Connection status or Join prompt */}
                {isConnected ? (
                  <div
                    style={{
                      marginBottom: '24px',
                      padding: '12px',
                      backgroundColor: `${theme.colors.success}10`,
                      border: `1px solid ${theme.colors.success}30`,
                      borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <Wifi size={16} color={theme.colors.success} />
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: theme.colors.text,
                        }}
                      >
                        Real-time Sync Active
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      Changes are being synchronized in real-time with other
                      collaborators
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      marginBottom: '24px',
                      padding: '16px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      <WifiOff size={16} color={theme.colors.textSecondary} />
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          color: theme.colors.text,
                        }}
                      >
                        Not Connected to Room
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        marginBottom: '16px',
                      }}
                    >
                      Join the collaboration room to:
                      <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                        <li>See who else is working on this repository</li>
                        <li>Sync changes in real-time</li>
                        <li>Avoid merge conflicts</li>
                        <li>Collaborate seamlessly</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Participants */}
                <div style={{ marginBottom: '24px' }}>
                  <h4
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Users size={16} />
                    Room Participants{' '}
                    {isConnected && `(${connectedPeers.length + 1})`}
                  </h4>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {isConnected ? (
                      <>
                        {/* Current user */}
                        <div
                          style={{
                            padding: '8px 12px',
                            backgroundColor: theme.colors.backgroundSecondary,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: theme.colors.success,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '13px',
                              color: theme.colors.text,
                            }}
                          >
                            {currentUser} (You)
                          </span>
                        </div>

                        {/* Other peers */}
                        {connectedPeers.map((peer) => (
                          <div
                            key={peer.agentId}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: theme.colors.backgroundSecondary,
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: theme.colors.primary,
                              }}
                            />
                            <span
                              style={{
                                fontSize: '13px',
                                color: theme.colors.text,
                              }}
                            >
                              {peer.userId}
                            </span>
                            {peer.branch !== branchName && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: theme.colors.textSecondary,
                                  marginLeft: '4px',
                                }}
                              >
                                ({peer.branch})
                              </span>
                            )}
                          </div>
                        ))}

                        {connectedPeers.length === 0 && (
                          <div
                            style={{
                              padding: '12px',
                              textAlign: 'center',
                              fontSize: '13px',
                              color: theme.colors.textSecondary,
                              fontStyle: 'italic',
                            }}
                          >
                            No other collaborators in the room
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          fontSize: '13px',
                          color: theme.colors.textSecondary,
                          fontStyle: 'italic',
                        }}
                      >
                        Join the room to see who's collaborating
                      </div>
                    )}
                  </div>
                </div>

                {/* Invite section */}
                <div
                  style={{
                    marginBottom: '24px',
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <UserPlus size={16} color={theme.colors.primary} />
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: theme.colors.text,
                      }}
                    >
                      Invite Collaborators
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Other developers with access to this repository will
                    automatically join when they open it
                  </div>
                </div>
              </div>

              {/* Footer with action button */}
              <div
                style={{
                  padding: '16px 20px',
                  borderTop: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                {isConnected ? (
                  <button
                    onClick={handleLeaveRoom}
                    disabled={isLeavingRoom}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: theme.colors.error || '#ef4444',
                      color: theme.colors.background,
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: isLeavingRoom ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: isLeavingRoom ? 0.7 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLeavingRoom) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isLeavingRoom) e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {isLeavingRoom ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Leaving Room...</span>
                      </>
                    ) : (
                      <>
                        <LogOut size={16} />
                        <span>Leave Room</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleJoinRoom}
                    disabled={isJoiningRoom}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: theme.colors.success || '#10b981',
                      color: theme.colors.background,
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: isJoiningRoom ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: isJoiningRoom ? 0.7 : 1,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isJoiningRoom) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isJoiningRoom) e.currentTarget.style.opacity = '1';
                    }}
                  >
                    {isJoiningRoom ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Joining Room...</span>
                      </>
                    ) : (
                      <>
                        <Wifi size={16} />
                        <span>Join Collaboration Room</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* OAuth modal removed - using CLI auth flow */}
      </>
    );
  }

  // Original full-size version
  return (
    <>
      <button
        onClick={handleButtonClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontSize: '13px',
          fontWeight: 500,
          minWidth: '180px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `${colors.border}25`;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.background;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
        title={
          buttonStatus === 'in-room'
            ? 'Already in room - click to configure sync settings'
            : buttonStatus === 'need-auth'
              ? 'Sign in to GitHub to collaborate'
              : 'Click to open collaboration panel'
        }
      >
        {/* Status Icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '6px',
            backgroundColor: colors.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.colors.background,
          }}
        >
          {buttonStatus === 'checking' || buttonStatus === 'checking-room' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : buttonStatus === 'need-auth' ? (
            <Shield size={16} />
          ) : buttonStatus === 'in-room' ? (
            <Users size={16} />
          ) : (
            <Shield size={16} />
          )}
        </div>

        {/* Status Text */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div
            style={{
              color: colors.text,
              fontWeight: 600,
              marginBottom: '2px',
              fontSize: '14px',
            }}
          >
            {buttonStatus === 'checking'
              ? 'Checking...'
              : buttonStatus === 'need-auth'
                ? 'Sign In Required'
                : buttonStatus === 'checking-room'
                  ? 'Connecting to Room...'
                  : buttonStatus === 'in-room'
                    ? `✅ Connected to Room`
                    : 'Ready to Join Room'}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: theme.colors.textSecondary,
            }}
          >
            {buttonStatus === 'checking'
              ? 'Checking authentication'
              : buttonStatus === 'need-auth'
                ? 'GitHub auth needed to join rooms'
                : buttonStatus === 'checking-room'
                  ? 'Checking room status'
                  : buttonStatus === 'in-room'
                    ? `${totalPeople === 1 ? 'You alone' : `${totalPeople} people`} in sync room`
                    : 'Click to join sync room'}
          </div>
        </div>

        {/* Quick Visual Indicator */}
        {buttonStatus === 'in-room' ? (
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success,
              animation: 'pulse 2s infinite',
            }}
          />
        ) : (
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor:
                buttonStatus === 'need-auth'
                  ? theme.colors.primary
                  : buttonStatus === 'ready-to-join'
                    ? theme.colors.primary
                    : buttonStatus === 'checking-room'
                      ? theme.colors.info || theme.colors.primary
                      : theme.colors.textTertiary,
            }}
          />
        )}
      </button>

      {/* OAuth modal removed - using CLI auth flow */}
    </>
  );
};
