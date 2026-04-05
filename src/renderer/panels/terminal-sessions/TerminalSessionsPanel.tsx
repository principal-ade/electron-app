import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Terminal, Clock, Activity, Loader2 } from 'lucide-react';
import type {
  PanelContextValue,
  PanelActions,
  PanelEventEmitter,
  DataSlice,
} from '@principal-ade/panel-framework-core';
import type { Tracer, Span } from '@opentelemetry/api';
import type { TerminalSessionInfo } from '../../../shared/tipc/terminalRouterTypes';
import { WindowService } from '../../main-process-api/WindowService';
import {
  terminalClient,
  onActivitySync,
  type TerminalActivityState,
} from '../../tipc/terminalClient';
import { AlexandriaService } from '../../main-process-api/AlexandriaService';

/**
 * No-op tracer for use in Storybook or when telemetry is not available
 */
const noopSpan: Span = {
  addEvent: () => noopSpan,
  addLink: () => noopSpan,
  addLinks: () => noopSpan,
  end: () => {},
  isRecording: () => false,
  recordException: () => {},
  setAttribute: () => noopSpan,
  setAttributes: () => noopSpan,
  setStatus: () => noopSpan,
  spanContext: () => ({ traceId: '', spanId: '', traceFlags: 0 }),
  updateName: () => noopSpan,
};

const noopTracer: Tracer = {
  startSpan: () => noopSpan,
  startActiveSpan: ((...args: unknown[]) => {
    // Handle all overloads by finding the function argument
    const fn = args.find((arg) => typeof arg === 'function') as
      | ((span: Span) => unknown)
      | undefined;
    return fn ? fn(noopSpan) : undefined;
  }) as Tracer['startActiveSpan'],
};

/**
 * Extended context with terminal sessions data slice
 */
interface TerminalSessionsPanelContext extends PanelContextValue {
  terminal?: DataSlice<TerminalSessionInfo[]>;
}

/**
 * Props for TerminalSessionsPanel
 */
interface TerminalSessionsPanelProps {
  context: TerminalSessionsPanelContext;
  actions: PanelActions;
  events: PanelEventEmitter;
  /** Optional tracer for telemetry. Defaults to no-op tracer for Storybook compatibility. */
  tracer?: Tracer;
}

/**
 * Format timestamp to relative time string
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Get the directory path from a session (handles both cwd and directory fields)
 */
function getSessionDirectory(session: TerminalSessionInfo): string {
  return session.directory || session.cwd || '';
}

/**
 * Get display name for a terminal session
 */
function getSessionDisplayName(session: TerminalSessionInfo): string {
  // Prefer repoName from metadata
  if (session.metadata?.repoName) {
    return session.metadata.repoName;
  }

  // Fall back to packageName if available
  if (session.metadata?.packageName) {
    return session.metadata.packageName;
  }

  // Fall back to directory name
  const directory = getSessionDirectory(session);
  const dirParts = directory.split('/');
  return dirParts[dirParts.length - 1] || 'Terminal';
}

/**
 * Get a context badge label
 */
function getContextBadge(session: TerminalSessionInfo): string | null {
  if (session.metadata?.serverType) {
    return session.metadata.serverType;
  }
  if (session.agentSessionId) {
    return 'agent';
  }
  return null;
}

/**
 * TerminalSessionsPanel - Displays active terminal sessions
 *
 * This panel provides:
 * - A list view of all active terminal sessions
 * - Session info including directory, context, and activity
 * - Click to switch to that terminal session (or focus the owning window)
 * - Visual distinction between sessions in this window vs other windows
 */
export const TerminalSessionsPanel: React.FC<TerminalSessionsPanelProps> = ({
  context,
  actions: _actions,
  events,
  tracer = noopTracer,
}) => {
  const { theme } = useTheme();
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [terminalActivities, setTerminalActivities] = useState<TerminalActivityState[]>([]);

  // Get the current window ID on mount
  useEffect(() => {
    WindowService.getWindowId()
      .then((id) => setCurrentWindowId(id))
      .catch(() => {});
  }, []);

  // Fetch terminal activity state and subscribe to updates
  useEffect(() => {
    // Fetch initial activity state
    const fetchInitialActivities = async () => {
      try {
        const activities = await terminalClient.getActivityState();
        setTerminalActivities(activities);
      } catch (_error) {
        // Silently fail - may not be available in Storybook
      }
    };
    fetchInitialActivities();

    // Subscribe to activity sync broadcasts
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onActivitySync((activities) => {
        setTerminalActivities(activities);
      });
    } catch (_error) {
      // Silently fail - may not be available in Storybook
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Get terminal sessions from context slice
  const terminalSlice = context?.terminal;
  const sessionsData = terminalSlice?.data;
  const isLoading = terminalSlice?.loading ?? false;

  // Sort sessions by creation time (oldest first)
  const sortedSessions = useMemo(() => {
    const sessions = sessionsData ?? [];
    return [...sessions].sort((a, b) => a.createdAt - b.createdAt);
  }, [sessionsData]);

  const handleSessionClick = async (session: TerminalSessionInfo) => {
    const isLocalSession = session.ownedByWindowId === currentWindowId;

    // Telemetry: Session clicked
    const span = tracer.startSpan('terminal.panel.session_click');
    span.addEvent('terminal.panel.session_clicked', {
      'session.id': session.id,
      is_local: isLocalSession,
      'owner.window_id': session.ownedByWindowId ?? -1,
      'current.window_id': currentWindowId ?? -1,
    });

    if (isLocalSession) {
      // Local session - emit event to switch to this terminal tab
      span.addEvent('terminal.panel.session_selected', {
        'session.id': session.id,
      });
      events.emit({
        type: 'principal-ade.terminal-sessions:session-selected',
        source: 'principal-ade.terminal-sessions',
        payload: { session, sessionId: session.id },
        timestamp: Date.now(),
      });
      span.end();
    } else if (session.ownedByWindowId) {
      // External session - try to focus the owning window
      span.addEvent('terminal.panel.window_focus_attempt', {
        'target.window_id': session.ownedByWindowId,
        'session.id': session.id,
      });
      const windowFocused = await WindowService.focusWindowById(session.ownedByWindowId);

      if (windowFocused) {
        span.addEvent('terminal.panel.window_focused', {
          'target.window_id': session.ownedByWindowId,
          'session.id': session.id,
        });
      } else {
        // Window no longer exists - recreate it
        span.addEvent('terminal.panel.window_recreate', {
          'session.id': session.id,
          'previous.window_id': session.ownedByWindowId,
        });
        const directory = getSessionDirectory(session);
        if (directory) {
          const entry = await AlexandriaService.getRepositoryByPath(directory);
          if (entry) {
            await WindowService.openDevWorkspace({ alexandriaEntry: entry });
          } else {
            // Fallback: open as a thread if not in Alexandria registry
            await WindowService.openThread(directory);
          }
        }
      }
      span.end();
    } else {
      span.end();
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: theme.colors.background,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
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
            <h2
              style={{
                fontSize: theme.fontSizes[3],
                fontWeight: theme.fontWeights.semibold,
                fontFamily: theme.fonts.body,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              Terminal Sessions
            </h2>
            {sortedSessions.length >= 5 && (
              <span
                style={{
                  fontSize: theme.fontSizes[1],
                  fontFamily: theme.fonts.body,
                  color: theme.colors.textTertiary,
                  backgroundColor: theme.colors.backgroundSecondary,
                  padding: '2px 8px',
                  borderRadius: theme.radii[0],
                }}
              >
                {sortedSessions.length}
              </span>
            )}
          </div>

          {isLoading && (
            <Loader2
              size={16}
              color={theme.colors.textTertiary}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          )}
        </div>

        {/* Session List */}
        {sortedSessions.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <Terminal
              size={48}
              color={theme.colors.textTertiary}
              style={{ marginBottom: '16px' }}
            />
            <p
              style={{
                margin: 0,
                fontSize: theme.fontSizes[2],
                fontFamily: theme.fonts.body,
              }}
            >
              No active terminal sessions
            </p>
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                color: theme.colors.textTertiary,
              }}
            >
              Terminal sessions will appear here when created
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
            {sortedSessions.map((session) => {
              const displayName = getSessionDisplayName(session);
              const contextBadge = getContextBadge(session);
              const isActive = session.status === 'active';
              const isLocalSession = session.ownedByWindowId === currentWindowId;
              const activity = terminalActivities.find(a => a.sessionId === session.id);
              const isWorking = activity?.isWorking ?? false;

              return (
                <button
                  key={session.id}
                  onClick={() => handleSessionClick(session)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: isLocalSession
                      ? theme.colors.backgroundSecondary
                      : theme.colors.background,
                    border: `1px solid ${isLocalSession ? theme.colors.border : theme.colors.backgroundSecondary}`,
                    borderRadius: theme.radii[1],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    opacity: isLocalSession ? 1 : 0.7,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.border;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isLocalSession
                      ? theme.colors.backgroundSecondary
                      : theme.colors.background;
                    e.currentTarget.style.borderColor = isLocalSession
                      ? theme.colors.border
                      : theme.colors.backgroundSecondary;
                    e.currentTarget.style.opacity = isLocalSession ? '1' : '0.7';
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
                      {/* Status indicator */}
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: isWorking
                            ? theme.colors.success
                            : isActive
                              ? theme.colors.success
                              : theme.colors.warning,
                          flexShrink: 0,
                          animation: isWorking ? 'pulse 2s infinite' : 'none',
                        }}
                        title={isWorking ? 'Working' : isActive ? 'Active' : 'Disconnected'}
                      />
                      <span
                        style={{
                          fontWeight: theme.fontWeights.medium,
                          fontFamily: theme.fonts.body,
                          color: theme.colors.text,
                          fontSize: theme.fontSizes[2],
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayName}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        fontFamily: theme.fonts.body,
                        color: theme.colors.textTertiary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {contextBadge && (
                        <span
                          style={{
                            fontSize: theme.fontSizes[0],
                            fontFamily: theme.fonts.body,
                            color: theme.colors.textSecondary,
                            backgroundColor: theme.colors.background,
                            padding: '2px 6px',
                            borderRadius: theme.radii[0],
                            textTransform: 'capitalize',
                          }}
                        >
                          {contextBadge}
                        </span>
                      )}
                      {session.metadata?.port && (
                        <span
                          style={{
                            fontSize: theme.fontSizes[0],
                            color: theme.colors.primary,
                            fontFamily: theme.fonts.monospace,
                            padding: '2px 6px',
                            backgroundColor: `${theme.colors.primary}15`,
                            borderRadius: theme.radii[0],
                          }}
                        >
                          :{session.metadata.port}
                        </span>
                      )}
                      {isWorking ? (
                        <span
                          style={{
                            fontSize: theme.fontSizes[0],
                            fontFamily: theme.fonts.body,
                            color: theme.colors.success,
                            backgroundColor: `${theme.colors.success}15`,
                            padding: '2px 6px',
                            borderRadius: theme.radii[0],
                            fontWeight: theme.fontWeights.medium,
                            display: 'inline-flex',
                            alignItems: 'center',
                            height: '18px',
                            boxSizing: 'border-box',
                          }}
                        >
                          Working
                        </span>
                      ) : (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            height: '18px',
                          }}
                        >
                          <Clock size={12} />
                          {formatRelativeTime(session.lastActivity)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Activity indicator */}
                  {session.agentSessionId && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: theme.colors.primary,
                        fontSize: theme.fontSizes[0],
                        marginLeft: '12px',
                        flexShrink: 0,
                      }}
                      title="Agent is working in this terminal"
                    >
                      <Activity size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default TerminalSessionsPanel;
