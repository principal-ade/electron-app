import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Activity,
  CheckCircle,
  XCircle,
  Users,
  Wifi,
  Server,
  PlayCircle,
} from 'lucide-react';
import { GitSyncService } from '../../main-process-api/GitSyncService';
import { AuthenticationService } from '../../main-process-api/AuthenticationService';
import { gitSyncConnectionManager } from '../../services/git-sync/GitSyncConnectionManager';
import { useAllRepositories } from '../../hooks/useRepositoryData';
import { SERVER_URLS, AUTH_SERVER_URLS } from '../../config/git-sync';

interface EventLogEntry {
  time: string;
  message: string;
  icon: string;
}

interface ConnectionStatus {
  connected: boolean;
  serverUrl: string;
}

interface AuthStatus {
  valid: boolean;
  user?: string;
  tokenPrefix?: string;
}

interface RoomInfo {
  repoId: string;
  peerCount: number;
}

interface ServiceStatus {
  name: string;
  available: boolean;
  checking: boolean;
  url?: string;
}

export const GitSyncDiagnosticPanel: React.FC = () => {
  const { theme } = useTheme();
  const { repositories } = useAllRepositories();
  const [environment, setEnvironment] = useState<'development' | 'production'>(
    'production',
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    serverUrl: '',
  });
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ valid: false });
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [testing, setTesting] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [checkingServices, setCheckingServices] = useState(false);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>('');
  const [testingRepoConnection, setTestingRepoConnection] = useState(false);
  const eventLogRef = useRef<HTMLDivElement>(null);

  // Add event to log
  const addEvent = useCallback((message: string, icon: string = '📝') => {
    setEvents((prev) => {
      const newEvents = [
        ...prev,
        {
          time: new Date().toLocaleTimeString(),
          message,
          icon,
        },
      ];
      // Keep only last 20 events
      return newEvents.slice(-20);
    });
  }, []);

  // Update services list when environment changes
  useEffect(() => {
    const getServicesForEnvironment = (): ServiceStatus[] => {
      if (environment === 'development') {
        return [
          {
            name: 'Auth Server (Dev)',
            available: false,
            checking: false,
            url: AUTH_SERVER_URLS.development,
          },
          {
            name: 'Traffic Controller (Dev)',
            available: false,
            checking: false,
            url: SERVER_URLS.development,
          },
          {
            name: 'GitHub API',
            available: false,
            checking: false,
            url: 'https://api.github.com',
          },
        ];
      } else {
        return [
          {
            name: 'Auth Server (Prod)',
            available: false,
            checking: false,
            url: AUTH_SERVER_URLS.production,
          },
          {
            name: 'Traffic Controller (Prod)',
            available: false,
            checking: false,
            url: SERVER_URLS.production,
          },
          {
            name: 'GitHub API',
            available: false,
            checking: false,
            url: 'https://api.github.com',
          },
        ];
      }
    };

    setServices(getServicesForEnvironment());
  }, [environment]);

  // Refresh connection status when environment changes
  useEffect(() => {
    const refreshConnectionStatus = async () => {
      try {
        const url = SERVER_URLS[environment];
        const connections =
          await gitSyncConnectionManager.getActiveConnections();
        const hasActiveConnection = Array.from(connections.values()).some(
          (conn) => conn.status.connected,
        );

        setConnectionStatus({
          connected: hasActiveConnection,
          serverUrl: url || 'Not configured',
        });

        addEvent(
          `Environment changed to ${environment}`,
          environment === 'production' ? '🚀' : '🔧',
        );
      } catch (error) {
        console.error('Failed to refresh connection:', error);
      }
    };

    refreshConnectionStatus();
  }, [environment, addEvent]);

  // Auto-scroll event log
  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [events]);

  // Get current server URL based on environment
  const getCurrentServerUrl = useCallback(() => {
    return SERVER_URLS[environment];
  }, [environment]);

  // Check connection status
  const checkConnection = useCallback(async () => {
    try {
      const url = getCurrentServerUrl();
      // Check if we have any active connections
      const connections = await gitSyncConnectionManager.getActiveConnections();
      const hasActiveConnection = Array.from(connections.values()).some(
        (conn) => conn.status.connected,
      );

      setConnectionStatus({
        connected: hasActiveConnection,
        serverUrl: url || 'Not configured',
      });

      if (hasActiveConnection) {
        addEvent(`Connection check: Connected to ${environment}`, '✅');
      } else {
        addEvent(`Connection check: Not connected (${environment})`, '🔴');
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
      setConnectionStatus({ connected: false, serverUrl: 'Error' });
      addEvent('Connection check failed', '❌');
    }
  }, [addEvent, environment, getCurrentServerUrl]);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      const result = await AuthenticationService.check();
      if (result.success && result.token && result.user) {
        setAuthStatus({
          valid: true,
          user: result.user.login,
          tokenPrefix: result.token.substring(0, 7),
        });
        addEvent(`Authenticated as ${result.user.login}`, '✅');
      } else {
        setAuthStatus({ valid: false });
        addEvent('Not authenticated', '❌');
      }
    } catch (error) {
      console.error('Failed to check auth:', error);
      setAuthStatus({ valid: false });
      addEvent('Auth check failed', '❌');
    }
  }, [addEvent]);

  // Load active rooms
  const loadRooms = useCallback(async () => {
    try {
      const connections = await gitSyncConnectionManager.getActiveConnections();

      const roomList = Array.from(connections.values()).map((conn) => ({
        repoId: conn.repoId,
        peerCount: conn.status.peers.length,
      }));

      setRooms(roomList);

      if (roomList.length > 0) {
        addEvent(`Active rooms: ${roomList.length}`, '🏠');
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
      addEvent('Failed to load rooms', '❌');
    }
  }, [addEvent]);

  // Check service availability via main process IPC
  const checkServiceAvailability = async (
    service: ServiceStatus,
  ): Promise<boolean> => {
    try {
      if (!service.url) return false;

      // Use IPC to check service from main process
      const result = await GitSyncService.checkService(
        service.url,
        service.name,
      );

      if (result.available) {
        if (result.status) {
          addEvent(`${service.name}: HTTP ${result.status}`, '🔍');
        }
        return true;
      } else {
        if (result.status === 404) {
          addEvent(`❌ ${service.name}: Endpoint not found (404)`, '❌');
        } else if (result.error) {
          addEvent(`${service.name} error: ${result.error}`, '❌');
        }
        return false;
      }
    } catch (error) {
      console.error(`Failed to check service ${service.name}:`, error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      addEvent(`${service.name} check failed: ${errorMsg}`, '❌');
      return false;
    }
  };

  // Check all services
  const checkServices = useCallback(async () => {
    setCheckingServices(true);
    addEvent('Checking services...', '🔍');

    const updatedServices = await Promise.all(
      services.map(async (service) => {
        const available = await checkServiceAvailability(service);
        if (available) {
          addEvent(`${service.name}: Available`, '🟢');
        } else {
          addEvent(`${service.name}: Unavailable`, '🔴');
        }
        return { ...service, available, checking: false };
      }),
    );

    setServices(updatedServices);
    setCheckingServices(false);
  }, [services, addEvent]);

  // Test repository connection
  const testRepositoryConnection = async () => {
    if (!selectedRepoPath) {
      addEvent('Please select a repository first', '⚠️');
      return;
    }

    setTestingRepoConnection(true);
    const repoData = repositories.find(
      (r) => r.repository.path === selectedRepoPath,
    );

    if (!repoData) {
      addEvent('Repository not found', '❌');
      setTestingRepoConnection(false);
      return;
    }

    const repo = repoData.repository;

    try {
      addEvent(`Testing connection for ${repo.name || repo.path}...`, '🔌');

      // Get the repository info
      const owner = repo.github?.owner || 'unknown';
      const name = repo.github?.name || repo.name || 'unknown';
      const branch = repo.github?.defaultBranch || repoData.gitBranch || 'main';

      addEvent(`Repository: ${owner}/${name}, Branch: ${branch}`, 'ℹ️');

      // Attempt to get/create a connection
      const client = await gitSyncConnectionManager.getConnection(
        repo.path,
        branch,
        {
          owner,
          name,
        },
      );

      if (client) {
        addEvent(`✅ Successfully connected to traffic controller`, '✅');
        addEvent(`Room: ${owner}/${name}:${branch}`, '🏠');

        // Refresh connection status and rooms
        await checkConnection();
        loadRooms();
      } else {
        addEvent('Failed to establish connection', '❌');
      }
    } catch (error) {
      console.error('Failed to test repository connection:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      addEvent(`Connection failed: ${errorMessage}`, '❌');
    } finally {
      setTestingRepoConnection(false);
    }
  };

  // Test WebSocket connection directly
  const testWebSocketConnection = async () => {
    const url = SERVER_URLS[environment];
    addEvent(`Testing WebSocket connection to ${url}...`, '🔌');

    try {
      // Convert to WebSocket URL if needed
      let wsUrl = url;
      if (url.startsWith('https://')) {
        wsUrl = url.replace('https://', 'wss://');
      } else if (url.startsWith('http://')) {
        wsUrl = url.replace('http://', 'ws://');
      }

      // Add /ws path if not already present
      if (!wsUrl.endsWith('/ws')) {
        wsUrl = `${wsUrl}/ws`;
      }

      addEvent(`Attempting connection to ${wsUrl}...`, '📡');

      const ws = new WebSocket(wsUrl);

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          addEvent('Connection timeout after 10 seconds', '⏱️');
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          addEvent('✅ WebSocket connection established!', '✅');
          ws.close();
          resolve();
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          addEvent(`❌ WebSocket connection failed: ${error}`, '❌');
          reject(error);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
        };
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      addEvent(`Connection test failed: ${errorMessage}`, '❌');
    }
  };

  // Test connection
  const testConnection = async () => {
    setTesting(true);
    addEvent('Testing connection...', '🔌');

    // Test direct WebSocket connection
    await testWebSocketConnection();

    // Check existing connections and auth
    await checkConnection();
    await checkAuth();
    loadRooms();
    setTesting(false);
  };

  // Clear event log
  const clearLog = () => {
    setEvents([]);
    addEvent('Log cleared', '🗑️');
  };

  // Initialize on mount (run once)
  useEffect(() => {
    const init = async () => {
      addEvent('Diagnostic panel opened', '📊');
      // Sync environment state with main process
      const currentEnv = await GitSyncService.getEnvironment();
      setEnvironment(currentEnv);
      await checkServices();
      await checkConnection();
      await checkAuth();
      loadRooms();
    };

    init();

    // Set up event listeners for connection manager
    const handleConnectionAdded = (repoId: string) => {
      addEvent(`Connection added: ${repoId}`, '➕');
      loadRooms();
      checkConnection();
    };

    const handleConnectionRemoved = (repoId: string) => {
      addEvent(`Connection removed: ${repoId}`, '➖');
      loadRooms();
      checkConnection();
    };

    const handleConnectionStatusChanged = (repoId: string) => {
      addEvent(`Status changed: ${repoId}`, '🔄');
      loadRooms();
      checkConnection();
    };

    const handleAuthChanged = (
      authenticated: boolean,
      user?: { githubHandle: string },
    ) => {
      if (authenticated && user) {
        addEvent(`Auth changed: ${user.githubHandle}`, '🔐');
      } else {
        addEvent('Auth changed: Logged out', '🔓');
      }
      checkAuth();
    };

    gitSyncConnectionManager.on('connection-added', handleConnectionAdded);
    gitSyncConnectionManager.on('connection-removed', handleConnectionRemoved);
    gitSyncConnectionManager.on(
      'connection-status-changed',
      handleConnectionStatusChanged,
    );
    gitSyncConnectionManager.on('auth-changed', handleAuthChanged);

    // Cleanup
    return () => {
      gitSyncConnectionManager.off('connection-added', handleConnectionAdded);
      gitSyncConnectionManager.off(
        'connection-removed',
        handleConnectionRemoved,
      );
      gitSyncConnectionManager.off(
        'connection-status-changed',
        handleConnectionStatusChanged,
      );
      gitSyncConnectionManager.off('auth-changed', handleAuthChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Set default repository when repositories load
  useEffect(() => {
    if (repositories.length > 0 && !selectedRepoPath) {
      setSelectedRepoPath(repositories[0].repository.path);
    }
  }, [repositories, selectedRepoPath]);

  return (
    <div
      style={{
        padding: '16px',
        height: '100%',
        overflow: 'auto',
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color={theme.colors.text} />
          <h3
            style={{
              fontSize: theme.fontSizes[3],
              fontWeight: 600,
              margin: 0,
              color: theme.colors.text,
            }}
          >
            Git-Sync Status
          </h3>
        </div>

        {/* Environment Toggle */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            onClick={async () => {
              setEnvironment('development');
              await GitSyncService.setEnvironment('development');
              addEvent('Switched to Development environment', '🔧');
              // Refresh connection status to show new URL
              const url = await GitSyncService.getServerUrl();
              setConnectionStatus({
                connected: connectionStatus.connected,
                serverUrl: url,
              });
            }}
            style={{
              padding: '6px 12px',
              fontSize: theme.fontSizes[1],
              backgroundColor:
                environment === 'development'
                  ? theme.colors.primary
                  : theme.colors.backgroundSecondary,
              color:
                environment === 'development'
                  ? theme.colors.background
                  : theme.colors.text,
              border: `1px solid ${environment === 'development' ? theme.colors.primary : theme.colors.border}`,
              borderRadius: '4px 0 0 4px',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            Dev
          </button>
          <button
            onClick={async () => {
              setEnvironment('production');
              await GitSyncService.setEnvironment('production');
              addEvent('Switched to Production environment', '🚀');
              // Refresh connection status to show new URL
              const url = await GitSyncService.getServerUrl();
              setConnectionStatus({
                connected: connectionStatus.connected,
                serverUrl: url,
              });
            }}
            style={{
              padding: '6px 12px',
              fontSize: theme.fontSizes[1],
              backgroundColor:
                environment === 'production'
                  ? theme.colors.primary
                  : theme.colors.backgroundSecondary,
              color:
                environment === 'production'
                  ? theme.colors.background
                  : theme.colors.text,
              border: `1px solid ${environment === 'production' ? theme.colors.primary : theme.colors.border}`,
              borderRadius: '0 4px 4px 0',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            Prod
          </button>
        </div>
      </div>

      {/* Services Status */}
      <div
        style={{
          padding: '12px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Server size={14} />
          Services
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          {services.map((service, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px',
                backgroundColor: theme.colors.background,
                borderRadius: '4px',
              }}
            >
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.text,
                }}
              >
                {service.name}
              </span>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {service.checking ? (
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textSecondary,
                    }}
                  >
                    Checking...
                  </span>
                ) : (
                  <>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: service.available
                          ? theme.colors.success
                          : theme.colors.error,
                      }}
                    />
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {service.available ? 'Available' : 'Unavailable'}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={checkServices}
          disabled={checkingServices}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: theme.fontSizes[1],
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: checkingServices ? 'not-allowed' : 'pointer',
            opacity: checkingServices ? 0.5 : 1,
            fontWeight: 500,
          }}
        >
          {checkingServices ? 'Checking Services...' : 'Check Services'}
        </button>
      </div>

      {/* Connection Status */}
      <div
        style={{
          padding: '12px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontWeight: 600,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Wifi size={14} />
          Connection
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}
        >
          {connectionStatus.connected ? (
            <CheckCircle size={16} color={theme.colors.success} />
          ) : (
            <XCircle size={16} color={theme.colors.error} />
          )}
          <span
            style={{
              fontSize: theme.fontSizes[2],
              color: theme.colors.text,
              fontWeight: 500,
            }}
          >
            {connectionStatus.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.monospace,
            marginBottom: '4px',
          }}
        >
          WebSocket: {connectionStatus.serverUrl}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontFamily: theme.fonts.monospace,
          }}
        >
          Auth Server: {AUTH_SERVER_URLS[environment]}
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textTertiary,
            marginTop: '6px',
            fontStyle: 'italic',
          }}
        >
          {environment === 'production'
            ? 'Using production servers'
            : 'Using local development servers'}
        </div>
      </div>

      {/* Authentication Status */}
      <div
        style={{
          padding: '12px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontWeight: 600,
            marginBottom: '8px',
          }}
        >
          Authentication
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          }}
        >
          {authStatus.valid ? (
            <CheckCircle size={16} color={theme.colors.success} />
          ) : (
            <XCircle size={16} color={theme.colors.error} />
          )}
          <span
            style={{
              fontSize: theme.fontSizes[2],
              color: theme.colors.text,
              fontWeight: 500,
            }}
          >
            {authStatus.valid ? 'Valid' : 'Invalid'}
          </span>
        </div>
        {authStatus.valid && (
          <>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
              }}
            >
              User: {authStatus.user}
            </div>
            <div
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.monospace,
              }}
            >
              Token: {authStatus.tokenPrefix}***
            </div>
          </>
        )}
      </div>

      {/* Active Rooms */}
      <div
        style={{
          padding: '12px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontWeight: 600,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Users size={14} />
          Active Rooms
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[2],
            color: theme.colors.text,
            fontWeight: 500,
            marginBottom: '8px',
          }}
        >
          {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
        </div>
        {rooms.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {rooms.map((room) => (
              <div
                key={room.repoId}
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  paddingLeft: '16px',
                }}
              >
                • {room.repoId} ({room.peerCount}{' '}
                {room.peerCount === 1 ? 'peer' : 'peers'})
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textTertiary,
              fontStyle: 'italic',
            }}
          >
            No active rooms
          </div>
        )}
      </div>

      {/* Test Repository Connection */}
      <div
        style={{
          padding: '12px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontWeight: 600,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <PlayCircle size={14} />
          Test Repository Connection
        </div>

        {/* Repository Selector */}
        <select
          value={selectedRepoPath}
          onChange={(e) => setSelectedRepoPath(e.target.value)}
          disabled={repositories.length === 0}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '12px',
            fontSize: theme.fontSizes[1],
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: repositories.length === 0 ? 'not-allowed' : 'pointer',
            fontFamily: theme.fonts.body,
          }}
        >
          {repositories.length === 0 ? (
            <option value="">No repositories available</option>
          ) : (
            repositories.map((repoData) => {
              const repo = repoData.repository;
              return (
                <option key={repo.path} value={repo.path}>
                  {repo.github?.owner && repo.github?.name
                    ? `${repo.github.owner}/${repo.github.name}`
                    : repo.name || repo.path}
                </option>
              );
            })
          )}
        </select>

        {/* Test Button */}
        <button
          onClick={testRepositoryConnection}
          disabled={
            testingRepoConnection ||
            !selectedRepoPath ||
            repositories.length === 0
          }
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: theme.fontSizes[1],
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: '4px',
            cursor:
              testingRepoConnection ||
              !selectedRepoPath ||
              repositories.length === 0
                ? 'not-allowed'
                : 'pointer',
            opacity:
              testingRepoConnection ||
              !selectedRepoPath ||
              repositories.length === 0
                ? 0.5
                : 1,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <PlayCircle size={16} />
          {testingRepoConnection ? 'Testing Connection...' : 'Test Connection'}
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={testConnection}
          disabled={testing}
          style={{
            padding: '8px 12px',
            fontSize: theme.fontSizes[1],
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            border: 'none',
            borderRadius: '4px',
            cursor: testing ? 'not-allowed' : 'pointer',
            opacity: testing ? 0.5 : 1,
            fontWeight: 500,
          }}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={clearLog}
          style={{
            padding: '8px 12px',
            fontSize: theme.fontSizes[1],
            backgroundColor: theme.colors.backgroundSecondary,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Clear Log
        </button>
      </div>

      {/* Event Log */}
      <div
        style={{
          flex: 1,
          padding: '12px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '6px',
          border: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
            fontWeight: 600,
            marginBottom: '8px',
          }}
        >
          Recent Events
        </div>
        <div
          ref={eventLogRef}
          style={{
            flex: 1,
            maxHeight: '200px',
            overflow: 'auto',
            fontSize: theme.fontSizes[1],
            fontFamily: theme.fonts.monospace,
            backgroundColor: theme.colors.background,
            borderRadius: '4px',
            padding: '8px',
          }}
        >
          {events.length === 0 ? (
            <div
              style={{
                color: theme.colors.textTertiary,
                fontStyle: 'italic',
              }}
            >
              No events
            </div>
          ) : (
            events.map((event, i) => (
              <div
                key={i}
                style={{
                  color: theme.colors.textSecondary,
                  marginBottom: '4px',
                  lineHeight: '1.4',
                }}
              >
                <span style={{ color: theme.colors.textTertiary }}>
                  {event.time}
                </span>{' '}
                {event.icon} {event.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Preview component for panel registry
export const GitSyncDiagnosticPanelPreview: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: '12px',
        fontSize: theme.fontSizes[1],
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
          fontWeight: 600,
        }}
      >
        <Activity size={14} />
        Git-Sync Diagnostics
      </div>
      <div
        style={{
          fontSize: theme.fontSizes[0],
          color: theme.colors.textSecondary,
        }}
      >
        Monitor git-sync connections and authentication status
      </div>
    </div>
  );
};
