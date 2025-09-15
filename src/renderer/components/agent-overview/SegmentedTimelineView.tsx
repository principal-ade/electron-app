import React, { useState, useEffect } from 'react';
import { useTheme } from 'themed-markdown';
import {
  FileText,
  Wrench,
  Globe,
  FileText as SummaryIcon,
  List,
} from 'lucide-react';
import { ActiveSegmentTimeline } from './ActiveSegmentTimeline';
import { SegmentSummary } from './SegmentSummary';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';
import type { SessionSummary } from '../../services/ai/SessionSummaryService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { aiService } from '../../main-process-api/AIService';

interface SegmentedTimelineViewProps {
  session: AgentSessionRecord;
  newEventIds: Set<string>;
  segmentEventsByStops: (session: AgentSessionRecord) => any[];
}

export const SegmentedTimelineView: React.FC<SegmentedTimelineViewProps> = ({
  session,
  newEventIds,
  segmentEventsByStops,
}) => {
  const { theme } = useTheme();
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const segments = segmentEventsByStops(session);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline' | 'summary'>('timeline');
  const [segmentSummaries, setSegmentSummaries] = useState<
    Record<string, SessionSummary>
  >({});
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Load user preferences and check available models
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await aiService.checkOllamaStatus();
        if (response && response.models) {
          setAvailableModels(response.models);
        }
      } catch (error) {
        console.warn('Failed to get available models:', error);
      }

      const prefs = await UserPreferencesService.getPreferences();
      if (prefs.ollamaModel) {
        setSelectedModel(prefs.ollamaModel);
      }
    };
    loadPreferences();
  }, []);

  // Add CSS animation for pulse if not already defined
  React.useEffect(() => {
    const styleId = 'segmented-timeline-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Reset to first segment when session changes, or adjust if index is out of bounds
  useEffect(() => {
    if (segments.length > 0) {
      if (activeSegmentIndex >= segments.length) {
        setActiveSegmentIndex(segments.length - 1);
      }
    } else {
      setActiveSegmentIndex(0);
    }
  }, [segments.length]);

  // Reset to latest segment when session changes
  useEffect(() => {
    if (segments.length > 0) {
      setActiveSegmentIndex(segments.length - 1);
      // Disable transition briefly to prevent animation on session change
      setIsInitialLoad(true);
      setTimeout(() => setIsInitialLoad(false), 50);
    }
    // Clear segment summaries when session changes
    setSegmentSummaries({});
    // Reset view mode to timeline
    setViewMode('timeline');
  }, [session.sessionId]);

  if (segments.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '32px 0',
          color: theme.colors.textSecondary,
        }}
      >
        <p>No activity recorded for this session</p>
      </div>
    );
  }

  const activeSegment = segments[activeSegmentIndex] || segments[0];

  // Helper to format duration
  const formatDuration = (start: number, end: number | null) => {
    const duration = (end || Date.now()) - start;
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Helper to get segment summary
  const getSegmentSummary = (segment: any) => {
    // Filter out stop events for counting
    const nonStopEvents = segment.events.filter((e: any) => e.type !== 'stop');

    const fileCount = new Set(
      nonStopEvents
        .filter((e: any) => e.type === 'file-read' || e.type === 'file-write')
        .map((e: any) => e.data.file),
    ).size;

    const toolCount = nonStopEvents.filter(
      (e: any) => e.type === 'tool',
    ).length;
    const webCount = nonStopEvents.filter((e: any) => e.type === 'web').length;

    return { fileCount, toolCount, webCount };
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Carousel Header with Segment Cards */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
          padding: '12px 16px',
        }}
      >
        {/* Segment Navigation */}
        <div style={{ position: 'relative' }}>
          {/* Segment Cards Carousel */}
          <div
            style={{ overflow: 'hidden', position: 'relative', height: '96px' }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                transition: isInitialLoad ? 'none' : 'transform 0.3s',
                position: 'absolute',
                left: '50%',
                top: 0,
                transform: `translateX(calc(-104px - ${activeSegmentIndex * 216}px))`,
              }}
            >
              {segments.map((segment, index) => {
                const summary = getSegmentSummary(segment);
                const isActive = index === activeSegmentIndex;
                const isCurrent = !segment.endTime;

                return (
                  <button
                    key={segment.segmentNumber}
                    onClick={() => {
                      setIsInitialLoad(false);
                      setActiveSegmentIndex(index);
                    }}
                    style={{
                      flexShrink: 0,
                      width: '208px',
                      height: '96px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
                      backgroundColor: isActive
                        ? theme.colors.backgroundTertiary
                        : `${theme.colors.backgroundTertiary}80`,
                      boxShadow: isActive
                        ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        : 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                        e.currentTarget.style.borderColor =
                          theme.colors.backgroundHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = `${theme.colors.backgroundTertiary}80`;
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
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
                            fontSize: '12px',
                            fontWeight: 500,
                            color: theme.colors.text,
                          }}
                        >
                          Segment {segment.segmentNumber}
                        </span>
                        {isCurrent && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              color: theme.colors.success,
                            }}
                          >
                            <span
                              style={{
                                position: 'relative',
                                display: 'flex',
                                height: '8px',
                                width: '8px',
                              }}
                            >
                              <span
                                style={{
                                  animation:
                                    'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                                  position: 'absolute',
                                  display: 'inline-flex',
                                  height: '100%',
                                  width: '100%',
                                  borderRadius: '50%',
                                  backgroundColor: theme.colors.success,
                                  opacity: 0.75,
                                }}
                              />
                              <span
                                style={{
                                  position: 'relative',
                                  display: 'inline-flex',
                                  borderRadius: '50%',
                                  height: '8px',
                                  width: '8px',
                                  backgroundColor: theme.colors.success,
                                }}
                              />
                            </span>
                            Working
                          </span>
                        )}
                      </div>
                      {index === activeSegmentIndex && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '4px',
                            marginLeft: '8px',
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewMode('timeline');
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor:
                                viewMode === 'timeline'
                                  ? theme.colors.primary
                                  : 'transparent',
                              color:
                                viewMode === 'timeline'
                                  ? '#FFFFFF'
                                  : theme.colors.textSecondary,
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s',
                            }}
                            title="View timeline"
                          >
                            <List size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewMode('summary');
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor:
                                viewMode === 'summary'
                                  ? theme.colors.primary
                                  : 'transparent',
                              color:
                                viewMode === 'summary'
                                  ? '#FFFFFF'
                                  : theme.colors.textSecondary,
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s',
                            }}
                            title="View summary"
                          >
                            <SummaryIcon size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                        marginBottom: '8px',
                      }}
                    >
                      {new Date(segment.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {segment.endTime
                        ? new Date(segment.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Now'}
                      <span
                        style={{
                          marginLeft: '4px',
                          color: theme.colors.textTertiary,
                        }}
                      >
                        ({formatDuration(segment.startTime, segment.endTime)})
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '12px',
                      }}
                    >
                      {summary.fileCount > 0 && (
                        <span
                          style={{
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <FileText size={14} /> {summary.fileCount}
                        </span>
                      )}
                      {summary.toolCount > 0 && (
                        <span
                          style={{
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Wrench size={14} /> {summary.toolCount}
                        </span>
                      )}
                      {summary.webCount > 0 && (
                        <span
                          style={{
                            color: theme.colors.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Globe size={14} /> {summary.webCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Previous Button - Overlaid */}
          {segments.length > 1 && (
            <button
              onClick={() =>
                setActiveSegmentIndex(Math.max(0, activeSegmentIndex - 1))
              }
              disabled={activeSegmentIndex === 0}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '64px',
                height: '96px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'all 0.2s',
                color:
                  activeSegmentIndex === 0
                    ? theme.colors.textMuted
                    : theme.colors.textSecondary,
                cursor: activeSegmentIndex === 0 ? 'not-allowed' : 'pointer',
                background:
                  activeSegmentIndex === 0
                    ? `linear-gradient(to right, ${theme.colors.backgroundSecondary}cc, transparent)`
                    : `linear-gradient(to right, ${theme.colors.backgroundSecondary}99, transparent)`,
                border: 'none',
              }}
              onMouseEnter={(e) => {
                if (activeSegmentIndex !== 0) {
                  e.currentTarget.style.color = theme.colors.text;
                  e.currentTarget.style.background = `linear-gradient(to right, ${theme.colors.backgroundSecondary}cc, transparent)`;
                }
              }}
              onMouseLeave={(e) => {
                if (activeSegmentIndex !== 0) {
                  e.currentTarget.style.color = theme.colors.textSecondary;
                  e.currentTarget.style.background = `linear-gradient(to right, ${theme.colors.backgroundSecondary}99, transparent)`;
                }
              }}
            >
              <svg
                style={{ width: '20px', height: '20px' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Next Button - Overlaid */}
          {segments.length > 1 && (
            <button
              onClick={() =>
                setActiveSegmentIndex(
                  Math.min(segments.length - 1, activeSegmentIndex + 1),
                )
              }
              disabled={activeSegmentIndex === segments.length - 1}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '64px',
                height: '96px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'all 0.2s',
                color:
                  activeSegmentIndex === segments.length - 1
                    ? theme.colors.textMuted
                    : theme.colors.textSecondary,
                cursor:
                  activeSegmentIndex === segments.length - 1
                    ? 'not-allowed'
                    : 'pointer',
                background:
                  activeSegmentIndex === segments.length - 1
                    ? `linear-gradient(to left, ${theme.colors.backgroundSecondary}cc, transparent)`
                    : `linear-gradient(to left, ${theme.colors.backgroundSecondary}99, transparent)`,
                border: 'none',
              }}
              onMouseEnter={(e) => {
                if (activeSegmentIndex !== segments.length - 1) {
                  e.currentTarget.style.color = theme.colors.text;
                  e.currentTarget.style.background = `linear-gradient(to left, ${theme.colors.backgroundSecondary}cc, transparent)`;
                }
              }}
              onMouseLeave={(e) => {
                if (activeSegmentIndex !== segments.length - 1) {
                  e.currentTarget.style.color = theme.colors.textSecondary;
                  e.currentTarget.style.background = `linear-gradient(to left, ${theme.colors.backgroundSecondary}99, transparent)`;
                }
              }}
            >
              <svg
                style={{ width: '20px', height: '20px' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Active Segment Timeline or Summary */}
      {viewMode === 'timeline' ? (
        <ActiveSegmentTimeline
          activeSegment={activeSegment}
          session={session}
          newEventIds={newEventIds}
        />
      ) : (
        <SegmentSummary
          key={`segment-summary-${activeSegment?.segmentNumber}-${session.sessionId}`}
          segment={activeSegment}
          session={session}
          segmentSummary={
            segmentSummaries[`segment-${activeSegment?.segmentNumber}`]
          }
          onSummaryGenerated={(summary) => {
            if (activeSegment) {
              setSegmentSummaries((prev) => ({
                ...prev,
                [`segment-${activeSegment.segmentNumber}`]: summary,
              }));
            }
          }}
          onRegenerateSummary={() => {
            if (activeSegment) {
              // Clear the existing summary to trigger regeneration
              setSegmentSummaries((prev) => {
                const newSummaries = { ...prev };
                delete newSummaries[`segment-${activeSegment.segmentNumber}`];
                return newSummaries;
              });
            }
          }}
          selectedModel={selectedModel}
          availableModels={availableModels}
        />
      )}
    </div>
  );
};
