import React, { useState, useEffect, memo } from 'react';
import { useTheme } from 'themed-markdown';
import { SupportedLLMProvider } from '../../../shared/main-process-api-interfaces/LLMModelsAPI';
import { Sparkles, Loader2 } from 'lucide-react';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';
// SessionSummaryService has been removed - using local types
type SessionSummary = {
  title: string;
  keyPoints: string[];
  provider: SupportedLLMProvider;
  modelUsed: string;
  totalTokens?: number;
  generatedAt: number;
};

import { formatDuration } from './SessionSummaryOverlay/utils';

interface SegmentSummaryProps {
  segment: any; // The active segment data
  session: AgentSessionRecord;
  segmentSummary?: SessionSummary | null; // Pre-stored summary if available
  onSummaryGenerated?: (summary: SessionSummary) => void; // Callback when summary is generated
  onRegenerateSummary?: () => void; // Callback to clear and regenerate summary
  selectedModel?: string;
  availableModels?: string[];
}

const SegmentSummaryComponent: React.FC<SegmentSummaryProps> = ({
  segment,
  session,
  segmentSummary,
  onSummaryGenerated,
  onRegenerateSummary,
  selectedModel = '',
  availableModels = [],
}) => {
  const { theme } = useTheme();
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(
    segmentSummary || null,
  );
  const [error, setError] = useState<string | null>(null);
  const [modelToUse, setModelToUse] = useState<string>(selectedModel);

  // Reset summary when segment changes or segmentSummary prop changes
  useEffect(() => {
    setSummary(segmentSummary || null);
    setError(null);
  }, [segment?.segmentNumber, segmentSummary]);

  useEffect(() => {
    setModelToUse(selectedModel);
  }, [selectedModel]);

  // Add CSS animation for spinner
  useEffect(() => {
    const styleId = 'segment-summary-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Extract segment information
  const extractSegmentInfo = () => {
    if (!segment || !segment.events) {
      return {
        modifiedFiles: [],
        filesAccessed: [],
        toolsUsed: [],
        totalEvents: 0,
        duration: 0,
      };
    }

    const modifiedFiles = new Map<string, any>();
    const filesAccessed = new Set<string>();
    const toolsUsed = new Set<string>();

    // Process events in the segment
    segment.events.forEach((event: any) => {
      if (event.type === 'file-read') {
        filesAccessed.add(event.data.file);
      } else if (event.type === 'file-write') {
        filesAccessed.add(event.data.file);
        modifiedFiles.set(event.data.file, {
          path: event.data.file,
          changeType:
            event.data.write?.operation === 'create'
              ? 'created'
              : event.data.write?.operation === 'delete'
                ? 'deleted'
                : 'modified',
          additions: undefined,
          deletions: undefined,
        });
      } else if (event.type === 'tool') {
        toolsUsed.add(event.data.toolName);
      } else if (event.type === 'grouped') {
        // Handle grouped events
        event.data.events.forEach((subEvent: any) => {
          if (subEvent.type === 'file-read' || subEvent.type === 'file-write') {
            filesAccessed.add(subEvent.data.file || event.data.filePath);
            if (subEvent.type === 'file-write') {
              modifiedFiles.set(subEvent.data.file || event.data.filePath, {
                path: subEvent.data.file || event.data.filePath,
                changeType: 'modified',
                additions: undefined,
                deletions: undefined,
              });
            }
          } else if (subEvent.type === 'tool') {
            toolsUsed.add(subEvent.data.toolName);
          }
        });
      }
    });

    const duration = segment.endTime
      ? segment.endTime - segment.startTime
      : Date.now() - segment.startTime;

    return {
      modifiedFiles: Array.from(modifiedFiles.values()),
      filesAccessed: Array.from(filesAccessed),
      toolsUsed: Array.from(toolsUsed),
      totalEvents: segment.events.filter((e: any) => e.type !== 'stop').length,
      duration,
    };
  };

  const generateSegmentSummary = async () => {
    if (!segment || !session) return;

    setIsGenerating(true);
    setError(null);

    try {
      const segmentInfo = extractSegmentInfo();
      const repoName =
        session.basicGitInfo?.githubRepo ||
        session.basicGitInfo?.gitRoot?.split('/').pop() ||
        'Current Repository';

      // Create a work session for this segment
      const segmentWorkSession = {
        id: `${session.sessionId}-segment-${segment.segmentNumber}`,
        startTime: segment.startTime,
        endTime: segment.endTime || Date.now(),
        modifiedFiles: segmentInfo.modifiedFiles,
        description: `Segment ${segment.segmentNumber} of development session (${formatDuration(segment.startTime, segment.endTime || Date.now())} duration, ${segmentInfo.totalEvents} events, tools used: ${segmentInfo.toolsUsed.join(', ') || 'none'})`,
        associatedLayers: {
          validationLayers: [],
          viewLayers: [],
          scaffoldLayers: [],
        },
      };

      // SessionSummaryService removed - placeholder implementation
      const result: SessionSummary = {
        title: 'Summary unavailable',
        keyPoints: ['Session summary service has been removed'],
        provider: SupportedLLMProvider.OLLAMA,
        modelUsed: 'N/A',
        generatedAt: Date.now(),
      };

      // Original call was: sessionSummaryService.generateSessionSummary(...)
      // Now using placeholder implementation
      setSummary(result);
      onSummaryGenerated?.(result);
    } catch (error) {
      console.error('Error generating segment summary:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to generate summary',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {isGenerating ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <Loader2
            size={48}
            style={{
              animation: 'spin 1s linear infinite',
              color: theme.colors.primary,
            }}
          />
          <div
            style={{
              fontSize: '16px',
              color: theme.colors.textSecondary,
            }}
          >
            Generating segment summary...
          </div>
        </div>
      ) : summary ? (
        <div
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              padding: '8px 16px',
              borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
            <button
              onClick={() => {
                setSummary(null);
                setError(null);
                onRegenerateSummary?.();
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: theme.colors.backgroundTertiary,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundTertiary;
              }}
            >
              <Sparkles size={14} />
              Regenerate
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div
              style={{
                padding: '20px',
                color: theme.colors.text,
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '14px',
              }}
            >
              {summary.markdownContent}
            </div>
          </div>
        </div>
      ) : error ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '16px',
            padding: '40px',
          }}
        >
          <div
            style={{
              color: theme.colors.danger,
              fontSize: '16px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
          <button
            onClick={generateSegmentSummary}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '24px',
            padding: '40px',
          }}
        >
          <Sparkles
            size={64}
            style={{
              color: theme.colors.primary,
              opacity: 0.3,
            }}
          />
          <div
            style={{
              textAlign: 'center',
              maxWidth: '400px',
            }}
          >
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '12px',
              }}
            >
              Segment Summary
            </h3>
            <p
              style={{
                fontSize: '14px',
                color: theme.colors.textSecondary,
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              Generate a summary of the work done in Segment{' '}
              {segment?.segmentNumber || 'N/A'}.
            </p>
            {modelToUse && availableModels.includes(modelToUse) && (
              <button
                onClick={generateSegmentSummary}
                style={{
                  padding: '12px 24px',
                  backgroundColor: theme.colors.primary,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={16} />
                Generate Summary
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SegmentSummary = memo(SegmentSummaryComponent);
