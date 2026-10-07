/**
 * Remote Terminal Viewer
 *
 * A test window that connects to terminals via WebSocket (like a browser client)
 * instead of using IPC. Demonstrates the terminal streaming functionality.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// Import Control Tower Core - Browser-safe imports
import { BaseClient, ClientBuilder, type ClientEvents } from '@principal-ai/control-tower-core/client';
import type { Event, TokenPayload } from '@principal-ai/control-tower-core/types';
import { BrowserWebSocketTransportAdapter } from '@principal-ai/control-tower-core/adapters/websocket/browser';

// Terminal event data interface for type safety
interface TerminalEventData {
  type: string;
  data?: {
    sessions?: TerminalSessionInfo[];
    session?: TerminalSessionInfo;
    sessionId?: string;
    data?: string;
    newOwner?: { type: 'local' | 'remote'; id: string; githubHandle: string } | null;
    error?: string;
  };
}

// Import terminal event types
import type {
  TerminalSessionInfo,
  TerminalEventType,
} from '../../../shared/terminal-events';

// Simple JWT Auth Adapter
class TerminalJWTAuthAdapter {
  constructor(private token: string) {}

  getCurrentToken(): string {
    return this.token;
  }

  async validateToken(_token: string): Promise<TokenPayload> {
    // Simple validation - return minimal payload for browser auth
    return { userId: 'browser-user' };
  }

  isAuthRequired(): boolean {
    return true;
  }
}

// Get device ID for room token
async function _getDeviceId(): Promise<string> {
  // Use a simple browser-based device ID
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `browser-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// Exchange GitHub token for JWT user discovery token
async function getUserToken(githubToken: string): Promise<string> {
  const preferences = await UserPreferencesService.getPreferences();
  if (
    !preferences.featureAvailability?.presenceAndCollaboration
  ) {
    throw new Error(
      'Remote terminal token exchange is disabled in Feature Availability settings.',
    );
  }
  const authServerUrl =
    process.env.AUTH_SERVER_URL || 'https://auth.principal-ade.com';

  const response = await fetch(`${authServerUrl}/api/auth/browser/user-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      github_token: githubToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to get user token: ${response.status}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

// Exchange GitHub token for JWT room token (for specific repository)
async function _getRoomToken(
  githubToken: string,
  repository: string,
  _userId: string
): Promise<string> {
  const authServerUrl =
    process.env.AUTH_SERVER_URL || 'https://auth.principal-ade.com';

  const response = await fetch(`${authServerUrl}/api/auth/browser/room-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repository,
      branch: 'main',
      github_token: githubToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to get room token: ${response.status}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

interface AttachedTerminal {
  sessionId: string;
  info: TerminalSessionInfo;
  terminal: Terminal;
  fitAddon: FitAddon;
  containerRef: HTMLDivElement;
}

// WebSocket close code descriptions
function getCloseCodeDescription(code: number): string {
  const codes: Record<number, string> = {
    1000: 'Normal closure',
    1001: 'Going away',
    1002: 'Protocol error',
    1003: 'Unsupported data',
    1005: 'No status received',
    1006: 'Abnormal closure (no close frame)',
    1007: 'Invalid frame payload data',
    1008: 'Policy violation',
    1009: 'Message too big',
    1010: 'Missing extension',
    1011: 'Internal server error',
    1012: 'Service restart',
    1013: 'Try again later',
    1014: 'Bad gateway',
    1015: 'TLS handshake failure',
  };
  return codes[code] || `Unknown code ${code}`;
}

export function RemoteTerminalViewer() {
  const { theme } = useTheme();
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<{ token: string; userId: string; githubHandle: string } | null>(null);
  const [attachedTerminals, setAttachedTerminals] = useState<Map<string, AttachedTerminal>>(new Map());

  const clientRef = useRef<BaseClient | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const terminalsContainerRef = useRef<HTMLDivElement>(null);

  // Initialize auth and connection
  useEffect(() => {
    console.info('[RemoteTerminalViewer] Mounted');
    console.info('[RemoteTerminalViewer] window.mainProcess available:', !!window.mainProcess);
    console.info('[RemoteTerminalViewer] Available window properties:', Object.keys(window).filter(k => k.includes('main') || k.includes('electron')));

    async function initialize() {
      try {
        setStatus('connecting');
        setError(null);

        // Check if mainProcess API is available
        if (!window.mainProcess) {
          console.error('[RemoteTerminalViewer] window.mainProcess is undefined!');
          console.error('[RemoteTerminalViewer] window keys:', Object.keys(window).slice(0, 50));
          throw new Error('Main process API not available. Please restart the application and try again.');
        }

        // Get GitHub auth from main process
        const authResult = await window.mainProcess.authentication.getGitHubAuth();
        console.info('[RemoteTerminalViewer] Auth result:', {
          authenticated: authResult.authenticated,
          hasUser: !!authResult.user
        });

        if (!authResult.authenticated || !authResult.token || !authResult.user) {
          throw new Error('Not authenticated. Please log in with GitHub first.');
        }

        const userId = authResult.user.id?.toString() || '';
        const githubHandle = authResult.user.login || '';

        setAuthInfo({
          token: authResult.token,
          userId,
          githubHandle,
        });

        // Exchange GitHub token for JWT user discovery token
        // This doesn't require a repository since we're joining user-specific discovery room
        console.info('[RemoteTerminalViewer] Getting user discovery token...');
        const userToken = await getUserToken(authResult.token);
        console.info('[RemoteTerminalViewer] User discovery token obtained');

        // Create WebSocket client and connect to user discovery room
        await connectToUserDiscoveryRoom(userToken, userId, githubHandle);

      } catch (err) {
        console.error('[RemoteTerminalViewer] Failed to initialize:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setStatus('disconnected');
      }
    }

    initialize();

    return () => {
      console.info('[RemoteTerminalViewer] Unmounting, cleaning up...');

      // Cleanup all terminals
      attachedTerminals.forEach(({ terminal }) => {
        terminal.dispose();
      });

      // Disconnect WebSocket client
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Run only on mount; cleanup uses stale closure intentionally for unmount cleanup
  }, []);

  // Connect to user discovery room via WebSocket
  async function connectToUserDiscoveryRoom(
    token: string,
    userId: string,
    githubHandle: string,
  ): Promise<void> {
    try {
      const wsServerUrl =
        process.env.CONTROL_TOWER_WS_URL ||
        'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com/ws';

      const userRoomId = `terminals:user:${userId}`;
      console.info('[RemoteTerminalViewer] Connecting to user discovery room:', userRoomId);
      console.info('[RemoteTerminalViewer] WebSocket URL:', wsServerUrl);
      console.info('[RemoteTerminalViewer] Token length:', token?.length);

      // Test direct WebSocket connection to see actual error
      console.info('[RemoteTerminalViewer] Testing direct WebSocket connection...');
      try {
        await new Promise<void>((resolve, reject) => {
          const testUrl = `${wsServerUrl}${wsServerUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
          const testWs = new WebSocket(testUrl);

          const timeout = setTimeout(() => {
            console.error('[RemoteTerminalViewer] Direct WebSocket test TIMEOUT');
            testWs.close();
            reject(new Error('Connection timeout'));
          }, 5000);

          testWs.onopen = () => {
            console.info('[RemoteTerminalViewer] ✅ Direct WebSocket test: CONNECTED');
            clearTimeout(timeout);
            testWs.close();
            resolve();
          };

          testWs.onerror = (event) => {
            console.error('[RemoteTerminalViewer] ❌ Direct WebSocket test: ERROR', event);
          };

          testWs.onclose = (event) => {
            console.error('[RemoteTerminalViewer] Direct WebSocket test: CLOSED', {
              code: event.code,
              reason: event.reason || '(no reason provided)',
              wasClean: event.wasClean,
              description: getCloseCodeDescription(event.code)
            });
            clearTimeout(timeout);

            if (event.code !== 1000) {
              reject(new Error(`WebSocket closed: ${event.code} - ${event.reason || getCloseCodeDescription(event.code)}`));
            } else {
              resolve();
            }
          };
        });
      } catch (testError) {
        console.error('[RemoteTerminalViewer] Direct WebSocket test failed:', testError instanceof Error ? testError.message : testError);
        // Continue anyway to see if Control Tower client behaves differently
      }

      // Create auth adapter
      const authAdapter = new TerminalJWTAuthAdapter(token);

      // Create browser-compatible WebSocket transport with error handling
      const transportAdapter = new BrowserWebSocketTransportAdapter({
        authToken: token,
        enableHeartbeat: true,
        heartbeatInterval: 30000,
        connectionTimeout: 15000, // 15 second timeout
      });

      // Log transport adapter details
      console.info('[RemoteTerminalViewer] Transport adapter created:', {
        type: 'BrowserWebSocketTransportAdapter',
        hasHeartbeat: true,
        tokenLength: token.length,
      });

      // Add close handler to see why connection fails
      transportAdapter.onClose((code: number, reason: string) => {
        console.error('[RemoteTerminalViewer] WebSocket closed:', {
          code,
          reason,
          codeDescription: getCloseCodeDescription(code)
        });
      });

      // Build client
      const client = await new ClientBuilder()
        .withTransport(transportAdapter)
        .withAuth(authAdapter as unknown as Parameters<typeof ClientBuilder.prototype.withAuth>[0])
        .build();

      clientRef.current = client;

      // Set up event handlers first
      setupEventHandlers(client);

      // Debug: log all incoming messages via event_received
      client.on('event_received', (data: ClientEvents['event_received']) => {
        console.info('[RemoteTerminalViewer] Raw message received:', data.event);
      });

      // Add connection error handlers
      client.on('error', (data: ClientEvents['error']) => {
        console.error('[RemoteTerminalViewer] Client error:', data);
        if (data?.error) {
          console.error('[RemoteTerminalViewer] Error details:', {
            message: data.error.message,
            stack: data.error.stack
          });
        }
      });

      client.on('disconnected', (data: ClientEvents['disconnected']) => {
        console.info('[RemoteTerminalViewer] Disconnected:', data.reason);
        setStatus('disconnected');
      });

      // Connect to server with timeout
      console.info('[RemoteTerminalViewer] Initiating connection...');
      try {
        await Promise.race([
          client.connect(wsServerUrl, token),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
          )
        ]);
        console.info('[RemoteTerminalViewer] Connected to WebSocket server');

        // Authenticate with the server using the BaseClient authenticate method
        // BaseClient emits 'authenticated' event when auth_result is processed
        console.info('[RemoteTerminalViewer] Authenticating...');

        // Set up promise to wait for authentication event
        const authPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Authentication timeout - no auth_result received'));
          }, 5000);

          const handleAuthenticated = (_data: ClientEvents['authenticated']) => {
            console.info('[RemoteTerminalViewer] ✅ Authenticated event received');
            clearTimeout(timeout);
            client.off('authenticated', handleAuthenticated);
            client.off('authentication_failed', handleAuthFailed);
            resolve();
          };

          const handleAuthFailed = (event: ClientEvents['authentication_failed']) => {
            console.error('[RemoteTerminalViewer] ❌ Authentication failed event:', event);
            clearTimeout(timeout);
            client.off('authenticated', handleAuthenticated);
            client.off('authentication_failed', handleAuthFailed);
            reject(new Error(`Authentication failed: ${event?.error || 'Unknown error'}`));
          };

          client.on('authenticated', handleAuthenticated);
          client.on('authentication_failed', handleAuthFailed);
        });

        // Send authenticate message
        try {
          await client.authenticate();
          console.info('[RemoteTerminalViewer] Authentication message sent, waiting for response...');

          // Wait for auth_result to be processed
          await authPromise;
          console.info('[RemoteTerminalViewer] ✅ Authentication complete');
        } catch (authError) {
          console.error('[RemoteTerminalViewer] ❌ Authentication failed:', authError);
          throw new Error(`Authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
        }

      } catch (connectError) {
        const errorObj = connectError instanceof Error ? connectError : new Error(String(connectError));
        console.error('[RemoteTerminalViewer] Connection error details:', {
          url: wsServerUrl,
          message: errorObj.message,
          stack: errorObj.stack,
          name: errorObj.name,
        });

        // Log WebSocket readyState if available
        if (typeof WebSocket !== 'undefined') {
          console.info('[RemoteTerminalViewer] WebSocket available:', true);
        }

        throw new Error(`Failed to connect to WebSocket server: ${errorObj.message}`);
      }

      // Join user discovery room
      console.info('[RemoteTerminalViewer] Joining room:', userRoomId);

      // Listen for ALL events to debug
      client.on('event_received', (data: ClientEvents['event_received']) => {
        console.info('[RemoteTerminalViewer] 🔍 Received message:', data.event);
      });

      // Listen for room join confirmation
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('[RemoteTerminalViewer] ❌ Room join timeout after 10 seconds');
          console.error('[RemoteTerminalViewer] Room we tried to join:', userRoomId);
          reject(new Error('Room join timeout'));
        }, 10000); // Increased to 10 seconds

        // Listen for join success (correct event name: room_joined with underscore)
        client.on('room_joined', (event: ClientEvents['room_joined']) => {
          console.info('[RemoteTerminalViewer] ✅ Room joined event:', event);
          clearTimeout(timeout);
          resolve();
        });

        // Listen for join error
        client.on('error', (event: ClientEvents['error']) => {
          console.error('[RemoteTerminalViewer] ❌ Error event:', event);
          clearTimeout(timeout);
          reject(new Error(`Failed to join room: ${event?.error?.message || 'Unknown error'}`));
        });

        // Attempt to join
        console.info('[RemoteTerminalViewer] 📤 Sending join room request for:', userRoomId);
        client.joinRoom(userRoomId).catch((err) => {
          console.error('[RemoteTerminalViewer] ❌ Join room threw error:', err);
          clearTimeout(timeout);
          reject(err);
        });
      });

      console.info('[RemoteTerminalViewer] Successfully joined user discovery room:', userRoomId);

      const connectionId = userId; // Use userId as connection identifier
      connectionIdRef.current = connectionId;

      setStatus('connected');

      // Tell main process to connect its bridge to the same user room (ONE-TIME IPC call for setup)
      // After this, all communication happens through WebSocket only
      console.info('[RemoteTerminalViewer] Telling main process to connect bridge (one-time setup)...');
      if (!window.mainProcess.terminalBridge) {
        console.error('[RemoteTerminalViewer] ❌ terminalBridge API not available');
      } else {
        try {
          const bridgeResult = await window.mainProcess.terminalBridge.connectBridge({
            token,
            userId,
            githubHandle,
          });
          if (bridgeResult.success) {
            console.info('[RemoteTerminalViewer] ✅ Main process bridge connected - all subsequent communication via WebSocket');
          } else {
            console.warn('[RemoteTerminalViewer] ⚠️ Bridge connection failed:', bridgeResult.error);
          }
        } catch (err) {
          console.error('[RemoteTerminalViewer] ❌ Failed to connect bridge:', err);
        }
      }

      // Small delay to ensure bridge connection and room state is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Request session list via WebSocket (not IPC)
      console.info('[RemoteTerminalViewer] Requesting session list via WebSocket...');
      await requestSessionList(client);
      console.info('[RemoteTerminalViewer] Session list requested');

    } catch (err) {
      console.error('[RemoteTerminalViewer] Connection failed:', err);
      throw err;
    }
  }

  // Set up event handlers for terminal events
  function setupEventHandlers(client: BaseClient): void {
    console.info('[RemoteTerminalViewer] Setting up event handlers');

    // Listen for all events via event_received
    // Terminal events have custom types not in the base Event schema
    client.on('event_received', (data: ClientEvents['event_received']) => {
      const event = data.event as unknown as TerminalEventData;
      console.info('[RemoteTerminalViewer] 📨 Event received:', event.type, event);

      // Handle different terminal event types
      switch (event.type) {
        case 'terminal:session_list':
          console.info('[RemoteTerminalViewer] ✅ Received session list:', event.data);
          if (event.data && Array.isArray(event.data.sessions)) {
            setSessions(event.data.sessions);
          }
          break;

        case 'terminal:session_created':
          console.info('[RemoteTerminalViewer] ➕ Session created:', event.data);
          if (event.data?.session) {
            const newSession = event.data.session;
            setSessions((prev) => [...prev, newSession]);
          }
          break;

        case 'terminal:session_destroyed':
          console.info('[RemoteTerminalViewer] ➖ Session destroyed:', event.data);
          if (event.data?.sessionId) {
            const sessionId = event.data.sessionId;
            setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));

            // Cleanup attached terminal if exists
            const attached = attachedTerminals.get(sessionId);
            if (attached) {
              attached.terminal.dispose();
              setAttachedTerminals((prev) => {
                const newMap = new Map(prev);
                newMap.delete(sessionId);
                return newMap;
              });
            }
          }
          break;

        case 'terminal:data':
          if (event.data?.sessionId && event.data?.data) {
            const { sessionId, data: termData } = event.data;
            const attached = attachedTerminals.get(sessionId);
            if (attached) {
              // Decode Base64 data
              const decoded = atob(termData);
              attached.terminal.write(decoded);
            }
          }
          break;

        case 'terminal:ownership_changed':
          console.info('[RemoteTerminalViewer] 🔑 Ownership changed:', event.data);
          // Update session ownership in list
          if (event.data?.sessionId) {
            const eventData = event.data;
            setSessions((prev) =>
              prev.map((session) =>
                session.sessionId === eventData.sessionId
                  ? { ...session, owner: eventData.newOwner ?? null }
                  : session,
              ),
            );
          }
          break;

        case 'terminal:error':
          console.error('[RemoteTerminalViewer] ❌ Terminal error:', event.data);
          if (event.data?.error) {
            setError(event.data.error);
          }
          break;

        default:
          console.info('[RemoteTerminalViewer] Unhandled terminal event:', event.type);
      }
    });
  }

  // Helper to create terminal events with proper structure
  function createTerminalEvent(
    type: TerminalEventType,
    data: Record<string, unknown>,
    sessionId?: string,
  ): Record<string, unknown> {
    const userId = authInfo?.userId || '';
    const roomId = `terminals:user:${userId}`;

    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      userId,
      roomId,
      data,
      metadata: sessionId ? { sessionId } : undefined,
    };
  }

  // Request session list
  async function requestSessionList(client: BaseClient): Promise<void> {
    const event = createTerminalEvent('terminal:session_list', {});
    await client.broadcast(event as unknown as Event);
  }

  // Attach to a terminal session
  async function attachToSession(sessionId: string, asOwner: boolean = false): Promise<void> {
    if (!clientRef.current) {
      console.error('[RemoteTerminalViewer] Cannot attach: not connected');
      return;
    }

    try {
      console.info('[RemoteTerminalViewer] Attaching to session:', sessionId, 'asOwner:', asOwner);

      // Send attach request
      const event = createTerminalEvent(
        'terminal:attach',
        {
          sessionId,
          asOwner,
        },
        sessionId,
      );
      await clientRef.current.broadcast(event as unknown as Event);

      // Create xterm terminal
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: theme.colors.background,
          foreground: theme.colors.text,
        },
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Create container
      const container = document.createElement('div');
      container.style.width = '100%';
      container.style.height = '400px';
      container.style.marginBottom = '10px';

      if (terminalsContainerRef.current) {
        terminalsContainerRef.current.appendChild(container);
      }

      // Open terminal
      terminal.open(container);
      fitAddon.fit();

      // Set up input handler if owner
      if (asOwner) {
        terminal.onData((data) => {
          handleTerminalInput(sessionId, data);
        });
      }

      // Store attached terminal
      setAttachedTerminals((prev) => {
        const newMap = new Map(prev);
        const session = sessions.find((s) => s.sessionId === sessionId);
        if (session) {
          newMap.set(sessionId, {
            sessionId,
            info: session,
            terminal,
            fitAddon,
            containerRef: container,
          });
        }
        return newMap;
      });

    } catch (err) {
      console.error('[RemoteTerminalViewer] Failed to attach:', err);
      setError(err instanceof Error ? err.message : 'Failed to attach to terminal');
    }
  }

  // Handle terminal input
  function handleTerminalInput(sessionId: string, data: string): void {
    if (!clientRef.current) return;

    const event = createTerminalEvent(
      'terminal:write',
      {
        sessionId,
        data,
      },
      sessionId,
    );
    clientRef.current.broadcast(event as unknown as Event);
  }

  // Detach from session
  async function detachFromSession(sessionId: string): Promise<void> {
    if (!clientRef.current) return;

    try {
      console.info('[RemoteTerminalViewer] Detaching from session:', sessionId);

      // Send detach request
      const event = createTerminalEvent(
        'terminal:detach',
        {
          sessionId,
        },
        sessionId,
      );
      await clientRef.current.broadcast(event as unknown as Event);

      // Cleanup terminal
      const attached = attachedTerminals.get(sessionId);
      if (attached) {
        attached.terminal.dispose();
        if (attached.containerRef.parentNode) {
          attached.containerRef.parentNode.removeChild(attached.containerRef);
        }
        setAttachedTerminals((prev) => {
          const newMap = new Map(prev);
          newMap.delete(sessionId);
          return newMap;
        });
      }
    } catch (err) {
      console.error('[RemoteTerminalViewer] Failed to detach:', err);
    }
  }

  // Claim ownership
  async function claimOwnership(sessionId: string): Promise<void> {
    if (!clientRef.current) return;

    try {
      console.info('[RemoteTerminalViewer] Claiming ownership:', sessionId);

      const event = createTerminalEvent(
        'terminal:claim_ownership',
        {
          sessionId,
          force: false,
        },
        sessionId,
      );
      await clientRef.current.broadcast(event as unknown as Event);

    } catch (err) {
      console.error('[RemoteTerminalViewer] Failed to claim ownership:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim ownership');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        padding: '20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: `1px solid ${theme.colors.border}`,
          paddingBottom: '10px',
          marginBottom: '20px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px' }}>
          Remote Terminal Viewer
        </h1>
        <p style={{ margin: '5px 0 0 0', color: theme.colors.textSecondary }}>
          WebSocket terminal streaming test client
        </p>
      </div>

      {/* Status */}
      <div
        style={{
          padding: '15px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '4px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor:
                status === 'connected'
                  ? '#4caf50'
                  : status === 'connecting'
                  ? '#ff9800'
                  : '#f44336',
            }}
          />
          <span style={{ fontWeight: 500 }}>
            Status: {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
          {authInfo && (
            <span style={{ marginLeft: 'auto', color: theme.colors.textSecondary }}>
              Room: terminals:user:{authInfo.userId}
            </span>
          )}
        </div>
        {authInfo && (
          <div style={{ marginTop: '5px', fontSize: '13px', color: theme.colors.textSecondary }}>
            Authenticated as: {authInfo.githubHandle} (User Discovery Mode - All Repositories)
          </div>
        )}
        {error && (
          <div
            style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f443361a',
              color: '#f44336',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div
        style={{
          padding: '15px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '4px',
          marginBottom: '20px',
          maxHeight: '300px',
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
          Available Terminal Sessions ({sessions.length})
        </h3>
        {sessions.length === 0 ? (
          <p style={{ color: theme.colors.textSecondary, fontStyle: 'italic', margin: 0 }}>
            {status === 'connected'
              ? 'No terminal sessions running. Create a terminal in the main window to see it here.'
              : 'Connecting to WebSocket server...'}
          </p>
        ) : (
          <div>
            {sessions.map((session) => {
              const isAttached = attachedTerminals.has(session.sessionId);
              const hasOwner = session.owner !== null;
              const isOwner = session.isOwner;

              return (
                <div
                  key={session.sessionId}
                  style={{
                    padding: '12px',
                    marginBottom: '10px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '4px',
                    border: isAttached ? `2px solid ${theme.colors.primary}` : '1px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                        {session.sessionId.substring(0, 8)}...
                      </div>
                      <div style={{ fontSize: '13px', color: theme.colors.textSecondary }}>
                        {session.directory}
                      </div>
                      {session.repoId && (
                        <div style={{ fontSize: '12px', color: theme.colors.primary, marginTop: '2px' }}>
                          📁 {session.repoId}
                        </div>
                      )}
                      {hasOwner && (
                        <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginTop: '4px' }}>
                          Owner: {session.owner?.type} - {session.owner?.githubHandle}
                          {isOwner && ' (You)'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!isAttached ? (
                        <>
                          <button
                            onClick={() => attachToSession(session.sessionId, false)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: theme.colors.primary,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '13px',
                            }}
                          >
                            View
                          </button>
                          <button
                            onClick={() => attachToSession(session.sessionId, true)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: hasOwner ? theme.colors.backgroundTertiary : theme.colors.success,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '13px',
                            }}
                            disabled={hasOwner && !isOwner}
                          >
                            Control
                          </button>
                        </>
                      ) : (
                        <>
                          {!isOwner && (
                            <button
                              onClick={() => claimOwnership(session.sessionId)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: theme.colors.warning,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px',
                              }}
                            >
                              Claim
                            </button>
                          )}
                          <button
                            onClick={() => detachFromSession(session.sessionId)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: theme.colors.error,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '13px',
                            }}
                          >
                            Detach
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attached Terminals Container */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
          Attached Terminals ({attachedTerminals.size})
        </h3>
        <div ref={terminalsContainerRef} />
      </div>
    </div>
  );
}
