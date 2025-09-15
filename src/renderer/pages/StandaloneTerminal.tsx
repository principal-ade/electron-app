import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from 'themed-markdown';

import TerminalPanel from '../components/Terminal/TerminalPanel';
import { TerminalService } from '../main-process-api/TerminalService';
import { AgentSessionService } from '../main-process-api/AgentSessionService';
import { TerminalInfo } from '../../shared/main-process-api-interfaces/TerminalService';

interface AgentSessionInfo {
  sessionId: string;
  metadata?: {
    customName?: string;
  };
}

export const StandaloneTerminal: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { theme } = useTheme();
  const [terminalInfo, setTerminalInfo] = useState<TerminalInfo | null>(null);
  const [aiSession, setAiSession] = useState<AgentSessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    const loadTerminalInfo = async () => {
      try {
        setLoading(true);

        // Get list of terminals and find the one matching our session ID
        const terminals = await TerminalService.list();
        const terminal = terminals?.find((t) => t.id === sessionId);

        if (!terminal) {
          throw new Error(`Terminal session ${sessionId} not found`);
        }

        setTerminalInfo(terminal);

        // If there's an associated AI session, get its info
        if (terminal.agentSessionId && terminal.directory) {
          try {
            const session = await AgentSessionService.getSession(
              terminal.directory,
              terminal.agentSessionId,
            );
            if (session) {
              setAiSession({
                sessionId: session.sessionId,
                metadata: session.metadata,
              });
            }
          } catch (aiError) {
            console.warn('Failed to load AI session info:', aiError);
            // Don't fail the whole component if AI session loading fails
          }
        }
      } catch (err) {
        console.error('Failed to load terminal info:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load terminal',
        );
      } finally {
        setLoading(false);
      }
    };

    loadTerminalInfo();
  }, [sessionId]);

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
            Loading terminal...
          </div>
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
            Session: {sessionId?.slice(0, 8)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !terminalInfo) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '16px',
              marginBottom: '8px',
              color: theme.colors.error,
            }}
          >
            {error || 'Terminal not found'}
          </div>
          <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
            Session: {sessionId?.slice(0, 8)}
          </div>
          <button
            onClick={() => window.close()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: theme.colors.backgroundSecondary,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* AI Session Header (if associated) */}
      {aiSession && (
        <div
          style={{
            padding: '8px 16px',
            borderBottom: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.backgroundSecondary,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
          </svg>
          <span
            style={{
              fontSize: '13px',
              color: theme.colors.text,
              fontWeight: '500',
            }}
          >
            AI Session:{' '}
            {aiSession.metadata?.customName || aiSession.sessionId.slice(0, 8)}
          </span>
        </div>
      )}

      {/* Terminal Panel */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <TerminalPanel
          directory={terminalInfo.directory}
          terminalId={sessionId}
          onClose={() => window.close()}
          className="h-full"
          agentSessionId={terminalInfo.agentSessionId}
        />
      </div>
    </div>
  );
};
