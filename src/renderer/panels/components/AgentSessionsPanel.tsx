/**
 * AgentSessionsPanel - Display active agent sessions as cards
 *
 * This panel shows all active agent sessions for the current repository,
 * with each session displayed as a card showing its latest event and stats.
 * This is a user-facing panel (unlike AgentEventsPanel which is for debugging).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Layers, AlertCircle, FolderOpen, RefreshCw } from 'lucide-react';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
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

const UNKNOWN_DIRECTORY_LABEL = 'Unknown Directory';

interface SessionDirectoryGroup {
  directory: string;
  normalizedDirectory: string;
  sessions: SessionWithEvents[];
  lastActivity: number;
  isCurrentDirectory: boolean;
}

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
  const [openingDirectory, setOpeningDirectory] = useState<string | null>(null);

  const normalizedRepositoryPath = useMemo(() => {
    if (!repositoryPath) {
      return null;
    }

    const normalized = repositoryPath.replace(/\\/g, '/').replace(/\/+$/, '');
    return normalized || repositoryPath;
  }, [repositoryPath]);

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

        // Check if session was found
        if (!fullSession) {
          console.warn(
            `[AgentSessionsPanel] Session ${sessionId} not found in repository ${repository}`,
          );
          return null;
        }

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
          ...(fullSession as Partial<EnhancedUIAgentSessionData>),
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
    try {
      setIsLoading(true);

      // Get all active sessions across all projects
      const allProjectSessions =
        await AgentSessionSDKService.getActiveSessionsByProject();

      if (!allProjectSessions || allProjectSessions.length === 0) {
        setSessions([]);
        return;
      }

      // Flatten all sessions from all projects
      const allSessionSummaries = allProjectSessions.flatMap(
        (project) => project.summaries,
      );

      if (allSessionSummaries.length === 0) {
        setSessions([]);
        return;
      }

      // Fetch full session data and events for each session
      const sessionsWithEvents = await Promise.all(
        allSessionSummaries.map(async (summary) => {
          return fetchSingleSession(summary.sessionId, summary.repository);
        }),
      );

      // Filter out failed fetches and sort by last activity
      const validSessions = sessionsWithEvents
        .filter((s): s is SessionWithEvents => s !== null)
        .sort((a, b) => b.session.lastActivity - a.session.lastActivity);

      setSessions(validSessions);
    } catch (err) {
      console.error('[AgentSessionsPanel] Error fetching sessions:', err);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSingleSession]);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Listen for real-time event updates
  useEffect(() => {
    const unsubscribe = AgentSessionSDKService.onProcessedEvent((event) => {
      // Get the event's repository path
      const eventRepoPath = event.repository?.root || event.workingDirectory;

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
  }, [fetchSingleSession]);

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

  const sessionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredSessions.forEach((sessionWithEvents, index) => {
      map.set(sessionWithEvents.session.sessionId, getSessionColor(index));
    });
    return map;
  }, [filteredSessions, getSessionColor]);

  const sessionsByDirectory = useMemo<SessionDirectoryGroup[]>(() => {
    const groups = new Map<string, SessionDirectoryGroup>();

    filteredSessions.forEach((sessionWithEvents) => {
      const rawDirectory =
        sessionWithEvents.session.directory ||
        sessionWithEvents.session.workingDirectory ||
        UNKNOWN_DIRECTORY_LABEL;

      const normalizedKey =
        rawDirectory === UNKNOWN_DIRECTORY_LABEL
          ? UNKNOWN_DIRECTORY_LABEL
          : rawDirectory.replace(/\\/g, '/').replace(/\/+$/, '') ||
            rawDirectory;

      let group = groups.get(normalizedKey);
      if (!group) {
        group = {
          directory: rawDirectory,
          normalizedDirectory: normalizedKey,
          sessions: [],
          lastActivity: 0,
          isCurrentDirectory: false,
        };
        groups.set(normalizedKey, group);
      }

      group.sessions.push(sessionWithEvents);
      const lastActivity = sessionWithEvents.session.lastActivity ?? 0;
      if (lastActivity > group.lastActivity) {
        group.lastActivity = lastActivity;
      }
    });

    const sortedGroups = Array.from(groups.values()).map((group) => ({
      ...group,
      isCurrentDirectory:
        normalizedRepositoryPath !== null &&
        group.normalizedDirectory === normalizedRepositoryPath,
    }));

    sortedGroups.sort((a, b) => {
      if (a.isCurrentDirectory && !b.isCurrentDirectory) {
        return -1;
      }
      if (b.isCurrentDirectory && !a.isCurrentDirectory) {
        return 1;
      }
      // Sort alphabetically by directory name
      return a.directory.localeCompare(b.directory);
    });

    return sortedGroups;
  }, [filteredSessions, normalizedRepositoryPath]);

  const handleOpenDirectory = useCallback(async (directory: string) => {
    if (!directory || directory === UNKNOWN_DIRECTORY_LABEL) {
      window.alert(
        'No repository directory information is available for this session yet.',
      );
      return;
    }

    setOpeningDirectory(directory);

    try {
      const [{ RepositoryService }, { WindowService }, { GitService }] =
        await Promise.all([
          import('../../main-process-api/RepositoryService'),
          import('../../main-process-api/WindowService'),
          import('../../main-process-api/GitService'),
        ]);

      // First, try to get the repository from registered repositories
      let repository =
        await RepositoryService.getRepositoryByLocalPath(directory);

      // If not found, try to detect git info from the directory
      if (!repository) {
        console.log(
          `[AgentSessionsPanel] Repository not found in registry, attempting to detect git info from directory: ${directory}`,
        );

        const gitInfo = await GitService.getRepositoryInfo(directory);

        if (
          gitInfo?.isRepository &&
          gitInfo.remotes &&
          gitInfo.remotes.length > 0
        ) {
          // Find the origin remote or use the first remote
          const originRemote =
            gitInfo.remotes.find((r) => r.name === 'origin') ||
            gitInfo.remotes[0];

          if (originRemote) {
            console.log(
              `[AgentSessionsPanel] Detected git remote: ${originRemote.url}`,
            );

            // Create a minimal repository object from git info
            repository = {
              remoteUrl: originRemote.url,
              owner: originRemote.owner || 'unknown',
              name:
                originRemote.repo || directory.split('/').pop() || 'unknown',
              localClones: [
                {
                  path: directory,
                  addedAt: Date.now(),
                  lastAccessed: Date.now(),
                },
              ],
              addedAt: Date.now(),
              lastAccessed: Date.now(),
              vcsType: 'github',
              tags: [],
            };

            console.log(
              `[AgentSessionsPanel] Created minimal repository object:`,
              repository,
            );
          }
        }
      }

      if (repository) {
        await WindowService.openRepositoryDashboard(
          repository as unknown as AlexandriaEntry,
        );
      } else {
        window.alert(
          'Could not find a repository associated with this directory. Make sure this is a git repository with a remote configured.',
        );
      }
    } catch (error) {
      console.error(
        `[AgentSessionsPanel] Failed to open repository for directory ${directory}:`,
        error,
      );
      window.alert('Failed to open repository window for this directory.');
    } finally {
      setOpeningDirectory((current) =>
        current === directory ? null : current,
      );
    }
  }, []);

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
        fontFamily: theme.fonts.body,
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
          <Layers size={18} style={{ color: theme.colors.primary }} />
          <span
            style={{
              fontWeight: theme.fontWeights.semibold,
              fontSize: theme.fontSizes[1],
            }}
          >
            Agent Sessions
          </span>
          <span
            style={{
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.backgroundTertiary,
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: theme.fontWeights.semibold,
            }}
          >
            {filteredSessions.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status filter dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              fontSize: theme.fontSizes[0],
              fontFamily: theme.fonts.body,
              color: theme.colors.text,
              backgroundColor: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              padding: '6px 10px',
              cursor: 'pointer',
              outline: 'none',
              fontWeight: theme.fontWeights.medium,
            }}
            title="Filter sessions by status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Sessions list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
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
            <Layers size={32} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <div style={{ fontSize: theme.fontSizes[1] }}>
              Loading sessions...
            </div>
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
            <div style={{ fontSize: theme.fontSizes[1] }}>
              {sessions.length === 0
                ? 'No active sessions found'
                : 'No sessions match the current filter'}
            </div>
          </div>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            {sessionsByDirectory.map((group) => {
              const canOpenDirectory =
                group.directory !== UNKNOWN_DIRECTORY_LABEL &&
                group.directory.trim().length > 0;
              const baseBackgroundColor = group.isCurrentDirectory
                ? theme.colors.backgroundSecondary
                : theme.colors.backgroundTertiary;
              const normalizedDisplayPath =
                group.directory === UNKNOWN_DIRECTORY_LABEL
                  ? group.directory
                  : group.directory.replace(/\\/g, '/');
              const pathSegments = normalizedDisplayPath
                .split('/')
                .filter(Boolean);
              const directoryName =
                group.directory === UNKNOWN_DIRECTORY_LABEL
                  ? UNKNOWN_DIRECTORY_LABEL
                  : pathSegments[pathSegments.length - 1] || group.directory;

              // Hide directory header if there's only one directory and it's the current one
              const shouldShowDirectoryHeader =
                sessionsByDirectory.length > 1 || !group.isCurrentDirectory;

              return (
                <div
                  key={group.normalizedDirectory}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {shouldShowDirectoryHeader && (
                    <div
                      onClick={
                        canOpenDirectory && !group.isCurrentDirectory
                          ? () => {
                              void handleOpenDirectory(group.directory);
                            }
                          : undefined
                      }
                      onMouseEnter={(e) => {
                        if (!canOpenDirectory || group.isCurrentDirectory) {
                          return;
                        }
                        e.currentTarget.style.borderColor =
                          theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        if (group.isCurrentDirectory) {
                          return;
                        }
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        border: group.isCurrentDirectory
                          ? `2px solid ${theme.colors.primary}`
                          : `1px solid ${theme.colors.border}`,
                        backgroundColor: group.isCurrentDirectory
                          ? theme.colors.primary + '10'
                          : baseBackgroundColor,
                        cursor:
                          canOpenDirectory && !group.isCurrentDirectory
                            ? 'pointer'
                            : 'default',
                        transition: 'background-color 0.2s, border-color 0.2s',
                        opacity: group.isCurrentDirectory ? 0.8 : 1,
                      }}
                      title={
                        group.isCurrentDirectory
                          ? 'Current directory'
                          : canOpenDirectory
                            ? 'Open repository window for this directory'
                            : 'Directory information not available yet'
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          overflow: 'hidden',
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: theme.fontWeights.semibold,
                              fontSize: theme.fontSizes[2],
                              color: group.isCurrentDirectory
                                ? theme.colors.primary
                                : theme.colors.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {directoryName}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        {openingDirectory === group.directory ? (
                          <RefreshCw
                            size={14}
                            style={{
                              color: theme.colors.primary,
                              animation: 'spin 1s linear infinite',
                            }}
                          />
                        ) : (
                          canOpenDirectory &&
                          !group.isCurrentDirectory && (
                            <FolderOpen
                              size={14}
                              style={{ color: theme.colors.textSecondary }}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {group.sessions.map((sessionWithEvents) => {
                      const cardData: SessionCardData = {
                        session: sessionWithEvents.session,
                        isExpanded: false,
                        fileOperations: sessionWithEvents.fileOperations,
                        lastTodos: sessionWithEvents.lastTodos,
                        latestEvent: sessionWithEvents.latestEvent,
                      };

                      const sessionColor =
                        sessionColorMap.get(
                          sessionWithEvents.session.sessionId,
                        ) || getSessionColor(0);

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
                          editInputRef={
                            React.createRef<HTMLInputElement>() as React.RefObject<HTMLInputElement>
                          }
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
                          onDeleteSession={async () => {
                            try {
                              await AgentSessionService.deleteSession(
                                sessionWithEvents.session.sessionId,
                                sessionWithEvents.session.workingDirectory ||
                                  '',
                              );
                              // Refetch sessions to update the UI
                              void fetchSessions();
                            } catch (error) {
                              console.error('Failed to delete session:', error);
                            }
                          }}
                          onOpenTerminal={
                            onOpenTerminal
                              ? () =>
                                  onOpenTerminal(
                                    sessionWithEvents.session.sessionId,
                                  )
                              : undefined
                          }
                          onSessionDetailSelect={
                            onSessionSelect
                              ? () =>
                                  onSessionSelect(
                                    sessionWithEvents.session.sessionId,
                                  )
                              : undefined
                          }
                          onOpenPackageCommands={async () => {
                            // Not implemented in panel view
                          }}
                          getTimeAgo={getTimeAgo}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spin animation for loading indicators */}
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
        fontSize: theme.fontSizes[0],
        fontFamily: theme.fonts.body,
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
        <div
          style={{
            fontWeight: theme.fontWeights.semibold,
            marginBottom: '4px',
          }}
        >
          Session abc123
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
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
        <div
          style={{
            fontWeight: theme.fontWeights.semibold,
            marginBottom: '4px',
          }}
        >
          Session def456
        </div>
        <div
          style={{
            fontSize: theme.fontSizes[0],
            color: theme.colors.textSecondary,
          }}
        >
          Last event: Write • src/utils.ts
        </div>
      </div>
    </div>
  );
};
