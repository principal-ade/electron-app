import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { GitSyncService } from '../../../main-process-api/GitSyncService';
import { PresenceService } from '../../../main-process-api/PresenceService';
import { SecureAuthService } from '../../../services/SecureAuthService';
import {
  Radio,
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  Circle,
  ArrowDownLeft,
  Server,
  Clock,
  Plus,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  Loader2,
  GitBranch,
  FolderGit,
  Users,
  Monitor,
  Cloud,
  Webhook,
  FileText,
} from 'lucide-react';
import { GitSyncWebhookEvent } from '../../../shared/main-process-api-interfaces/GitSyncAPI';

interface ConnectionInfo {
  connectionId: string;
  repoId: string;
  repoPath: string;
  branch: string;
  status: {
    connected: boolean;
    authenticated: boolean;
    repoId: string;
    branch: string;
    activeLocks: unknown[];
    queuedLocks: number;
    peers: unknown[];
  };
}

interface MessageLogEntry {
  id: string;
  timestamp: Date;
  connectionId: string;
  direction: 'incoming' | 'outgoing';
  type: string;
  preview: string;
  data: unknown;
}

interface ActionResult {
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

interface ServerPresenceUser {
  userId: string;
  status: 'online' | 'away' | 'offline';
  devices: Record<
    string,
    {
      deviceId: string;
      type?: string;
      connectedAt: number;
      lastActivity: number;
      metadata?: {
        login?: string;
        name?: string;
        avatar_url?: string;
      };
    }
  >;
  firstConnectedAt: number;
  lastActivity: number;
  extended?: {
    openRepositories?: Array<{
      repoId: string;
      branch: string;
    }>;
  };
}

interface ServerPresenceData {
  users: ServerPresenceUser[];
  stats: {
    totalOnline: number;
    totalRepositories: number;
    activeCollaborations: number;
  };
}

/**
 * ConnectionsView - UI for viewing and managing WebSocket connections
 * Left: Desktop app activity | Right: Traffic controller server view
 */
export const ConnectionsView: React.FC = () => {
  const { theme, mode } = useTheme();
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [environment, setEnvironment] = useState<'development' | 'production'>(
    'production',
  );
  const [serverUrl, setServerUrl] = useState<string>('');
  const [messageLog, setMessageLog] = useState<MessageLogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const [actionResults, setActionResults] = useState<ActionResult[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Connection form state
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingPresence, setIsConnectingPresence] = useState(false);

  // Server presence state
  const [serverPresence, setServerPresence] = useState<ServerPresenceData | null>(null);
  const [isLoadingServerPresence, setIsLoadingServerPresence] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Webhook events state
  const [webhookEvents, setWebhookEvents] = useState<GitSyncWebhookEvent[]>([]);
  const [isLoadingWebhookEvents, setIsLoadingWebhookEvents] = useState(false);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [expandedWebhookEvent, setExpandedWebhookEvent] = useState<string | null>(null);

  // Current user state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  const textColor = mode === 'dark' ? theme.colors.text : theme.colors.text;
  const textSecondary =
    mode === 'dark' ? theme.colors.textSecondary : theme.colors.textSecondary;
  const borderColor =
    mode === 'dark' && theme.modes?.dark?.border
      ? theme.modes.dark.border
      : theme.colors.border;

  // Add action result
  const addActionResult = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      const result: ActionResult = {
        type,
        message,
        timestamp: new Date(),
      };
      setActionResults((prev) => [...prev.slice(-19), result]);
    },
    [],
  );

  // Load connections and environment
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [conns, env, url] = await Promise.all([
        GitSyncService.getAllConnections(),
        GitSyncService.getEnvironment(),
        GitSyncService.getServerUrl(),
      ]);
      setConnections(conns);
      setEnvironment(env);
      setServerUrl(url);
    } catch (error) {
      console.error('[ConnectionsView] Failed to load data:', error);
      addActionResult('error', `Failed to load data: ${error}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [addActionResult]);

  // Fetch server presence from traffic controller via IPC (avoids CORS)
  const fetchServerPresence = useCallback(async () => {
    setIsLoadingServerPresence(true);
    setServerError(null);
    try {
      const result = await GitSyncService.getServerPresence();

      if (result.success && result.data) {
        setServerPresence(result.data as ServerPresenceData);
      } else {
        setServerError(result.error || 'Unknown error');
        setServerPresence(null);
      }
    } catch (error) {
      console.error('[ConnectionsView] Failed to fetch server presence:', error);
      setServerError(String(error));
      setServerPresence(null);
    } finally {
      setIsLoadingServerPresence(false);
    }
  }, []);

  // Fetch webhook events from traffic controller via IPC (avoids CORS)
  const fetchWebhookEvents = useCallback(async () => {
    setIsLoadingWebhookEvents(true);
    setWebhookError(null);
    try {
      const result = await GitSyncService.getWebhookEvents(50);

      if (result.success) {
        setWebhookEvents(result.events);
      } else {
        setWebhookError(result.error || 'Unknown error');
        setWebhookEvents([]);
      }
    } catch (error) {
      console.error('[ConnectionsView] Failed to fetch webhook events:', error);
      setWebhookError(String(error));
      setWebhookEvents([]);
    } finally {
      setIsLoadingWebhookEvents(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch current user info
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const authService = SecureAuthService.getInstance();
        const authResult = await authService.checkAuth();
        if (authResult.authenticated && authResult.user) {
          setCurrentUserId(authResult.user.githubHandle);
          setCurrentUserName(authResult.user.name || authResult.user.githubHandle);
        }
      } catch (error) {
        console.error('[ConnectionsView] Failed to get current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  // Auto-fetch server presence and webhook events when serverUrl changes
  useEffect(() => {
    if (serverUrl) {
      fetchServerPresence();
      fetchWebhookEvents();
    }
  }, [serverUrl, fetchServerPresence, fetchWebhookEvents]);

  // Subscribe to connection events
  useEffect(() => {
    const unsubscribeAdded = GitSyncService.onConnectionAdded((connId) => {
      addActionResult('info', `Connection added: ${connId}`);
      loadData();
      fetchServerPresence();
    });

    const unsubscribeRemoved = GitSyncService.onConnectionRemoved((connId) => {
      addActionResult('info', `Connection removed: ${connId}`);
      loadData();
      fetchServerPresence();
    });

    const unsubscribeStatusChanged = GitSyncService.onConnectionStatusChanged(
      (connId) => {
        addActionResult('info', `Status changed: ${connId}`);
        loadData();
      },
    );

    return () => {
      unsubscribeAdded();
      unsubscribeRemoved();
      unsubscribeStatusChanged();
    };
  }, [loadData, addActionResult, fetchServerPresence]);

  // Subscribe to messages (including webhook events)
  useEffect(() => {
    const unsubscribe = GitSyncService.onMessage((connectionKey, message) => {
      const messageType =
        typeof message === 'object' && message !== null && 'type' in message
          ? String((message as { type: unknown }).type)
          : 'unknown';

      const entry: MessageLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        connectionId: connectionKey,
        direction: 'incoming',
        type: messageType,
        preview: JSON.stringify(message).slice(0, 100),
        data: message,
      };
      setMessageLog((prev) => [...prev.slice(-99), entry]);

      // Handle real-time webhook events
      if (messageType === 'webhook:github_event') {
        const webhookPayload = (message as { payload?: unknown }).payload;
        if (webhookPayload && typeof webhookPayload === 'object') {
          const payload = webhookPayload as Record<string, unknown>;
          const webhookEvent: GitSyncWebhookEvent = {
            id: String(payload.eventId || entry.id),
            event: String(payload.event || 'unknown'),
            deliveryId: String(payload.deliveryId || ''),
            repository: String(payload.repository || 'unknown'),
            branch: payload.branch ? String(payload.branch) : undefined,
            timestamp: Number(payload.timestamp) || Date.now(),
            processed: Boolean(payload.processed),
            message: payload.message ? String(payload.message) : undefined,
            backlogChanges: payload.backlogChanges as GitSyncWebhookEvent['backlogChanges'],
          };
          setWebhookEvents((prev) => [webhookEvent, ...prev.slice(0, 49)]);
          addActionResult('info', `Webhook: ${webhookEvent.event} from ${webhookEvent.repository}`);
        }
      }
    });
    return unsubscribe;
  }, [addActionResult]);

  // Subscribe to presence events
  useEffect(() => {
    const unsubscribe = PresenceService.onPresenceEvent((event) => {
      const entry: MessageLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        connectionId: '__presence__',
        direction: 'incoming',
        type: event.type,
        preview: JSON.stringify(event.payload).slice(0, 100),
        data: event,
      };
      setMessageLog((prev) => [...prev.slice(-99), entry]);
    });
    return unsubscribe;
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageLog]);

  // Handle environment toggle
  const handleEnvironmentChange = async (env: 'development' | 'production') => {
    try {
      await GitSyncService.setEnvironment(env);
      setEnvironment(env);
      const url = await GitSyncService.getServerUrl();
      setServerUrl(url);
      addActionResult('success', `Switched to ${env}`);
    } catch (error) {
      addActionResult('error', `Failed to set environment: ${error}`);
    }
  };

  // Connect to presence server
  const handleConnectPresence = async () => {
    setIsConnectingPresence(true);
    try {
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        addActionResult('error', 'Not authenticated. Please log in first.');
        return;
      }

      addActionResult('info', 'Connecting to presence...');
      const result = await PresenceService.connectToPresence(authResult.token);

      if (result.success) {
        addActionResult('success', `Connected: ${result.connectionId}`);
        loadData();
        setTimeout(fetchServerPresence, 1000);
      } else {
        addActionResult('error', `Failed: ${result.error}`);
      }
    } catch (error) {
      addActionResult('error', `Error: ${error}`);
    } finally {
      setIsConnectingPresence(false);
    }
  };

  // Disconnect from presence
  const handleDisconnectPresence = async () => {
    try {
      addActionResult('info', 'Disconnecting presence...');
      const result = await PresenceService.disconnectFromPresence();
      if (result.success) {
        addActionResult('success', 'Disconnected');
        loadData();
        setTimeout(fetchServerPresence, 1000);
      } else {
        addActionResult('error', `Failed: ${result.message}`);
      }
    } catch (error) {
      addActionResult('error', `Error: ${error}`);
    }
  };

  // Connect to repository
  const handleConnectRepo = async () => {
    if (!repoOwner || !repoName) {
      addActionResult('error', 'Enter owner and repository name');
      return;
    }

    setIsConnecting(true);
    try {
      const authService = SecureAuthService.getInstance();
      const authResult = await authService.checkAuth();

      if (!authResult.authenticated || !authResult.token) {
        addActionResult('error', 'Not authenticated');
        return;
      }

      const repoId = `${repoOwner}/${repoName}`;
      addActionResult('info', `Connecting to ${repoId}...`);

      const result = await GitSyncService.connect({
        repoId,
        repoPath: '',
        branch: repoBranch,
        token: authResult.token,
      });

      if (result.success) {
        addActionResult('success', `Connected to ${repoId}`);
        setShowRepoForm(false);
        setRepoOwner('');
        setRepoName('');
        setRepoBranch('main');
        loadData();
        setTimeout(fetchServerPresence, 1000);
      } else {
        addActionResult('error', `Failed: ${result.error}`);
      }
    } catch (error) {
      addActionResult('error', `Error: ${error}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async (connectionId: string) => {
    try {
      addActionResult('info', `Disconnecting ${connectionId}...`);
      const result = await GitSyncService.disconnect(connectionId);
      if (result.success) {
        addActionResult('success', 'Disconnected');
        loadData();
        setTimeout(fetchServerPresence, 1000);
      } else {
        addActionResult('error', `Failed: ${result.message}`);
      }
    } catch (error) {
      addActionResult('error', `Error: ${error}`);
    }
  };

  const handleDisconnectAll = async () => {
    for (const conn of connections) {
      await handleDisconnect(conn.connectionId);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const hasPresenceConnection = connections.some(
    (c) => c.repoId === '__presence_only__',
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: '64px',
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Radio size={20} color={theme.colors.primary} />
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: textColor }}>
            Socket Connections
          </h2>
        </div>

        {/* Environment Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Server size={14} color={textSecondary} />
          <span style={{ fontSize: '12px', color: textSecondary, fontFamily: 'monospace' }}>
            {serverUrl || 'Not configured'}
          </span>
          <div
            style={{
              display: 'flex',
              borderRadius: '6px',
              overflow: 'hidden',
              border: `1px solid ${borderColor}`,
            }}
          >
            <button
              onClick={() => handleEnvironmentChange('development')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: 'none',
                background: environment === 'development' ? theme.colors.primary : 'transparent',
                color: environment === 'development' ? '#fff' : textSecondary,
                cursor: 'pointer',
              }}
            >
              Dev
            </button>
            <button
              onClick={() => handleEnvironmentChange('production')}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                border: 'none',
                borderLeft: `1px solid ${borderColor}`,
                background: environment === 'production' ? theme.colors.primary : 'transparent',
                color: environment === 'production' ? '#fff' : textSecondary,
                cursor: 'pointer',
              }}
            >
              Prod
            </button>
          </div>
        </div>
      </div>

      {/* Main Split View */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          minHeight: 0,
          padding: '16px',
        }}
      >
        {/* LEFT SIDE: Desktop App Activity */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: 0,
          }}
        >
          {/* Left Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={16} color={theme.colors.primary} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: textColor }}>
                Desktop App
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {!hasPresenceConnection ? (
                <button
                  onClick={handleConnectPresence}
                  disabled={isConnectingPresence}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: theme.colors.primary,
                    color: '#fff',
                    cursor: isConnectingPresence ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                  }}
                >
                  {isConnectingPresence ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Connect
                </button>
              ) : (
                <button
                  onClick={handleDisconnectPresence}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme.colors.error || '#ef4444'}`,
                    background: 'transparent',
                    color: theme.colors.error || '#ef4444',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  <Square size={12} />
                  Disconnect
                </button>
              )}
              <button
                onClick={() => setShowRepoForm(!showRepoForm)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${borderColor}`,
                  background: showRepoForm ? theme.colors.primary + '20' : 'transparent',
                  color: textColor,
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                <Plus size={12} />
                Repo
              </button>
              {connections.length > 0 && (
                <button
                  onClick={handleDisconnectAll}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme.colors.error || '#ef4444'}`,
                    background: 'transparent',
                    color: theme.colors.error || '#ef4444',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
              <button
                onClick={loadData}
                disabled={isRefreshing}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: textSecondary,
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                <RefreshCw size={12} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* Repo Connection Form */}
          {showRepoForm && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${borderColor}`,
                flexWrap: 'wrap',
              }}
            >
              <FolderGit size={14} color={textSecondary} />
              <input
                type="text"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
                placeholder="owner"
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: textColor,
                  fontSize: '12px',
                  width: '80px',
                }}
              />
              <span style={{ color: textSecondary }}>/</span>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="repo"
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: textColor,
                  fontSize: '12px',
                  width: '100px',
                }}
              />
              <GitBranch size={12} color={textSecondary} />
              <input
                type="text"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
                placeholder="main"
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: textColor,
                  fontSize: '12px',
                  width: '70px',
                }}
              />
              <button
                onClick={handleConnectRepo}
                disabled={isConnecting || !repoOwner || !repoName}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  background: theme.colors.primary,
                  color: '#fff',
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                  fontSize: '11px',
                }}
              >
                {isConnecting ? <Loader2 size={12} /> : 'Connect'}
              </button>
            </div>
          )}

          {/* Active Connections */}
          <div
            style={{
              borderRadius: '6px',
              border: `1px solid ${borderColor}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}
            >
              {connections.length > 0 ? (
                <Wifi size={12} color={theme.colors.success || '#22c55e'} />
              ) : (
                <WifiOff size={12} color={textSecondary} />
              )}
              <span style={{ fontSize: '12px', fontWeight: 500, color: textColor }}>
                Local Connections ({connections.length})
              </span>
            </div>
            <div style={{ maxHeight: '150px', overflow: 'auto', padding: '8px' }}>
              {connections.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: textSecondary, fontSize: '12px' }}>
                  No active connections
                </div>
              ) : (
                connections.map((conn) => (
                  <div
                    key={conn.connectionId}
                    style={{
                      padding: '8px',
                      marginBottom: '6px',
                      borderRadius: '4px',
                      border: `1px solid ${borderColor}`,
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Circle
                          size={6}
                          fill={conn.status.connected ? theme.colors.success || '#22c55e' : theme.colors.error || '#ef4444'}
                          color={conn.status.connected ? theme.colors.success || '#22c55e' : theme.colors.error || '#ef4444'}
                        />
                        <span style={{ fontWeight: 500, color: textColor }}>
                          {conn.repoId === '__presence_only__' ? 'Presence' : conn.repoId}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDisconnect(conn.connectionId)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '3px',
                          border: `1px solid ${theme.colors.error || '#ef4444'}`,
                          background: 'transparent',
                          color: theme.colors.error || '#ef4444',
                          cursor: 'pointer',
                          fontSize: '10px',
                        }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                    <div style={{ color: textSecondary, marginTop: '4px' }}>
                      {conn.branch} | {conn.status.peers?.length || 0} peers
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Log */}
          <div
            style={{
              flex: 1,
              borderRadius: '6px',
              border: `1px solid ${borderColor}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={12} color={textSecondary} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: textColor }}>
                  Activity ({messageLog.length + actionResults.length})
                </span>
              </div>
              <button
                onClick={() => { setMessageLog([]); setActionResults([]); }}
                style={{
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: `1px solid ${borderColor}`,
                  background: 'transparent',
                  color: textSecondary,
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px', fontSize: '11px', fontFamily: 'monospace' }}>
              {actionResults.map((result, idx) => (
                <div
                  key={`action-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    padding: '4px 0',
                    color: result.type === 'error' ? theme.colors.error || '#ef4444' : result.type === 'success' ? theme.colors.success || '#22c55e' : textSecondary,
                  }}
                >
                  {result.type === 'error' ? <AlertCircle size={10} /> : result.type === 'success' ? <CheckCircle size={10} /> : <Circle size={10} />}
                  <span style={{ color: textSecondary }}>{formatTime(result.timestamp)}</span>
                  <span>{result.message}</span>
                </div>
              ))}
              {messageLog.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setExpandedMessage(expandedMessage === entry.id ? null : entry.id)}
                  style={{
                    padding: '4px 0',
                    cursor: 'pointer',
                    borderBottom: expandedMessage === entry.id ? `1px solid ${borderColor}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ArrowDownLeft size={10} color={theme.colors.success || '#22c55e'} />
                    <span style={{ color: textSecondary }}>{formatTime(entry.timestamp)}</span>
                    <span
                      style={{
                        padding: '1px 4px',
                        borderRadius: '3px',
                        backgroundColor: theme.colors.primary + '20',
                        color: theme.colors.primary,
                        fontSize: '9px',
                      }}
                    >
                      {entry.type}
                    </span>
                  </div>
                  {expandedMessage === entry.id && (
                    <pre
                      style={{
                        margin: '4px 0 0 16px',
                        padding: '6px',
                        borderRadius: '4px',
                        backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                        color: textColor,
                        overflow: 'auto',
                        maxHeight: '100px',
                        whiteSpace: 'pre-wrap',
                        fontSize: '10px',
                      }}
                    >
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Traffic Controller Server View */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: 0,
          }}
        >
          {/* Right Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={16} color={theme.colors.primary} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: textColor }}>
                Traffic Controller
              </span>
            </div>
            <button
              onClick={fetchServerPresence}
              disabled={isLoadingServerPresence}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                border: `1px solid ${borderColor}`,
                background: 'transparent',
                color: textSecondary,
                cursor: isLoadingServerPresence ? 'not-allowed' : 'pointer',
                fontSize: '11px',
              }}
            >
              {isLoadingServerPresence ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
          </div>

          {/* Your Connection Status */}
          {currentUserId && (
            <div
              style={{
                padding: '12px',
                borderRadius: '6px',
                border: `1px solid ${borderColor}`,
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Monitor size={14} color={theme.colors.primary} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>
                  Your Connection
                </span>
              </div>
              {(() => {
                const currentUserPresence = serverPresence?.users?.find(
                  (u) => u.userId === currentUserId
                );

                if (!currentUserPresence) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: textSecondary }}>
                      <Circle size={8} fill={textSecondary} color={textSecondary} />
                      <span style={{ fontSize: '11px' }}>Not connected to server</span>
                    </div>
                  );
                }

                const devices = Object.values(currentUserPresence.devices || {});
                const statusColor =
                  currentUserPresence.status === 'online'
                    ? theme.colors.success || '#22c55e'
                    : currentUserPresence.status === 'away'
                      ? theme.colors.warning || '#f59e0b'
                      : textSecondary;

                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Circle size={8} fill={statusColor} color={statusColor} />
                      <span style={{ fontSize: '11px', color: textColor, fontWeight: 500 }}>
                        {currentUserName || currentUserId}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          backgroundColor: statusColor + '20',
                          color: statusColor,
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}
                      >
                        {currentUserPresence.status}
                      </span>
                    </div>

                    {/* Devices */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '10px', color: textSecondary, marginBottom: '6px' }}>
                        {devices.length} device{devices.length !== 1 ? 's' : ''} connected
                      </div>
                      {devices.map((device, idx) => (
                        <div
                          key={device.deviceId || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            marginBottom: '4px',
                            borderRadius: '4px',
                            backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            fontSize: '10px',
                          }}
                        >
                          <Monitor size={12} color={textSecondary} />
                          <div style={{ flex: 1 }}>
                            <div style={{ color: textColor, fontWeight: 500 }}>
                              {device.type || 'Unknown Device'}
                            </div>
                            <div style={{ color: textSecondary, fontSize: '9px' }}>
                              ID: {device.deviceId?.slice(0, 12)}...
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', color: textSecondary }}>
                            <div style={{ fontSize: '9px' }}>
                              Connected {formatRelativeTime(device.connectedAt)}
                            </div>
                            <div style={{ fontSize: '9px' }}>
                              Active {formatRelativeTime(device.lastActivity)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Open Repositories */}
                    {currentUserPresence.extended?.openRepositories &&
                     currentUserPresence.extended.openRepositories.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '10px', color: textSecondary, marginBottom: '4px' }}>
                          Open Repositories
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {currentUserPresence.extended.openRepositories.map((repo, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: theme.colors.primary + '20',
                                color: theme.colors.primary,
                              }}
                            >
                              <FolderGit size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {repo.repoId}
                              {repo.branch && repo.branch !== 'main' && (
                                <span style={{ opacity: 0.7 }}>:{repo.branch}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Server Stats */}
          {serverPresence?.stats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
              }}
            >
              <div
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${borderColor}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 600, color: textColor }}>
                  {serverPresence.stats.totalOnline}
                </div>
                <div style={{ fontSize: '10px', color: textSecondary }}>Online</div>
              </div>
              <div
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${borderColor}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 600, color: textColor }}>
                  {serverPresence.stats.totalRepositories}
                </div>
                <div style={{ fontSize: '10px', color: textSecondary }}>Repos</div>
              </div>
              <div
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  border: `1px solid ${borderColor}`,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 600, color: textColor }}>
                  {serverPresence.stats.activeCollaborations}
                </div>
                <div style={{ fontSize: '10px', color: textSecondary }}>Collabs</div>
              </div>
            </div>
          )}

          {/* Connected Users */}
          <div
            style={{
              flex: 1,
              borderRadius: '6px',
              border: `1px solid ${borderColor}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Users size={12} color={textSecondary} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: textColor }}>
                Server Users ({serverPresence?.users?.length || 0})
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
              {serverError ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    color: theme.colors.error || '#ef4444',
                    fontSize: '12px',
                  }}
                >
                  <AlertCircle size={24} style={{ marginBottom: '8px' }} />
                  <div>{serverError}</div>
                </div>
              ) : isLoadingServerPresence && !serverPresence ? (
                <div style={{ padding: '24px', textAlign: 'center', color: textSecondary }}>
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : !serverPresence?.users?.length ? (
                <div style={{ padding: '24px', textAlign: 'center', color: textSecondary, fontSize: '12px' }}>
                  <Users size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <div>No users connected to server</div>
                </div>
              ) : (
                serverPresence.users.map((user) => {
                  const deviceCount = Object.keys(user.devices || {}).length;
                  const firstDevice = Object.values(user.devices || {})[0];
                  const metadata = firstDevice?.metadata;

                  return (
                    <div
                      key={user.userId}
                      style={{
                        padding: '10px',
                        marginBottom: '8px',
                        borderRadius: '6px',
                        border: `1px solid ${borderColor}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        {metadata?.avatar_url ? (
                          <img
                            src={metadata.avatar_url}
                            alt=""
                            style={{ width: 24, height: 24, borderRadius: '50%' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              backgroundColor: theme.colors.primary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {user.userId[0]?.toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 500, color: textColor }}>
                            {metadata?.name || metadata?.login || user.userId}
                          </div>
                          <div style={{ fontSize: '10px', color: textSecondary }}>
                            {deviceCount} device{deviceCount !== 1 ? 's' : ''} · {formatRelativeTime(user.lastActivity)}
                          </div>
                        </div>
                        <Circle
                          size={8}
                          fill={
                            user.status === 'online'
                              ? theme.colors.success || '#22c55e'
                              : user.status === 'away'
                                ? theme.colors.warning || '#f59e0b'
                                : textSecondary
                          }
                          color={
                            user.status === 'online'
                              ? theme.colors.success || '#22c55e'
                              : user.status === 'away'
                                ? theme.colors.warning || '#f59e0b'
                                : textSecondary
                          }
                        />
                      </div>
                      {user.extended?.openRepositories && user.extended.openRepositories.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {user.extended.openRepositories.map((repo, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: theme.colors.primary + '20',
                                color: theme.colors.primary,
                              }}
                            >
                              {repo.repoId}
                              {repo.branch && repo.branch !== 'main' && (
                                <span style={{ opacity: 0.7 }}>:{repo.branch}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Webhook Events */}
          <div
            style={{
              flex: 1,
              borderRadius: '6px',
              border: `1px solid ${borderColor}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '200px',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${borderColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Webhook size={12} color={textSecondary} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: textColor }}>
                  Webhook Events ({webhookEvents.length})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setWebhookEvents([])}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: `1px solid ${borderColor}`,
                    background: 'transparent',
                    color: textSecondary,
                    cursor: 'pointer',
                    fontSize: '10px',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={fetchWebhookEvents}
                  disabled={isLoadingWebhookEvents}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: `1px solid ${borderColor}`,
                    background: 'transparent',
                    color: textSecondary,
                    cursor: isLoadingWebhookEvents ? 'not-allowed' : 'pointer',
                    fontSize: '10px',
                  }}
                >
                  {isLoadingWebhookEvents ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                </button>
                <button
                  onClick={async () => {
                    addActionResult('info', 'Sending test webhook event...');
                    const result = await GitSyncService.sendTestWebhookEvent();
                    if (result.success) {
                      addActionResult('success', `Test event sent: ${result.eventId}`);
                    } else {
                      addActionResult('error', `Failed to send test event: ${result.error}`);
                    }
                  }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: `1px solid ${borderColor}`,
                    background: 'transparent',
                    color: textSecondary,
                    cursor: 'pointer',
                    fontSize: '10px',
                  }}
                  title="Send test webhook event"
                >
                  Test
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px', fontSize: '11px' }}>
              {webhookError ? (
                <div
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    color: theme.colors.error || '#ef4444',
                    fontSize: '11px',
                  }}
                >
                  <AlertCircle size={20} style={{ marginBottom: '6px' }} />
                  <div>{webhookError}</div>
                </div>
              ) : isLoadingWebhookEvents && webhookEvents.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: textSecondary }}>
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : webhookEvents.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: textSecondary, fontSize: '11px' }}>
                  <Webhook size={20} style={{ marginBottom: '6px', opacity: 0.5 }} />
                  <div>No webhook events received</div>
                </div>
              ) : (
                webhookEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => setExpandedWebhookEvent(expandedWebhookEvent === event.id ? null : event.id)}
                    style={{
                      padding: '8px',
                      marginBottom: '6px',
                      borderRadius: '4px',
                      border: `1px solid ${borderColor}`,
                      cursor: 'pointer',
                      backgroundColor: expandedWebhookEvent === event.id ? (mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '9px',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          backgroundColor: theme.colors.primary + '20',
                          color: theme.colors.primary,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {event.event}
                      </span>
                      <span style={{ fontSize: '10px', color: textSecondary }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      {event.processed && (
                        <CheckCircle size={10} color={theme.colors.success || '#22c55e'} />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: textColor }}>
                      <FolderGit size={10} />
                      <span style={{ fontSize: '11px' }}>{event.repository}</span>
                      {event.branch && (
                        <>
                          <GitBranch size={10} style={{ marginLeft: '4px' }} />
                          <span style={{ fontSize: '10px', color: textSecondary }}>{event.branch}</span>
                        </>
                      )}
                    </div>
                    {event.message && (
                      <div style={{ fontSize: '10px', color: textSecondary, marginTop: '4px' }}>
                        {event.message}
                      </div>
                    )}
                    {expandedWebhookEvent === event.id && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${borderColor}` }}>
                        <div style={{ fontSize: '10px', color: textSecondary, marginBottom: '4px' }}>
                          Delivery ID: {event.deliveryId}
                        </div>
                        {event.backlogChanges && event.backlogChanges.length > 0 && (
                          <div style={{ marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 500, color: textColor, marginBottom: '4px' }}>
                              Backlog Changes ({event.backlogChanges.length}):
                            </div>
                            {event.backlogChanges.map((change, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '10px',
                                  padding: '2px 0',
                                }}
                              >
                                <span
                                  style={{
                                    padding: '1px 4px',
                                    borderRadius: '2px',
                                    fontSize: '9px',
                                    backgroundColor:
                                      change.changeType === 'added'
                                        ? (theme.colors.success || '#22c55e') + '20'
                                        : change.changeType === 'removed'
                                          ? (theme.colors.error || '#ef4444') + '20'
                                          : theme.colors.primary + '20',
                                    color:
                                      change.changeType === 'added'
                                        ? theme.colors.success || '#22c55e'
                                        : change.changeType === 'removed'
                                          ? theme.colors.error || '#ef4444'
                                          : theme.colors.primary,
                                  }}
                                >
                                  {change.changeType}
                                </span>
                                <FileText size={10} />
                                <span style={{ color: textColor }}>{change.taskPath}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: spin 1s linear infinite;
          }
        `}
      </style>
    </div>
  );
};
