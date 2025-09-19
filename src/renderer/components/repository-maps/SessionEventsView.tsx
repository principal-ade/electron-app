import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  FileText,
  Terminal,
  Globe,
  Hash,
  ChevronRight,
  Search,
  Activity,
  AlertCircle,
  CheckCircle,
  Info,
  Code,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
// Type alias for backward compatibility
type NormalizedAgentSessionEvent = RepoNormalizedUniversalAgentSessionEvent;
import { AgentSessionService } from '../../main-process-api/AgentSessionService';

interface SessionEventsViewProps {
  sessionId: string;
  sessionName?: string;
}

export const SessionEventsView: React.FC<SessionEventsViewProps> = ({
  sessionId,
  sessionName,
}) => {
  const { theme } = useTheme();
  const [events, setEvents] = useState<NormalizedAgentSessionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] =
    useState<NormalizedAgentSessionEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, [sessionId]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const sessionEvents =
        await AgentSessionService.getSessionEvents(sessionId);
      if (sessionEvents) {
        setEvents(sessionEvents);
        // Auto-select first event
        if (sessionEvents.length > 0) {
          setSelectedEvent(sessionEvents[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load session events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on search and type
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter((event) => {
        switch (filterType) {
          case 'tool':
            return (
              event.eventType === 'pre-tool-use' ||
              event.eventType === 'post-tool-use'
            );
          case 'file':
            return (
              event.toolName &&
              ['Read', 'Write', 'Edit', 'MultiEdit'].includes(event.toolName)
            );
          case 'web':
            return (
              event.toolName &&
              ['WebFetch', 'WebSearch'].includes(event.toolName)
            );
          case 'bash':
            return event.toolName === 'Bash';
          case 'todo':
            return event.toolName === 'TodoWrite';
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) => {
        const searchableText = [
          event.eventType,
          event.toolName,
          event.files?.[0]?.relativePath || event.files?.[0]?.absolutePath,
          JSON.stringify(event.toolInput),
          JSON.stringify(event.data),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    return filtered;
  }, [events, searchQuery, filterType]);

  // Get event icon based on type
  const getEventIcon = (event: NormalizedAgentSessionEvent) => {
    if (event.toolName) {
      if (['Read', 'Write', 'Edit', 'MultiEdit'].includes(event.toolName)) {
        return <FileText size={14} />;
      }
      if (event.toolName === 'Bash') {
        return <Terminal size={14} />;
      }
      if (['WebFetch', 'WebSearch'].includes(event.toolName)) {
        return <Globe size={14} />;
      }
      if (event.toolName === 'TodoWrite') {
        return <CheckCircle size={14} />;
      }
    }

    if (event.eventType === 'session-start') {
      return <Activity size={14} color={theme.colors.success} />;
    }
    if (event.eventType === 'stop') {
      return <AlertCircle size={14} color={theme.colors.error} />;
    }

    return <Hash size={14} />;
  };

  // Get event color based on type
  const getEventColor = (event: NormalizedAgentSessionEvent) => {
    if (event.eventType === 'pre-tool-use') return theme.colors.primary;
    if (event.eventType === 'post-tool-use') return theme.colors.success;
    if (event.eventType === 'stop') return theme.colors.error;
    if (event.eventType === 'notification') return theme.colors.warning;
    return theme.colors.textSecondary;
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Format event title
  const getEventTitle = (event: NormalizedAgentSessionEvent) => {
    if (event.toolName) {
      if (event.files && event.files.length > 0 && event.files[0].displayPath) {
        const fileName = event.files[0].displayPath.split('/').pop();
        return `${event.toolName}: ${fileName}`;
      }
      return event.toolName;
    }
    return event.eventType;
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Left Panel - Event List */}
      <div
        style={{
          width: '350px',
          borderRight: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        {/* Header with count */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              Session Events
            </h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: theme.colors.primary + '20',
                color: theme.colors.primary,
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {events.length}
            </span>
          </div>
        </div>

        {/* Search and Filter */}
        <div
          style={{
            padding: '12px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: theme.colors.background,
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <Search size={16} color={theme.colors.textSecondary} />
            <input
              type="text"
              placeholder="Search events..."
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

          {/* Filter Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              marginTop: '8px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { value: 'all', label: 'All' },
              { value: 'tool', label: 'Tools' },
              { value: 'file', label: 'Files' },
              { value: 'bash', label: 'Bash' },
              { value: 'web', label: 'Web' },
              { value: 'todo', label: 'Todos' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterType(filter.value)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor:
                    filterType === filter.value
                      ? theme.colors.primary
                      : theme.colors.background,
                  color:
                    filterType === filter.value
                      ? '#fff'
                      : theme.colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 500,
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Event List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '13px',
              }}
            >
              Loading events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '13px',
              }}
            >
              {searchQuery || filterType !== 'all'
                ? 'No matching events found'
                : 'No events recorded for this session'}
            </div>
          ) : (
            filteredEvents.map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                onClick={() => setSelectedEvent(event)}
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${theme.colors.border}`,
                  cursor: 'pointer',
                  backgroundColor:
                    selectedEvent === event
                      ? theme.colors.primary + '15'
                      : 'transparent',
                  transition: 'background-color 0.2s',
                  borderLeft:
                    selectedEvent === event
                      ? `3px solid ${theme.colors.primary}`
                      : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (selectedEvent !== event) {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.background;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEvent !== event) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  {getEventIcon(event)}
                  <span
                    style={{
                      flex: 1,
                      fontSize: '13px',
                      fontWeight: 500,
                      color: getEventColor(event),
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getEventTitle(event)}
                  </span>
                  <ChevronRight size={14} color={theme.colors.textTertiary} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11px',
                    color: theme.colors.textTertiary,
                  }}
                >
                  <Clock size={10} />
                  {formatTime(event.timestamp)}
                  {event.eventType && (
                    <>
                      <span>•</span>
                      <span
                        style={{
                          padding: '1px 4px',
                          borderRadius: '3px',
                          backgroundColor: theme.colors.backgroundTertiary,
                          fontSize: '10px',
                        }}
                      >
                        {event.eventType}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Event Details */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {selectedEvent ? (
          <div>
            {/* Event Header */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: getEventColor(selectedEvent) + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getEventIcon(selectedEvent)}
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      color: theme.colors.text,
                    }}
                  >
                    {getEventTitle(selectedEvent)}
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {selectedEvent.eventType}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textTertiary,
                      }}
                    >
                      {new Date(selectedEvent.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Details Sections */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Basic Info */}
              {(selectedEvent.sessionId ||
                selectedEvent.provider ||
                selectedEvent.workingDirectory) && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Info size={12} />
                    Basic Information
                  </h4>
                  <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                    {selectedEvent.sessionId && (
                      <div>
                        <strong>Session ID:</strong> {selectedEvent.sessionId}
                      </div>
                    )}
                    {selectedEvent.provider && (
                      <div>
                        <strong>Provider:</strong> {selectedEvent.provider}
                      </div>
                    )}
                    {selectedEvent.workingDirectory && (
                      <div>
                        <strong>Working Directory:</strong>{' '}
                        {selectedEvent.workingDirectory}
                      </div>
                    )}
                    {selectedEvent.normalizedWorkingDirectory && (
                      <div>
                        <strong>Git Root:</strong>{' '}
                        {selectedEvent.normalizedWorkingDirectory}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* File Paths */}
              {selectedEvent.files && selectedEvent.files.length > 0 && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FileText size={12} />
                    File Paths
                  </h4>
                  {selectedEvent.files.map((file, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px',
                        marginTop: i > 0 ? '4px' : '0',
                        backgroundColor: theme.colors.background,
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {file.displayPath ||
                        file.originalPath ||
                        '[path not normalized]'}
                    </div>
                  ))}
                </div>
              )}

              {/* Tool Input */}
              {selectedEvent.toolInput && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: theme.colors.backgroundSecondary,
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Code size={12} />
                    Tool Input
                  </h4>
                  <pre
                    style={{
                      margin: 0,
                      padding: '12px',
                      backgroundColor: theme.colors.background,
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                      maxHeight: '300px',
                      color: theme.colors.text,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {JSON.stringify(selectedEvent.toolInput, null, 2)}
                  </pre>
                </div>
              )}

              {/* Parameters */}
              {selectedEvent.data &&
                Object.keys(selectedEvent.data).length > 0 && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: '8px',
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <h4
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Parameters
                    </h4>
                    <pre
                      style={{
                        margin: 0,
                        padding: '12px',
                        backgroundColor: theme.colors.background,
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '300px',
                        color: theme.colors.text,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(selectedEvent.data, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Metadata */}
              {selectedEvent.raw &&
                typeof selectedEvent.raw === 'object' &&
                Object.keys(selectedEvent.raw).length > 0 && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: theme.colors.backgroundSecondary,
                      borderRadius: '8px',
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <h4
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: '13px',
                        color: theme.colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Metadata
                    </h4>
                    <pre
                      style={{
                        margin: 0,
                        padding: '12px',
                        backgroundColor: theme.colors.background,
                        borderRadius: '4px',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '200px',
                        color: theme.colors.text,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(selectedEvent.raw, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}
          >
            <Info size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ fontSize: '14px' }}>Select an event to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};
