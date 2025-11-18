import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Users,
  Loader2,
  AlertCircle,
  Circle,
  Clock,
  Folder,
  GitBranch,
  Monitor,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PresenceService } from '../../main-process-api/PresenceService';
import type {
  UserPresence,
} from '../../../shared/main-process-api-interfaces/PresenceAPI';
import { useGitSyncConnection } from '../../hooks/useGitSyncConnection';
import { GitSyncService } from '../../main-process-api/GitSyncService';
import { SecureAuthService } from '../../services/SecureAuthService';
import { AuthenticationService } from '../../main-process-api/AuthenticationService';

export const PresencePanel: React.FC = () => {
  const { theme } = useTheme();
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useGitSyncConnection();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasGitHubAuth, setHasGitHubAuth] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const baseContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
  };

  // Fetch initial presence data
  const fetchPresence = useCallback(async () => {
    try {
      setError(null);
      const data = await PresenceService.getUsers();
      setUsers(data.users || []);
      setIsLoading(false);
    } catch (err) {
      console.error('[PresencePanel] Failed to fetch presence data:', err);

      // Check if it's a 404 (server not running or endpoint doesn't exist)
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('404')) {
        setError('Presence API not available. Make sure the repository-traffic-controller is running with the presence API enabled.');
      } else {
        setError(errorMessage || 'Failed to connect to presence server.');
      }
      setIsLoading(false);
    }
  }, []);

  // Handle GitHub login
  const handleLogin = useCallback(async () => {
    try {
      setIsLoggingIn(true);
      setError(null);

      const result = await AuthenticationService.login();

      if (result.authenticated) {
        setHasGitHubAuth(true);
        console.info('[PresencePanel] Successfully authenticated with GitHub');
      } else {
        setError(result.error || 'Failed to authenticate with GitHub');
      }
    } catch (err) {
      console.error('[PresencePanel] Failed to login:', err);
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  // Handle visibility toggle
  const handleVisibilityToggle = useCallback(async () => {
    try {
      const newVisibility = !isVisible;
      const result = await PresenceService.setVisibility(newVisibility);
      if (result.success) {
        setIsVisible(newVisibility);
      } else {
        console.error('[PresencePanel] Failed to set visibility:', result.message);
      }
    } catch (err) {
      console.error('[PresencePanel] Failed to set visibility:', err);
    }
  }, [isVisible]);

  // Connect to Git-Sync for presence tracking only
  const handleConnect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Get GitHub token
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        setError('Please authenticate with GitHub first');
        return;
      }

      // Connect to presence
      const result = await PresenceService.connectToPresence(authResult.token);

      if (!result.success) {
        setError(result.error || 'Failed to connect to presence');
      } else {
        console.info('[PresencePanel] Connected to Git-Sync for presence tracking');
        // Refresh presence data
        await fetchPresence();
      }
    } catch (err) {
      console.error('[PresencePanel] Failed to connect:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [fetchPresence]);

  // Disconnect from all Git-Sync connections
  const handleDisconnectAll = useCallback(async () => {
    try {
      setIsDisconnecting(true);

      // Get all active connections from main process
      const connections = await GitSyncService.getAllConnections();

      // Disconnect each connection
      const disconnectPromises = connections.map((conn) =>
        GitSyncService.disconnect(conn.connectionId)
      );

      await Promise.all(disconnectPromises);

      console.info('[PresencePanel] Disconnected all Git-Sync connections');
    } catch (err) {
      console.error('[PresencePanel] Failed to disconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  // Check GitHub authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authService = SecureAuthService.getInstance();
        const authResult = await authService.checkAuth();
        setHasGitHubAuth(authResult.authenticated);
      } catch (error) {
        console.error('[PresencePanel] Failed to check auth:', error);
        setHasGitHubAuth(false);
      }
    };

    void checkAuth();
  }, []);

  // Subscribe to presence events
  useEffect(() => {
    // If not connected, just clear loading state and exit
    if (!isConnected) {
      setIsLoading(false);
      setUsers([]);
      return;
    }

    // Subscribe to global presence
    void PresenceService.subscribeToPresence().then((subscribed) => {
      if (subscribed) {
        console.info('[PresencePanel] Subscribed to presence events');
      } else {
        console.warn('[PresencePanel] Failed to subscribe - connection not ready yet');
      }
    });

    // Fetch initial data
    void fetchPresence();

    // Listen for real-time presence events via IPC
    const unsubscribe = PresenceService.onPresenceEvent((event) => {
      console.info('[PresencePanel] Presence event received:', event.type, event.payload);

      // If we receive user_offline event, check if it's for us
      if (event.type === 'presence:user_offline') {
        const offlineUserId = event.payload.userId;
        // Get current user from auth
        const authService = SecureAuthService.getInstance();
        authService.checkAuth().then((authResult) => {
          if (authResult.authenticated && authResult.user?.githubHandle === offlineUserId) {
            console.warn('[PresencePanel] WE went offline on server side! Server marked us as offline.');
            // Optionally trigger a reconnect here
            if (isConnected) {
              console.warn('[PresencePanel] Local state says connected but server says offline - state mismatch!');
            }
          }
        }).catch(console.error);
      }

      // Refetch presence data when any event occurs
      void fetchPresence();
    });

    return () => {
      unsubscribe();
      void PresenceService.unsubscribeFromPresence();
    };
  }, [fetchPresence, isConnected]);

  const renderState = (
    icon: React.ReactNode,
    title: string,
    description?: string,
  ) => (
    <div style={baseContainerStyle}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '360px',
          }}
        >
          <div>{icon}</div>
          <div>
            <h3
              style={{
                margin: 0,
                marginBottom: '8px',
                color: theme.colors.text,
                fontSize: `${theme.fontSizes[3]}px`,
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textSecondary,
                  lineHeight: theme.lineHeights.body,
                  fontFamily: theme.fonts.body,
                }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online':
        return '#10b981'; // green
      case 'away':
        return '#f59e0b'; // amber
      case 'offline':
        return '#6b7280'; // gray
      default:
        return theme.colors.textSecondary;
    }
  };

  if (isLoading) {
    return renderState(
      <Loader2
        size={32}
        style={{ color: theme.colors.textSecondary }}
        className="animate-spin"
      />,
      'Loading presence data...',
      'Fetching user presence from traffic controller',
    );
  }

  if (error) {
    return renderState(
      <AlertCircle
        size={32}
        style={{ color: theme.colors.error || '#ef4444' }}
      />,
      'Unable to load presence',
      error,
    );
  }

  const contentContainerStyle: React.CSSProperties = {
    ...baseContainerStyle,
    padding: '16px',
    gap: '12px',
  };

  // If not authenticated, show full-screen login prompt
  if (!hasGitHubAuth) {
    return (
      <div style={baseContainerStyle}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: '400px',
            }}
          >
            <Users size={64} color={theme.colors.textSecondary} />
            <div>
              <h3
                style={{
                  margin: 0,
                  marginBottom: '12px',
                  fontSize: `${theme.fontSizes[3]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                }}
              >
                Login to connect with other users
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textSecondary,
                  lineHeight: theme.lineHeights.body,
                }}
              >
                Authenticate with GitHub to see who's online and collaborate with your team in real-time.
              </p>
            </div>
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              style={{
                padding: '12px 24px',
                fontSize: `${theme.fontSizes[2]}px`,
                fontFamily: theme.fonts.body,
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.background,
                backgroundColor: theme.colors.primary,
                border: 'none',
                borderRadius: '8px',
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                opacity: isLoggingIn ? 0.6 : 1,
                transition: 'all 0.2s ease',
                minWidth: '180px',
              }}
              onMouseEnter={(e) => {
                if (!isLoggingIn) {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoggingIn) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {isLoggingIn ? 'Logging in...' : 'Login with GitHub'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={contentContainerStyle}>
      {/* Header with online count and toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          backgroundColor: theme.colors.background,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color={theme.colors.text} />
          <span
            style={{
              fontSize: `${theme.fontSizes[2]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          >
            {isConnected ? `Online (${users.length})` : 'Offline'}
          </span>
        </div>

        {/* Online/Offline Toggle */}
        <button
          onClick={() => {
            if (isConnected) {
              handleDisconnectAll();
            } else {
              handleConnect();
            }
          }}
          disabled={isConnecting || isDisconnecting}
          style={{
            position: 'relative',
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            border: 'none',
            cursor: (isConnecting || isDisconnecting) ? 'not-allowed' : 'pointer',
            backgroundColor: isConnected ? '#10b981' : '#6b7280',
            transition: 'background-color 0.2s ease',
            opacity: (isConnecting || isDisconnecting) ? 0.6 : 1,
          }}
          title={isConnected ? 'Go offline' : 'Go online'}
        >
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: isConnected ? '22px' : '2px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              transition: 'left 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>

      {/* Visibility Control */}
      {isConnected && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px',
            backgroundColor: theme.colors.background,
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Visibility Toggle */}
          <button
            onClick={handleVisibilityToggle}
            disabled={!isConnected}
            style={{
              padding: '8px 16px',
              fontSize: `${theme.fontSizes[1]}px`,
              fontFamily: theme.fonts.body,
              fontWeight: theme.fontWeights.medium,
              color: isVisible ? theme.colors.text : '#ffffff',
              backgroundColor: isVisible ? theme.colors.backgroundSecondary : '#6b7280',
              border: `1px solid ${isVisible ? theme.colors.border : '#6b7280'}`,
              borderRadius: '4px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title={isVisible ? 'Hide from others (invisible mode)' : 'Show to others (visible mode)'}
          >
            {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            <span>{isVisible ? 'Visible' : 'Invisible'}</span>
          </button>
        </div>
      )}

      {/* User list - only show when connected */}
      {isConnected ? (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {users.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Users
                size={32}
                style={{
                  color: theme.colors.textSecondary,
                  marginBottom: '12px',
                }}
              />
              <p style={{ margin: 0 }}>No users online</p>
              <p style={{ margin: '8px 0 0 0', fontSize: `${theme.fontSizes[0]}px` }}>
                Users will appear here when they connect to the traffic controller
              </p>
            </div>
          ) : (
          users.map((user) => (
            <div
              key={user.userId}
              style={{
                padding: '12px',
                backgroundColor: theme.colors.background,
                borderRadius: '6px',
                border: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {/* User header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Circle
                    size={8}
                    fill={getStatusColor(user.status)}
                    color={getStatusColor(user.status)}
                  />
                  <span
                    style={{
                      fontSize: `${theme.fontSizes[1]}px`,
                      fontWeight: theme.fontWeights.semibold,
                      fontFamily: theme.fonts.body,
                      color: theme.colors.text,
                    }}
                  >
                    {user.userId}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.textSecondary,
                  }}
                >
                  <Clock size={12} />
                  {formatRelativeTime(user.lastSeen)}
                </div>
              </div>

              {/* Status message */}
              {user.statusMessage && (
                <div
                  style={{
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.textSecondary,
                    fontStyle: 'italic',
                  }}
                >
                  {user.statusMessage}
                </div>
              )}

              {/* Open repositories */}
              {user.openRepositories && user.openRepositories.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    paddingTop: '4px',
                    borderTop: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {user.openRepositories.map((repo) => (
                    <div
                      key={repo.repoId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: `${theme.fontSizes[0]}px`,
                        fontFamily: theme.fonts.body,
                        color: theme.colors.textSecondary,
                        padding: '4px 8px',
                        backgroundColor:
                          user.activeRepository === repo.repoId
                            ? `${theme.colors.primary}20`
                            : 'transparent',
                        borderRadius: '4px',
                      }}
                    >
                      <Folder size={12} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {repo.repoId?.split('/').pop() || repo.repoId || 'Unknown'}
                      </span>
                      <GitBranch size={10} />
                      <span>{repo.branch || 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Devices */}
              {user.devices && user.devices.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: `${theme.fontSizes[0]}px`,
                    fontFamily: theme.fonts.body,
                    color: theme.colors.textSecondary,
                  }}
                >
                  <Monitor size={12} />
                  <span>
                    {user.devices.length} device{user.devices.length !== 1 ? 's' : ''}
                    {user.devices[0]?.deviceName && ` (${user.devices[0].deviceName})`}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: theme.colors.textSecondary,
            }}
          >
            <Users size={48} style={{ opacity: 0.5 }} />
            <div>
              <p style={{ margin: 0, fontWeight: theme.fontWeights.semibold }}>
                Go online to see other users
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: `${theme.fontSizes[0]}px` }}>
                Enable the connection switch above to view presence
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const PresencePanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: `${theme.fontSizes[0]}px`,
        fontFamily: theme.fonts.body,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: theme.fontWeights.semibold,
        }}
      >
        <Users size={16} color={theme.colors.primary} />
        <span>Live Presence</span>
      </div>
      <div
        style={{
          fontSize: `${theme.fontSizes[0]}px`,
          fontFamily: theme.fonts.body,
          color: theme.colors.textSecondary,
          marginTop: '4px',
        }}
      >
        See who's online and what they're working on in real-time
      </div>
    </div>
  );
};
