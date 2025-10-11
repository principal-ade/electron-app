import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  FileText,
  Terminal,
  Globe,
  Hash,
  ChevronRight,
  Search,
  Filter,
  Activity,
  Code,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';

interface SessionEventViewerModalProps {
  sessionId: string;
  sessionName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionEventViewerModal: React.FC<
  SessionEventViewerModalProps
> = ({ sessionId, sessionName, isOpen, onClose }) => {
  const { theme } = useTheme();
  const [events, setEvents] = useState<
    RepoNormalizedUniversalAgentSessionEvent[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] =
    useState<RepoNormalizedUniversalAgentSessionEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Load events when modal opens
  useEffect(() => {
    if (isOpen && sessionId) {
      loadEvents();
    }
  }, [isOpen, sessionId]);

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
          event.paths?.primary?.displayPath,
          JSON.stringify(event.toolInput),
          JSON.stringify(event.parameters),
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
  const getEventIcon = (event: RepoNormalizedUniversalAgentSessionEvent) => {
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
  const getEventColor = (event: RepoNormalizedUniversalAgentSessionEvent) => {
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
  const getEventTitle = (event: RepoNormalizedUniversalAgentSessionEvent) => {
    if (event.toolName) {
      if (event.files && event.files.length > 0 && event.files[0].displayPath) {
        const fileName = event.files[0].displayPath.split('/').pop();
        return `${event.toolName}: ${fileName}`;
      }
      return event.toolName;
    }
    return event.eventType;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '1400px',
          height: '80%',
          backgroundColor: theme.colors.background,
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={20} color={theme.colors.primary} />
            <h2
              style={{ margin: 0, fontSize: '18px', color: theme.colors.text }}
            >
              Session Events:{' '}
              {sessionName || `Session ${sessionId.substring(0, 8)}`}
            </h2>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: theme.colors.primary + '20',
                color: theme.colors.primary,
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {events.length} events
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Panel - Event List */}
          <div
            style={{
              width: '400px',
              borderRight: `1px solid ${theme.colors.border}`,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
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
                  }}
                >
                  No events found
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
                      <ChevronRight
                        size={14}
                        color={theme.colors.textTertiary}
                      />
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
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* Basic Info */}
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
                      <div>
                        <strong>Session ID:</strong> {selectedEvent.sessionId}
                      </div>
                      <div>
                        <strong>Provider:</strong> {selectedEvent.provider}
                      </div>
                      <div>
                        <strong>Working Directory:</strong>{' '}
                        {selectedEvent.workingDirectory}
                      </div>
                      {selectedEvent.normalizedWorkingDirectory && (
                        <div>
                          <strong>Git Root:</strong>{' '}
                          {selectedEvent.normalizedWorkingDirectory}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File Paths */}
                  {selectedEvent.paths && (
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
                      {selectedEvent.files &&
                        selectedEvent.files.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <strong>Primary Path:</strong>
                            <div
                              style={{
                                padding: '8px',
                                marginTop: '4px',
                                backgroundColor: theme.colors.background,
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                wordBreak: 'break-all',
                              }}
                            >
                              {selectedEvent.files[0].displayPath ||
                                '[path not normalized]'}
                            </div>
                          </div>
                        )}
                      {selectedEvent.files &&
                        selectedEvent.files.length > 1 && (
                          <div>
                            <strong>Additional Paths:</strong>
                            {selectedEvent.files.slice(1).map((file, i) => (
                              <div
                                key={i}
                                style={{
                                  padding: '8px',
                                  marginTop: '4px',
                                  backgroundColor: theme.colors.background,
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  wordBreak: 'break-all',
                                }}
                              >
                                {file.displayPath || '[path not normalized]'}
                              </div>
                            ))}
                          </div>
                        )}
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
                        }}
                      >
                        {JSON.stringify(selectedEvent.toolInput, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Parameters */}
                  {selectedEvent.parameters && (
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
                        }}
                      >
                        {JSON.stringify(selectedEvent.parameters, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Metadata */}
                  {selectedEvent.metadata && (
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
                        }}
                      >
                        {JSON.stringify(selectedEvent.metadata, null, 2)}
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
                <Info
                  size={48}
                  style={{ marginBottom: '16px', opacity: 0.5 }}
                />
                <p>Select an event to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
