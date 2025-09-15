import React, { useState, useMemo, useEffect } from 'react';
import { X, Clock, FileText, Wrench, ChevronDown, ChevronRight, CheckSquare, StopCircle, Settings, HelpCircle } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
import { eventSegmenter, EventSegment, SegmentationMode } from '../../services/EventSegmenterService';
import { EventSegmentView } from './EventSegmentView';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';

interface EventHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: any; // Will be EnhancedUIAgentSessionData from the parent
  sessionId: string;
}

export const EventHistoryModal: React.FC<EventHistoryModalProps> = ({
  isOpen,
  onClose,
  session,
  sessionId
}) => {
  const { theme } = useTheme();
  const [segmentationMode, setSegmentationMode] = useState<SegmentationMode>('hybrid');
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<NormalizedAgentSessionEvent[]>([]);

  // Load full event data
  useEffect(() => {
    if (isOpen && sessionId) {
      setLoading(true);
      AgentSessionService.getSessionEvents(sessionId)
        .then(loadedEvents => {
          setEvents(loadedEvents || []);
        })
        .catch(error => {
          console.error('Failed to load session events:', error);
          setEvents([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, sessionId]);

  // Segment events based on selected mode
  const segments = useMemo(() => {
    if (!events || events.length === 0) return [];
    return eventSegmenter.segmentEvents(events, segmentationMode);
  }, [events, segmentationMode]);

  // Filter segments based on search
  const filteredSegments = useMemo(() => {
    if (!searchQuery) return segments;
    
    return segments.filter(segment => {
      // Search in summary
      if (segment.summary.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true;
      }
      
      // Search in todo content
      if (segment.todoInfo?.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true;
      }
      
      // Search in file names
      const fileMatch = segment.stats.filesAccessed.some(file => 
        file.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      return fileMatch;
    });
  }, [segments, searchQuery]);

  const toggleSegment = (index: number) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSegments(newExpanded);
  };

  const expandAll = () => {
    setExpandedSegments(new Set(filteredSegments.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedSegments(new Set());
  };

  const getSegmentIcon = (type: EventSegment['type']) => {
    switch (type) {
      case 'todo':
        return <CheckSquare size={16} />;
      case 'stop':
        return <StopCircle size={16} />;
      case 'setup':
        return <Settings size={16} />;
      case 'orphaned':
        return <HelpCircle size={16} />;
      default:
        return null;
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '16px',
        width: '90vw',
        maxWidth: '1200px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: theme.shadows[2] || theme.shadows[0],
        border: `1px solid ${theme.colors.border}`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}>
              Event History
            </h2>
            <p style={{
              fontSize: '14px',
              color: theme.colors.textSecondary,
              margin: '4px 0 0 0',
            }}>
              Session: {sessionId.slice(0, 8)}... • {events.length} events
            </p>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          flexWrap: 'wrap',
        }}>
          {/* Segmentation Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{
              fontSize: '14px',
              color: theme.colors.textSecondary,
            }}>
              Group by:
            </label>
            <select
              value={segmentationMode}
              onChange={(e) => setSegmentationMode(e.target.value as SegmentationMode)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="hybrid">Hybrid (Todo + Stops)</option>
              <option value="todo">Todo Items</option>
              <option value="stop">Stop Events</option>
            </select>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: '14px',
            }}
          />

          {/* Expand/Collapse */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={expandAll}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}>
              Loading events...
            </div>
          ) : filteredSegments.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
            }}>
              {searchQuery ? 'No matching events found' : 'No events to display'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredSegments.map((segment, index) => (
                <div
                  key={index}
                  style={{
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: theme.colors.background,
                  }}
                >
                  {/* Segment Header */}
                  <div
                    onClick={() => toggleSegment(index)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      borderLeft: `4px solid ${eventSegmenter.getSegmentColor(segment.type)}`,
                      backgroundColor: expandedSegments.has(index) 
                        ? theme.colors.backgroundSecondary 
                        : theme.colors.background,
                    }}
                  >
                    {expandedSegments.has(index) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    
                    <div style={{ 
                      color: eventSegmenter.getSegmentColor(segment.type),
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {getSegmentIcon(segment.type)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: theme.colors.text,
                      }}>
                        {segment.summary}
                      </div>
                      {segment.todoInfo && (
                        <div style={{
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                          marginTop: '2px',
                        }}>
                          Status: {segment.todoInfo.status}
                        </div>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {formatDuration(segment.stats.duration)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Wrench size={12} />
                        {segment.events.length} events
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={12} />
                        {segment.stats.filesAccessed.length} files
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedSegments.has(index) && (
                    <EventSegmentView
                      segment={segment}
                      theme={theme}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}>
            Showing {filteredSegments.length} of {segments.length} segments
          </div>
          
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: theme.colors.primary,
              color: '#fff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};