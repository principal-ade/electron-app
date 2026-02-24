import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { RefreshCw, Globe, ExternalLink, Terminal, Folder, X } from 'lucide-react';
import type {
  PanelComponentProps,
} from '@principal-ade/panel-framework-core';
import { LocalhostDetectionService } from '../../main-process-api/LocalhostDetectionService';

export interface RunningServer {
  port: number;
  protocol: 'http' | 'https';
  label?: string;
  serviceType?: string;
  pid?: number;
  cwd?: string;
  command?: string;
  responsive?: boolean;
  path?: string;
}

/**
 * LocalhostProcessesPanel - Displays running localhost development servers
 *
 * This panel provides:
 * - A list view of all running localhost dev servers
 * - Process info including port, service type, and working directory
 * - A refresh button to trigger re-scanning for servers
 * - Click to open in external browser
 */
export const LocalhostProcessesPanel: React.FC<PanelComponentProps> = ({
  context,
  actions: _actions,
  events,
}) => {
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [killingPids, setKillingPids] = useState<Set<number>>(new Set());

  // Get localhost servers from context slice
  const serversSlice = context?.getSlice<RunningServer[]>('localhostServers');
  const servers = serversSlice?.data ?? [];
  const isLoading = serversSlice?.loading ?? false;

  // Subscribe to panel events for tool invocations
  useEffect(() => {
    const onRefresh = () => {
      handleRefresh();
    };

    const unsubscribers = [
      events.on('principal-ade.localhost-processes:refresh', onRefresh),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    // Emit event for host to refresh the server list
    events.emit({
      type: 'principal-ade.localhost-processes:request-refresh',
      source: 'principal-ade.localhost-processes',
      payload: {},
      timestamp: Date.now(),
    });

    // Also try context refresh if available
    if (serversSlice?.refresh) {
      try {
        await serversSlice.refresh();
      } catch (err) {
        console.error('Failed to refresh servers:', err);
      }
    }

    // Animation duration for visual feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleOpenServer = (server: RunningServer) => {
    const url = `${server.protocol}://localhost:${server.port}${server.path || ''}`;

    // Emit event for host to handle opening
    events.emit({
      type: 'principal-ade.localhost-processes:open-server',
      source: 'principal-ade.localhost-processes',
      payload: { server, url },
      timestamp: Date.now(),
    });

    // Also open in browser directly
    window.open(url, '_blank');
  };

  const handleKillServer = async (server: RunningServer) => {
    if (!server.pid) {
      console.warn('[LocalhostProcessesPanel] Cannot kill server without PID');
      return;
    }

    const pid = server.pid;

    // Confirm before killing
    const confirmed = window.confirm(
      `Are you sure you want to kill the server on port ${server.port}?\n\nPID: ${pid}\nCommand: ${server.command || 'Unknown'}`,
    );

    if (!confirmed) {
      return;
    }

    // Add to killing set for UI feedback
    setKillingPids((prev) => new Set(prev).add(pid));

    try {
      const result = await LocalhostDetectionService.killServer(server.pid);

      if (result.success) {
        console.info(
          `[LocalhostProcessesPanel] Successfully killed server with PID ${server.pid}`,
        );

        // Emit event for tracking
        events.emit({
          type: 'principal-ade.localhost-processes:server-killed',
          source: 'principal-ade.localhost-processes',
          payload: { server },
          timestamp: Date.now(),
        });

        // Trigger refresh to update the list
        setTimeout(() => {
          handleRefresh();
        }, 500);
      } else {
        console.error(
          `[LocalhostProcessesPanel] Failed to kill server: ${result.error}`,
        );
        alert(`Failed to kill server: ${result.error}`);
      }
    } catch (error) {
      console.error('[LocalhostProcessesPanel] Error killing server:', error);
      alert(`Error killing server: ${error}`);
    } finally {
      // Remove from killing set
      setKillingPids((prev) => {
        const next = new Set(prev);
        next.delete(pid);
        return next;
      });
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: theme.colors.background,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Globe size={20} color={theme.colors.primary} />
            <h2
              style={{
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights.semibold,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              Localhost Processes
            </h2>
            <span
              style={{
                fontSize: theme.fontSizes[1],
                color: theme.colors.textTertiary,
                backgroundColor: theme.colors.backgroundSecondary,
                padding: '2px 8px',
                borderRadius: theme.radii[0],
              }}
            >
              {servers.length}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            style={{
              padding: '6px 12px',
              backgroundColor: theme.colors.backgroundSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii[1],
              cursor: isRefreshing || isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: theme.colors.text,
              fontSize: theme.fontSizes[1],
              fontWeight: theme.fontWeights.medium,
            }}
            title="Refresh server list"
          >
            <RefreshCw
              size={14}
              style={
                isRefreshing || isLoading
                  ? { animation: 'spin 1s linear infinite' }
                  : {}
              }
            />
            Refresh
          </button>
        </div>

        {/* Server List */}
        {servers.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: theme.radii[1],
            }}
          >
            <Globe
              size={32}
              color={theme.colors.textTertiary}
              style={{ marginBottom: '12px' }}
            />
            <p
              style={{
                margin: 0,
                fontSize: theme.fontSizes[2],
              }}
            >
              No localhost servers detected
            </p>
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: theme.fontSizes[1],
                color: theme.colors.textTertiary,
              }}
            >
              Start a dev server and click Refresh
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {servers.map((server) => (
              <div
                key={`${server.port}-${server.protocol}`}
                style={{
                  padding: '12px 16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radii[1],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: theme.fontWeights.medium,
                        color: theme.colors.text,
                        fontSize: theme.fontSizes[2],
                      }}
                    >
                      {server.label || `localhost:${server.port}`}
                    </span>
                    <span
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: server.responsive
                          ? theme.colors.success
                          : theme.colors.warning,
                        fontFamily: theme.fonts.monospace,
                        padding: '2px 6px',
                        backgroundColor: server.responsive
                          ? `${theme.colors.success}15`
                          : `${theme.colors.warning}15`,
                        borderRadius: theme.radii[0],
                      }}
                    >
                      :{server.port}
                    </span>
                    {server.serviceType && (
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.textSecondary,
                          backgroundColor: theme.colors.background,
                          padding: '2px 6px',
                          borderRadius: theme.radii[0],
                        }}
                      >
                        {server.serviceType}
                      </span>
                    )}
                    {server.responsive === false && (
                      <span
                        style={{
                          fontSize: theme.fontSizes[0],
                          color: theme.colors.warning,
                          padding: '2px 6px',
                          backgroundColor: `${theme.colors.warning}15`,
                          borderRadius: theme.radii[0],
                        }}
                      >
                        Not responding
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textTertiary,
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    {server.pid && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Terminal size={12} />
                        PID: {server.pid}
                      </span>
                    )}
                    {server.command && <span>{server.command}</span>}
                    {server.cwd && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontFamily: theme.fonts.monospace,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '300px',
                        }}
                        title={server.cwd}
                      >
                        <Folder size={12} />
                        {server.cwd}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexShrink: 0,
                    marginLeft: '12px',
                  }}
                >
                  <button
                    onClick={() => handleOpenServer(server)}
                    disabled={server.responsive === false}
                    style={{
                      padding: '6px',
                      backgroundColor: theme.colors.background,
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.radii[1],
                      cursor:
                        server.responsive === false ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color:
                        server.responsive === false
                          ? theme.colors.textTertiary
                          : theme.colors.text,
                      opacity: server.responsive === false ? 0.5 : 1,
                    }}
                    title="Open server"
                  >
                    <ExternalLink size={14} />
                  </button>

                  {server.pid && (
                    <button
                      onClick={() => handleKillServer(server)}
                      disabled={killingPids.has(server.pid)}
                      style={{
                        padding: '6px',
                        backgroundColor: theme.colors.background,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: theme.radii[1],
                        cursor: killingPids.has(server.pid)
                          ? 'not-allowed'
                          : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: killingPids.has(server.pid)
                          ? theme.colors.textTertiary
                          : theme.colors.error,
                        opacity: killingPids.has(server.pid) ? 0.5 : 1,
                      }}
                      title={`Kill server (PID: ${server.pid})`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LocalhostProcessesPanel;
