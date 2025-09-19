import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { NormalizedAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { RotateCw } from 'lucide-react';

interface NormalizedEventCardProps {
  event: NormalizedAgentSessionEvent;
  index?: number;
  showRawData?: boolean;
  compact?: boolean;
  onReprocess?: (event: NormalizedAgentSessionEvent) => void;
  layerBadges?: React.ReactNode;
}

export const NormalizedEventCard: React.FC<NormalizedEventCardProps> = ({
  event,
  index,
  showRawData = true,
  compact = false,
  onReprocess,
  layerBadges,
}) => {
  const { theme } = useTheme();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );

  // Debug logging to see what's in the event
  React.useEffect(() => {
    if (!compact && event.eventType === 'pre-tool-use') {
      console.log('Event data:', {
        eventType: event.eventType,
        toolName: event.toolName,
        hasToolInput: !!event.toolInput,
        hasToolOutput: !!event.toolOutput,
        hasRaw: !!event.raw,
        hasData: !!event.data,
        toolInput: event.toolInput,
        raw: event.raw,
      });
    }
  }, [event, compact]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'pre-tool-use':
        return '#7c3aed'; // Purple
      case 'post-tool-use':
        return '#10b981'; // Green
      case 'stop':
      case 'subagent-stop':
        return '#f59e0b'; // Amber
      case 'session-start':
        return '#3b82f6'; // Blue
      case 'notification':
        return '#06b6d4'; // Cyan
      case 'user-prompt-submit':
        return '#ec4899'; // Pink
      case 'pre-compact':
        return '#8b5cf6'; // Violet
      case 'lifecycle':
        return '#6b7280'; // Gray
      default:
        return '#6b7280'; // Gray for unknown
    }
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp || timestamp === 0 || !isFinite(timestamp)) {
      return 'No timestamp';
    }
    return new Date(timestamp).toLocaleString();
  };

  const formatPath = (path?: string) => {
    if (!path) return null;
    // Show last 2 parts of the path for brevity
    const parts = path.split('/');
    if (parts.length > 2) {
      return `.../${parts.slice(-2).join('/')}`;
    }
    return path;
  };

  const eventColor = getEventColor(event.eventType);

  if (compact) {
    // Compact mode for list views
    return (
      <div
        style={{
          padding: '6px 8px',
          borderLeft: `3px solid ${eventColor}`,
          backgroundColor: theme.colors.backgroundTertiary,
          marginBottom: '4px',
          fontSize: '11px',
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {index !== undefined && (
            <span
              style={{ color: theme.colors.textSecondary, fontSize: '10px' }}
            >
              #{index}
            </span>
          )}
          <span style={{ color: theme.colors.textSecondary, fontSize: '10px' }}>
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
          <span style={{ color: eventColor, fontWeight: 600 }}>
            {event.eventType}
          </span>
          {event.toolName && (
            <>
              <span style={{ color: theme.colors.textSecondary }}>→</span>
              <span style={{ color: '#8b5cf6', fontWeight: 500 }}>
                {event.toolName}
              </span>
            </>
          )}
          {layerBadges}
        </div>
        {event.files && event.files.length > 0 && (
          <div
            style={{
              marginTop: '4px',
              paddingLeft: '12px',
              fontSize: '10px',
              color: theme.colors.text,
              fontFamily: 'monospace',
              opacity: 0.9,
            }}
          >
            📄 {event.files[0].displayPath || '[path not normalized]'}
            {event.files.length > 1 && (
              <span
                style={{ color: theme.colors.textSecondary, marginLeft: '8px' }}
              >
                (+{event.files.length - 1} more)
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full card mode
  return (
    <div
      style={{
        marginBottom: '8px',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '4px',
        backgroundColor: theme.colors.background,
        fontFamily: 'monospace',
        fontSize: '11px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
          borderLeft: `4px solid ${eventColor}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {index !== undefined && (
            <span
              style={{ color: theme.colors.textSecondary, fontSize: '10px' }}
            >
              #{index}
            </span>
          )}
          <span style={{ color: eventColor, fontWeight: 600 }}>
            {event.eventType}
          </span>
          {event.toolName && (
            <>
              <span style={{ color: theme.colors.textSecondary }}>→</span>
              <span style={{ color: '#8b5cf6', fontWeight: 500 }}>
                {event.toolName}
              </span>
            </>
          )}
          {layerBadges}
          <span
            style={{
              marginLeft: 'auto',
              color: theme.colors.textSecondary,
              fontSize: '10px',
            }}
          >
            {formatTimestamp(event.timestamp)}
          </span>
          {onReprocess && event.raw && (
            <button
              onClick={() => onReprocess(event)}
              style={{
                padding: '2px 6px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '3px',
                color: '#10b981',
                cursor: 'pointer',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '8px',
              }}
              title="Reprocess this event"
            >
              <RotateCw size={10} />
              Test
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '8px' }}>
        {/* Session Info */}
        <div style={{ marginBottom: '6px' }}>
          <span style={{ color: theme.colors.textSecondary, fontSize: '10px' }}>
            Session:{' '}
          </span>
          <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>
            {event.sessionId.substring(0, 12)}...
          </span>
          {event.provider && (
            <>
              <span
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: '10px',
                  marginLeft: '8px',
                }}
              >
                Provider:{' '}
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                {event.provider}
              </span>
            </>
          )}
        </div>

        {/* Working Directory */}
        {event.normalizedWorkingDirectory &&
          event.normalizedWorkingDirectory !== event.workingDirectory && (
            <div style={{ marginBottom: '6px' }}>
              <span
                style={{ color: theme.colors.textSecondary, fontSize: '10px' }}
              >
                Git Root:{' '}
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                {event.normalizedWorkingDirectory}
              </span>
            </div>
          )}

        {/* Path Information - Enhanced */}
        {event.files && event.files.length > 0 && (
          <div
            style={{
              marginBottom: '8px',
              padding: '8px',
              backgroundColor: theme.colors.backgroundTertiary,
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              📁 File Paths
            </div>
            {event.files[0] && (
              <div style={{ marginBottom: '4px' }}>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#8b5cf6',
                    fontWeight: 600,
                    marginBottom: '2px',
                  }}
                >
                  Primary:
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: theme.colors.text,
                    padding: '4px 8px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '3px',
                    wordBreak: 'break-all',
                  }}
                >
                  {event.files[0].displayPath || '[path not normalized]'}
                </div>
              </div>
            )}
            {event.files.length > 1 && (
              <div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#8b5cf6',
                    fontWeight: 600,
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  Secondary ({event.files.length - 1} files):
                  <button
                    onClick={() => toggleSection('secondary-paths')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: theme.colors.textSecondary,
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '10px',
                    }}
                  >
                    {expandedSections.has('secondary-paths') ? '▼' : '▸'}
                  </button>
                </div>
                {expandedSections.has('secondary-paths') && (
                  <div
                    style={{
                      maxHeight: '150px',
                      overflowY: 'auto',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: theme.colors.text,
                      padding: '4px 8px',
                      backgroundColor: theme.colors.background,
                      borderRadius: '3px',
                    }}
                  >
                    {event.files.slice(1).map((file: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: '2px 0',
                          wordBreak: 'break-all',
                          borderBottom:
                            idx < event.files.length - 2
                              ? `1px solid ${theme.colors.border}`
                              : 'none',
                        }}
                      >
                        {file.displayPath || '[path not normalized]'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Event Data */}
        {event.data && Object.keys(event.data).length > 0 && (
          <div style={{ marginTop: '6px' }}>
            <div
              style={{
                cursor: 'pointer',
                color: '#9333ea',
                fontSize: '11px',
                fontWeight: 500,
              }}
              onClick={() => toggleSection('data')}
            >
              {expandedSections.has('data') ? '▼' : '▸'} Event Data
            </div>
            {expandedSections.has('data') && (
              <pre
                style={{
                  fontSize: '10px',
                  color: theme.colors.textSecondary,
                  marginLeft: '12px',
                  marginTop: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '150px',
                  overflowY: 'auto',
                }}
              >
                {JSON.stringify(event.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Tool Input */}
        {event.toolInput && (
          <div style={{ marginTop: '6px' }}>
            <div
              style={{
                cursor: 'pointer',
                color: '#9333ea',
                fontSize: '11px',
                fontWeight: 500,
              }}
              onClick={() => toggleSection('input')}
            >
              {expandedSections.has('input') ? '▼' : '▸'} Tool Input
            </div>
            {expandedSections.has('input') && (
              <pre
                style={{
                  fontSize: '10px',
                  color: theme.colors.textSecondary,
                  marginLeft: '12px',
                  marginTop: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '150px',
                  overflowY: 'auto',
                }}
              >
                {JSON.stringify(event.toolInput, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Tool Output */}
        {event.toolOutput && (
          <div style={{ marginTop: '6px' }}>
            <div
              style={{
                cursor: 'pointer',
                color: '#9333ea',
                fontSize: '11px',
                fontWeight: 500,
              }}
              onClick={() => toggleSection('output')}
            >
              {expandedSections.has('output') ? '▼' : '▸'} Tool Output
            </div>
            {expandedSections.has('output') && (
              <pre
                style={{
                  fontSize: '10px',
                  color: theme.colors.textSecondary,
                  marginLeft: '12px',
                  marginTop: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '150px',
                  overflowY: 'auto',
                }}
              >
                {typeof event.toolOutput === 'string'
                  ? event.toolOutput.substring(0, 500) +
                    (event.toolOutput.length > 500 ? '...' : '')
                  : JSON.stringify(event.toolOutput, null, 2).substring(
                      0,
                      500,
                    ) + '...'}
              </pre>
            )}
          </div>
        )}

        {/* Raw Data */}
        {showRawData && event.raw && (
          <div style={{ marginTop: '6px' }}>
            <div
              style={{
                cursor: 'pointer',
                color: '#9333ea',
                fontSize: '11px',
                fontWeight: 500,
              }}
              onClick={() => toggleSection('raw')}
            >
              {expandedSections.has('raw') ? '▼' : '▸'} Raw Event
            </div>
            {expandedSections.has('raw') && (
              <pre
                style={{
                  fontSize: '10px',
                  color: theme.colors.textSecondary,
                  marginLeft: '12px',
                  marginTop: '4px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: theme.colors.backgroundTertiary,
                  padding: '4px',
                  borderRadius: '2px',
                }}
              >
                {JSON.stringify(event.raw, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
