import React, { useEffect, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { RefreshCw, Globe, ExternalLink, Folder, X, User } from 'lucide-react';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import { LocalhostDetectionService } from '../../main-process-api/LocalhostDetectionService';
import { tildifyPath } from '../../utils/tildifyPath';

const STORYBOOK_BRAND = '#FF4785';

/** Official Storybook logo (Simple Icons path). */
const StorybookIcon: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M16.71.243l-.12 2.71a.18.18 0 0 0 .29.15l1.06-.79.9.7a.18.18 0 0 0 .29-.143L18.999.12l1.2-.063A1.06.94 0 0 1 21.42.998l-.78 21.05a1.06.94 0 0 1-1.054.95l-15.13.84a1.06.94 0 0 1-1.122-.926L2.58 2.766a1.06.94 0 0 1 1.004-.98L16.71.243zm-2.987 9.485c0 .448 3.022.234 3.43-.08 0-3.082-1.657-4.703-4.69-4.703-3.032 0-4.731 1.646-4.731 4.115 0 4.295 5.803 4.377 5.803 6.72 0 .658-.323 1.05-1.04 1.05-.952 0-1.33-.486-1.286-2.136 0-.357-3.61-.469-3.724 0-.286 4.001 2.204 5.158 5.054 5.158 2.768 0 4.935-1.476 4.935-4.14 0-4.602-5.882-4.482-5.882-6.767 0-.92.685-1.05 1.092-1.05.43 0 1.197.075 1.13 1.31z" />
  </svg>
);

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
  // Resolved from the matching Alexandria entry (when the cwd is a registered repo).
  ownerLogin?: string;
  ownerAvatarUrl?: string;
  repoName?: string;
}

interface LocalhostProcessesPanelContext extends PanelContextValue {
  localhostServers?: DataSlice<RunningServer[]>;
}

interface LocalhostProcessesPanelProps {
  context: LocalhostProcessesPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
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
export const LocalhostProcessesPanel: React.FC<LocalhostProcessesPanelProps> = ({
  context,
  actions: _actions,
  events,
}) => {
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [killingPids, setKillingPids] = useState<Set<number>>(new Set());

  // Get localhost servers from context slice
  const serversSlice = context?.localhostServers;
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
                  gap: '12px',
                }}
              >
                {/* Owner avatar — resolved from the matching Alexandria repo */}
                {server.ownerAvatarUrl ? (
                  <img
                    src={server.ownerAvatarUrl}
                    alt={server.ownerLogin ?? 'repo owner'}
                    title={server.ownerLogin}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'block',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: theme.colors.background,
                    }}
                  >
                    <User size={22} color={theme.colors.textTertiary} />
                  </div>
                )}
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
                      {server.repoName || server.label || `localhost:${server.port}`}
                    </span>
                    {server.serviceType && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: theme.fontSizes[0],
                          color:
                            server.serviceType === 'storybook'
                              ? STORYBOOK_BRAND
                              : theme.colors.textSecondary,
                          backgroundColor: theme.colors.background,
                          padding: '2px 6px',
                          borderRadius: theme.radii[0],
                        }}
                      >
                        {server.serviceType === 'storybook' && (
                          <StorybookIcon size={12} />
                        )}
                        {server.serviceType}
                      </span>
                    )}
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
                        {tildifyPath(server.cwd)}
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
