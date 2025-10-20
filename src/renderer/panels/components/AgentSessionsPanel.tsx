/**
 * AgentSessionsPanel - Display active agent sessions as cards
 *
 * This panel shows all active agent sessions for the current repository,
 * with each session displayed as a card showing its latest event and stats.
 * This is a user-facing panel (unlike AgentEventsPanel which is for debugging).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { Activity, Search, RefreshCw, AlertCircle } from 'lucide-react';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { AgentSessionSDKService } from '../../main-process-api/AgentSessionSDKService';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import type { EnhancedUIAgentSessionData } from '../../types/session.types';
import type { SessionCardData } from '../../repo-manager/shared/AgentSessionCard';
import { AgentSessionCard } from '../../repo-manager/shared/AgentSessionCard';
import type {
  FileOperation,
  TodoItem,
} from '../../main-process-api/AgentSessionService';
import { EventActivityType, ToolName } from '../../../shared/sessionEnums';

const SESSION_COLORS: readonly string[] = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

const mapToolToActivityType = (toolName?: string): EventActivityType => {
  switch (toolName) {
    case ToolName.READ:
    case ToolName.NOTEBOOK_READ:
      return EventActivityType.READ;
    case ToolName.WRITE:
    case ToolName.NOTEBOOK_WRITE:
      return EventActivityType.WRITE;
    case ToolName.EDIT:
    case ToolName.MULTI_EDIT:
    case ToolName.NOTEBOOK_EDIT:
      return EventActivityType.EDIT;
    case ToolName.WEB_FETCH:
    case ToolName.WEB_SEARCH:
      return EventActivityType.WEB;
    case ToolName.BASH:
      return EventActivityType.BASH;
    case ToolName.TODO_WRITE:
      return EventActivityType.TODO_WRITE;
    default:
      return EventActivityType.TOOL;
  }
};

export interface AgentSessionsPanelProps {
  repositoryPath?: string | null;
  onSessionSelect?: (sessionId: string) => void;
  onOpenTerminal?: (sessionId: string) => void;
}

interface SessionWithEvents {
  session: EnhancedUIAgentSessionData;
  events: RepoNormalizedUniversalAgentSessionEvent[];
  latestEvent?: {
    toolName: string;
    timestamp: number;
    fileName?: string;
    description?: string;
  };
  fileOperations?: Map<string, FileOperation>;
  lastTodos?: TodoItem[];
}

export const AgentSessionsPanel: React.FC<AgentSessionsPanelProps> = ({
  repositoryPath,
  onSessionSelect,
  onOpenTerminal,
}) => {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<SessionWithEvents[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Log when panel mounts/repositoryPath changes (commented out for less noise)
  // useEffect(() => {
  //   console.info('[AgentSessionsPanel] ========== PANEL MOUNTED/UPDATED ==========');
  //   console.info('[AgentSessionsPanel] repositoryPath:', repositoryPath);
  //   console.info('[AgentSessionsPanel] Current sessions count:', sessions.length);
  // }, [repositoryPath, sessions.length]);

  // Color palette for sessions
  const getSessionColor = useCallback((index: number): string => {
    return SESSION_COLORS[index % SESSION_COLORS.length];
  }, []);

  // Fetch a single session by ID
  const fetchSingleSession = useCallback(
    async (
      sessionId: string,
      repository: string,
    ): Promise<SessionWithEvents | null> => {
      try {
        // Get full session details
        const fullSession = await AgentSessionSDKService.getSDKSession(
          sessionId,
          repository,
        );

        // Get events for this session
        const events =
          await AgentSessionSDKService.getSDKSessionEvents(sessionId);

        // Extract file operations
        const fileOperations = events
          ? AgentSessionService.extractFileOperations(events)
          : new Map();

        // Extract latest event
        let latestEvent = undefined;
        if (events && events.length > 0) {
          const lastEvent = events[events.length - 1];
          const filePath = AgentSessionService.extractFilePath(lastEvent);
          latestEvent = {
            toolName: lastEvent.toolName || lastEvent.eventType,
            timestamp: lastEvent.timestamp,
            fileName: filePath?.displayPath?.split('/').pop(),
          };
        }

        // Extract todos
        const lastTodos = events
          ? AgentSessionService.extractLastTodos(events)
          : undefined;

        // Create enhanced session with status
        const enhancedSession: EnhancedUIAgentSessionData = {
          ...fullSession,
          sessionId,
          directory: repository,
          workingDirectory: repository,
          lastActivity: fullSession.lastActivity || Date.now(),
          firstAccess: fullSession.firstAccess || Date.now(),
          isActive: fullSession.isActive || true,
          eventCount: events?.length || 0,
          lastEvent: latestEvent
            ? {
                type: mapToolToActivityType(latestEvent.toolName),
                fileName: latestEvent.fileName || '',
                timestamp: latestEvent.timestamp,
              }
            : {
                type: EventActivityType.TOOL,
                fileName: '',
                timestamp: fullSession.firstAccess || Date.now(),
              },
          // Compute status based on session state
          status: fullSession.isActive
            ? 'active'
            : (fullSession.lastActivity || 0) > Date.now() - 300000
              ? 'idle'
              : 'inactive',
          statusColor: fullSession.isActive
            ? '#10b981'
            : (fullSession.lastActivity || 0) > Date.now() - 300000
              ? '#f59e0b'
              : '#6b7280',
          statusText: fullSession.isActive
            ? 'Active'
            : (fullSession.lastActivity || 0) > Date.now() - 300000
              ? 'Idle'
              : 'Inactive',
        };

        return {
          session: enhancedSession,
          events: events || [],
          latestEvent,
          fileOperations,
          lastTodos,
        };
      } catch (err) {
        console.error(
          `[AgentSessionsPanel] Failed to fetch session ${sessionId}:`,
          err,
        );
        return null;
      }
    },
    [],
  );

  // Fetch sessions from the SDK
  const fetchSessions = useCallback(async () => {
    if (!repositoryPath) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get active sessions for this directory
      const projectSessions =
        await AgentSessionSDKService.getActiveSessionsForDirectory(
          repositoryPath,
        );

      if (!projectSessions || projectSessions.summaries.length === 0) {
        setSessions([]);
        return;
      }

      // Fetch full session data and events for each session
      const sessionsWithEvents = await Promise.all(
        projectSessions.summaries.map(async (summary) => {
          return fetchSingleSession(summary.sessionId, summary.repository);
        }),
      );

      // Filter out failed fetches and sort by last activity
      const validSessions = sessionsWithEvents
        .filter((s): s is SessionWithEvents => s !== null)
        .sort((a, b) => b.session.lastActivity - a.session.lastActivity);

      setSessions(validSessions);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[AgentSessionsPanel] Error fetching sessions:', err);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [repositoryPath, fetchSingleSession]);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Listen for real-time event updates
  useEffect(() => {
    if (!repositoryPath) {
      return;
    }

    const unsubscribe = AgentSessionSDKService.onProcessedEvent((event) => {
      // Check if this event belongs to the current repository
      const eventRepoPath = event.repository?.root || event.workingDirectory;

      if (eventRepoPath !== repositoryPath) {
        return;
      }

      // Update the session that received this event
      setSessions((prevSessions) => {
        // Check if this is a new session
        const sessionExists = prevSessions.some(
          (s) => s.session.sessionId === event.sessionId,
        );

        if (!sessionExists) {
          // Fetch the new session asynchronously and add it
          fetchSingleSession(event.sessionId, eventRepoPath).then(
            (newSession) => {
              if (newSession) {
                setSessions((current) => {
                  // Check again to prevent duplicates
                  if (
                    current.some((s) => s.session.sessionId === event.sessionId)
                  ) {
                    return current;
                  }
                  // Add new session and sort by last activity
                  return [...current, newSession].sort(
                    (a, b) => b.session.lastActivity - a.session.lastActivity,
                  );
                });
              }
            },
          );
          // Return current sessions while we fetch the new one
          return prevSessions;
        }

        // Update existing session
        return prevSessions.map((sessionWithEvents) => {
          if (sessionWithEvents.session.sessionId === event.sessionId) {
            // Add event to the session's events array
            const updatedEvents = [...sessionWithEvents.events, event];

            // Extract new latest event
            const filePath = AgentSessionService.extractFilePath(event);
            const latestEvent = {
              toolName: event.toolName || event.eventType,
              timestamp: event.timestamp,
              fileName: filePath?.displayPath?.split('/').pop(),
            };

            // Update file operations
            const fileOperations =
              AgentSessionService.extractFileOperations(updatedEvents);

            // Update todos
            const lastTodos =
              AgentSessionService.extractLastTodos(updatedEvents);

            // Update session activity
            const updatedSession: EnhancedUIAgentSessionData = {
              ...sessionWithEvents.session,
              lastActivity: event.timestamp,
              eventCount: updatedEvents.length,
              status: 'active',
              statusColor: '#10b981',
              statusText: 'Active',
            };

            return {
              ...sessionWithEvents,
              session: updatedSession,
              events: updatedEvents,
              latestEvent,
              fileOperations,
              lastTodos,
            };
          }
          return sessionWithEvents;
        });
      });
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath, fetchSingleSession]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.session.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const searchableText = [
          s.session.customName,
          s.session.sessionId,
          s.session.workingDirectory,
          s.latestEvent?.toolName,
          s.latestEvent?.fileName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    return filtered;
  }, [sessions, statusFilter, searchQuery]);

  // Helper to get time ago
  const getTimeAgo = useCallback((timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }, []);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.backgroundSecondary,
        color: theme.colors.text,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          backgroundColor: theme.colors.background,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} style={{ color: theme.colors.primary }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Agent Sessions
          </span>
          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.backgroundTertiary,
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 600,
            }}
          >
            {filteredSessions.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Refresh button */}
          <button
            onClick={fetchSessions}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}`}
          >
            <RefreshCw
              size={12}
              style={{
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
          backgroundColor: theme.colors.background,
        }}
      >
        {/* Search box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: '6px',
            border: `1px solid ${theme.colors.border}`,
            marginBottom: '12px',
          }}
        >
          <Search size={14} color={theme.colors.textSecondary} />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: theme.colors.text,
              fontSize: '13px',
            }}
          />
        </div>

        {/* Status filter buttons */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { value: 'all', label: 'All', color: theme.colors.textSecondary },
            { value: 'active', label: 'Active', color: '#10b981' },
            { value: 'idle', label: 'Idle', color: '#f59e0b' },
            { value: 'inactive', label: 'Inactive', color: '#6b7280' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '4px',
                border:
                  statusFilter === filter.value
                    ? 'none'
                    : `1px solid ${theme.colors.border}`,
                backgroundColor:
                  statusFilter === filter.value
                    ? filter.color
                    : theme.colors.backgroundSecondary,
                color:
                  statusFilter === filter.value ? '#fff' : theme.colors.text,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: statusFilter === filter.value ? 600 : 400,
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        {isLoading && sessions.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <Activity
              size={32}
              style={{ opacity: 0.3, marginBottom: '12px' }}
            />
            <div style={{ fontSize: '14px' }}>Loading sessions...</div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            <AlertCircle
              size={32}
              style={{ opacity: 0.3, marginBottom: '12px' }}
            />
            <div style={{ fontSize: '14px' }}>
              {sessions.length === 0
                ? repositoryPath
                  ? 'No active sessions in this repository'
                  : 'Select a repository to view sessions'
                : 'No sessions match the current filter'}
            </div>
          </div>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {filteredSessions.map((sessionWithEvents, index) => {
              const sessionColor = getSessionColor(index);
              const cardData: SessionCardData = {
                session: sessionWithEvents.session,
                isExpanded: false,
                fileOperations: sessionWithEvents.fileOperations,
                lastTodos: sessionWithEvents.lastTodos,
                latestEvent: sessionWithEvents.latestEvent,
              };

              return (
                <AgentSessionCard
                  key={sessionWithEvents.session.sessionId}
                  cardData={cardData}
                  sessionColor={sessionColor}
                  theme={theme}
                  sources={new Map()}
                  repositoryPath={repositoryPath || ''}
                  isEditingName={false}
                  editingName=""
                  editInputRef={React.createRef()}
                  isCopied={false}
                  isArchiving={false}
                  onStartEditName={() => {}}
                  onSaveEditName={() => {}}
                  onCancelEditName={() => {}}
                  onEditNameChange={() => {}}
                  onCopySessionId={() => {
                    navigator.clipboard.writeText(
                      sessionWithEvents.session.sessionId,
                    );
                  }}
                  onOpenTerminal={
                    onOpenTerminal
                      ? () =>
                          onOpenTerminal(sessionWithEvents.session.sessionId)
                      : undefined
                  }
                  onSessionDetailSelect={
                    onSessionSelect
                      ? () =>
                          onSessionSelect(sessionWithEvents.session.sessionId)
                      : undefined
                  }
                  getTimeAgo={getTimeAgo}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Spin animation for refresh button */}
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export const AgentSessionsPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: '11px',
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          padding: '8px',
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '6px',
          borderLeft: `3px solid #3b82f6`,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
          Session abc123
        </div>
        <div style={{ fontSize: '10px', color: theme.colors.textSecondary }}>
          Last event: Read • src/index.ts
        </div>
      </div>
      <div
        style={{
          padding: '8px',
          backgroundColor: theme.colors.backgroundTertiary,
          borderRadius: '6px',
          borderLeft: `3px solid #10b981`,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
          Session def456
        </div>
        <div style={{ fontSize: '10px', color: theme.colors.textSecondary }}>
          Last event: Write • src/utils.ts
        </div>
      </div>
    </div>
  );
};
