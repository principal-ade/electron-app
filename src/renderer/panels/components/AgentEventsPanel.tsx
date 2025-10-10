/**
 * AgentEventsPanel - Display incoming agent events in real-time
 *
 * This panel is for development/debugging to see what events are coming through
 * before implementing the highlight layer mapping logic.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Copy,
  Trash2,
  Filter,
  Heart,
} from 'lucide-react';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { AgentSessionSDKService } from '../../main-process-api/AgentSessionSDKService';

export interface AgentEventsPanelProps {
  repositoryPath?: string | null;
  maxEvents?: number;
}

interface EventEntry {
  event: RepoNormalizedUniversalAgentSessionEvent;
  timestamp: number;
  localIndex: number;
}

export const AgentEventsPanel: React.FC<AgentEventsPanelProps> = ({
  repositoryPath,
  maxEvents = 100,
}) => {
  const { theme } = useTheme();
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [filterByRepo, setFilterByRepo] = useState(true);
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(
    new Set(),
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const [healthStatus, setHealthStatus] = useState<
    'checking' | 'healthy' | 'unhealthy' | 'unknown' | null
  >(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Listen for processed events
  useEffect(() => {
    let eventCounter = 0;

    console.log(
      '[AgentEventsPanel] Setting up event listener, repositoryPath:',
      repositoryPath,
    );

    const unsubscribe = AgentSessionSDKService.onProcessedEvent((event) => {
      console.log('[AgentEventsPanel] Received event:', event.eventType, event);

      // Filter by repository if enabled
      if (filterByRepo && repositoryPath) {
        const eventRepoPath =
          event.repositoryInfo?.root || event.workingDirectory;
        console.log(
          '[AgentEventsPanel] Filtering - eventRepoPath:',
          eventRepoPath,
          'current:',
          repositoryPath,
        );
        if (eventRepoPath !== repositoryPath) {
          console.log(
            '[AgentEventsPanel] Event filtered out - different repository',
          );
          return;
        }
      }

      // Add event to list
      setEvents((prev) => {
        const newEntry: EventEntry = {
          event,
          timestamp: Date.now(),
          localIndex: eventCounter++,
        };

        const updated = [...prev, newEntry];

        // Keep only last N events (circular buffer)
        if (updated.length > maxEvents) {
          return updated.slice(-maxEvents);
        }

        return updated;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [repositoryPath, filterByRepo, maxEvents]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll) {
      const container = document.getElementById('events-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [events, autoScroll]);

  // Get unique event types for filtering
  const availableEventTypes = useMemo(() => {
    const types = new Set<string>();
    events.forEach((entry) => types.add(entry.event.eventType));
    return Array.from(types).sort();
  }, [events]);

  // Filtered events based on selected types
  const filteredEvents = useMemo(() => {
    if (selectedEventTypes.size === 0) {
      return events;
    }
    return events.filter((entry) =>
      selectedEventTypes.has(entry.event.eventType),
    );
  }, [events, selectedEventTypes]);

  const toggleExpanded = useCallback((index: number) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const copyToClipboard = useCallback(
    (event: RepoNormalizedUniversalAgentSessionEvent) => {
      navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    },
    [],
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
    setExpandedEvents(new Set());
  }, []);

  const toggleEventTypeFilter = useCallback((eventType: string) => {
    setSelectedEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(eventType)) {
        next.delete(eventType);
      } else {
        next.add(eventType);
      }
      return next;
    });
  }, []);

  const checkEventServerHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const result = await AgentSessionSDKService.checkEventServerHealth();
      setHealthStatus(result.healthStatus || 'unknown');
    } catch (error) {
      console.error('Failed to check event server health:', error);
      setHealthStatus('unknown');
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  const getEventColor = (eventType: string): string => {
    const colorMap: Record<string, string> = {
      file_read: '#3b82f6', // Blue
      file_write: '#22c55e', // Green
      file_edit: '#f59e0b', // Amber
      tool_use: '#8b5cf6', // Purple
      error: '#ef4444', // Red
      session_start: '#10b981', // Emerald
      session_end: '#6366f1', // Indigo
    };
    return colorMap[eventType] || '#6b7280'; // Gray default
  };

  const extractFilePaths = (
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): string[] => {
    const paths: string[] = [];

    switch (event.eventType) {
      case 'file_read':
      case 'file_write':
      case 'file_edit':
        if (event.data?.path) {
          paths.push(event.data.path);
        }
        break;
      case 'tool_use':
        if (event.data?.parameters) {
          const params = event.data.parameters as any;
          if (params.file_path) paths.push(params.file_path);
          if (params.path) paths.push(params.path);
          if (params.paths && Array.isArray(params.paths)) {
            paths.push(...params.paths);
          }
        }
        break;
    }

    return paths;
  };

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
          padding: '4px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} style={{ color: theme.colors.primary }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            Agent Events
          </span>
          <span
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              backgroundColor: theme.colors.background,
              padding: '2px 8px',
              borderRadius: '4px',
            }}
          >
            {filteredEvents.length}{' '}
            {filteredEvents.length === maxEvents ? `(max)` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Health check button */}
          <button
            onClick={checkEventServerHealth}
            disabled={isCheckingHealth}
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              backgroundColor:
                healthStatus === 'healthy'
                  ? theme.colors.success
                  : healthStatus === 'unhealthy'
                    ? theme.colors.warning
                    : healthStatus === 'checking'
                      ? theme.colors.primary
                      : 'transparent',
              color:
                healthStatus === 'healthy' ||
                healthStatus === 'unhealthy' ||
                healthStatus === 'checking'
                  ? '#fff'
                  : theme.colors.text,
              border: `1px solid ${
                healthStatus === 'healthy'
                  ? theme.colors.success
                  : healthStatus === 'unhealthy'
                    ? theme.colors.warning
                    : healthStatus === 'checking'
                      ? theme.colors.primary
                      : theme.colors.border
              }`,
              borderRadius: '4px',
              cursor: isCheckingHealth ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: isCheckingHealth ? 0.7 : 1,
            }}
            title={
              healthStatus === 'healthy'
                ? 'Event server is healthy'
                : healthStatus === 'unhealthy'
                  ? 'Event server is unhealthy'
                  : healthStatus === 'checking'
                    ? 'Checking server health...'
                    : 'Check event server health'
            }
          >
            <Heart size={12} />
            {isCheckingHealth
              ? 'Checking...'
              : healthStatus === 'healthy'
                ? 'Healthy'
                : healthStatus === 'unhealthy'
                  ? 'Unhealthy'
                  : 'Check Health'}
          </button>

          {/* Filter by repo toggle */}
          <button
            onClick={() => setFilterByRepo(!filterByRepo)}
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              backgroundColor: filterByRepo
                ? theme.colors.primary
                : 'transparent',
              color: filterByRepo ? '#fff' : theme.colors.text,
              border: `1px solid ${filterByRepo ? theme.colors.primary : theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={
              filterByRepo ? 'Filtering by repository' : 'Show all repositories'
            }
          >
            <Filter size={12} />
            {filterByRepo ? 'Filtered' : 'All Repos'}
          </button>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              backgroundColor: autoScroll
                ? theme.colors.success
                : 'transparent',
              color: autoScroll ? '#fff' : theme.colors.text,
              border: `1px solid ${autoScroll ? theme.colors.success : theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            {autoScroll ? 'Auto' : 'Manual'}
          </button>

          {/* Clear button */}
          <button
            onClick={clearEvents}
            disabled={events.length === 0}
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              color:
                events.length === 0
                  ? theme.colors.textSecondary
                  : theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: events.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: events.length === 0 ? 0.5 : 1,
            }}
            title="Clear all events"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Event type filters */}
      {availableEventTypes.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          {availableEventTypes.map((eventType) => (
            <button
              key={eventType}
              onClick={() => toggleEventTypeFilter(eventType)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor:
                  selectedEventTypes.has(eventType) ||
                  selectedEventTypes.size === 0
                    ? getEventColor(eventType)
                    : 'transparent',
                color:
                  selectedEventTypes.has(eventType) ||
                  selectedEventTypes.size === 0
                    ? '#fff'
                    : theme.colors.textSecondary,
                border: `1px solid ${getEventColor(eventType)}`,
                borderRadius: '12px',
                cursor: 'pointer',
                opacity:
                  selectedEventTypes.size === 0 ||
                  selectedEventTypes.has(eventType)
                    ? 1
                    : 0.5,
              }}
            >
              {eventType}
            </button>
          ))}
        </div>
      )}

      {/* Events list */}
      <div
        id="events-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
        }}
      >
        {filteredEvents.length === 0 ? (
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
            <div style={{ fontSize: '14px' }}>
              {events.length === 0
                ? 'No events received yet'
                : 'No events match the filter'}
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {filterByRepo && repositoryPath
                ? `Listening for events in ${repositoryPath}`
                : 'Listening for events from all repositories'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredEvents.map((entry) => {
              const isExpanded = expandedEvents.has(entry.localIndex);
              const filePaths = extractFilePaths(entry.event);
              const eventColor = getEventColor(entry.event.eventType);

              return (
                <div
                  key={entry.localIndex}
                  style={{
                    backgroundColor: theme.colors.background,
                    border: `1px solid ${theme.colors.border}`,
                    borderLeft: `3px solid ${eventColor}`,
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Event summary */}
                  <div
                    onClick={() => toggleExpanded(entry.localIndex)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                      {isExpanded ? (
                        <ChevronDown
                          size={16}
                          style={{ color: theme.colors.textSecondary }}
                        />
                      ) : (
                        <ChevronRight
                          size={16}
                          style={{ color: theme.colors.textSecondary }}
                        />
                      )}
                    </div>

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
                            fontSize: '11px',
                            fontWeight: 600,
                            color: eventColor,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {entry.event.eventType}
                        </span>
                        {entry.event.toolName && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: theme.colors.text,
                              backgroundColor: theme.colors.backgroundSecondary,
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontWeight: 500,
                            }}
                          >
                            {entry.event.toolName}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {entry.event.provider}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {filePaths.length > 0 && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: theme.colors.text,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          📄 {filePaths[0]}
                          {filePaths.length > 1 && (
                            <span style={{ color: theme.colors.textSecondary }}>
                              {' '}
                              +{filePaths.length - 1} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(entry.event);
                      }}
                      style={{
                        padding: '4px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: theme.colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Copy to clipboard"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '12px',
                        borderTop: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        fontSize: '12px',
                      }}
                    >
                      {/* Session info */}
                      <div style={{ marginBottom: '12px' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            marginBottom: '4px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          Session
                        </div>
                        <div
                          style={{ fontFamily: 'monospace', fontSize: '11px' }}
                        >
                          {entry.event.sessionId}
                        </div>
                      </div>

                      {/* Repository info */}
                      {entry.event.repositoryInfo && (
                        <div style={{ marginBottom: '12px' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: '4px',
                              color: theme.colors.textSecondary,
                            }}
                          >
                            Repository
                          </div>
                          <div style={{ fontSize: '11px' }}>
                            <div>
                              📦 {entry.event.repositoryInfo.owner}/
                              {entry.event.repositoryInfo.repo}
                            </div>
                            <div style={{ color: theme.colors.textSecondary }}>
                              📂 {entry.event.repositoryInfo.root}
                            </div>
                            <div style={{ color: theme.colors.textSecondary }}>
                              🌿{' '}
                              {entry.event.repositoryInfo.branch || 'unknown'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* File paths */}
                      {filePaths.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: '4px',
                              color: theme.colors.textSecondary,
                            }}
                          >
                            Files ({filePaths.length})
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                            }}
                          >
                            {filePaths.map((path, idx) => (
                              <div
                                key={idx}
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  color: theme.colors.text,
                                  padding: '2px 6px',
                                  backgroundColor: theme.colors.background,
                                  borderRadius: '3px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={path}
                              >
                                {path}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Full event JSON */}
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            marginBottom: '4px',
                            color: theme.colors.textSecondary,
                          }}
                        >
                          Complete Event JSON
                        </div>
                        <pre
                          style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            backgroundColor: theme.colors.background,
                            padding: '8px',
                            borderRadius: '4px',
                            overflow: 'auto',
                            maxHeight: '400px',
                            margin: 0,
                            color: theme.colors.text,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {JSON.stringify(entry.event, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
