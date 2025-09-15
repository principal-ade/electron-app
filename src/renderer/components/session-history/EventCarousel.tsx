import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Layers,
  Filter,
  Clock,
  Wrench,
  FileText,
  Search,
  Globe,
  Terminal,
  CheckSquare,
} from 'lucide-react';
import { useTheme } from 'themed-markdown';

// Types
interface GroupedEvent {
  id: string;
  type: 'single' | 'paired';
  preEvent?: NormalizedAgentSessionEvent;
  postEvent?: NormalizedAgentSessionEvent;
  event?: NormalizedAgentSessionEvent; // For single events
  timestamp: number;
  toolName: string;
  fileCount: number;
  files: string[];
  duration?: number; // Time between pre and post
}

interface EventCarouselProps {
  events: NormalizedAgentSessionEvent[];
  onEventSelect: (event: GroupedEvent, files: string[]) => void;
  onHighlightModeChange?: (mode: 'single' | 'trail' | 'cumulative') => void;
  className?: string;
}

// Helper Functions
const getToolIcon = (toolName: string) => {
  const iconProps = { size: 14 };
  
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
      return <FileText {...iconProps} />;
    case 'Grep':
    case 'Glob':
      return <Search {...iconProps} />;
    case 'Bash':
      return <Terminal {...iconProps} />;
    case 'WebFetch':
    case 'WebSearch':
      return <Globe {...iconProps} />;
    case 'TodoWrite':
      return <CheckSquare {...iconProps} />;
    default:
      return <Wrench {...iconProps} />;
  }
};

const groupEvents = (events: NormalizedAgentSessionEvent[]): GroupedEvent[] => {
  const grouped: GroupedEvent[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < events.length; i++) {
    if (processedIndices.has(i)) continue;

    const event = events[i];
    
    // Check if this is a pre-tool-use event
    if (event.eventType === 'pre-tool-use' && event.toolName) {
      // Look for matching post-tool-use event
      let postEvent: NormalizedAgentSessionEvent | undefined;
      
      // Search within next 5 events for matching post event
      for (let j = i + 1; j < Math.min(i + 5, events.length); j++) {
        const candidate = events[j];
        if (
          candidate.eventType === 'post-tool-use' && 
          candidate.toolName === event.toolName &&
          !processedIndices.has(j)
        ) {
          postEvent = candidate;
          processedIndices.add(j);
          break;
        }
      }

      if (postEvent) {
        // Create paired event - only use displayPath (relative to git root)
        const files = [
          ...(event.files?.map(f => f.displayPath || '[path not normalized]') || []),
          ...(postEvent.files?.map(f => f.displayPath || '[path not normalized]') || [])
        ];
        
        grouped.push({
          id: `${event.sessionId}-${i}`,
          type: 'paired',
          preEvent: event,
          postEvent,
          timestamp: event.timestamp,
          toolName: event.toolName,
          fileCount: files.length,
          files: [...new Set(files)], // Dedupe
          duration: postEvent.timestamp - event.timestamp
        });
      } else {
        // Single pre event
        grouped.push({
          id: `${event.sessionId}-${i}`,
          type: 'single',
          event,
          timestamp: event.timestamp,
          toolName: event.toolName || 'Unknown',
          fileCount: event.files?.length || 0,
          files: event.files?.map(f => f.displayPath || '[path not normalized]') || []
        });
      }
      
      processedIndices.add(i);
    } else if (event.eventType === 'post-tool-use' && !processedIndices.has(i)) {
      // Orphaned post event
      grouped.push({
        id: `${event.sessionId}-${i}`,
        type: 'single',
        event,
        timestamp: event.timestamp,
        toolName: event.toolName || 'Unknown',
        fileCount: event.files?.length || 0,
        files: event.files?.map(f => f.displayPath || '[path not normalized]') || []
      });
      processedIndices.add(i);
    } else if (!processedIndices.has(i) && event.toolName) {
      // Other tool events
      grouped.push({
        id: `${event.sessionId}-${i}`,
        type: 'single',
        event,
        timestamp: event.timestamp,
        toolName: event.toolName,
        fileCount: event.files?.length || 0,
        files: event.files?.map(f => f.displayPath || '[path not normalized]') || []
      });
      processedIndices.add(i);
    }
  }

  return grouped;
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

const formatTimestamp = (ts: number): string => {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Main Component
export const EventCarousel: React.FC<EventCarouselProps> = ({
  events,
  onEventSelect,
  onHighlightModeChange,
  className
}) => {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per event
  const [filterMode, setFilterMode] = useState<'all' | 'reads' | 'writes' | 'todos'>('all');
  const [highlightMode, setHighlightMode] = useState<'single' | 'trail' | 'cumulative'>('single');

  // Group events
  const groupedEvents = useMemo(() => groupEvents(events), [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filterMode === 'all') return groupedEvents;
    
    return groupedEvents.filter(g => {
      switch (filterMode) {
        case 'reads':
          return g.toolName === 'Read' || g.toolName === 'Grep' || g.toolName === 'Glob';
        case 'writes':
          return g.toolName === 'Write' || g.toolName === 'Edit' || g.toolName === 'MultiEdit';
        case 'todos':
          return g.toolName === 'TodoWrite';
        default:
          return true;
      }
    });
  }, [groupedEvents, filterMode]);

  // Playback effect with auto-scroll
  useEffect(() => {
    if (!isPlaying || filteredEvents.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= filteredEvents.length) {
          setIsPlaying(false);
          return prev;
        }
        
        // Auto-scroll the carousel to keep current event visible
        const eventElement = document.getElementById(`event-card-${next}`);
        if (eventElement) {
          eventElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
          });
        }
        
        return next;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, filteredEvents.length]);

  // Handle event selection
  useEffect(() => {
    if (filteredEvents.length > 0 && currentIndex < filteredEvents.length) {
      const event = filteredEvents[currentIndex];
      onEventSelect(event, event.files);
    }
  }, [currentIndex, filteredEvents, onEventSelect]);

  // Handle highlight mode change
  const handleHighlightModeChange = useCallback((mode: typeof highlightMode) => {
    setHighlightMode(mode);
    onHighlightModeChange?.(mode);
  }, [onHighlightModeChange]);

  // Navigation
  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(filteredEvents.length - 1, prev + 1));
  }, [filteredEvents.length]);

  const goToFirst = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const goToLast = useCallback(() => {
    setCurrentIndex(filteredEvents.length - 1);
  }, [filteredEvents.length]);

  if (events.length === 0) {
    return (
      <div className={className} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        background: theme.colors.surface || theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: theme.colors.textSecondary,
          paddingTop: '8px',
          borderTop: `1px solid ${theme.colors.border}`
        }}>
          No events to display
        </div>
      </div>
    );
  }

  const currentEvent = filteredEvents[currentIndex];

  // Style helpers
  const buttonStyle = (active?: boolean) => ({
    padding: '6px',
    borderRadius: '4px',
    border: `1px solid ${theme.colors.border}`,
    background: active ? theme.colors.primary : theme.colors.background,
    color: active ? theme.colors.background : theme.colors.text,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  });

  const filterButtonStyle = (active?: boolean) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    border: `1px solid ${theme.colors.border}`,
    background: active ? theme.colors.primary : theme.colors.background,
    color: active ? theme.colors.background : theme.colors.text,
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease'
  });

  const eventCardStyle = (active?: boolean, type?: 'single' | 'paired') => ({
    flexShrink: 0,
    padding: '8px 12px',
    borderRadius: '6px',
    border: `2px solid ${active ? theme.colors.primary : theme.colors.border}`,
    background: active ? (theme.colors.primaryLight || theme.colors.primary + '20') : theme.colors.background,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '120px',
    position: 'relative' as const
  });

  return (
    <div className={className} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      background: theme.colors.surface || theme.colors.backgroundSecondary,
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`
    }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Playback Controls Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {/* Core Playback */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <button onClick={goToFirst} disabled={currentIndex === 0} style={{...buttonStyle(), opacity: currentIndex === 0 ? 0.5 : 1, padding: '4px'}}>
              <SkipBack size={14} />
            </button>
            <button onClick={goToPrevious} disabled={currentIndex === 0} style={{...buttonStyle(), opacity: currentIndex === 0 ? 0.5 : 1, padding: '4px'}}>
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setIsPlaying(!isPlaying)} style={{...buttonStyle(isPlaying), padding: '6px'}}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button onClick={goToNext} disabled={currentIndex >= filteredEvents.length - 1} style={{...buttonStyle(), opacity: currentIndex >= filteredEvents.length - 1 ? 0.5 : 1, padding: '4px'}}>
              <ChevronRight size={14} />
            </button>
            <button onClick={goToLast} disabled={currentIndex >= filteredEvents.length - 1} style={{...buttonStyle(), opacity: currentIndex >= filteredEvents.length - 1 ? 0.5 : 1, padding: '4px'}}>
              <SkipForward size={14} />
            </button>
            <select 
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              style={{
                padding: '2px 4px',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.background,
                color: theme.colors.text,
                fontSize: '11px'
              }}
            >
              <option value="500">2x</option>
              <option value="1000">1x</option>
              <option value="2000">0.5x</option>
              <option value="3000">0.3x</option>
            </select>
          </div>

          {/* Highlight Mode */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <button 
              onClick={() => handleHighlightModeChange('single')} 
              style={{...filterButtonStyle(highlightMode === 'single'), padding: '3px 6px'}}
              title="Highlight current event only"
            >
              <Layers size={11} />
            </button>
            <button 
              onClick={() => handleHighlightModeChange('trail')} 
              style={{...filterButtonStyle(highlightMode === 'trail'), padding: '3px 6px', fontSize: '11px'}}
              title="Show trail of recent events"
            >
              Trail
            </button>
            <button 
              onClick={() => handleHighlightModeChange('cumulative')} 
              style={{...filterButtonStyle(highlightMode === 'cumulative'), padding: '3px 6px', fontSize: '11px'}}
              title="Show all accessed files"
            >
              All
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <button onClick={() => setFilterMode('all')} style={{...filterButtonStyle(filterMode === 'all'), padding: '3px 8px', fontSize: '11px'}}>
            All
          </button>
          <button onClick={() => setFilterMode('reads')} style={{...filterButtonStyle(filterMode === 'reads'), padding: '3px 8px', fontSize: '11px'}}>
            <FileText size={11} /> Reads
          </button>
          <button onClick={() => setFilterMode('writes')} style={{...filterButtonStyle(filterMode === 'writes'), padding: '3px 8px', fontSize: '11px'}}>
            <FileText size={11} /> Writes
          </button>
          <button onClick={() => setFilterMode('todos')} style={{...filterButtonStyle(filterMode === 'todos'), padding: '3px 8px', fontSize: '11px'}}>
            <CheckSquare size={11} /> Todos
          </button>
        </div>
      </div>

      {/* Event Strip */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <button 
          onClick={goToPrevious} 
          disabled={currentIndex === 0}
          style={{
            padding: '4px',
            borderRadius: '4px',
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.background,
            color: theme.colors.text,
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            opacity: currentIndex === 0 ? 0.3 : 1
          }}
        >
          <ChevronLeft size={16} />
        </button>
        
        <div style={{
          flex: 1,
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          padding: '8px 0',
          scrollBehavior: 'smooth'
        }}>
          {filteredEvents.map((event, index) => (
            <div
              key={event.id}
              id={`event-card-${index}`}
              onClick={() => setCurrentIndex(index)}
              style={eventCardStyle(index === currentIndex, event.type)}
              onMouseEnter={(e) => {
                if (index !== currentIndex) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              {event.type === 'paired' && (
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '8px',
                  height: '8px',
                  background: theme.colors.success || '#10b981',
                  borderRadius: '50%'
                }} />
              )}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px'
              }}>
                {getToolIcon(event.toolName)}
                <span>{event.toolName}</span>
              </div>
              <div style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {event.type === 'paired' && event.duration && (
                  <div>{formatDuration(event.duration)}</div>
                )}
                {formatTimestamp(event.timestamp)}
              </div>
              {event.fileCount > 0 && (
                <div style={{
                  fontSize: '10px',
                  color: theme.colors.textTertiary || theme.colors.textSecondary,
                  marginTop: '2px'
                }}>
                  {event.fileCount} file{event.fileCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          ))}
        </div>

        <button 
          onClick={goToNext} 
          disabled={currentIndex >= filteredEvents.length - 1}
          style={{
            padding: '4px',
            borderRadius: '4px',
            border: `1px solid ${theme.colors.border}`,
            background: theme.colors.background,
            color: theme.colors.text,
            cursor: currentIndex >= filteredEvents.length - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            opacity: currentIndex >= filteredEvents.length - 1 ? 0.3 : 1
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* File Paths Display */}
      {currentEvent && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: theme.colors.backgroundSecondary,
          borderRadius: '4px',
          border: `1px solid ${theme.colors.border}`,
          maxHeight: '120px',
          overflowY: 'auto'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: theme.colors.textSecondary,
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <FileText size={12} />
            Files Affected ({currentEvent.files.length}):
          </div>
          {currentEvent.files.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              {currentEvent.files.map((file, idx) => (
                <div key={idx} style={{
                  fontSize: '11px',
                  color: theme.colors.text,
                  fontFamily: 'monospace',
                  padding: '2px 4px',
                  background: theme.colors.background,
                  borderRadius: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {file}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              fontSize: '11px',
              color: theme.colors.textTertiary || theme.colors.textSecondary,
              fontStyle: 'italic',
              padding: '4px'
            }}>
              No files affected by this event
            </div>
          )}
        </div>
      )}

      {/* Status Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: theme.colors.textSecondary,
        paddingTop: '8px',
        borderTop: `1px solid ${theme.colors.border}`
      }}>
        <div>
          Event {currentIndex + 1} of {filteredEvents.length} 
          {filterMode !== 'all' && ` (filtered: ${filterMode})`}
        </div>
        {currentEvent && (
          <div>
            {currentEvent.type === 'paired' ? 'Pre→Post' : 'Single'} • 
            {currentEvent.toolName} • 
            {currentEvent.fileCount > 0 && `${currentEvent.fileCount} files`}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCarousel;