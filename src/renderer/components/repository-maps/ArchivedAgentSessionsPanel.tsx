import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { Archive, Settings, Search, Calendar, Activity } from 'lucide-react';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { AgentSessionArchiveService } from '../../main-process-api/AgentSessionArchiveService';
import { NormalizedAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { HighlightLayer } from '@principal-ai/code-city-react';
import { AgentSessionRecord } from '../../../shared/sessionTypes';
import { ToolName, EventActivityType } from '../../../shared/sessionEnums';
import { AgentSessionDebugModal } from '../agent-session-debug/AgentSessionDebugModal';
import { AgentSessionCollisionIndicator } from '../agent-session-debug/AgentSessionCollisionIndicator';
import {
  SessionCollisionDetector,
  SessionLayer,
} from '../../utils/sessionCollisionDetector';
import { ArchivedSessionData } from '../../types/session.types';

// Export the archived type for backward compatibility
export type ArchivedAgentSessionBrief = ArchivedSessionData;

interface ArchivedAgentSessionsPanelProps {
  repositoryPath: string;
  repositoryName: string;
  localClonePaths?: string[];
  onSessionSelect: (session: ArchivedSessionData, directory: string) => void;
  onSessionUnselect: () => void;
  selectedSessionId?: string;
  sessionLayerFilters: Map<string, 'current' | 'recent' | 'all'>;
  onSessionLayerFilterChange: (
    sessionId: string,
    filter: 'current' | 'recent' | 'all',
  ) => void;
  onLayersGenerated?: (
    sessionId: string,
    readLayer: any,
    writeLayer: any,
  ) => void;
  selectedSessionIds?: Set<string>;
  onMultiSessionSelect?: (sessionId: string) => void;
}

export const ArchivedAgentSessionsPanel: React.FC<
  ArchivedAgentSessionsPanelProps
> = ({
  repositoryPath,
  repositoryName,
  localClonePaths = [],
  onSessionSelect,
  onSessionUnselect,
  selectedSessionId,
  sessionLayerFilters,
  onSessionLayerFilterChange,
  onLayersGenerated,
  selectedSessionIds = new Set(),
  onMultiSessionSelect,
}) => {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<ArchivedSessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugModalSession, setDebugModalSession] =
    useState<ArchivedSessionData | null>(null);
  const [sessionLayers, setSessionLayers] = useState<Map<string, SessionLayer>>(
    new Map(),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<
    'all' | 'week' | 'month' | 'year'
  >('all');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to format time ago
  const getTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (months > 0) return `${months}mo ago`;
    if (weeks > 0) return `${weeks}w ago`;
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  };

  // Agent color palette for visual differentiation
  const getAgentColor = (
    sessionId: string,
    index: number,
  ): { primary: string; secondary: string } => {
    const colors = [
      { primary: '#F02C0380', secondary: '#F02C03' },
      { primary: '#FF950C80', secondary: '#FF950C' },
      { primary: '#FEDC0380', secondary: '#FEDC03' },
      { primary: '#7CDA0180', secondary: '#7CDA01' },
      { primary: '#0D8DFF80', secondary: '#0D8DFF' },
      { primary: '#B02FF780', secondary: '#B02FF7' },
    ];

    const hash = sessionId.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  // Automatically generate layers when a session is clicked
  const generateLayersForSession = async (sessionId: string) => {
    if (!onLayersGenerated) return;

    try {
      console.log('Loading events for archived session:', sessionId);
      const events = await AgentSessionService.getSessionEvents(sessionId);

      if (events && events.length > 0) {
        const readPaths = new Set<string>();
        const writePaths = new Set<string>();

        events.forEach((event: NormalizedAgentSessionEvent) => {
          const hasPaths = event.files && event.files.length > 0;

          if (hasPaths) {
            const writeTools = new Set([
              'Write',
              'write',
              'write_file',
              'writefile',
              'Edit',
              'edit',
              'edit_file',
              'editfile',
              'MultiEdit',
              'multiedit',
              'multi_edit',
              'str_replace_editor',
              'str_replace_based_edit_tool',
              'str_replace',
              'Create',
              'create',
              'Delete',
              'delete',
              'NotebookWrite',
              'NotebookEdit',
            ]);

            const isWriteOperation =
              event.toolName && writeTools.has(event.toolName);
            const targetSet = isWriteOperation ? writePaths : readPaths;

            if (event.files && event.files.length > 0) {
              event.files.forEach((file: any) => {
                // Use displayPath for UI, with safe fallback
                const pathToUse = file.displayPath || '[path not normalized]';
                if (pathToUse && pathToUse !== '[path not normalized]') {
                  targetSet.add(pathToUse);
                }
              });
            }
          }
        });

        const session = sessions.find((s) => s.sessionId === sessionId);
        const sessionName =
          session?.customName ||
          `Archived Session ${sessionId.substring(0, 8)}`;

        const readLayer: HighlightLayer | null =
          readPaths.size > 0
            ? {
                id: `archived-session-${sessionId}-read`,
                name: `${sessionName} (Reads)`,
                enabled: true,
                color: '#3b82f6',
                opacity: 0.4,
                borderWidth: 2,
                priority: 10,
                items: Array.from(readPaths).map((path) => ({
                  path,
                  type: 'file' as const,
                  renderStrategy: 'border' as const,
                })),
                dynamic: true,
              }
            : null;

        const writeLayer: HighlightLayer | null =
          writePaths.size > 0
            ? {
                id: `archived-session-${sessionId}-write`,
                name: `${sessionName} (Writes)`,
                enabled: true,
                color: '#ef4444',
                opacity: 0.6,
                borderWidth: 3,
                priority: 15,
                items: Array.from(writePaths).map((path) => ({
                  path,
                  type: 'file' as const,
                  renderStrategy: 'fill' as const,
                })),
                dynamic: true,
              }
            : null;

        console.log('Generated layers for archived session:', {
          sessionId,
          readFiles: readPaths.size,
          writeFiles: writePaths.size,
        });

        onLayersGenerated(sessionId, readLayer, writeLayer);

        setSessionLayers((prev) => {
          const newMap = new Map(prev);
          newMap.set(sessionId, {
            sessionId,
            readLayer: readLayer || undefined,
            writeLayer: writeLayer || undefined,
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error generating layers for archived session:', error);
    }
  };

  // Load archived sessions
  const loadArchivedSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all archived sessions from the archive service
      const archivedSessionsList =
        await AgentSessionArchiveService.listArchivedSessions();

      // If no archived sessions exist, return early
      if (!archivedSessionsList || archivedSessionsList.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // Create a set of all paths to check (main path + all local clones)
      const pathsToCheck = repositoryPath
        ? [repositoryPath, ...localClonePaths]
        : [];

      // Filter sessions relevant to this repository
      const relevantSessions: ArchivedSessionData[] = [];

      for (const archivedSession of archivedSessionsList) {
        // If no repository path is specified, show all archived sessions
        // Also show sessions with empty directory (legacy archived sessions)
        const isRelevant =
          pathsToCheck.length === 0 ||
          !archivedSession.directory ||
          archivedSession.directory === '' ||
          pathsToCheck.some(
            (path) =>
              path &&
              archivedSession.directory &&
              (path.startsWith(archivedSession.directory) ||
                archivedSession.directory.startsWith(path)),
          );

        if (isRelevant) {
          // Use the summary data directly without loading full session
          // The full session will be loaded when the user clicks on it
          const archivedSessionData: ArchivedSessionData = {
            sessionId: archivedSession.sessionId,
            directory: archivedSession.directory,
            workingDirectory: archivedSession.directory,
            lastActivity: archivedSession.archivedAt,
            firstAccess: archivedSession.archivedAt - 24 * 60 * 60 * 1000, // Assume 1 day old
            isActive: false, // Archived sessions are never active
            archivedAt: archivedSession.archivedAt,
            archivedReason: archivedSession.reason || 'Manual archive',
            lastEvent: {
              type: EventActivityType.READ,
              fileName: '',
              timestamp: archivedSession.archivedAt,
            },
            fileAccessCount: archivedSession.fileCount || 0,
            fileWriteCount: 0,
            toolCallCount: archivedSession.eventCount || 0,
            webAccessCount: 0,
            eventCount: archivedSession.eventCount || 0,
            customName: archivedSession.metadata?.customName,
            metadata: archivedSession.metadata,
          };

          relevantSessions.push(archivedSessionData);
        }
      }

      // Sort by archived date (newest first)
      relevantSessions.sort(
        (a, b) => (b.archivedAt || 0) - (a.archivedAt || 0),
      );
      setSessions(relevantSessions);
    } catch (error) {
      console.error('Failed to load archived sessions:', error);
      setError(
        'Failed to load archived sessions. Please check if the archive service is running.',
      );
      // If the service doesn't exist yet, provide empty list
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [repositoryPath, localClonePaths]);

  // Load sessions on mount and when paths change
  useEffect(() => {
    // Always load sessions, even with empty repository path (will show all archived sessions)
    loadArchivedSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositoryPath]); // Only reload when repository path changes

  // Filter sessions based on search and date
  const filteredSessions = sessions.filter((session) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        session.sessionId.toLowerCase().includes(query) ||
        (session.customName &&
          session.customName.toLowerCase().includes(query)) ||
        (session.workingDirectory &&
          session.workingDirectory.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Date filter
    if (dateFilter !== 'all' && session.archivedAt) {
      const now = Date.now();
      const diff = now - session.archivedAt;
      const days = diff / (24 * 60 * 60 * 1000);

      if (dateFilter === 'week' && days > 7) return false;
      if (dateFilter === 'month' && days > 30) return false;
      if (dateFilter === 'year' && days > 365) return false;
    }

    // Active filter
    if (showActiveOnly && !session.isActive) return false;

    return true;
  });

  if (loading) {
    return (
      <div
        style={{
          padding: '16px',
          color: theme.colors.textSecondary,
          textAlign: 'center',
        }}
      >
        Loading archived sessions...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: theme.colors.error,
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
        <button
          onClick={loadArchivedSessions}
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          color: theme.colors.textTertiary,
          textAlign: 'center',
        }}
      >
        <Archive size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
        <p>No archived sessions found</p>
        <p style={{ fontSize: '12px', marginTop: '8px' }}>
          Sessions will be archived automatically based on your configuration
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
      }}
    >
      {/* Search and Filter Header */}
      <div
        style={{
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.colors.text,
            }}
          >
            Archived Sessions
            <span
              style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
                marginLeft: '8px',
                fontWeight: 400,
              }}
            >
              ({filteredSessions.length} of {sessions.length})
            </span>
          </div>
          <button
            onClick={loadArchivedSessions}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 8px',
              backgroundColor: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Refresh archived sessions"
          >
            <Activity size={14} />
          </button>
        </div>

        {/* Search and Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              flex: 1,
              position: 'relative',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.colors.textTertiary,
              }}
            />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 28px',
                backgroundColor: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text,
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            style={{
              padding: '4px 8px',
              backgroundColor: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: theme.colors.text,
              fontSize: '12px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All time</option>
            <option value="week">Past week</option>
            <option value="month">Past month</option>
            <option value="year">Past year</option>
          </select>
        </div>
      </div>

      {/* Collision Indicator */}
      {selectedSessionIds.size > 1 && (
        <AgentSessionCollisionIndicator
          collisions={SessionCollisionDetector.detectCollisions(
            Array.from(sessionLayers.values()).filter((layer) =>
              selectedSessionIds.has(layer.sessionId),
            ),
          )}
          sessionNames={
            new Map(
              sessions.map((s) => [
                s.sessionId,
                s.customName ||
                  `Archived Session ${s.sessionId.substring(0, 8)}`,
              ]),
            )
          }
        />
      )}

      {/* Sessions List - Simple Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredSessions.map((session, index) => {
          const isSelected = selectedSessionId === session.sessionId;
          const timeAgo = session.archivedAt
            ? getTimeAgo(session.archivedAt)
            : 'unknown';
          const createdTimeAgo = session.firstAccess
            ? getTimeAgo(session.firstAccess)
            : 'unknown';
          const agentColors = getAgentColor(session.sessionId, index);

          return (
            <div
              key={session.sessionId}
              onClick={() => {
                if (isSelected) {
                  onSessionUnselect();
                } else {
                  onSessionSelect(session, session.directory);
                }
              }}
              style={{
                padding: '12px',
                backgroundColor: isSelected
                  ? theme.colors.backgroundHover
                  : theme.colors.backgroundTertiary,
                border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                }}
              >
                <div style={{ flex: 1 }}>
                  {/* Session ID and Name */}
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: theme.colors.text,
                      marginBottom: '4px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {session.customName ||
                      `Session ${session.sessionId.substring(0, 8)}`}
                  </div>

                  {/* Session Info */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    <div style={{ marginBottom: '2px' }}>
                      Created: {createdTimeAgo} • Archived: {timeAgo}
                    </div>
                    <div>
                      {session.eventCount || 0} events •
                      {session.fileAccessCount || 0} files accessed •
                      {session.toolCallCount || 0} tools used
                    </div>
                  </div>
                </div>

                {/* Color indicator */}
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: agentColors.secondary,
                    marginLeft: '8px',
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug Modal */}
      {debugModalSession && (
        <AgentSessionDebugModal
          sessionId={debugModalSession.sessionId}
          sessionName={
            debugModalSession.customName ||
            `Archived Session ${debugModalSession.sessionId.substring(0, 8)}`
          }
          onClose={() => setDebugModalSession(null)}
          onLoadEvents={async (sessionId) => {
            try {
              // Get normalized events from archived session
              const events =
                await AgentSessionService.getSessionEvents(sessionId);
              return events || [];
            } catch (error) {
              console.error('Error loading archived session events:', error);
              return [];
            }
          }}
          onApplyLayer={(layer) => {
            if (onLayersGenerated) {
              const match = layer.id.match(
                /archived-session-([^-]+)-(read|write)/,
              );
              if (match) {
                const [, sessionId, type] = match;
                setSessionLayers((prev) => {
                  const newMap = new Map(prev);
                  const existing = newMap.get(sessionId) || { sessionId };

                  if (type === 'read') {
                    existing.readLayer = layer;
                  } else {
                    existing.writeLayer = layer;
                  }

                  newMap.set(sessionId, existing);
                  return newMap;
                });

                if (type === 'read') {
                  onLayersGenerated(sessionId, layer, null);
                } else {
                  onLayersGenerated(sessionId, null, layer);
                }
              }
            }
          }}
        />
      )}
    </div>
  );
};
