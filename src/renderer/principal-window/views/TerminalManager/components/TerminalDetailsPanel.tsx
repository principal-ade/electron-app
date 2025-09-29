import React from 'react';
import { Terminal, ExternalLink, Folder, Clock, Cpu, AlertCircle } from 'lucide-react';
import type { Theme } from 'themed-markdown';
import { TerminalInfo } from '../../../../../shared/main-process-api-interfaces/TerminalService';
import TerminalPanel from '../../../../components/Terminal/TerminalPanel';

interface TerminalDetailsPanelProps {
  terminal: TerminalInfo | null;
  hasWindow: boolean;
  onPopOut: (sessionId: string) => void;
  formatTime: (timestamp: number) => string;
  theme: Theme;
}

export const TerminalDetailsPanel: React.FC<TerminalDetailsPanelProps> = ({
  terminal,
  hasWindow,
  onPopOut,
  formatTime,
  theme
}) => {
  if (!terminal) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.colors.textSecondary,
        padding: '20px',
      }}>
        <Terminal size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
        <div style={{ fontSize: theme.fontSizes[2], marginBottom: '8px' }}>
          Select a Terminal Session
        </div>
        <div style={{
          fontSize: theme.fontSizes[1],
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          Choose a terminal session from the list to view it here, or open it in a separate window.
        </div>
      </div>
    );
  }

  const getDirectoryName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || 'Unknown';
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundSecondary,
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'start',
          justifyContent: 'space-between',
        }}>
          <div style={{ flex: 1 }}>
            {/* Title */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                backgroundColor: theme.colors.primary + '20',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Terminal size={20} style={{ color: theme.colors.primary }} />
              </div>

              <div>
                <h2 style={{
                  fontSize: theme.fontSizes[3],
                  fontWeight: 600,
                  color: theme.colors.text,
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  {getDirectoryName(terminal.directory)}
                  {terminal.agentSessionId && (
                    <span style={{
                      backgroundColor: theme.colors.primary + '20',
                      color: theme.colors.primary,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: theme.fontSizes[0],
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <Cpu size={10} />
                      AI Session
                    </span>
                  )}
                </h2>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  marginTop: '2px',
                }}>
                  <Folder size={12} />
                  {terminal.directory}
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div style={{
              display: 'flex',
              gap: '16px',
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                Created {formatTime(terminal.createdAt)}
              </div>
              {hasWindow && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: theme.colors.success,
                }}>
                  <AlertCircle size={12} />
                  Window Open
                </div>
              )}
            </div>

            {/* Session ID */}
            <div style={{
              marginTop: '8px',
              fontSize: theme.fontSizes[0],
              color: theme.colors.textTertiary,
              fontFamily: 'monospace',
              padding: '4px 8px',
              backgroundColor: theme.colors.background,
              borderRadius: '4px',
              display: 'inline-block',
            }}>
              Session: {terminal.id}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={() => onPopOut(terminal.id)}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary,
              color: theme.colors.background,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: theme.fontSizes[1],
              fontWeight: 500,
              transition: 'opacity 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            <ExternalLink size={14} />
            {hasWindow ? 'Focus Window' : 'Pop Out'}
          </button>
        </div>
      </div>

      {/* Terminal Viewer */}
      <div style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        position: 'relative',
        minHeight: 0,
      }}>
        <TerminalPanel
          directory={terminal.directory}
          terminalId={terminal.id}
          agentSessionId={terminal.agentSessionId}
          hideHeader={true}
          isVisible={true}
          autoFocus={false}
        />
      </div>
    </div>
  );
};