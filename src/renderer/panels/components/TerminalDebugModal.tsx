import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Terminal,
  AlertCircle,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { TerminalService } from '../../main-process-api/TerminalService';

interface TerminalSessionInfo {
  id: string;
  directory: string;
  agentSessionId?: string;
  createdAt: number;
  lastActivity: number;
}

interface TerminalDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string;
  tabs?: Array<{
    id: string;
    label: string;
    sessionId?: string;
    command?: string;
  }>;
}

export const TerminalDebugModal: React.FC<TerminalDebugModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  tabs = [],
}) => {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<TerminalSessionInfo[]>([]);
  const [sessionsByRepo, setSessionsByRepo] = useState<Map<string, string>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [cleaningUp, setCleaningUp] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const sessionList = await TerminalService.list();
      setSessions(sessionList);

      // Try to infer repo associations from directories
      const repoMap = new Map<string, string>();
      sessionList.forEach((session) => {
        repoMap.set(session.directory, session.id);
      });
      setSessionsByRepo(repoMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      console.error('Failed to fetch terminal sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, refreshCount]);

  const getOrphanedSessions = () => {
    return sessions.filter((session) => {
      const hasUITab = tabs.some((t) => t.sessionId === session.id);
      return !hasUITab;
    });
  };

  const cleanupOrphanedSessions = async () => {
    setCleaningUp(true);
    setError(null);

    const orphaned = getOrphanedSessions();
    console.info(
      '[TerminalDebug] Cleaning up',
      orphaned.length,
      'orphaned sessions',
    );

    try {
      for (const session of orphaned) {
        console.info('[TerminalDebug] Destroying session:', session.id);
        await TerminalService.destroy(session.id);
      }

      // Refresh the list after cleanup
      setRefreshCount((c) => c + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to cleanup sessions',
      );
      console.error('Failed to cleanup orphaned sessions:', err);
    } finally {
      setCleaningUp(false);
    }
  };

  const destroySession = async (sessionId: string) => {
    try {
      console.info('[TerminalDebug] Destroying individual session:', sessionId);
      await TerminalService.destroy(sessionId);
      setRefreshCount((c) => c + 1);
    } catch (err) {
      console.error('Failed to destroy session:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to destroy session',
      );
    }
  };

  if (!isOpen) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatDuration = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
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
        zIndex: 10000,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: `1px solid ${theme.colors.border}`,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Terminal size={20} />
            Terminal Debug Information
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {getOrphanedSessions().length > 0 && (
              <button
                onClick={cleanupOrphanedSessions}
                disabled={cleaningUp}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  backgroundColor: theme.colors.error + '22',
                  border: `1px solid ${theme.colors.error}`,
                  borderRadius: '4px',
                  color: theme.colors.error,
                  cursor: cleaningUp ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  opacity: cleaningUp ? 0.5 : 1,
                }}
                title="Clean up all orphaned sessions"
              >
                <Trash2 size={14} />
                Clean {getOrphanedSessions().length} Orphaned
              </button>
            )}
            <button
              onClick={() => setRefreshCount((c) => c + 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.text,
                cursor: 'pointer',
              }}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {/* Current State */}
          <div
            style={{
              marginBottom: '24px',
              padding: '12px',
              backgroundColor: theme.colors.backgroundSecondary,
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              Current State
            </h3>

            <div
              style={{ fontSize: '12px', color: theme.colors.textSecondary }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong>Active Session ID:</strong>{' '}
                <code
                  style={{
                    padding: '2px 4px',
                    backgroundColor: theme.colors.backgroundTertiary,
                    borderRadius: '3px',
                    fontFamily: 'monospace',
                  }}
                >
                  {currentSessionId || 'none'}
                </code>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Total Sessions:</strong> {sessions.length} / 10 max
              </div>
              <div>
                <strong>UI Tabs:</strong> {tabs.length} tabs
                {tabs.length > 0 && (
                  <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                    {tabs.map((tab) => (
                      <li key={tab.id} style={{ marginBottom: '4px' }}>
                        {tab.label} - Tab ID: {tab.id}
                        {tab.sessionId && (
                          <>
                            {' → Session: '}
                            <code
                              style={{
                                padding: '2px 4px',
                                backgroundColor:
                                  theme.colors.backgroundTertiary,
                                borderRadius: '3px',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                              }}
                            >
                              {tab.sessionId.substring(0, 8)}...
                            </code>
                          </>
                        )}
                        {tab.command && (
                          <span style={{ color: theme.colors.primary }}>
                            {' '}
                            (cmd: {tab.command})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Active Sessions */}
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              Active Terminal Sessions (Backend)
            </h3>

            {loading ? (
              <div
                style={{ color: theme.colors.textSecondary, fontSize: '12px' }}
              >
                Loading sessions...
              </div>
            ) : error ? (
              <div
                style={{
                  color: theme.colors.error,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={14} />
                {error}
              </div>
            ) : sessions.length === 0 ? (
              <div
                style={{ color: theme.colors.textTertiary, fontSize: '12px' }}
              >
                No active terminal sessions
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {sessions.map((session) => {
                  const isCurrentSession = session.id === currentSessionId;
                  const hasUITab = tabs.some((t) => t.sessionId === session.id);

                  return (
                    <div
                      key={session.id}
                      style={{
                        padding: '12px',
                        backgroundColor: isCurrentSession
                          ? theme.colors.primary + '11'
                          : theme.colors.backgroundSecondary,
                        border: `1px solid ${
                          isCurrentSession
                            ? theme.colors.primary
                            : theme.colors.border
                        }`,
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                        }}
                      >
                        <code
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: theme.colors.text,
                          }}
                        >
                          {session.id}
                        </code>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {isCurrentSession && (
                            <span
                              style={{
                                padding: '2px 6px',
                                backgroundColor: theme.colors.primary,
                                color: '#fff',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                              }}
                            >
                              CURRENT
                            </span>
                          )}
                          {hasUITab ? (
                            <span
                              style={{
                                padding: '2px 6px',
                                backgroundColor: theme.colors.success + '22',
                                color: theme.colors.success,
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <CheckCircle size={10} />
                              HAS TAB
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 6px',
                                backgroundColor: theme.colors.warning + '22',
                                color: theme.colors.warning,
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                              }}
                            >
                              ORPHANED
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ color: theme.colors.textSecondary }}>
                        <div>
                          <strong>Directory:</strong> {session.directory}
                        </div>
                        <div>
                          <strong>Created:</strong>{' '}
                          {formatTime(session.createdAt)} (
                          {formatDuration(session.createdAt)})
                        </div>
                        <div>
                          <strong>Last Activity:</strong>{' '}
                          {formatTime(session.lastActivity)} (
                          {formatDuration(session.lastActivity)})
                        </div>
                        {session.agentSessionId && (
                          <div>
                            <strong>Agent Session:</strong>{' '}
                            {session.agentSessionId}
                          </div>
                        )}
                      </div>

                      {!hasUITab && (
                        <div
                          style={{
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px',
                            backgroundColor: theme.colors.warning + '11',
                            borderRadius: '4px',
                            fontSize: '11px',
                          }}
                        >
                          <span style={{ color: theme.colors.warning }}>
                            ⚠️ This session exists in backend but has no UI tab
                            - potential leak
                          </span>
                          <button
                            onClick={() => destroySession(session.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              backgroundColor: theme.colors.error,
                              color: '#fff',
                              border: 'none',
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Destroy this session"
                          >
                            <Trash2 size={12} />
                            DESTROY
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Repository Session Map */}
          <div>
            <h3
              style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: 600,
                color: theme.colors.text,
              }}
            >
              Repository → Session Mapping
            </h3>

            {sessionsByRepo.size === 0 ? (
              <div
                style={{ color: theme.colors.textTertiary, fontSize: '12px' }}
              >
                No repository mappings found
              </div>
            ) : (
              <div
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  padding: '12px',
                  backgroundColor: theme.colors.backgroundSecondary,
                  borderRadius: '6px',
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                {Array.from(sessionsByRepo.entries()).map(
                  ([repo, sessionId]) => (
                    <div key={repo} style={{ marginBottom: '4px' }}>
                      <span style={{ color: theme.colors.textSecondary }}>
                        {repo}
                      </span>
                      {' → '}
                      <span style={{ color: theme.colors.primary }}>
                        {sessionId.substring(0, 8)}...
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px',
            borderTop: `1px solid ${theme.colors.border}`,
            fontSize: '12px',
            color: theme.colors.textSecondary,
          }}
        >
          <strong>Debug Tips:</strong>
          <ul style={{ margin: '4px 0 0 0', padding: '0 0 0 20px' }}>
            <li>Sessions should be destroyed when tabs close</li>
            <li>Maximum 10 concurrent sessions allowed</li>
            <li>Orphaned sessions indicate a cleanup issue</li>
            <li>Sessions persist across view switches but UI tabs may not</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
