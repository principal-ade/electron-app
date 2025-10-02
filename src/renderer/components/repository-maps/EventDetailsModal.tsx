import { useTheme } from '@a24z/industry-theme';
import { X, Copy, CheckCircle } from 'lucide-react';
import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';

interface EventDetailsModalProps {
  event: RepoNormalizedUniversalAgentSessionEvent | null;
  rawEvent?: any;
  isOpen: boolean;
  onClose: () => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  event,
  rawEvent,
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();
  const [copiedSide, setCopiedSide] = React.useState<
    'normalized' | 'raw' | null
  >(null);

  if (!isOpen || !event) return null;

  const copyToClipboard = (data: any, side: 'normalized' | 'raw') => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedSide(side);
    setTimeout(() => setCopiedSide(null), 2000);
  };

  const formatJson = (data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          width: '90%',
          maxWidth: '1200px',
          height: '80%',
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
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.colors.text,
              margin: 0,
            }}
          >
            Event Details: {event.eventType}{' '}
            {event.toolName && `- ${event.toolName}`}
          </h2>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1px',
            backgroundColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          {/* Normalized Event */}
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: theme.colors.background,
                borderBottom: `1px solid ${theme.colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
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
                Normalized Event
              </h3>
              <button
                onClick={() => copyToClipboard(event, 'normalized')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '4px',
                  color: theme.colors.text,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundHover;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                {copiedSide === 'normalized' ? (
                  <>
                    <CheckCircle size={12} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: theme.colors.text,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {formatJson(event)}
              </pre>
            </div>
          </div>

          {/* Raw Event */}
          <div
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: theme.colors.background,
                borderBottom: `1px solid ${theme.colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
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
                Raw Event
              </h3>
              {rawEvent && (
                <button
                  onClick={() => copyToClipboard(rawEvent, 'raw')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.text,
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundHover;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      theme.colors.backgroundTertiary;
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  {copiedSide === 'raw' ? (
                    <>
                      <CheckCircle size={12} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px',
              }}
            >
              {rawEvent ? (
                <pre
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: theme.colors.text,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {formatJson(rawEvent)}
                </pre>
              ) : (
                <div
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: '13px',
                    textAlign: 'center',
                    marginTop: '40px',
                  }}
                >
                  Raw event data not available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with metadata */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: `1px solid ${theme.colors.border}`,
            display: 'flex',
            gap: '24px',
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}
        >
          <div>
            <strong>Timestamp:</strong>{' '}
            {new Date(event.timestamp).toLocaleString()}
          </div>
          {event.sessionId && (
            <div>
              <strong>Session ID:</strong> {event.sessionId.substring(0, 12)}...
            </div>
          )}
          {event.workingDirectory && (
            <div>
              <strong>Working Dir:</strong> {event.workingDirectory}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
