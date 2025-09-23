import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { ArrowRight, Play, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import {
  RepoNormalizedUniversalAgentSessionEvent,
  SupportedAgent,
} from '@principal-ai/agent-monitoring';
// Type alias for backward compatibility
type NormalizedAgentSessionEvent = RepoNormalizedUniversalAgentSessionEvent;

interface EventProcessingTestViewProps {
  onClose?: () => void;
  initialEvent?: NormalizedAgentSessionEvent;
}

export const EventProcessingTestView: React.FC<
  EventProcessingTestViewProps
> = ({ onClose, initialEvent }) => {
  const { theme } = useTheme();
  const [rawEventText, setRawEventText] = useState<string>(
    initialEvent?.raw ? JSON.stringify(initialEvent.raw, null, 2) : '',
  );
  const [selectedAgent, setSelectedAgent] = useState<SupportedAgent>(
    initialEvent?.provider || SupportedAgent.CLAUDE,
  );
  const [processedEvent, setProcessedEvent] =
    useState<NormalizedAgentSessionEvent | null>(initialEvent || null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'raw' | 'processed' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sample raw events for quick testing
  const sampleEvents = {
    [SupportedAgent.CLAUDE]: {
      name: 'Claude Read Event',
      event: JSON.stringify(
        {
          type: 'pre-tool-use',
          sessionId: 'test-session-123',
          workingDirectory: '/Users/test/project',
          timestamp: Date.now(),
          tool: 'Read',
          input: {
            file_path: '/Users/test/project/src/index.ts',
            limit: 100,
          },
        },
        null,
        2,
      ),
    },
    [SupportedAgent.CLINE]: {
      name: 'Cline Tool Event',
      event: JSON.stringify(
        {
          type: 'tool_use',
          sessionId: 'cline-test-789',
          workingDirectory: '/Users/test/project',
          timestamp: Date.now(),
          tool: 'str_replace_editor',
          input: {
            command: 'view',
            path: '/Users/test/project/src/index.ts',
          },
        },
        null,
        2,
      ),
    },
  };

  const processEvent = async () => {
    setIsProcessing(true);
    setProcessingError(null);
    setProcessedEvent(null);

    try {
      // Parse the raw event
      let rawEvent;
      try {
        rawEvent = JSON.parse(rawEventText);
      } catch (e) {
        throw new Error('Invalid JSON: ' + e.message);
      }

      // Call the main process to process this event
      // Using testDebug API - this is a debug/test utility
      const result = await window.mainProcess.testDebug.processEvent(
        selectedAgent,
        rawEvent,
      );

      if (result.success) {
        setProcessedEvent(result.data);
      } else {
        setProcessingError(result.error || 'Failed to process event');
      }
    } catch (error) {
      setProcessingError(error.message || 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, type: 'raw' | 'processed') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const loadSampleEvent = () => {
    const sample = sampleEvents[selectedAgent];
    if (sample) {
      setRawEventText(sample.event);
      setProcessedEvent(null);
      setProcessingError(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '1600px',
          height: '90%',
          backgroundColor: theme.colors.background,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Play size={20} color="#10b981" />
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              Event Processing Test
            </h2>
            {initialEvent && (
              <span
                style={{
                  fontSize: '12px',
                  color: '#10b981',
                  padding: '2px 8px',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '4px',
                  marginLeft: '8px',
                }}
              >
                Testing Event #{initialEvent.eventType}
              </span>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                backgroundColor: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Close
            </button>
          )}
        </div>

        {/* Controls */}
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            backgroundColor: theme.colors.backgroundSecondary,
          }}
        >
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value as SupportedAgent)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value={SupportedAgent.CLAUDE}>Claude</option>
            <option value={SupportedAgent.CLINE}>Cline</option>
            <option value={SupportedAgent.OPENCODE}>OpenCode</option>
          </select>

          <button
            onClick={loadSampleEvent}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.backgroundTertiary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: theme.colors.text,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Load Sample Event
          </button>

          <button
            onClick={processEvent}
            disabled={!rawEventText || isProcessing}
            style={{
              padding: '8px 16px',
              backgroundColor: isProcessing
                ? theme.colors.backgroundTertiary
                : '#10b981',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: !rawEventText || isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: !rawEventText || isProcessing ? 0.5 : 1,
            }}
          >
            <Play size={14} />
            {isProcessing ? 'Processing...' : 'Process Event'}
          </button>

          {processingError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#ef4444',
                fontSize: '12px',
              }}
            >
              <AlertCircle size={14} />
              {processingError}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '16px',
            padding: '16px',
            overflow: 'hidden',
          }}
        >
          {/* Raw Event Side */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}
              >
                Raw Event (Input)
              </h3>
              <button
                onClick={() => copyToClipboard(rawEventText, 'raw')}
                disabled={!rawEventText}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color:
                    copied === 'raw' ? '#10b981' : theme.colors.textSecondary,
                  cursor: rawEventText ? 'pointer' : 'not-allowed',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copied === 'raw' ? (
                  <CheckCircle size={12} />
                ) : (
                  <Copy size={12} />
                )}
                {copied === 'raw' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              value={rawEventText}
              onChange={(e) => setRawEventText(e.target.value)}
              placeholder={
                initialEvent
                  ? 'Raw event loaded from session'
                  : 'Paste or type raw event JSON here...'
              }
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text,
                fontFamily: 'monospace',
                fontSize: '12px',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>

          {/* Arrow */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 8px',
            }}
          >
            <ArrowRight size={24} color={theme.colors.textSecondary} />
          </div>

          {/* Processed Event Side */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                }}
              >
                Normalized Event (Output)
              </h3>
              <button
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(processedEvent, null, 2),
                    'processed',
                  )
                }
                disabled={!processedEvent}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color:
                    copied === 'processed'
                      ? '#10b981'
                      : theme.colors.textSecondary,
                  cursor: processedEvent ? 'pointer' : 'not-allowed',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {copied === 'processed' ? (
                  <CheckCircle size={12} />
                ) : (
                  <Copy size={12} />
                )}
                {copied === 'processed' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: theme.colors.backgroundTertiary,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                overflowY: 'auto',
              }}
            >
              {processedEvent ? (
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: theme.colors.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(processedEvent, null, 2)}
                </pre>
              ) : (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: '13px',
                    textAlign: 'center',
                    marginTop: '20px',
                  }}
                >
                  {rawEventText
                    ? 'Click "Process Event" to see normalized output'
                    : 'Enter a raw event and click "Process Event"'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Path Information (if available) */}
        {processedEvent?.files && processedEvent.files.length > 0 && (
          <div
            style={{
              padding: '16px',
              borderTop: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
            <h4
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.colors.text,
                marginBottom: '8px',
              }}
            >
              Extracted Paths
            </h4>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              {processedEvent.files && processedEvent.files.length > 0 && (
                <div>
                  <span style={{ color: theme.colors.textSecondary }}>
                    Primary:{' '}
                  </span>
                  <span style={{ color: '#7c3aed' }}>
                    {processedEvent.files[0].displayPath ||
                      '[path not normalized]'}
                  </span>
                </div>
              )}
              {processedEvent.files && processedEvent.files.length > 1 && (
                <div>
                  <span style={{ color: theme.colors.textSecondary }}>
                    Secondary:{' '}
                  </span>
                  <span style={{ color: '#7c3aed' }}>
                    {processedEvent.files.length - 1} files
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
