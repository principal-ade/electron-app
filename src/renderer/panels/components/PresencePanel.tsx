import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Users,
  Loader2,
  AlertCircle,
  Circle,
  Clock,
  Folder,
  GitBranch,
  Monitor,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PresenceService } from '../../main-process-api/PresenceService';
import type {
  UserPresence,
  PresenceStats,
} from '../../../shared/main-process-api-interfaces/PresenceAPI';
import { useGitSyncConnection } from '../../hooks/useGitSyncConnection';
import { GitSyncService } from '../../main-process-api/GitSyncService';

export const PresencePanel: React.FC = () => {
  const { theme } = useTheme();
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [stats, setStats] = useState<PresenceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { isConnected, connectionCount, isAuthenticated } = useGitSyncConnection();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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
      setStats(data.stats || null);
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

  // Subscribe to presence events
  useEffect(() => {
    // Subscribe to global presence (will fail gracefully if no connection)
    void PresenceService.subscribeToPresence().then((subscribed) => {
      setIsSubscribed(subscribed);
      if (subscribed) {
        console.info('[PresencePanel] Subscribed to presence events');
      } else {
        console.warn('[PresencePanel] Failed to subscribe - no active GitSync connection');
      }
    });

    // Fetch initial data
    void fetchPresence();

    // Listen for real-time presence events via IPC
    const unsubscribe = PresenceService.onPresenceEvent((event) => {
      console.info('[PresencePanel] Presence event received:', event.type);
      // Refetch presence data when any event occurs
      void fetchPresence();
    });

    return () => {
      unsubscribe();
      void PresenceService.unsubscribeFromPresence();
    };
  }, [fetchPresence]);

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

  return (
    <div style={contentContainerStyle}>
      {/* Header with stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: theme.colors.background,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} color={theme.colors.textSecondary} />
          <span
            style={{
              fontSize: `${theme.fontSizes[1]}px`,
              fontWeight: theme.fontWeights.semibold,
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
            }}
          >
            {Math.max(0, stats?.totalOnline ?? users.length)} Online
          </span>
        </div>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isSubscribed ? '#10b981' : '#6b7280',
          }}
          title={isSubscribed ? 'Subscribed to presence' : 'Not subscribed'}
        />
      </div>

      {/* Current User Connection Status */}
      {isAuthenticated && (
        <div
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
                fill={isConnected ? '#10b981' : '#6b7280'}
                color={isConnected ? '#10b981' : '#6b7280'}
              />
              <span
                style={{
                  fontSize: `${theme.fontSizes[1]}px`,
                  fontWeight: theme.fontWeights.semibold,
                  fontFamily: theme.fonts.body,
                  color: theme.colors.text,
                }}
              >
                You
              </span>
            </div>
            {isConnected ? (
              <Wifi size={16} color="#10b981" />
            ) : (
              <WifiOff size={16} color="#6b7280" />
            )}
          </div>
          <div
            style={{
              fontSize: `${theme.fontSizes[0]}px`,
              fontFamily: theme.fonts.body,
              color: theme.colors.textSecondary,
            }}
          >
            {isConnected ? (
              connectionCount > 0 ? (
                `Connected to Git-Sync (${connectionCount} ${connectionCount === 1 ? 'room' : 'rooms'})`
              ) : (
                'Connected to Git-Sync (no rooms joined)'
              )
            ) : (
              'Not connected to Git-Sync'
            )}
          </div>
          {!isConnected && (
            <div
              style={{
                marginTop: '4px',
                padding: '8px',
                fontSize: `${theme.fontSizes[0]}px`,
                fontFamily: theme.fonts.body,
                color: theme.colors.textSecondary,
                backgroundColor: theme.colors.backgroundTertiary,
                borderRadius: '4px',
                lineHeight: '1.4',
              }}
            >
              Open a repository to connect to Git-Sync and collaborate with your team in real-time.
            </div>
          )}
          {isConnected && (
            <button
              onClick={handleDisconnectAll}
              disabled={isDisconnecting}
              style={{
                marginTop: '4px',
                padding: '6px 12px',
                fontSize: `${theme.fontSizes[0]}px`,
                fontFamily: theme.fonts.body,
                fontWeight: theme.fontWeights.medium,
                color: theme.colors.error || '#ef4444',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.error || '#ef4444'}`,
                borderRadius: '4px',
                cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                opacity: isDisconnecting ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isDisconnecting) {
                  e.currentTarget.style.backgroundColor = `${theme.colors.error || '#ef4444'}15`;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect All'}
            </button>
          )}
        </div>
      )}

      {/* User list */}
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
              {user.openRepositories.length > 0 && (
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
              {user.devices.length > 0 && (
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
